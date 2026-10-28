export const SYNC_0 = 0xAA
export const SYNC_1 = 0xBB
export const MAX_PAYLOAD = 255

export enum MessageType {
  SAMPLES = 0x01,
  PARAMS = 0x02,
  RESULT = 0x03,
  STATUS = 0x04,
  PING_RESET = 0x05,
}

export interface ProtocolFrame {
  type: MessageType
  seq: number
  payload: Uint8Array
}

export interface TargetResult {
  seq: number
  timestampUs: number
  samples: Float32Array
}

export interface TargetStatus {
  maxJitterUs: number
  meanJitterUs: number
  isrOverruns: number
  fifoUnderruns: number
  fifoOverflows: number
  crcErrors: number
  discardedBytes: number
  stable: boolean
  inputEmpty: boolean
  outputFull: boolean
}

// CRC-8/ATM: polinômio 0x07, valor inicial 0x00, sem reflexão ou XOR final.
// O CRC cobre tipo, seq, len e payload; os dois bytes de sincronismo ficam fora.
export function crc8(data: ArrayLike<number>, start = 0, end = data.length): number {
  let crc = 0
  for (let i = start; i < end; i += 1) {
    crc ^= data[i]
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF
    }
  }
  return crc
}

export function encodeFrame(type: MessageType, seq: number, payload = new Uint8Array()): Uint8Array {
  if (payload.byteLength > MAX_PAYLOAD) throw new RangeError('Payload excede 255 bytes.')
  const frame = new Uint8Array(7 + payload.byteLength)
  const view = new DataView(frame.buffer)
  frame[0] = SYNC_0
  frame[1] = SYNC_1
  frame[2] = type
  view.setUint16(3, seq & 0xFFFF, true)
  frame[5] = payload.byteLength
  frame.set(payload, 6)
  frame[frame.length - 1] = crc8(frame, 2, frame.length - 1)
  return frame
}

export function encodeSamples(seq: number, samples: ArrayLike<number>): Uint8Array {
  if (samples.length < 1 || samples.length > 63) throw new RangeError('O bloco deve conter de 1 a 63 amostras.')
  const payload = new Uint8Array(samples.length * 4)
  const view = new DataView(payload.buffer)
  for (let i = 0; i < samples.length; i += 1) view.setFloat32(i * 4, samples[i], true)
  return encodeFrame(MessageType.SAMPLES, seq, payload)
}

export function encodeParams(seq: number, m: number, c: number, k: number): Uint8Array {
  const payload = new Uint8Array(12)
  const view = new DataView(payload.buffer)
  view.setFloat32(0, m, true)
  view.setFloat32(4, c, true)
  view.setFloat32(8, k, true)
  return encodeFrame(MessageType.PARAMS, seq, payload)
}

export function encodePing(seq: number, reset = false): Uint8Array {
  return encodeFrame(MessageType.PING_RESET, seq, Uint8Array.of(reset ? 1 : 0))
}

export function decodeFloat32Payload(payload: Uint8Array): Float32Array {
  if (payload.byteLength % 4 !== 0) throw new RangeError('Payload de floats possui tamanho inválido.')
  const result = new Float32Array(payload.byteLength / 4)
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  for (let i = 0; i < result.length; i += 1) result[i] = view.getFloat32(i * 4, true)
  return result
}

export function decodeResult(frame: ProtocolFrame): TargetResult {
  if (frame.type !== MessageType.RESULT || frame.payload.byteLength < 8 || (frame.payload.byteLength - 4) % 4 !== 0) {
    throw new RangeError('Quadro RESULT inválido.')
  }
  const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength)
  return {
    seq: frame.seq,
    timestampUs: view.getUint32(0, true),
    samples: decodeFloat32Payload(frame.payload.subarray(4)),
  }
}

export function decodeStatus(frame: ProtocolFrame): TargetStatus {
  if (frame.type !== MessageType.STATUS || frame.payload.byteLength !== 29) throw new RangeError('Quadro STATUS inválido.')
  const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength)
  const flags = view.getUint8(28)
  return {
    maxJitterUs: view.getFloat32(0, true),
    meanJitterUs: view.getFloat32(4, true),
    isrOverruns: view.getUint32(8, true),
    fifoUnderruns: view.getUint32(12, true),
    fifoOverflows: view.getUint32(16, true),
    crcErrors: view.getUint32(20, true),
    discardedBytes: view.getUint32(24, true),
    stable: (flags & 0x01) !== 0,
    inputEmpty: (flags & 0x02) !== 0,
    outputFull: (flags & 0x04) !== 0,
  }
}

export class FrameParser {
  private bytes: number[] = []

  readonly stats = {
    frames: 0,
    invalidCrc: 0,
    discardedBytes: 0,
  }

  reset(): void {
    this.bytes.length = 0
  }

  push(chunk: Uint8Array): ProtocolFrame[] {
    for (let i = 0; i < chunk.length; i += 1) this.bytes.push(chunk[i])
    const frames: ProtocolFrame[] = []

    while (this.bytes.length >= 2) {
      let syncIndex = -1
      for (let i = 0; i < this.bytes.length - 1; i += 1) {
        if (this.bytes[i] === SYNC_0 && this.bytes[i + 1] === SYNC_1) { syncIndex = i; break }
      }

      if (syncIndex < 0) {
        const keepLastAA = this.bytes[this.bytes.length - 1] === SYNC_0
        const discard = this.bytes.length - (keepLastAA ? 1 : 0)
        this.bytes.splice(0, discard)
        this.stats.discardedBytes += discard
        break
      }

      if (syncIndex > 0) {
        this.bytes.splice(0, syncIndex)
        this.stats.discardedBytes += syncIndex
      }
      if (this.bytes.length < 7) break

      const payloadLength = this.bytes[5]
      const frameLength = 7 + payloadLength
      if (this.bytes.length < frameLength) break

      const expectedCrc = this.bytes[frameLength - 1]
      const actualCrc = crc8(this.bytes, 2, frameLength - 1)
      if (expectedCrc !== actualCrc) {
        this.bytes.shift()
        this.stats.invalidCrc += 1
        this.stats.discardedBytes += 1
        continue
      }

      const seq = this.bytes[3] | (this.bytes[4] << 8)
      const payload = Uint8Array.from(this.bytes.slice(6, 6 + payloadLength))
      frames.push({ type: this.bytes[2] as MessageType, seq, payload })
      this.bytes.splice(0, frameLength)
      this.stats.frames += 1
    }
    return frames
  }
}
