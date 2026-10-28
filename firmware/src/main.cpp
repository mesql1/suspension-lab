#include <Arduino.h>
#include <esp_timer.h>

#include "Dsp.h"
#include "Protocol.h"
#include "RingBuffer.h"

namespace {

constexpr uint32_t SAMPLE_RATE_HZ = 1000;
constexpr uint32_t SAMPLE_PERIOD_US = 1000000UL / SAMPLE_RATE_HZ;
constexpr size_t JITTER_BUFFER_SAMPLES = 32;
constexpr size_t FIFO_CAPACITY = 512;
constexpr gpio_num_t TIMING_PIN = GPIO_NUM_2;

struct SampleItem {
  float value = 0;
  uint16_t seq = 0;
  uint8_t index = 0;
  uint8_t count = 0;
  uint32_t timestampUs = 0;
};

hil::RingBuffer<SampleItem, FIFO_CAPACITY> inputFifo;
hil::RingBuffer<SampleItem, FIFO_CAPACITY> outputFifo;
hil::FrameParser parser;

hil::BiquadCoefficients coefficientBanks[2];
volatile uint8_t activeCoefficientBank = 0;
volatile int8_t pendingCoefficientBank = -1;
portMUX_TYPE coefficientMux = portMUX_INITIALIZER_UNLOCKED;
hil::Df2TState filterState;

hw_timer_t* sampleTimer = nullptr;
volatile bool dspStarted = false;
volatile bool filterStable = true;
volatile bool outputFullSticky = false;
volatile uint32_t fifoUnderruns = 0;
volatile uint32_t fifoOverflows = 0;
volatile uint32_t isrOverruns = 0;
volatile uint32_t jitterMaxUs = 0;
volatile uint64_t jitterSumUs = 0;
volatile uint32_t jitterSamples = 0;
volatile uint32_t lastIsrTimestampUs = 0;
float lastInput = 0.0F;

void IRAM_ATTR onSampleTimer() {
  const uint32_t startUs = static_cast<uint32_t>(esp_timer_get_time());
  gpio_set_level(TIMING_PIN, 1);

  if (lastIsrTimestampUs != 0) {
    const uint32_t interval = startUs - lastIsrTimestampUs;
    const uint32_t jitter = interval > SAMPLE_PERIOD_US ? interval - SAMPLE_PERIOD_US : SAMPLE_PERIOD_US - interval;
    if (jitter > jitterMaxUs) jitterMaxUs = jitter;
    jitterSumUs += jitter;
    ++jitterSamples;
  }
  lastIsrTimestampUs = startUs;

  portENTER_CRITICAL_ISR(&coefficientMux);
  if (pendingCoefficientBank >= 0) {
    activeCoefficientBank = static_cast<uint8_t>(pendingCoefficientBank);
    pendingCoefficientBank = -1;
  }
  const uint8_t bank = activeCoefficientBank;
  portEXIT_CRITICAL_ISR(&coefficientMux);

  if (!dspStarted) {
    if (inputFifo.sizeFromIsr() >= JITTER_BUFFER_SAMPLES) dspStarted = true;
    else {
      gpio_set_level(TIMING_PIN, 0);
      return;
    }
  }

  SampleItem input;
  if (!inputFifo.popFromIsr(input)) {
    ++fifoUnderruns;
    hil::processDf2T(lastInput, coefficientBanks[bank], filterState);
  } else {
    lastInput = input.value;
    SampleItem output = input;
    output.value = static_cast<float>(hil::processDf2T(input.value, coefficientBanks[bank], filterState));
    output.timestampUs = startUs;
    if (!outputFifo.pushFromIsr(output)) {
      ++fifoOverflows;
      outputFullSticky = true;
    }
  }

  const uint32_t elapsed = static_cast<uint32_t>(esp_timer_get_time()) - startUs;
  if (elapsed >= SAMPLE_PERIOD_US) ++isrOverruns;
  gpio_set_level(TIMING_PIN, 0);
}

void publishCoefficients(float m, float c, float k) {
  if (!hil::parametersValid(m, c, k)) {
    filterStable = false;
    return;
  }
  const uint8_t inactive = activeCoefficientBank ^ 1U;
  hil::BiquadCoefficients candidate;
  if (!hil::generateCoefficients(m, c, k, SAMPLE_RATE_HZ, candidate)) {
    filterStable = false;
    return;
  }
  coefficientBanks[inactive] = candidate;
  portENTER_CRITICAL(&coefficientMux);
  pendingCoefficientBank = static_cast<int8_t>(inactive);
  filterStable = true;
  portEXIT_CRITICAL(&coefficientMux);
}

void resetRuntime() {
  noInterrupts();
  filterState = {};
  lastInput = 0;
  dspStarted = false;
  fifoUnderruns = fifoOverflows = isrOverruns = 0;
  jitterMaxUs = jitterSamples = 0;
  jitterSumUs = 0;
  lastIsrTimestampUs = 0;
  interrupts();
  inputFifo.clear();
  outputFifo.clear();
}

void handleSamples(const hil::Frame& frame) {
  if (frame.len == 0 || frame.len % 4 != 0) return;
  const uint8_t count = frame.len / 4;
  if (count > hil::MAX_BLOCK_SAMPLES) return;
  for (uint8_t i = 0; i < count; ++i) {
    SampleItem item;
    item.value = hil::readFloatLE(frame.payload + i * 4);
    item.seq = frame.seq;
    item.index = i;
    item.count = count;
    if (!isfinite(item.value) || !inputFifo.pushFromTask(item)) {
      ++fifoOverflows;
      break;
    }
  }
}

void handleFrame(const hil::Frame& frame) {
  switch (frame.type) {
    case hil::MessageType::Samples:
      handleSamples(frame);
      break;
    case hil::MessageType::Params:
      if (frame.len == 12) publishCoefficients(
          hil::readFloatLE(frame.payload),
          hil::readFloatLE(frame.payload + 4),
          hil::readFloatLE(frame.payload + 8));
      break;
    case hil::MessageType::PingReset:
      if (frame.len > 0 && frame.payload[0] == 1) resetRuntime();
      hil::sendFrame(Serial, hil::MessageType::PingReset, frame.seq, frame.payload, frame.len);
      break;
    default:
      break;
  }
}

struct ResultAssembler {
  uint16_t seq = 0;
  uint8_t count = 0;
  uint64_t receivedMask = 0;
  uint32_t timestampUs = 0;
  float samples[hil::MAX_BLOCK_SAMPLES]{};
};

ResultAssembler result;

void drainOutputFifo() {
  SampleItem item;
  while (outputFifo.popFromTask(item)) {
    if (result.count == 0 || result.seq != item.seq || result.count != item.count) {
      result = {};
      result.seq = item.seq;
      result.count = item.count;
    }
    if (item.index >= result.count || item.index >= hil::MAX_BLOCK_SAMPLES) continue;
    result.samples[item.index] = item.value;
    result.receivedMask |= 1ULL << item.index;
    if (item.index == 0) result.timestampUs = item.timestampUs;
    const uint64_t expected = result.count == 64 ? UINT64_MAX : ((1ULL << result.count) - 1ULL);
    if (result.receivedMask == expected) {
      uint8_t payload[4 + 4 * hil::MAX_BLOCK_SAMPLES];
      hil::writeU32LE(payload, result.timestampUs);
      for (uint8_t i = 0; i < result.count; ++i) hil::writeFloatLE(payload + 4 + i * 4, result.samples[i]);
      hil::sendFrame(Serial, hil::MessageType::Result, result.seq, payload, 4 + 4 * result.count);
      result = {};
    }
  }
}

void sendStatus(uint16_t seq) {
  uint32_t maxJitter;
  uint64_t sumJitter;
  uint32_t samples;
  noInterrupts();
  maxJitter = jitterMaxUs;
  sumJitter = jitterSumUs;
  samples = jitterSamples;
  jitterMaxUs = 0;
  jitterSumUs = 0;
  jitterSamples = 0;
  interrupts();

  uint8_t payload[29]{};
  hil::writeFloatLE(payload, static_cast<float>(maxJitter));
  hil::writeFloatLE(payload + 4, samples ? static_cast<float>(sumJitter) / samples : 0.0F);
  hil::writeU32LE(payload + 8, isrOverruns);
  hil::writeU32LE(payload + 12, fifoUnderruns);
  hil::writeU32LE(payload + 16, fifoOverflows);
  hil::writeU32LE(payload + 20, parser.crcErrors());
  hil::writeU32LE(payload + 24, parser.discardedBytes());
  uint8_t flags = filterStable ? 0x01 : 0x00;
  if (inputFifo.size() == 0) flags |= 0x02;
  if (outputFullSticky) flags |= 0x04;
  payload[28] = flags;
  outputFullSticky = false;
  hil::sendFrame(Serial, hil::MessageType::Status, seq, payload, sizeof(payload));
}

void communicationTask(void*) {
  hil::Frame frame;
  uint32_t lastStatusMs = 0;
  uint16_t statusSeq = 0;
  for (;;) {
    while (Serial.available() > 0) {
      if (parser.feed(static_cast<uint8_t>(Serial.read()), frame)) handleFrame(frame);
    }
    drainOutputFifo();
    const uint32_t now = millis();
    if (now - lastStatusMs >= 1000) {
      lastStatusMs = now;
      sendStatus(statusSeq++);
    }
    vTaskDelay(pdMS_TO_TICKS(1));
  }
}

}  // namespace

void setup() {
  Serial.begin(HIL_BAUD);
  Serial.setRxBufferSize(4096);
  Serial.setTxBufferSize(4096);
  pinMode(TIMING_PIN, OUTPUT);
  digitalWrite(TIMING_PIN, LOW);

  hil::generateCoefficients(340.0, 3200.0, 32000.0, SAMPLE_RATE_HZ, coefficientBanks[0]);
  coefficientBanks[1] = coefficientBanks[0];

  xTaskCreatePinnedToCore(communicationTask, "hil-uart", 6144, nullptr, 3, nullptr, 0);

  // Arduino-ESP32 2.x: APB 80 MHz / prescaler 80 = tick de 1 us.
  sampleTimer = timerBegin(0, 80, true);
  timerAttachInterrupt(sampleTimer, &onSampleTimer, true);
  timerAlarmWrite(sampleTimer, SAMPLE_PERIOD_US, true);
  timerAlarmEnable(sampleTimer);
}

void loop() {
  // setup()/loop() rodam no Core 1. O trabalho periódico ocorre no timer ISR;
  // a comunicação permanece isolada na tarefa fixada ao Core 0.
  vTaskDelay(pdMS_TO_TICKS(1000));
}
