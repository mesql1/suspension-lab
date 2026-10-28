import { useEffect } from 'react'
import { espectroMagnitude } from '../../dsp/fft'
import { useCanvasSize } from '../../hooks/useCanvasSize'
import { drawGrid, label, setupCanvas, trace } from './canvas'

export function SpectrumPlot({ engine }) {
  const [ref, size] = useCanvasSize()

  useEffect(() => {
    let frame = 0
    let lastDraw = 0
    const draw = (now) => {
      frame = requestAnimationFrame(draw)
      if (!ref.current || now - lastDraw < 180) return
      lastDraw = now
      const ctx = setupCanvas(ref.current, size)
      const rect = { x: 40, y: 10, width: size.width - 50, height: size.height - 30 }
      drawGrid(ctx, rect, 10, 4)
      const samples = engine.copyTimeSeries(2048)
      const sx = espectroMagnitude(samples.x, samples.fs)
      const sy = espectroMagnitude(samples.y, samples.fs)
      const xFor = (f) => rect.x + f / 100 * rect.width
      const yFor = (db) => rect.y + (-5 - Math.max(-85, Math.min(-5, db))) / 80 * rect.height
      const road = []
      const cabin = []
      for (let i = 1; i < sx.frequencies.length && sx.frequencies[i] <= 100; i += 1) {
        road.push([xFor(sx.frequencies[i]), yFor(sx.db[i])])
        cabin.push([xFor(sy.frequencies[i]), yFor(sy.db[i])])
      }
      trace(ctx, road, '#ffb44a', 1.1)
      trace(ctx, cabin, '#5ee7f0', 1.5)
      ;[-80, -60, -40, -20].forEach((db) => label(ctx, `${db}`, rect.x - 5, yFor(db) + 3, 'right'))
      ;[0, 20, 40, 60, 80, 100].forEach((f) => label(ctx, `${f}`, xFor(f), size.height - 5, f === 0 ? 'left' : f === 100 ? 'right' : 'center'))
      label(ctx, 'dB', rect.x + 3, rect.y + 11, 'left', '#91a9b6')
      label(ctx, 'Hz', rect.x + rect.width - 2, rect.y + 11, 'right', '#91a9b6')
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [engine, ref, size])

  return (
    <div className="chart-wrap">
      <canvas ref={ref} />
      <div className="chart-legend"><span className="amber">entrada</span><span className="cyan">saída</span></div>
    </div>
  )
}
