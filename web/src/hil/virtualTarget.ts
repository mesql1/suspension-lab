import { criarEstadoFiltro, gerarCoeficientes, processarAmostra } from '../dsp/biquad'
import {
  FrameParser,
  MessageType,
  decodeFloat32Payload,
  encodeFrame,
  type ProtocolFrame,
} from './protocol'
import type { SerialState } from './serial'

/**
 * Emulador do firmware ESP32. Ele recebe e devolve exatamente os mesmos
 * quadros do protocolo HIL, mas executa o target dentro do navegador.
 */
export class VirtualHilTarget {
  private readonly inputParser = new FrameParser()
  private readonly outputParser = new FrameParser()
  private filterState = criarEstadoFiltro()
  private coefficients = gerarCoeficientes(340, 3200, 32000, 1000)
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private startedAt = performance.now()

  state: SerialState = 'disconnected'
  onFrame: (frame: ProtocolFrame) => void = () => {}
  onStateChange: (state: SerialState, message?: string) => void = () => {}

  get parserStats() {
    return this.outputParser.stats
  }

  async connect(): Promise<void> {
    if (this.state === 'connected') return
    this.state = 'connected'
    this.startedAt = performance.now()
    this.onStateChange('connected', 'ESP32 virtual ativo; nenhum hardware é necessário.')
    this.scheduleStatus()
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.state !== 'connected') throw new Error('Target virtual desconectado.')
    for (const frame of this.inputParser.push(data)) this.handleFrame(frame)
  }

  async disconnect(notify = true): Promise<void> {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    this.inputParser.reset()
    this.outputParser.reset()
    this.state = 'disconnected'
    if (notify) this.onStateChange('disconnected', 'ESP32 virtual pausado.')
  }

  private handleFrame(frame: ProtocolFrame) {
    if (frame.type === MessageType.PARAMS) this.applyParams(frame)
    else if (frame.type === MessageType.SAMPLES) this.processBlock(frame)
    else if (frame.type === MessageType.PING_RESET) {
      if (frame.payload[0] === 1) this.filterState = criarEstadoFiltro()
      this.emitLater(encodeFrame(MessageType.PING_RESET, frame.seq, frame.payload), 1.5)
    }
  }

  private applyParams(frame: ProtocolFrame) {
    if (frame.payload.byteLength !== 12) return
    const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength)
    try {
      this.coefficients = gerarCoeficientes(
        view.getFloat32(0, true),
        view.getFloat32(4, true),
        view.getFloat32(8, true),
        1000,
      )
    } catch {
      // O firmware real também mantém o último conjunto válido.
    }
  }

  private processBlock(frame: ProtocolFrame) {
    const input = decodeFloat32Payload(frame.payload)
    const payload = new Uint8Array(4 + input.length * 4)
    const view = new DataView(payload.buffer)
    view.setUint32(0, Math.max(0, Math.round((performance.now() - this.startedAt) * 1000)), true)
    for (let i = 0; i < input.length; i += 1) {
      view.setFloat32(4 + i * 4, processarAmostra(input[i], this.coefficients, this.filterState), true)
    }

    // Latência USB/serial plausível apenas para visualização; não representa hardware medido.
    this.emitLater(encodeFrame(MessageType.RESULT, frame.seq, payload), 2.5)
  }

  private scheduleStatus() {
    if (this.state !== 'connected') return
    const payload = new Uint8Array(29)
    const view = new DataView(payload.buffer)
    view.setUint8(28, this.coefficients.stable ? 0x01 : 0)
    this.emitBytes(encodeFrame(MessageType.STATUS, 0, payload))
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      this.scheduleStatus()
    }, 500)
    this.timers.add(timer)
  }

  private emitLater(data: Uint8Array, delayMs: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      if (this.state === 'connected') this.emitBytes(data)
    }, delayMs)
    this.timers.add(timer)
  }

  private emitBytes(data: Uint8Array) {
    // Fragmenta a resposta para exercitar o parser incremental como uma serial real.
    const split = Math.max(1, Math.floor(data.length / 2))
    for (const frame of this.outputParser.push(data.subarray(0, split))) this.onFrame(frame)
    for (const frame of this.outputParser.push(data.subarray(split))) this.onFrame(frame)
  }
}
