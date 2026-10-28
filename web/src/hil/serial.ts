import { FrameParser, ProtocolFrame } from './protocol'

interface SerialReader {
  read(): Promise<{ value?: Uint8Array; done: boolean }>
  cancel(): Promise<void>
  releaseLock(): void
}

interface SerialWriter {
  write(data: Uint8Array): Promise<void>
  close(): Promise<void>
  releaseLock(): void
}

interface SerialPortLike {
  readable?: { getReader(): SerialReader }
  writable?: { getWriter(): SerialWriter }
  open(options: { baudRate: number; bufferSize: number; flowControl: 'none' }): Promise<void>
  close(): Promise<void>
}

interface SerialNavigator {
  requestPort(options?: { filters?: Array<Record<string, number>> }): Promise<SerialPortLike>
}

export type SerialState = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'error'

export class HilSerialService {
  private port: SerialPortLike | null = null
  private reader: SerialReader | null = null
  private writer: SerialWriter | null = null
  private readTask: Promise<void> | null = null
  private writeQueue: Promise<void> = Promise.resolve()
  private closing = false
  private parser = new FrameParser()

  state: SerialState = HilSerialService.isSupported() ? 'disconnected' : 'unsupported'
  onFrame: (frame: ProtocolFrame) => void = () => {}
  onStateChange: (state: SerialState, message?: string) => void = () => {}

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator && window.isSecureContext
  }

  get parserStats() {
    return this.parser.stats
  }

  private setState(state: SerialState, message?: string) {
    this.state = state
    this.onStateChange(state, message)
  }

  async connect(): Promise<void> {
    if (!HilSerialService.isSupported()) {
      this.setState('unsupported', 'Web Serial requer Chromium em HTTPS ou localhost.')
      throw new Error('Web Serial indisponível.')
    }
    if (this.state === 'connected' || this.state === 'connecting') return
    this.setState('connecting')
    this.closing = false
    this.parser.reset()
    try {
      const serial = (navigator as Navigator & { serial: SerialNavigator }).serial
      // requestPort precisa permanecer nesta chamada, iniciada pelo clique do usuário.
      this.port = await serial.requestPort()
      await this.port.open({ baudRate: 921600, bufferSize: 65536, flowControl: 'none' })
      if (!this.port.readable || !this.port.writable) throw new Error('Porta sem streams de leitura/escrita.')
      this.reader = this.port.readable.getReader()
      this.writer = this.port.writable.getWriter()
      this.setState('connected')
      this.readTask = this.readLoop()
    } catch (error) {
      this.setState('error', error instanceof Error ? error.message : 'Falha ao abrir a porta serial.')
      await this.disconnect(false)
      throw error
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writer || this.state !== 'connected') throw new Error('Serial não conectada.')
    // Encadeamento evita writes simultâneos no WritableStream.
    this.writeQueue = this.writeQueue.then(() => this.writer!.write(data))
    return this.writeQueue
  }

  private async readLoop(): Promise<void> {
    try {
      while (!this.closing && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) break
        if (!value) continue
        const frames = this.parser.push(value)
        for (const frame of frames) this.onFrame(frame)
      }
      if (!this.closing) this.setState('error', 'A conexão serial foi encerrada pelo dispositivo.')
    } catch (error) {
      if (!this.closing) this.setState('error', error instanceof Error ? error.message : 'Erro de leitura serial.')
    } finally {
      if (!this.closing) await this.disconnect(false)
    }
  }

  async disconnect(notify = true): Promise<void> {
    this.closing = true
    try { await this.reader?.cancel() } catch { /* porta já removida */ }
    try { this.reader?.releaseLock() } catch { /* lock já liberado */ }
    this.reader = null
    try { await this.writeQueue } catch { /* write interrompido */ }
    try { await this.writer?.close() } catch { /* dispositivo desconectado */ }
    try { this.writer?.releaseLock() } catch { /* lock já liberado */ }
    this.writer = null
    try { await this.port?.close() } catch { /* porta removida */ }
    this.port = null
    this.readTask = null
    if (notify) this.setState(HilSerialService.isSupported() ? 'disconnected' : 'unsupported')
  }
}
