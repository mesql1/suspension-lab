import { criarEstadoFiltro, gerarCoeficientes, processarAmostra } from '../dsp/biquad'
import type { SimulationEngine } from '../simulation/SimulationEngine'
import {
  MessageType,
  decodeResult,
  decodeStatus,
  encodeParams,
  encodePing,
  encodeSamples,
  type ProtocolFrame,
  type TargetStatus,
} from './protocol'
import { HilSerialService, type SerialState } from './serial'

export type HilMode = 'simulation' | 'hil'

export interface HilSnapshot {
  mode: HilMode
  serialState: SerialState
  supported: boolean
  message: string
  blockSize: number
  rttMs: number
  oneWayMs: number
  jitterBufferMs: number
  packetsSent: number
  packetsReceived: number
  packetsLost: number
  packetsReordered: number
  invalidCrc: number
  discardedBytes: number
  maxJitterUs: number
  meanJitterUs: number
  isrOverruns: number
  fifoUnderruns: number
  fifoOverflows: number
  targetCrcErrors: number
  stable: boolean
  errorRms: number
  errorMax: number
}

interface PendingBlock {
  x: Float32Array
  reference: Float64Array
  sentAt: number
}

const INITIAL_STATUS: TargetStatus = {
  maxJitterUs: 0,
  meanJitterUs: 0,
  isrOverruns: 0,
  fifoUnderruns: 0,
  fifoOverflows: 0,
  crcErrors: 0,
  discardedBytes: 0,
  stable: true,
  inputEmpty: true,
  outputFull: false,
}

export class HilController {
  private readonly serial = new HilSerialService()
  private readonly listeners = new Set<() => void>()
  private readonly pending = new Map<number, PendingBlock>()
  private readonly referenceState = criarEstadoFiltro()
  private referenceCoefficients
  private block = new Float32Array(16)
  private blockReference = new Float64Array(16)
  private blockIndex = 0
  private sequence = 0
  private lastResultSequence: number | null = null
  private paramsSequence = 0
  private paramsTimer: ReturnType<typeof setTimeout> | null = null
  private pingSentAt = new Map<number, number>()
  private targetStatus: TargetStatus = INITIAL_STATUS
  private errorHistory = new Float64Array(4096)
  private errorIndex = 0
  private errorCount = 0
  private latestMessage = ''
  private packetsSent = 0
  private packetsReceived = 0
  private packetsLost = 0
  private packetsReordered = 0
  private rttMs = 0
  private snapshot: HilSnapshot
  private lastNotifyAt = 0

  mode: HilMode = 'simulation'
  blockSize = 16

  constructor(private readonly engine: SimulationEngine) {
    this.referenceCoefficients = gerarCoeficientes(
      engine.params.m,
      engine.params.c,
      engine.params.k,
      engine.fs,
    )
    this.serial.onFrame = (frame) => this.handleFrame(frame)
    this.serial.onStateChange = (state, message) => this.handleSerialState(state, message)
    this.engine.setSampleSink((sample: number) => this.acceptLogicalSample(sample))
    this.snapshot = this.createSnapshot()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private createSnapshot(): HilSnapshot {
    const error = this.computeErrorMetrics()
    return {
      mode: this.mode,
      serialState: this.serial.state,
      supported: HilSerialService.isSupported(),
      message: this.latestMessage,
      blockSize: this.blockSize,
      rttMs: this.rttMs,
      oneWayMs: this.rttMs * 0.5,
      jitterBufferMs: 32,
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived,
      packetsLost: this.packetsLost,
      packetsReordered: this.packetsReordered,
      invalidCrc: this.serial.parserStats.invalidCrc,
      discardedBytes: this.serial.parserStats.discardedBytes + this.targetStatus.discardedBytes,
      maxJitterUs: this.targetStatus.maxJitterUs,
      meanJitterUs: this.targetStatus.meanJitterUs,
      isrOverruns: this.targetStatus.isrOverruns,
      fifoUnderruns: this.targetStatus.fifoUnderruns,
      fifoOverflows: this.targetStatus.fifoOverflows,
      targetCrcErrors: this.targetStatus.crcErrors,
      stable: this.targetStatus.stable,
      errorRms: error.rms,
      errorMax: error.max,
    }
  }

  private notify(force = false) {
    const now = performance.now()
    if (!force && now - this.lastNotifyAt < 100) return
    this.lastNotifyAt = now
    this.snapshot = this.createSnapshot()
    for (const listener of this.listeners) listener()
  }

  private handleSerialState(state: SerialState, message?: string) {
    if (message) this.latestMessage = message
    if (state === 'error' || state === 'disconnected' || state === 'unsupported') {
      if (this.mode === 'hil') this.fallbackToSimulation('Conexão HIL perdida; DSP local reativado.')
    }
    this.notify(true)
  }

  async enableHil(): Promise<void> {
    if (!HilSerialService.isSupported()) {
      this.latestMessage = 'Web Serial requer Chrome/Edge em HTTPS ou localhost.'
      this.notify(true)
      return
    }
    try {
      await this.serial.connect()
      this.pending.clear()
      this.lastResultSequence = null
      this.blockIndex = 0
      this.mode = 'hil'
      this.engine.setHilMode(true)
      this.latestMessage = 'ESP32 conectado; aguardando jitter buffer.'
      await this.sendParamsNow()
      const pingSeq = this.paramsSequence++ & 0xFFFF
      this.pingSentAt.set(pingSeq, performance.now())
      await this.serial.write(encodePing(pingSeq))
      this.notify(true)
    } catch (error) {
      this.fallbackToSimulation(error instanceof Error ? error.message : 'Falha ao conectar o target.')
    }
  }

  async disconnect(): Promise<void> {
    this.fallbackToSimulation('HIL desconectado pelo usuário.')
    await this.serial.disconnect()
  }

  useSimulation(): void {
    this.fallbackToSimulation('DSP executado localmente no navegador.')
  }

  private fallbackToSimulation(message: string) {
    this.mode = 'simulation'
    this.engine.setHilMode(false)
    this.pending.clear()
    this.blockIndex = 0
    this.latestMessage = message
    this.notify(true)
  }

  setBlockSize(size: number) {
    const next = Math.max(4, Math.min(60, Math.round(size)))
    if (next === this.blockSize) return
    this.blockSize = next
    this.block = new Float32Array(next)
    this.blockReference = new Float64Array(next)
    this.blockIndex = 0
    this.notify(true)
  }

  updateParams(m: number, c: number, k: number) {
    this.referenceCoefficients = gerarCoeficientes(m, c, k, this.engine.fs)
    if (this.paramsTimer) clearTimeout(this.paramsTimer)
    this.paramsTimer = setTimeout(() => { void this.sendParamsNow() }, 120)
  }

  private async sendParamsNow() {
    if (this.serial.state !== 'connected') return
    const { m, c, k } = this.engine.params
    await this.serial.write(encodeParams(this.paramsSequence++ & 0xFFFF, m, c, k))
  }

  private acceptLogicalSample(sample: number) {
    if (this.mode !== 'hil' || this.serial.state !== 'connected') return
    this.block[this.blockIndex] = sample
    this.blockReference[this.blockIndex] = processarAmostra(
      sample,
      this.referenceCoefficients,
      this.referenceState,
    )
    this.blockIndex += 1
    if (this.blockIndex < this.blockSize) return

    const seq = this.sequence++ & 0xFFFF
    const x = Float32Array.from(this.block)
    const reference = Float64Array.from(this.blockReference)
    this.pending.set(seq, { x, reference, sentAt: performance.now() })
    if (this.pending.size > 128) {
      const oldest = this.pending.keys().next().value as number | undefined
      if (oldest !== undefined) { this.pending.delete(oldest); this.packetsLost += 1 }
    }
    this.blockIndex = 0
    this.packetsSent += 1
    void this.serial.write(encodeSamples(seq, x)).catch(() => {
      this.fallbackToSimulation('Falha de escrita serial; DSP local reativado.')
    })
  }

  private handleFrame(frame: ProtocolFrame) {
    try {
      if (frame.type === MessageType.RESULT) this.handleResult(frame)
      else if (frame.type === MessageType.STATUS) this.targetStatus = decodeStatus(frame)
      else if (frame.type === MessageType.PING_RESET) {
        const sent = this.pingSentAt.get(frame.seq)
        if (sent !== undefined) {
          this.rttMs = performance.now() - sent
          this.pingSentAt.delete(frame.seq)
        }
      }
      this.notify(frame.type === MessageType.STATUS)
    } catch {
      this.packetsLost += 1
      this.notify()
    }
  }

  private handleResult(frame: ProtocolFrame) {
    const result = decodeResult(frame)
    const pending = this.pending.get(result.seq)
    if (!pending || pending.x.length !== result.samples.length) {
      this.packetsLost += 1
      return
    }
    this.pending.delete(result.seq)
    this.rttMs = performance.now() - pending.sentAt
    if (this.lastResultSequence !== null) {
      const expected = (this.lastResultSequence + 1) & 0xFFFF
      if (result.seq !== expected) {
        const delta = (result.seq - expected + 0x10000) & 0xFFFF
        if (delta < 0x8000) this.packetsLost += delta
        else this.packetsReordered += 1
      }
    }
    this.lastResultSequence = result.seq
    this.packetsReceived += 1

    for (let i = 0; i < result.samples.length; i += 1) {
      const error = result.samples[i] - pending.reference[i]
      this.errorHistory[this.errorIndex] = error
      this.errorIndex = (this.errorIndex + 1) % this.errorHistory.length
      if (this.errorCount < this.errorHistory.length) this.errorCount += 1
      this.engine.ingestHilSample(pending.x[i], result.samples[i], pending.reference[i])
    }
  }

  private computeErrorMetrics() {
    if (this.errorCount === 0) return { rms: 0, max: 0 }
    let sum = 0
    let max = 0
    for (let i = 0; i < this.errorCount; i += 1) {
      const value = this.errorHistory[i]
      sum += value * value
      max = Math.max(max, Math.abs(value))
    }
    return { rms: Math.sqrt(sum / this.errorCount), max }
  }

  copyErrors(length = 512): Float64Array {
    const target = new Float64Array(length)
    const available = Math.min(length, this.errorCount)
    const start = (this.errorIndex - available + this.errorHistory.length) % this.errorHistory.length
    for (let i = 0; i < available; i += 1) {
      target[length - available + i] = this.errorHistory[(start + i) % this.errorHistory.length]
    }
    return target
  }

  dispose() {
    if (this.paramsTimer) clearTimeout(this.paramsTimer)
    this.engine.setSampleSink(null)
    void this.serial.disconnect(false)
  }
}
