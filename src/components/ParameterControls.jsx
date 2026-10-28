import { suspensionPresets } from '../simulation/SimulationEngine'

function Slider({ label, symbol, unit, value, min, max, step, onChange }) {
  const percent = ((value - min) / (max - min)) * 100
  return (
    <label className="slider-row">
      <span className="slider-label"><b>{symbol}</b> {label}</span>
      <span className="slider-value">{value.toLocaleString('pt-BR')} <small>{unit}</small></span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--progress': `${percent}%` }}
      />
    </label>
  )
}

export function ParameterControls({ params, metrics, stable, onChange, onPreset }) {
  return (
    <div className="controls-grid">
      <div className="sliders">
        <Slider label="Massa suspensa" symbol="m" unit="kg" value={params.m} min={180} max={650} step={5} onChange={(m) => onChange({ m })} />
        <Slider label="Rigidez da mola" symbol="k" unit="N/m" value={params.k} min={10000} max={90000} step={500} onChange={(k) => onChange({ k })} />
        <Slider label="Amortecimento" symbol="c" unit="N·s/m" value={params.c} min={100} max={12000} step={100} onChange={(c) => onChange({ c })} />
      </div>
      <div className="metrics-wrap">
        <div className="metric-grid">
          <div><span>ωn</span><strong>{metrics.omega.toFixed(2)}</strong><small>rad/s</small></div>
          <div><span>fn</span><strong>{metrics.fn.toFixed(2)}</strong><small>Hz</small></div>
          <div><span>ζ</span><strong>{metrics.zeta.toFixed(2)}</strong><small>razão</small></div>
          <div><span>Q</span><strong>{metrics.q.toFixed(2)}</strong><small>fator</small></div>
        </div>
        <div className="preset-row">
          {Object.keys(suspensionPresets).map((name) => (
            <button type="button" key={name} onClick={() => onPreset(name)}>{name}</button>
          ))}
        </div>
        <div className={`stability ${stable ? 'stable' : 'unstable'}`}>
          <i /> {stable ? 'Filtro discreto estável' : 'Atenção: polos fora do círculo unitário'}
        </div>
      </div>
    </div>
  )
}

export function SignalControls({ params, onChange }) {
  return (
    <div className="signal-controls">
      <Slider label="Ondulação" symbol="Aₗ" unit="m" value={params.waveAmplitude} min={0} max={0.12} step={0.001} onChange={(waveAmplitude) => onChange({ waveAmplitude })} />
      <Slider label="Rugosidade" symbol="Aₕ" unit="m" value={params.roughnessAmplitude} min={0} max={0.05} step={0.001} onChange={(roughnessAmplitude) => onChange({ roughnessAmplitude })} />
      <Slider label="Ruído rosa" symbol="N" unit="m" value={params.noiseAmplitude} min={0} max={0.04} step={0.001} onChange={(noiseAmplitude) => onChange({ noiseAmplitude })} />
      <Slider label="Velocidade" symbol="v" unit="m/s" value={params.speed} min={4} max={40} step={1} onChange={(speed) => onChange({ speed })} />
    </div>
  )
}
