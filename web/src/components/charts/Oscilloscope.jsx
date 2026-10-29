import { useEffect, useRef, useState } from 'react'
import { useCanvasSize } from '../../hooks/useCanvasSize'
import { drawGrid, label, setupCanvas, trace } from './canvas'
import { formatFixed } from '../../utils/format'

export function Oscilloscope({ engine }) {
  const [ref, size] = useCanvasSize()
  const [paused, setPaused] = useState(false)
  const frozenSamples = useRef(null)

  const togglePaused = () => {
    if (!paused) frozenSamples.current = engine.copyTimeSeries(2000)
    setPaused((current) => !current)
  }

  useEffect(() => {
    let frame = 0
    let lastDraw = 0
    const draw = (now) => {
      frame = requestAnimationFrame(draw)
      if (!ref.current || now - lastDraw < 33) return
      lastDraw = now
      const ctx = setupCanvas(ref.current, size)
      const rect = { x: 62, y: 10, width: size.width - 72, height: size.height - 30 }
      drawGrid(ctx, rect, 10, 4)
      const samples = paused && frozenSamples.current ? frozenSamples.current : engine.copyTimeSeries(2000)
      const excitationLimit = engine.params.waveAmplitude + engine.params.roughnessAmplitude + engine.params.noiseAmplitude
      const max = Math.max(0.04, excitationLimit * 1.35)
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
      label(ctx, `+${formatFixed(max * 100, 1)} cm`, rect.x - 5, rect.y + 10, 'right')
      label(ctx, '0', rect.x - 5, rect.y + rect.height / 2 + 3, 'right')
      label(ctx, `−${formatFixed(max * 100, 1)} cm`, rect.x - 5, rect.y + rect.height - 3, 'right')
      label(ctx, '−2.0 s', rect.x, size.height - 5, 'left')
      label(ctx, 'agora', rect.x + rect.width, size.height - 5, 'right')
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [engine, paused, ref, size])

  return (
    <div className="oscilloscope-wrap">
      <div className="chart-toolbar">
        <span className={`live-indicator ${paused ? 'paused' : ''}`}><i /> {paused ? 'PAUSADO' : 'AO VIVO'}</span>
        <button type="button" onClick={togglePaused}>{paused ? 'RETOMAR' : 'PAUSAR'}</button>
      </div>
      <div className="chart-wrap">
        <canvas ref={ref} />
        <div className="chart-legend"><span className="amber">x(t) pista</span><span className="cyan">y(t) cabine</span></div>
      </div>
    </div>
  )
}
