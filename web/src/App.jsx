import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { useEffect, useState } from 'react'
import { HilStatusPanel, ModeSelector } from './components/HilStatusPanel'
import { Panel } from './components/Panel'
import { ParameterControls, SignalControls } from './components/ParameterControls'
import { QuarterCarDiagram } from './components/QuarterCarDiagram'
import { BodePlot } from './components/charts/BodePlot'
import { Oscilloscope } from './components/charts/Oscilloscope'
import { PoleZeroPlot } from './components/charts/PoleZeroPlot'
import { SpectrumPlot } from './components/charts/SpectrumPlot'
import { ValidationPlot } from './components/charts/ValidationPlot'
import { SimulationScene } from './components/three/SimulationScene'
import { SimulationEngine, suspensionPresets } from './simulation/SimulationEngine'
import { HilController } from './hil/HilController'
import { formatFixed, formatNumber } from './utils/format'

const INITIAL_PARAMS = {
  m: 340,
  c: 3200,
  k: 32000,
  speed: 18,
  waveAmplitude: 0.055,
  roughnessAmplitude: 0.018,
  noiseAmplitude: 0.012,
}

function LiveReadout({ engine }) {
  const xRef = useRef(null)
  const yRef = useRef(null)
  const attenuationRef = useRef(null)
  const attenuationLabelRef = useRef(null)
  useEffect(() => {
    let frame
    const update = () => {
      const { xFront, y } = engine.current
      if (xRef.current) xRef.current.textContent = `${formatFixed(xFront * 100, 1)} cm`
      if (yRef.current) yRef.current.textContent = `${formatFixed(y * 100, 1)} cm`
      if (attenuationRef.current) {
        const attenuation = Math.abs(xFront) > 0.002 ? (1 - Math.abs(y / xFront)) * 100 : 0
        const amplified = attenuation < 0
        attenuationRef.current.textContent = amplified ? `+${formatNumber(Math.abs(attenuation), { maximumFractionDigits: 0 })}%` : `${formatNumber(attenuation, { maximumFractionDigits: 0 })}%`
        attenuationRef.current.classList.toggle('warning', amplified)
        if (attenuationLabelRef.current) attenuationLabelRef.current.textContent = amplified ? 'AMPLIFICAÇÃO' : 'ATENUAÇÃO'
      }
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [engine])
  return (
    <div className="live-readout">
      <div><span>PISTA</span><strong ref={xRef}>0,0 cm</strong></div>
      <div><span>CABINE</span><strong ref={yRef}>0,0 cm</strong></div>
      <div><span ref={attenuationLabelRef}>ATENUAÇÃO</span><strong ref={attenuationRef}>0%</strong></div>
    </div>
  )
}

export default function App() {
  const engine = useMemo(() => new SimulationEngine(INITIAL_PARAMS), [])
  const hilController = useMemo(() => new HilController(engine), [engine])
  const hilStatus = useSyncExternalStore(hilController.subscribe, hilController.getSnapshot, hilController.getSnapshot)
  const [params, setParams] = useState(INITIAL_PARAMS)
  const [activePreset, setActivePreset] = useState(null)

  useEffect(() => {
    void hilController.start()
    return () => hilController.dispose()
  }, [hilController])

  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const tick = (now) => {
      engine.advance((now - previous) / 1000)
      previous = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [engine])

  const metrics = useMemo(() => {
    const omega = Math.sqrt(params.k / params.m)
    const zeta = params.c / (2 * Math.sqrt(params.k * params.m))
    return { omega, fn: omega / (2 * Math.PI), zeta, q: zeta > 0 ? 1 / (2 * zeta) : Infinity }
  }, [params.m, params.c, params.k])

  const updateParams = useCallback((next, preservePreset = false) => {
    if (!preservePreset) setActivePreset(null)
    setParams((current) => {
      const merged = { ...current, ...next }
      engine.setParams(next)
      if (next.m !== undefined || next.c !== undefined || next.k !== undefined) {
        hilController.updateParams(merged.m, merged.c, merged.k)
      }
      return merged
    })
  }, [engine, hilController])

  const applyPreset = useCallback((name) => {
    setActivePreset(name)
    updateParams(suspensionPresets[name], true)
  }, [updateParams])

  const resetParams = useCallback(() => {
    setActivePreset(null)
    updateParams(INITIAL_PARAMS, true)
  }, [updateParams])

  return (
    <main className="app-shell">
      <aside className="nav-rail" aria-label="Navegação do simulador">
        <a className="rail-logo" href="#scene" aria-label="Suspension Lab">SL</a>
        <nav>
          <a className="active" href="#scene" aria-label="Cena 3D"><b>◆</b><span className="rail-label">Cena 3D</span></a>
          <a href="#model" aria-label="Modelo"><b>◫</b><span className="rail-label">Modelo</span></a>
          <a href="#analysis" aria-label="Análises"><b>⌁</b><span className="rail-label">Análises</span></a>
          <a href="#hil" aria-label="Telemetria HIL"><b>◎</b><span className="rail-label">Telemetria</span></a>
          <a href="#signal" aria-label="Excitação da pista"><b>∿</b><span className="rail-label">Excitação</span></a>
        </nav>
        <div className="rail-spacer" />
        <span className={`rail-connection ${hilStatus.connected ? 'online' : ''}`} title={hilStatus.connected ? 'Alvo conectado' : 'Alvo desconectado'} />
        <a href="#model" aria-label="Configurações"><b>⚙</b><span className="rail-label">Configurações</span></a>
      </aside>

      <section className="dashboard-shell">
        <header className="dashboard-header">
          <div className="brand">
            <div className="brand-mark"><span /></div>
            <div><b>SUSPENSION LAB</b><small>CONSOLE DE DINÂMICA VEICULAR</small></div>
          </div>
          <div>
            <span className="eyebrow">SIMULADOR HIL · FILTRO MECÂNICO</span>
            <h1>Dinâmica da suspensão</h1>
          </div>
          <div className="header-status">
            <span className={`target-chip ${hilStatus.mode}`}><i /> {hilStatus.mode === 'hil' ? 'ESP32 FÍSICO' : hilStatus.mode === 'virtual' ? 'ESP32 VIRTUAL' : 'NAVEGADOR'}</span>
            <div className="sample-badge"><span>FS</span><b>1000</b><small>Hz</small></div>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="hero-grid">
            <section className="visual-side" id="scene">
              <div className="scene-wrap">
                <SimulationScene engine={engine} />
                <div className="scene-vignette" />
                <div className="scene-label top-left"><i className={`pulse ${hilStatus.mode !== 'simulation' ? 'hil-pulse' : ''}`} /> {hilStatus.mode === 'hil' ? 'HIL · ESP32 FÍSICO' : hilStatus.mode === 'virtual' ? 'HIL · ESP32 VIRTUAL' : 'SIMULAÇÃO'} · 1 kHz</div>
                <div className="scene-label top-right">ARRASTE PARA ORBITAR</div>
                <LiveReadout engine={engine} />
                <div className="equation-card">
                  <span>FUNÇÃO DE TRANSFERÊNCIA</span>
                  <div className="fraction"><b>Y(s)</b><i /><b>X(s)</b></div>
                  <strong>=</strong>
                  <div className="fraction wide"><b>cs + k</b><i /><b>ms² + cs + k</b></div>
                </div>
              </div>
              <div className="scene-footer">
                <span><i className="dot cyan-bg" /> Roda = x(t)</span>
                <span><i className="dot amber-bg" /> Carroceria = y(t)</span>
                <span className="spacer" />
                <span>{formatNumber(params.speed)} m/s · {formatNumber(params.speed * 3.6, { maximumFractionDigits: 0 })} km/h</span>
              </div>
            </section>

            <aside className="hero-side">
              <section className="mode-card" id="hil">
                <div className="compact-card-heading">
                  <div><span className="eyebrow">ALVO</span><h2>Modo de processamento</h2></div>
                  <span className={`status-led ${hilStatus.connected ? 'online' : ''}`} />
                </div>
                <ModeSelector
                  status={hilStatus}
                  onEnableHil={() => void hilController.enableHil()}
                  onEnableVirtual={() => void hilController.enableVirtual()}
                  onSimulation={() => hilController.useSimulation()}
                  onDisconnect={() => void hilController.disconnect()}
                  onBlockSize={(size) => hilController.setBlockSize(size)}
                />
              </section>

              <Panel title="Modelo de quarto de carro" eyebrow="FÍSICA DO SISTEMA" className="quarter-car-panel">
                <QuarterCarDiagram engine={engine} params={params} />
              </Panel>

              <Panel title="Telemetria do alvo" eyebrow="ESTADO HIL" className="telemetry-panel" action={<span className={`hil-mode-pill ${hilStatus.mode}`}>{hilStatus.mode === 'hil' ? 'FÍSICO' : hilStatus.mode === 'virtual' ? 'VIRTUAL' : 'NAVEGADOR'}</span>}>
                <HilStatusPanel status={hilStatus} />
              </Panel>
            </aside>
          </div>

          <section className="analysis-side">
            <div className="lab-controls-grid" id="model">
              <Panel title="Parâmetros do sistema" eyebrow="01 · MODELO" className="controls-panel">
                <ParameterControls params={params} metrics={metrics} stable={engine.coefficients.stable} activePreset={activePreset} onChange={updateParams} onPreset={applyPreset} onReset={resetParams} />
              </Panel>
              <div id="signal">
                <Panel title="Excitação da pista" eyebrow="02 · ENTRADA DO SISTEMA" className="signal-panel">
                  <SignalControls params={params} onChange={updateParams} />
                </Panel>
              </div>
            </div>

            <div className="two-column cockpit-grid" id="analysis">
              <Panel title="Resposta em frequência" eyebrow="03 · BODE">
                <BodePlot m={params.m} c={params.c} k={params.k} fs={engine.fs} />
              </Panel>
              <Panel title="Polos e zero" eyebrow="04 · PLANO S" className="compass-panel">
                <PoleZeroPlot m={params.m} c={params.c} k={params.k} />
              </Panel>
            </div>

            <div className="two-column cockpit-grid equal">
              <Panel title="Resposta temporal" eyebrow="05 · OSCILOSCÓPIO">
                <Oscilloscope engine={engine} />
              </Panel>
              <Panel title="Densidade espectral" eyebrow="06 · FFT RADIX-2" action={<span className="bin-pill">2.048 AMOSTRAS</span>}>
                <SpectrumPlot engine={engine} />
              </Panel>
            </div>

            <div>
              <Panel title="Erro do alvo × referência" eyebrow="07 · VALIDAÇÃO">
                <ValidationPlot controller={hilController} status={hilStatus} />
              </Panel>
            </div>

            <footer className="app-footer">
              <span>H(s) = (cs + k) / (ms² + cs + k)</span>
              <span title="Discretização bilinear com correção da frequência natural para preservar a resposta ao redor de ωn.">Tustin + pré-distorção em ωn</span>
              <span>ESP32 virtual · Web Serial opcional · CRC-8</span>
            </footer>
          </section>
        </div>
      </section>
    </main>
  )
}
