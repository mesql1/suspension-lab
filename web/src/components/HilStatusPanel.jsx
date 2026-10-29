import { formatFixed, formatNumber } from '../utils/format'

function Metric({ label, value, unit, tone = '' }) {
  return (
    <div className={`hil-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  )
}

export function ModeSelector({ status, onEnableHil, onEnableVirtual, onSimulation, onDisconnect, onBlockSize }) {
  const connected = status.serialState === 'connected'
  const blockProgress = ((status.blockSize - 4) / (60 - 4)) * 100
  return (
    <div className="mode-bar">
      <div className="mode-tabs" aria-label="Modo de processamento">
        <button type="button" className={status.mode === 'simulation' ? 'active' : ''} onClick={onSimulation}>SIMULAÇÃO</button>
        <button type="button" className={status.mode === 'virtual' ? 'active virtual' : ''} onClick={onEnableVirtual}>ESP32 VIRTUAL</button>
        <button type="button" className={status.mode === 'hil' ? 'active hil' : ''} onClick={onEnableHil} disabled={!status.supported}>ESP32 FÍSICO</button>
      </div>
      <div className="mode-actions">
        <label className="block-control"><span>AMOSTRAS POR BLOCO</span><b>{status.blockSize}</b>
          <input aria-label="Amostras por bloco HIL" type="range" min="4" max="60" step="4" value={status.blockSize} onChange={(event) => onBlockSize(Number(event.target.value))} style={{ '--progress': `${blockProgress}%` }} />
          <small><i>4</i><i>60</i></small>
        </label>
        {connected && <button type="button" className="disconnect-button" onClick={onDisconnect}>DESCONECTAR</button>}
      </div>
    </div>
  )
}

function Connection({ status, online, virtual, serialLabel }) {
  return (
    <div className="hil-connection">
      <div className={`device-icon ${online ? 'online' : ''}`}><i /><i /><i /></div>
      <div className="hil-connection-copy">
        <span>ALVO · {virtual ? 'ESP32 VIRTUAL' : 'ESP32 DEVKIT V1'}</span>
        <strong><i className={online ? 'online' : ''} /> {serialLabel}</strong>
        <small>{status.message || (status.supported ? 'Use o alvo virtual ou conecte um ESP32 físico.' : 'O alvo virtual funciona neste navegador.')}</small>
      </div>
    </div>
  )
}

function Diagnostics({ status, virtual }) {
  return (
    <div className="hil-diagnostics">
      <div className="hil-metrics-grid">
        <Metric label="RTT" value={formatFixed(status.rttMs, 1)} unit="ms" />
        <Metric label="IDA EST." value={formatFixed(status.oneWayMs, 1)} unit="ms" />
        <Metric label="JITTER MÁX." value={virtual ? '—' : formatFixed(status.maxJitterUs, 1)} unit={virtual ? 'não medido' : 'µs'} tone={!virtual && status.maxJitterUs > 100 ? 'warn' : 'good'} />
        <Metric label="JITTER MÉD." value={virtual ? '—' : formatFixed(status.meanJitterUs, 1)} unit={virtual ? 'não medido' : 'µs'} />
        <Metric label="BLOCOS RX/TX" value={`${formatNumber(status.packetsReceived)}/${formatNumber(status.packetsSent)}`} unit="quadros" />
        <Metric label="PERDIDOS" value={formatNumber(status.packetsLost)} unit="quadros" tone={status.packetsLost ? 'warn' : ''} />
        <Metric label="REORDENADOS" value={formatNumber(status.packetsReordered)} unit="quadros" tone={status.packetsReordered ? 'warn' : ''} />
        <Metric label="CRC INVÁLIDO" value={formatNumber(status.invalidCrc + status.targetCrcErrors)} unit="quadros" tone={status.invalidCrc + status.targetCrcErrors ? 'warn' : ''} />
        <Metric label="DESCARTADOS" value={formatNumber(status.discardedBytes)} unit="bytes" tone={status.discardedBytes ? 'warn' : ''} />
        <Metric label="SUBALIMENTAÇÃO" value={formatNumber(status.fifoUnderruns)} unit="amostras" tone={status.fifoUnderruns ? 'warn' : ''} />
      </div>
      <div className="hil-health-row">
        <span><i className={status.stable ? 'good' : 'bad'} /> filtro {status.stable ? 'estável' : 'rejeitado'}</span>
        <span>sobrecargas ISR <b>{formatNumber(status.isrOverruns)}</b></span>
        <span>excesso FIFO <b>{formatNumber(status.fifoOverflows)}</b></span>
        <span>buffer de jitter <b>{formatNumber(status.jitterBufferMs)} ms</b></span>
      </div>
    </div>
  )
}

export function HilStatusPanel({ status }) {
  const online = status.mode !== 'simulation' && status.serialState === 'connected'
  const virtual = status.mode === 'virtual'
  const serialLabel = status.serialState === 'unsupported'
    ? 'NÃO SUPORTADO'
    : status.serialState === 'connecting'
      ? 'CONECTANDO'
      : online ? 'ONLINE' : 'OFFLINE'
  return (
    <div className="hil-status-body">
      <Connection status={status} online={online} virtual={virtual} serialLabel={serialLabel} />
      {virtual ? (
        <details className="telemetry-details">
          <summary>Ver diagnóstico do alvo virtual</summary>
          <p>Emulação local: perdas, CRC e jitter de hardware não se aplicam.</p>
          <Diagnostics status={status} virtual />
        </details>
      ) : <Diagnostics status={status} virtual={false} />}
    </div>
  )
}
