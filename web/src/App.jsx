import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { useEffect, useState } from 'react'
import { HilStatusPanel, ModeSelector } from './components/HilStatusPanel'
import { Panel } from './components/Panel'
import { ParameterControls, SignalControls } from './components/ParameterControls'
import { BodePlot } from './components/charts/BodePlot'
import { Oscilloscope } from './components/charts/Oscilloscope'
import { PoleZeroPlot } from './components/charts/PoleZeroPlot'
import { SpectrumPlot } from './components/charts/SpectrumPlot'
import { ValidationPlot } from './components/charts/ValidationPlot'
import { SimulationScene } from './components/three/SimulationScene'
import { SimulationEngine, suspensionPresets } from './simulation/SimulationEngine'
import { HilController } from './hil/HilController'

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
  useEffect(() => {
    let frame
    const update = () => {
      const { xFront, y } = engine.current
      if (xRef.current) xRef.current.textContent = `${(xFront * 100).toFixed(1)} cm`
      if (yRef.current) yRef.current.textContent = `${(y * 100).toFixed(1)} cm`
      if (attenuationRef.current) {
        const ratio = Math.abs(xFront) > 0.002 ? Math.min(99, Math.max(0, (1 - Math.abs(y / xFront)) * 100)) : 0
        attenuationRef.current.textContent = `${ratio.toFixed(0)}%`
      }
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [engine])
  return (
    <div className="live-readout">
      <div><span>PISTA</span><strong ref={xRef}>0.0 cm</strong></div>
      <div><span>CABINE</span><strong ref={yRef}>0.0 cm</strong></div>
      <div><span>ATENUAÇÃO</span><strong ref={attenuationRef}>0%</strong></div>
    </div>
  )
}

export default function App() {
  const engine = useMemo(() => new SimulationEngine(INITIAL_PARAMS), [])
  const hilController = useMemo(() => new HilController(engine), [engine])
  const hilStatus = useSyncExternalStore(hilController.subscribe, hilController.getSnapshot, hilController.getSnapshot)
  const [params, setParams] = useState(INITIAL_PARAMS)

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

  const updateParams = useCallback((next) => {
    setParams((current) => {
      const merged = { ...current, ...next }
      engine.setParams(next)
      if (next.m !== undefined || next.c !== undefined || next.k !== undefined) {
        hilController.updateParams(merged.m, merged.c, merged.k)
      }
      return merged
    })
  }, [engine, hilController])

  const applyPreset = useCallback((name) => updateParams(suspensionPresets[name]), [updateParams])

  return (
    <main className="app-shell">
      <aside className="nav-rail" aria-label="Navegação do simulador">
        <a className="rail-logo" href="#scene" aria-label="Suspension Lab">SL</a>
        <nav>
          <a className="active" href="#scene" aria-label="Cena 3D" title="Cena 3D">◆</a>
          <a href="#model" aria-label="Modelo" title="Modelo">◫</a>
          <a href="#analysis" aria-label="Análises" title="Análises">⌁</a>
          <a href="#hil" aria-label="Telemetria HIL" title="Telemetria HIL">◎</a>
          <a href="#signal" aria-label="Excitação da pista" title="Excitação da pista">∿</a>
        </nav>
        <div className="rail-spacer" />
        <span className={`rail-connection ${hilStatus.connected ? 'online' : ''}`} title={hilStatus.connected ? 'Target conectado' : 'Target desconectado'} />
        <a href="#model" aria-label="Configurações" title="Configurações">⚙</a>
      </aside>

      <section className="dashboard-shell">
        <header className="dashboard-header">
          <div className="brand">
            <div className="brand-mark"><span /></div>
            <div><b>SUSPENSION LAB</b><small>VEHICLE DYNAMICS CONSOLE</small></div>
          </div>
          <div>
            <span className="eyebrow">SIMULADOR HIL · FILTRO MECÂNICO</span>
            <h1>Dinâmica da suspensão</h1>
          </div>
          <div className="header-status">
            <span className={`target-chip ${hilStatus.mode}`}><i /> {hilStatus.mode === 'hil' ? 'ESP32 FÍSICO' : hilStatus.mode === 'virtual' ? 'ESP32 VIRTUAL' : 'HOST'}</span>
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
                <span>{params.speed} m/s · {(params.speed * 3.6).toFixed(0)} km/h</span>
              </div>
            </section>

            <aside className="hero-side">
              <section className="mode-card" id="hil">
                <div className="compact-card-heading">
                  <div><span className="eyebrow">TARGET</span><h2>Modo de processamento</h2></div>
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

              <Panel title="Telemetria do target" eyebrow="STATUS HIL" className="telemetry-panel" action={<span className={`hil-mode-pill ${hilStatus.mode}`}>{hilStatus.mode === 'hil' ? 'FÍSICO' : hilStatus.mode === 'virtual' ? 'VIRTUAL' : 'HOST'}</span>}>
                <HilStatusPanel status={hilStatus} />
              </Panel>

              <Panel title="Polos e zero" eyebrow="PLANO S" className="compass-panel">
                <PoleZeroPlot m={params.m} c={params.c} k={params.k} />
              </Panel>
            </aside>
          </div>

          <section className="analysis-side">
            <div id="model">
              <Panel title="Parâmetros do sistema" eyebrow="01 · MODELO" className="controls-panel">
                <ParameterControls params={params} metrics={metrics} stable={engine.coefficients.stable} onChange={updateParams} onPreset={applyPreset} />
              </Panel>
            </div>

            <div className="two-column cockpit-grid" id="analysis">
              <Panel title="Resposta em frequência" eyebrow="02 · BODE">
                <BodePlot m={params.m} c={params.c} k={params.k} fs={engine.fs} />
              </Panel>
              <Panel title="Erro target × referência" eyebrow="03 · VALIDAÇÃO">
                <ValidationPlot controller={hilController} status={hilStatus} />
              </Panel>
            </div>

            <div className="two-column cockpit-grid equal">
              <Panel title="Resposta temporal" eyebrow="04 · OSCILOSCÓPIO" action={<span className="live-pill"><i /> AO VIVO</span>}>
                <Oscilloscope engine={engine} />
              </Panel>
              <Panel title="Densidade espectral" eyebrow="05 · FFT RADIX-2" action={<span className="bin-pill">2048 AMOSTRAS</span>}>
                <SpectrumPlot engine={engine} />
              </Panel>
            </div>

            <div id="signal">
              <Panel title="Excitação da pista" eyebrow="06 · GERADOR DE SINAL" className="signal-panel">
                <SignalControls params={params} onChange={updateParams} />
              </Panel>
            </div>

            <footer className="app-footer">
              <span>H(s) = (cs + k) / (ms² + cs + k)</span>
              <span>Tustin + pre-warp em ωn</span>
              <span>ESP32 virtual · Web Serial opcional · CRC-8</span>
            </footer>
          </section>
        </div>
      </section>
    </main>
  )
}
