import { describe, expect, it } from 'vitest'
import {
  FrameParser,
  MessageType,
  crc8,
  decodeFloat32Payload,
  decodeResult,
  decodeStatus,
  encodeFrame,
  encodeParams,
  encodeSamples,
} from './protocol'

describe('protocolo HIL', () => {
  it('codifica em little-endian e recupera um bloco fragmentado', () => {
    const encoded = encodeSamples(0x1234, [0.25, -0.5, 1.75, 0])
    expect(encoded[0]).toBe(0xAA)
    expect(encoded[1]).toBe(0xBB)
    expect(encoded[3]).toBe(0x34)
    expect(encoded[4]).toBe(0x12)

    const parser = new FrameParser()
    expect(parser.push(encoded.subarray(0, 3))).toEqual([])
    expect(parser.push(encoded.subarray(3, 9))).toEqual([])
    const frames = parser.push(encoded.subarray(9))
    expect(frames).toHaveLength(1)
    expect(frames[0].seq).toBe(0x1234)
    expect(Array.from(decodeFloat32Payload(frames[0].payload))).toEqual([0.25, -0.5, 1.75, 0])
  })

  it('descarta um quadro corrompido e ressincroniza no próximo header', () => {
    const bad = encodeSamples(1, [1, 2])
    bad[7] ^= 0x40
    const good = encodeSamples(2, [3, 4])
    const stream = new Uint8Array(3 + bad.length + good.length)
    stream.set([0x10, 0xAA, 0x00])
    stream.set(bad, 3)
    stream.set(good, 3 + bad.length)
    const parser = new FrameParser()
    const frames = parser.push(stream)
    expect(frames).toHaveLength(1)
    expect(frames[0].seq).toBe(2)
    expect(parser.stats.invalidCrc).toBe(1)
    expect(parser.stats.discardedBytes).toBeGreaterThan(0)
  })

  it('mantém um 0xAA isolado para completar o header no próximo fragmento', () => {
    const frame = encodeFrame(MessageType.PING_RESET, 7, Uint8Array.of(0))
    const parser = new FrameParser()
    expect(parser.push(Uint8Array.of(0x99, 0xAA))).toEqual([])
    const frames = parser.push(frame.subarray(1))
    expect(frames).toHaveLength(1)
    expect(frames[0].type).toBe(MessageType.PING_RESET)
  })

  it('codifica m, c e k como três float32 little-endian', () => {
    const frame = encodeParams(9, 340, 3200, 32000)
    const parser = new FrameParser()
    const [decoded] = parser.push(frame)
    expect(Array.from(decodeFloat32Payload(decoded.payload))).toEqual([340, 3200, 32000])
    expect(frame[frame.length - 1]).toBe(crc8(frame, 2, frame.length - 1))
  })

  it('decodifica timestamp e amostras de RESULT', () => {
    const payload = new Uint8Array(12)
    const view = new DataView(payload.buffer)
    view.setUint32(0, 123456, true)
    view.setFloat32(4, 0.125, true)
    view.setFloat32(8, -0.25, true)
    const result = decodeResult({ type: MessageType.RESULT, seq: 33, payload })
    expect(result.seq).toBe(33)
    expect(result.timestampUs).toBe(123456)
    expect(Array.from(result.samples)).toEqual([0.125, -0.25])
  })

  it('decodifica telemetria e flags de STATUS', () => {
    const payload = new Uint8Array(29)
    const view = new DataView(payload.buffer)
    view.setFloat32(0, 12.5, true)
    view.setFloat32(4, 1.25, true)
    view.setUint32(8, 2, true)
    view.setUint32(12, 3, true)
    view.setUint32(16, 4, true)
    view.setUint32(20, 5, true)
    view.setUint32(24, 6, true)
    view.setUint8(28, 0x05)
    const status = decodeStatus({ type: MessageType.STATUS, seq: 1, payload })
    expect(status).toMatchObject({
      maxJitterUs: 12.5,
      meanJitterUs: 1.25,
      isrOverruns: 2,
      fifoUnderruns: 3,
      fifoOverflows: 4,
      crcErrors: 5,
      discardedBytes: 6,
      stable: true,
      inputEmpty: false,
      outputFull: true,
    })
  })
})
