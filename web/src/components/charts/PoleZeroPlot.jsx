import { useEffect, useMemo } from 'react'
import { polosZerosContinuos } from '../../dsp/biquad'
import { useCanvasSize } from '../../hooks/useCanvasSize'
import { drawGrid, label, setupCanvas } from './canvas'

export function PoleZeroPlot({ m, c, k }) {
  const [ref, size] = useCanvasSize()
  const values = useMemo(() => polosZerosContinuos(m, c, k), [m, c, k])

  useEffect(() => {
    if (!ref.current) return
    const ctx = setupCanvas(ref.current, size)
    const rect = { x: 30, y: 12, width: size.width - 42, height: size.height - 34 }
    drawGrid(ctx, rect, 6, 6)
    const all = [...values.poles, ...values.zeros]
    const maxRe = Math.max(1, ...all.map((p) => Math.abs(p.re))) * 1.25
    const maxIm = Math.max(1, ...all.map((p) => Math.abs(p.im))) * 1.3
    const xFor = (re) => rect.x + rect.width * (0.92 + 0.84 * re / maxRe)
    const yFor = (im) => rect.y + rect.height * (0.5 - 0.46 * im / maxIm)
    const axisX = xFor(0)
    const axisY = yFor(0)
    ctx.strokeStyle = 'rgba(210,210,210,.35)'
    ctx.beginPath(); ctx.moveTo(rect.x, axisY); ctx.lineTo(rect.x + rect.width, axisY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(axisX, rect.y); ctx.lineTo(axisX, rect.y + rect.height); ctx.stroke()

    ctx.strokeStyle = '#f2f2f2'
    ctx.lineWidth = 2
    values.poles.forEach((pole) => {
      const x = xFor(pole.re); const y = yFor(pole.im)
      ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke()
    })
    ctx.strokeStyle = '#8d8d8d'
    values.zeros.forEach((zero) => {
      ctx.beginPath(); ctx.arc(xFor(zero.re), yFor(zero.im), 5, 0, Math.PI * 2); ctx.stroke()
    })
    label(ctx, 'Re(s)', rect.x + rect.width, axisY - 5, 'right')
    label(ctx, 'Im(s)', axisX - 5, rect.y + 9, 'right')
    label(ctx, `${(-maxRe).toFixed(0)}`, rect.x, axisY + 14, 'left')
    label(ctx, '0', axisX, axisY + 14, 'center')
    label(ctx, `ζ ${(c / (2 * Math.sqrt(k * m))).toFixed(2)}`, rect.x + 3, rect.y + 12, 'left', '#d8d8d8')
  }, [values, m, c, k, ref, size])

  return (
    <div className="chart-wrap">
      <canvas ref={ref} />
      <div className="chart-legend"><span className="red cross">polos</span><span className="cyan circle">zero</span></div>
    </div>
  )
}
