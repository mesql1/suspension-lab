function Metric({ label, value, unit, tone = '' }) {
  return (
    <div className={`hil-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  )
}

export function ModeSelector({ status, onEnableHil, onSimulation, onDisconnect, onBlockSize }) {
  const connected = status.serialState === 'connected'
  return (
    <div className="mode-bar">
      <div className="mode-tabs" aria-label="Modo de processamento">
        <button type="button" className={status.mode === 'simulation' ? 'active' : ''} onClick={onSimulation}>SIMULAÇÃO</button>
        <button type="button" className={status.mode === 'hil' ? 'active hil' : ''} onClick={onEnableHil} disabled={!status.supported}>HIL · ESP32</button>
      </div>
      <div className="mode-actions">
        <label>Bloco <b>{status.blockSize}</b>
          <input aria-label="Amostras por bloco HIL" type="range" min="4" max="60" step="4" value={status.blockSize} onChange={(event) => onBlockSize(Number(event.target.value))} />
        </label>
        {connected && <button type="button" className="disconnect-button" onClick={onDisconnect}>DESCONECTAR</button>}
      </div>
    </div>
  )
}

export function HilStatusPanel({ status }) {
  const online = status.mode === 'hil' && status.serialState === 'connected'
  const serialLabel = status.serialState === 'unsupported'
    ? 'NÃO SUPORTADO'
    : status.serialState === 'connecting'
      ? 'CONECTANDO'
      : online ? 'ONLINE' : 'OFFLINE'
  return (
    <div className="hil-status-body">
      <div className="hil-connection">
        <div className={`device-icon ${online ? 'online' : ''}`}><i /><i /><i /></div>
        <div>
          <span>TARGET · ESP32 DEVKIT V1</span>
          <strong><i className={online ? 'online' : ''} /> {serialLabel}</strong>
          <small>{status.message || (status.supported ? 'Selecione HIL para abrir a porta serial.' : 'Use Chrome ou Edge em HTTPS/localhost.')}</small>
        </div>
      </div>
      <div className="hil-metrics-grid">
        <Metric label="RTT" value={status.rttMs.toFixed(1)} unit="ms" />
        <Metric label="ONE-WAY EST." value={status.oneWayMs.toFixed(1)} unit="ms" />
        <Metric label="JITTER MÁX." value={status.maxJitterUs.toFixed(1)} unit="µs" tone={status.maxJitterUs > 100 ? 'warn' : 'good'} />
        <Metric label="JITTER MÉD." value={status.meanJitterUs.toFixed(1)} unit="µs" />
        <Metric label="BLOCOS RX/TX" value={`${status.packetsReceived}/${status.packetsSent}`} unit="quadros" />
        <Metric label="PERDIDOS" value={status.packetsLost} unit="quadros" tone={status.packetsLost ? 'warn' : ''} />
        <Metric label="REORDENADOS" value={status.packetsReordered} unit="quadros" tone={status.packetsReordered ? 'warn' : ''} />
        <Metric label="CRC INVÁLIDO" value={status.invalidCrc + status.targetCrcErrors} unit="quadros" tone={status.invalidCrc + status.targetCrcErrors ? 'warn' : ''} />
        <Metric label="DESCARTADOS" value={status.discardedBytes} unit="bytes" tone={status.discardedBytes ? 'warn' : ''} />
        <Metric label="UNDERRUN" value={status.fifoUnderruns} unit="amostras" tone={status.fifoUnderruns ? 'warn' : ''} />
      </div>
      <div className="hil-health-row">
        <span><i className={status.stable ? 'good' : 'bad'} /> filtro {status.stable ? 'estável' : 'rejeitado'}</span>
        <span>ISR overruns <b>{status.isrOverruns}</b></span>
        <span>FIFO overflow <b>{status.fifoOverflows}</b></span>
        <span>jitter buffer <b>{status.jitterBufferMs} ms</b></span>
      </div>
    </div>
  )
}
