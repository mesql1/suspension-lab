import { useEffect } from 'react'
import { useCanvasSize } from '../../hooks/useCanvasSize'
import { drawGrid, label, setupCanvas, trace } from './canvas'

export function ValidationPlot({ controller, status }) {
  const [ref, size] = useCanvasSize()

  useEffect(() => {
    let frame = 0
    let lastDraw = 0
    const draw = (now) => {
      frame = requestAnimationFrame(draw)
      if (!ref.current || now - lastDraw < 100) return
      lastDraw = now
      const ctx = setupCanvas(ref.current, size)
      const rect = { x: 42, y: 12, width: size.width - 54, height: size.height - 34 }
      drawGrid(ctx, rect, 8, 4)
      const errors = controller.copyErrors(512)
      let max = 1e-6
      for (let i = 0; i < errors.length; i += 1) max = Math.max(max, Math.abs(errors[i]))
      max *= 1.15
      const points = []
      for (let i = 0; i < errors.length; i += 1) {
        points.push([
          rect.x + i / (errors.length - 1) * rect.width,
          rect.y + rect.height * (0.5 - errors[i] / (2 * max)),
        ])
      }
      trace(ctx, points, status.mode !== 'simulation' ? '#d8d8d8' : '#666666', 1.35)
      label(ctx, `+${(max * 1e6).toFixed(1)} µm`, rect.x - 5, rect.y + 5, 'right')
      label(ctx, '0', rect.x - 5, rect.y + rect.height / 2 + 3, 'right')
      label(ctx, `-${(max * 1e6).toFixed(1)} µm`, rect.x - 5, rect.y + rect.height, 'right')
      label(ctx, 'y_target − y_ref', rect.x + 4, rect.y + 12, 'left', '#9a9a9a')
      if (status.mode === 'simulation') label(ctx, 'Selecione um target para iniciar a validação', rect.x + rect.width / 2, rect.y + rect.height / 2 - 7, 'center', '#777777')
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [controller, ref, size, status.mode])

  return (
    <div className="validation-wrap">
      <div className="validation-summary">
        <div><span>ERRO RMS</span><strong>{(status.errorRms * 1e6).toFixed(2)} <small>µm</small></strong></div>
        <div><span>ERRO MÁX.</span><strong>{(status.errorMax * 1e6).toFixed(2)} <small>µm</small></strong></div>
      </div>
      <div className="chart-wrap validation-chart"><canvas ref={ref} /></div>
    </div>
  )
}
