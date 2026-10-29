import { useEffect, useRef } from 'react'
import { formatNumber } from '../utils/format'

function springPath(top, bottom) {
  const x = 122
  const lead = 10
  const turns = 7
  const usable = Math.max(24, bottom - top - lead * 2)
  const points = [`M ${x} ${top}`, `L ${x} ${top + lead}`]
  for (let index = 0; index <= turns; index += 1) {
    const y = top + lead + usable * index / turns
    const offset = index === 0 || index === turns ? 0 : index % 2 ? -12 : 12
    points.push(`L ${x + offset} ${y}`)
  }
  points.push(`L ${x} ${bottom}`)
  return points.join(' ')
}

export function QuarterCarDiagram({ engine, params }) {
  const massRef = useRef(null)
  const wheelRef = useRef(null)
  const springRef = useRef(null)
  const damperBodyRef = useRef(null)
  const damperRodRef = useRef(null)
  const inputRef = useRef(null)
  const outputRef = useRef(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      const { xFront, y } = engine.current
      const massY = 48 - Math.max(-12, Math.min(12, y * 150))
      const wheelY = 157 - Math.max(-14, Math.min(14, xFront * 150))
      massRef.current?.setAttribute('transform', `translate(0 ${massY - 48})`)
      wheelRef.current?.setAttribute('transform', `translate(0 ${wheelY - 157})`)
      springRef.current?.setAttribute('d', springPath(massY + 45, wheelY - 18))
      damperBodyRef.current?.setAttribute('y1', massY + 45)
      damperBodyRef.current?.setAttribute('y2', Math.max(massY + 60, wheelY - 38))
      damperRodRef.current?.setAttribute('y1', Math.max(massY + 60, wheelY - 38))
      damperRodRef.current?.setAttribute('y2', wheelY - 18)
      if (inputRef.current) inputRef.current.textContent = `x(t) ${formatNumber(xFront * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} cm`
      if (outputRef.current) outputRef.current.textContent = `y(t) ${formatNumber(y * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} cm`
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [engine])

  return (
    <div className="quarter-car">
      <svg viewBox="0 0 320 220" role="img" aria-label="Esquema animado de massa, mola e amortecedor do modelo de quarto de carro">
        <g ref={massRef}>
          <rect className="qc-mass" x="72" y="22" width="176" height="70" />
          <text className="qc-main-label" x="160" y="53" textAnchor="middle">MASSA SUSPENSA</text>
          <text x="160" y="74" textAnchor="middle">m</text>
        </g>

        <path ref={springRef} className="qc-spring" d={springPath(93, 139)} />
        <text className="qc-symbol" x="91" y="122">k</text>

        <line ref={damperBodyRef} className="qc-damper-body" x1="198" y1="93" x2="198" y2="119" />
        <rect className="qc-damper-box" x="184" y="110" width="28" height="20" />
        <line ref={damperRodRef} className="qc-damper-rod" x1="198" y1="119" x2="198" y2="139" />
        <text className="qc-symbol" x="224" y="122">c</text>

        <g ref={wheelRef}>
          <line className="qc-axle" x1="104" y1="139" x2="216" y2="139" />
          <circle className="qc-wheel" cx="160" cy="157" r="23" />
          <circle className="qc-hub" cx="160" cy="157" r="7" />
        </g>

        <path className="qc-road" d="M 30 192 L 92 192 L 108 184 L 124 200 L 140 184 L 156 200 L 172 184 L 188 200 L 204 184 L 220 192 L 290 192" />
        <path className="qc-arrow output" d="M 268 78 L 268 28 M 261 36 L 268 28 L 275 36" />
        <path className="qc-arrow input" d="M 49 199 L 49 165 M 42 173 L 49 165 L 56 173" />
        <text ref={outputRef} className="qc-reading output" x="286" y="54" textAnchor="end">y(t) 0,0 cm</text>
        <text ref={inputRef} className="qc-reading input" x="30" y="215">x(t) 0,0 cm</text>
      </svg>
      <div className="qc-parameters">
        <span><b>m</b>{formatNumber(params.m)} kg</span>
        <span><b>k</b>{formatNumber(params.k)} N/m</span>
        <span><b>c</b>{formatNumber(params.c)} N·s/m</span>
      </div>
      <p><b>x(t)</b> pista → mola + amortecedor → <b>y(t)</b> carroceria</p>
    </div>
  )
}
