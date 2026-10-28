import { useEffect, useMemo } from 'react'
import { encontrarCorte, frequenciasLog, respostaEmFrequencia } from '../../dsp/frequency'
import { gerarCoeficientes } from '../../dsp/biquad'
import { useCanvasSize } from '../../hooks/useCanvasSize'
import { drawGrid, label, setupCanvas, trace } from './canvas'

export function BodePlot({ m, c, k, fs }) {
  const [ref, size] = useCanvasSize()
  const data = useMemo(() => {
    const frequencies = frequenciasLog(0.1, 100, 360)
    const coefficients = gerarCoeficientes(m, c, k, fs)
    const response = respostaEmFrequencia(m, c, k, coefficients, frequencies)
    return { response, cutoff: encontrarCorte(response), fn: Math.sqrt(k / m) / (2 * Math.PI) }
  }, [m, c, k, fs])

  useEffect(() => {
    if (!ref.current) return
    const ctx = setupCanvas(ref.current, size)
    const pad = { left: 36, right: 10, top: 10, bottom: 22 }
    const gap = 16
    const innerWidth = size.width - pad.left - pad.right
    const h = (size.height - pad.top - pad.bottom - gap) / 2
    const magRect = { x: pad.left, y: pad.top, width: innerWidth, height: h }
    const phaseRect = { x: pad.left, y: pad.top + h + gap, width: innerWidth, height: h }
    drawGrid(ctx, magRect, 3, 4)
    drawGrid(ctx, phaseRect, 3, 3)

    const xFor = (f) => magRect.x + (Math.log10(f) + 1) / 3 * magRect.width
    const magFor = (db) => magRect.y + (20 - Math.max(-60, Math.min(20, db))) / 80 * magRect.height
    const phaseFor = (deg) => phaseRect.y + (30 - Math.max(-120, Math.min(30, deg))) / 150 * phaseRect.height
    const r = data.response
    const continuousMag = []
    const discreteMag = []
    const continuousPhase = []
    const discretePhase = []
    for (let i = 0; i < r.frequencies.length; i += 1) {
      const x = xFor(r.frequencies[i])
      continuousMag.push([x, magFor(r.continuousMagnitude[i])])
      discreteMag.push([x, magFor(r.discreteMagnitude[i])])
      continuousPhase.push([x, phaseFor(r.continuousPhase[i])])
      discretePhase.push([x, phaseFor(r.discretePhase[i])])
    }
    trace(ctx, continuousMag, '#f2f2f2', 1.8)
    trace(ctx, discreteMag, '#8c8c8c', 1.25, [4, 3])
    trace(ctx, continuousPhase, '#f2f2f2', 1.8)
    trace(ctx, discretePhase, '#8c8c8c', 1.25, [4, 3])

    const resonanceX = xFor(data.fn)
    ctx.strokeStyle = 'rgba(210,210,210,.55)'
    ctx.setLineDash([2, 3])
    ;[magRect, phaseRect].forEach((rect) => {
      ctx.beginPath(); ctx.moveTo(resonanceX, rect.y); ctx.lineTo(resonanceX, rect.y + rect.height); ctx.stroke()
    })
    ctx.setLineDash([])
    if (data.cutoff) {
      const cutoffX = xFor(data.cutoff)
      ctx.fillStyle = '#a8a8a8'
      ctx.beginPath(); ctx.arc(cutoffX, magFor(-3), 3, 0, Math.PI * 2); ctx.fill()
      label(ctx, `fc ${data.cutoff.toFixed(1)} Hz`, cutoffX - 4, magFor(-3) - 6, 'right', '#a8a8a8')
    }

    ;[-60, -40, -20, 0, 20].forEach((v) => label(ctx, `${v}`, pad.left - 6, magFor(v) + 3, 'right'))
    ;[-120, -90, -60, -30, 0, 30].filter((_, i) => i % 2 === 0).forEach((v) => label(ctx, `${v}°`, pad.left - 6, phaseFor(v) + 3, 'right'))
    ;[0.1, 1, 10, 100].forEach((f) => label(ctx, `${f}`, xFor(f), size.height - 5, 'center'))
    label(ctx, 'MAG · dB', magRect.x + 4, magRect.y + 11, 'left', '#9a9a9a')
    label(ctx, 'FASE', phaseRect.x + 4, phaseRect.y + 11, 'left', '#9a9a9a')
    label(ctx, `fn ${data.fn.toFixed(2)} Hz`, Math.min(resonanceX + 4, size.width - 75), magRect.y + 12, 'left', '#d8d8d8')
  }, [data, ref, size])

  return (
    <div className="chart-wrap">
      <canvas ref={ref} />
      <div className="chart-legend"><span className="cyan">contínuo</span><span className="amber dashed">discreto</span></div>
    </div>
  )
}
