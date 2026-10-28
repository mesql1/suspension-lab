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

  useEffect(() => () => hilController.dispose(), [hilController])

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
      <section className="visual-side">
        <div className="brand">
          <div className="brand-mark"><span /></div>
          <div><b>SUSPENSION</b><small>MECHANICAL FILTER LAB</small></div>
        </div>
        <div className="scene-wrap">
          <SimulationScene engine={engine} />
          <div className="scene-vignette" />
          <div className="scene-label top-left"><i className={`pulse ${hilStatus.mode === 'hil' ? 'hil-pulse' : ''}`} /> {hilStatus.mode === 'hil' ? 'HIL · ESP32' : 'SIMULAÇÃO'} · 1 kHz</div>
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

      <section className="analysis-side">
        <header className="analysis-header">
          <div>
            <span className="eyebrow">DOMÍNIO DE LAPLACE · FILTRO PASSA-BAIXAS</span>
            <h1>Dinâmica da suspensão</h1>
          </div>
          <div className="sample-badge"><span>FS</span><b>1000</b><small>Hz</small></div>
        </header>

        <ModeSelector
          status={hilStatus}
          onEnableHil={() => void hilController.enableHil()}
          onSimulation={() => hilController.useSimulation()}
          onDisconnect={() => void hilController.disconnect()}
          onBlockSize={(size) => hilController.setBlockSize(size)}
        />

        <Panel title="Parâmetros do sistema" eyebrow="01 · MODELO" className="controls-panel">
          <ParameterControls params={params} metrics={metrics} stable={engine.coefficients.stable} onChange={updateParams} onPreset={applyPreset} />
        </Panel>

        <div className="hil-grid">
          <Panel title="Telemetria do target" eyebrow="02 · STATUS HIL" action={<span className={`hil-mode-pill ${hilStatus.mode}`}>{hilStatus.mode === 'hil' ? 'TARGET' : 'HOST'}</span>}>
            <HilStatusPanel status={hilStatus} />
          </Panel>
          <Panel title="Erro target × referência" eyebrow="03 · VALIDAÇÃO">
            <ValidationPlot controller={hilController} status={hilStatus} />
          </Panel>
        </div>

        <div className="two-column">
          <Panel title="Resposta em frequência" eyebrow="04 · BODE">
            <BodePlot m={params.m} c={params.c} k={params.k} fs={engine.fs} />
          </Panel>
          <Panel title="Polos e zero" eyebrow="05 · PLANO S">
            <PoleZeroPlot m={params.m} c={params.c} k={params.k} />
          </Panel>
        </div>

        <Panel title="Resposta temporal" eyebrow="06 · OSCILOSCÓPIO" action={<span className="live-pill"><i /> AO VIVO</span>}>
          <Oscilloscope engine={engine} />
        </Panel>

        <Panel title="Densidade espectral" eyebrow="07 · FFT RADIX-2" action={<span className="bin-pill">2048 AMOSTRAS</span>}>
          <SpectrumPlot engine={engine} />
        </Panel>

        <Panel title="Excitação da pista" eyebrow="08 · GERADOR DE SINAL" className="signal-panel">
          <SignalControls params={params} onChange={updateParams} />
        </Panel>

        <footer className="app-footer">
          <span>H(s) = (cs + k) / (ms² + cs + k)</span>
          <span>Tustin + pre-warp em ωn</span>
          <span>Web Serial · 921.600 baud · CRC-8</span>
        </footer>
      </section>
    </main>
  )
}
