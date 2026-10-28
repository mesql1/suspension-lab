#include "Protocol.h"

#include <cstring>

namespace hil {

uint8_t crc8Update(uint8_t crc, uint8_t value) {
  crc ^= value;
  for (uint8_t bit = 0; bit < 8; ++bit) {
    crc = (crc & 0x80U) ? static_cast<uint8_t>((crc << 1U) ^ 0x07U)
                        : static_cast<uint8_t>(crc << 1U);
  }
  return crc;
}

uint8_t crc8(const uint8_t* data, size_t length) {
  uint8_t crc = 0;
  for (size_t i = 0; i < length; ++i) crc = crc8Update(crc, data[i]);
  return crc;
}

void FrameParser::reset() {
  state_ = State::Sync0;
  payloadIndex_ = 0;
  runningCrc_ = 0;
}

bool FrameParser::feed(uint8_t byte, Frame& completed) {
  switch (state_) {
    case State::Sync0:
      if (byte == SYNC_0) state_ = State::Sync1;
      else ++discardedBytes_;
      break;
    case State::Sync1:
      if (byte == SYNC_1) state_ = State::Type;
      else {
        ++discardedBytes_;
        state_ = byte == SYNC_0 ? State::Sync1 : State::Sync0;
      }
      break;
    case State::Type:
      current_.type = static_cast<MessageType>(byte);
      runningCrc_ = crc8Update(0, byte);
      state_ = State::SeqLo;
      break;
    case State::SeqLo:
      current_.seq = byte;
      runningCrc_ = crc8Update(runningCrc_, byte);
      state_ = State::SeqHi;
      break;
    case State::SeqHi:
      current_.seq |= static_cast<uint16_t>(byte) << 8U;
      runningCrc_ = crc8Update(runningCrc_, byte);
      state_ = State::Len;
      break;
    case State::Len:
      current_.len = byte;
      payloadIndex_ = 0;
      runningCrc_ = crc8Update(runningCrc_, byte);
      state_ = byte == 0 ? State::Crc : State::Payload;
      break;
    case State::Payload:
      current_.payload[payloadIndex_++] = byte;
      runningCrc_ = crc8Update(runningCrc_, byte);
      if (payloadIndex_ >= current_.len) state_ = State::Crc;
      break;
    case State::Crc: {
      const bool valid = byte == runningCrc_;
      if (valid) completed = current_;
      else ++crcErrors_;
      reset();
      if (!valid && byte == SYNC_0) state_ = State::Sync1;
      return valid;
    }
  }
  return false;
}

void writeU16LE(uint8_t* destination, uint16_t value) {
  destination[0] = static_cast<uint8_t>(value & 0xFFU);
  destination[1] = static_cast<uint8_t>((value >> 8U) & 0xFFU);
}

void writeU32LE(uint8_t* destination, uint32_t value) {
  for (uint8_t i = 0; i < 4; ++i) destination[i] = static_cast<uint8_t>((value >> (8U * i)) & 0xFFU);
}

void writeFloatLE(uint8_t* destination, float value) {
  static_assert(sizeof(float) == 4, "O protocolo requer float IEEE-754 de 32 bits.");
  uint32_t raw;
  memcpy(&raw, &value, sizeof(raw));
  writeU32LE(destination, raw);
}

uint32_t readU32LE(const uint8_t* source) {
  return static_cast<uint32_t>(source[0]) |
         (static_cast<uint32_t>(source[1]) << 8U) |
         (static_cast<uint32_t>(source[2]) << 16U) |
         (static_cast<uint32_t>(source[3]) << 24U);
}

float readFloatLE(const uint8_t* source) {
  const uint32_t raw = readU32LE(source);
  float value;
  memcpy(&value, &raw, sizeof(value));
  return value;
}

void sendFrame(HardwareSerial& serial, MessageType type, uint16_t seq, const uint8_t* payload, uint8_t len) {
  uint8_t prefix[6] = {SYNC_0, SYNC_1, static_cast<uint8_t>(type), 0, 0, len};
  writeU16LE(prefix + 3, seq);
  uint8_t crc = 0;
  for (size_t i = 2; i < sizeof(prefix); ++i) crc = crc8Update(crc, prefix[i]);
  for (uint8_t i = 0; i < len; ++i) crc = crc8Update(crc, payload[i]);
  serial.write(prefix, sizeof(prefix));
  if (len > 0) serial.write(payload, len);
  serial.write(crc);
}

}  // namespace hil
