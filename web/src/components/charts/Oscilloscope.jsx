import { useEffect } from 'react'
import { useCanvasSize } from '../../hooks/useCanvasSize'
import { drawGrid, label, setupCanvas, trace } from './canvas'

export function Oscilloscope({ engine }) {
  const [ref, size] = useCanvasSize()

  useEffect(() => {
    let frame = 0
    let lastDraw = 0
    const draw = (now) => {
      frame = requestAnimationFrame(draw)
      if (!ref.current || now - lastDraw < 33) return
      lastDraw = now
      const ctx = setupCanvas(ref.current, size)
      const rect = { x: 40, y: 10, width: size.width - 50, height: size.height - 30 }
      drawGrid(ctx, rect, 10, 4)
      const samples = engine.copyTimeSeries(2000)
      let max = 0.04
      for (let i = 0; i < samples.x.length; i += 1) max = Math.max(max, Math.abs(samples.x[i]), Math.abs(samples.y[i]))
      max *= 1.12
      const xPoints = []
      const yPoints = []
      const stride = Math.max(1, Math.floor(samples.x.length / rect.width))
      for (let i = 0; i < samples.x.length; i += stride) {
        const px = rect.x + i / (samples.x.length - 1) * rect.width
        xPoints.push([px, rect.y + rect.height * (0.5 - samples.x[i] / (2 * max))])
        yPoints.push([px, rect.y + rect.height * (0.5 - samples.y[i] / (2 * max))])
      }
      trace(ctx, xPoints, '#8f8f8f', 1.25)
      trace(ctx, yPoints, '#f2f2f2', 1.8)
      label(ctx, `+${(max * 100).toFixed(1)} cm`, rect.x - 5, rect.y + 5, 'right')
      label(ctx, '0', rect.x - 5, rect.y + rect.height / 2 + 3, 'right')
      label(ctx, `-${(max * 100).toFixed(1)} cm`, rect.x - 5, rect.y + rect.height, 'right')
      label(ctx, '−2.0 s', rect.x, size.height - 5, 'left')
      label(ctx, 'agora', rect.x + rect.width, size.height - 5, 'right')
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [engine, ref, size])

  return (
    <div className="chart-wrap">
      <canvas ref={ref} />
      <div className="chart-legend"><span className="amber">x(t) pista</span><span className="cyan">y(t) cabine</span></div>
    </div>
  )
}
