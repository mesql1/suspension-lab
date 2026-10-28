export class RingBuffer {
  constructor(size) {
    this.data = new Float64Array(size)
    this.size = size
    this.index = 0
    this.count = 0
  }

  push(value) {
    this.data[this.index] = value
    this.index = (this.index + 1) % this.size
    if (this.count < this.size) this.count += 1
  }

  getDelayed(delaySamples) {
    if (this.count === 0) return 0
    const delay = Math.max(0, Math.min(Math.floor(delaySamples), this.count - 1))
    const i = (this.index - 1 - delay + this.size) % this.size
    return this.data[i]
  }

  copyLatest(target) {
    const length = Math.min(target.length, this.count)
    const start = (this.index - length + this.size) % this.size
    for (let i = 0; i < length; i += 1) target[target.length - length + i] = this.data[(start + i) % this.size]
    return target
  }
}
