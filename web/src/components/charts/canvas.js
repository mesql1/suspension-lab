export function setupCanvas(canvas, size) {
  canvas.width = Math.round(size.width * size.dpr)
  canvas.height = Math.round(size.height * size.dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
  ctx.clearRect(0, 0, size.width, size.height)
  return ctx
}

export function drawGrid(ctx, rect, xDivisions = 8, yDivisions = 4) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i <= xDivisions; i += 1) {
    const x = rect.x + rect.width * i / xDivisions
    ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.height); ctx.stroke()
  }
  for (let i = 0; i <= yDivisions; i += 1) {
    const y = rect.y + rect.height * i / yDivisions
    ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.width, y); ctx.stroke()
  }
  ctx.restore()
}

export function label(ctx, text, x, y, align = 'left', color = '#858585') {
  ctx.fillStyle = color
  ctx.font = '10px JetBrains Mono, monospace'
  ctx.textAlign = align
  ctx.fillText(text, x, y)
}

export function trace(ctx, points, color, width = 1.5, dash = []) {
  if (!points.length) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1])
  ctx.stroke()
  ctx.restore()
}
