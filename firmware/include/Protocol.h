#pragma once

#include <Arduino.h>

namespace hil {

constexpr uint8_t SYNC_0 = 0xAA;
constexpr uint8_t SYNC_1 = 0xBB;
constexpr size_t MAX_PAYLOAD = 255;
constexpr size_t MAX_BLOCK_SAMPLES = 60;  // RESULT: 4 + 4*N deve caber em len u8.

enum class MessageType : uint8_t {
  Samples = 0x01,
  Params = 0x02,
  Result = 0x03,
  Status = 0x04,
  PingReset = 0x05,
};

struct Frame {
  MessageType type = MessageType::PingReset;
  uint16_t seq = 0;
  uint8_t len = 0;
  uint8_t payload[MAX_PAYLOAD]{};
};

uint8_t crc8Update(uint8_t crc, uint8_t value);
uint8_t crc8(const uint8_t* data, size_t length);

class FrameParser {
 public:
  bool feed(uint8_t byte, Frame& completed);
  void reset();
  uint32_t crcErrors() const { return crcErrors_; }
  uint32_t discardedBytes() const { return discardedBytes_; }

 private:
  enum class State : uint8_t { Sync0, Sync1, Type, SeqLo, SeqHi, Len, Payload, Crc };
  State state_ = State::Sync0;
  Frame current_{};
  uint8_t payloadIndex_ = 0;
  uint8_t runningCrc_ = 0;
  uint32_t crcErrors_ = 0;
  uint32_t discardedBytes_ = 0;
};

void writeU16LE(uint8_t* destination, uint16_t value);
void writeU32LE(uint8_t* destination, uint32_t value);
void writeFloatLE(uint8_t* destination, float value);
uint32_t readU32LE(const uint8_t* source);
float readFloatLE(const uint8_t* source);
void sendFrame(HardwareSerial& serial, MessageType type, uint16_t seq, const uint8_t* payload, uint8_t len);

}  // namespace hil
