#pragma once

#include <Arduino.h>

namespace hil {

template <typename T, size_t Capacity>
class RingBuffer {
 public:
  static_assert(Capacity >= 2, "Ring buffer muito pequeno.");

  bool pushFromTask(const T& item) {
    portENTER_CRITICAL(&mux_);
    const bool result = pushUnsafe(item);
    portEXIT_CRITICAL(&mux_);
    return result;
  }

  bool IRAM_ATTR pushFromIsr(const T& item) {
    portENTER_CRITICAL_ISR(&mux_);
    const bool result = pushUnsafe(item);
    portEXIT_CRITICAL_ISR(&mux_);
    return result;
  }

  bool popFromTask(T& item) {
    portENTER_CRITICAL(&mux_);
    const bool result = popUnsafe(item);
    portEXIT_CRITICAL(&mux_);
    return result;
  }

  bool IRAM_ATTR popFromIsr(T& item) {
    portENTER_CRITICAL_ISR(&mux_);
    const bool result = popUnsafe(item);
    portEXIT_CRITICAL_ISR(&mux_);
    return result;
  }

  size_t size() const {
    portENTER_CRITICAL(&mux_);
    const size_t result = sizeUnsafe();
    portEXIT_CRITICAL(&mux_);
    return result;
  }

  size_t IRAM_ATTR sizeFromIsr() const {
    portENTER_CRITICAL_ISR(&mux_);
    const size_t result = sizeUnsafe();
    portEXIT_CRITICAL_ISR(&mux_);
    return result;
  }

  void clear() {
    portENTER_CRITICAL(&mux_);
    head_ = tail_ = 0;
    portEXIT_CRITICAL(&mux_);
  }

 private:
  bool IRAM_ATTR pushUnsafe(const T& item) {
    const size_t next = (head_ + 1U) % Capacity;
    if (next == tail_) return false;
    data_[head_] = item;
    head_ = next;
    return true;
  }

  bool IRAM_ATTR popUnsafe(T& item) {
    if (tail_ == head_) return false;
    item = data_[tail_];
    tail_ = (tail_ + 1U) % Capacity;
    return true;
  }

  size_t IRAM_ATTR sizeUnsafe() const {
    return head_ >= tail_ ? head_ - tail_ : Capacity - tail_ + head_;
  }

  T data_[Capacity]{};
  volatile size_t head_ = 0;
  volatile size_t tail_ = 0;
  mutable portMUX_TYPE mux_ = portMUX_INITIALIZER_UNLOCKED;
};

}  // namespace hil
