import { describe, expect, it } from 'vitest'
import { criarEstadoFiltro, gerarCoeficientes, processarAmostra } from './biquad'
import { fft } from './fft'

describe('biquad da suspensão', () => {
  it('mantém ganho DC unitário e polos estáveis', () => {
    const coefficients = gerarCoeficientes(340, 3200, 32000, 1000)
    const dcGain = (coefficients.b0 + coefficients.b1 + coefficients.b2)
      / (1 + coefficients.a1 + coefficients.a2)
    expect(dcGain).toBeCloseTo(1, 8)
    expect(coefficients.stable).toBe(true)
  })

  it('converge para uma entrada degrau', () => {
    const coefficients = gerarCoeficientes(340, 3200, 32000, 1000)
    const state = criarEstadoFiltro()
    let output = 0
    for (let i = 0; i < 10000; i += 1) output = processarAmostra(1, coefficients, state)
    expect(output).toBeCloseTo(1, 4)
  })
})

describe('FFT radix-2', () => {
  it('localiza um seno exatamente em um bin', () => {
    const n = 1024
    const bin = 17
    const signal = Float64Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * bin * i / n))
    const result = fft(signal)
    let peak = 1
    for (let i = 2; i < n / 2; i += 1) {
      if (Math.hypot(result.real[i], result.imag[i]) > Math.hypot(result.real[peak], result.imag[peak])) peak = i
    }
    expect(peak).toBe(bin)
  })
})
