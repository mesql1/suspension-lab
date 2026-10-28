function complexDivide(nr, ni, dr, di) {
  const denom = dr * dr + di * di
  return { re: (nr * dr + ni * di) / denom, im: (ni * dr - nr * di) / denom }
}

export function respostaEmFrequencia(m, c, k, coefficients, frequencies) {
  const continuousMagnitude = new Float64Array(frequencies.length)
  const continuousPhase = new Float64Array(frequencies.length)
  const discreteMagnitude = new Float64Array(frequencies.length)
  const discretePhase = new Float64Array(frequencies.length)

  for (let i = 0; i < frequencies.length; i += 1) {
    const omega = 2 * Math.PI * frequencies[i]
    const continuous = complexDivide(k, c * omega, k - m * omega * omega, c * omega)
    continuousMagnitude[i] = 20 * Math.log10(Math.max(Math.hypot(continuous.re, continuous.im), 1e-12))
    continuousPhase[i] = Math.atan2(continuous.im, continuous.re) * 180 / Math.PI

    const theta = omega / coefficients.fs
    const c1 = Math.cos(theta)
    const s1 = -Math.sin(theta)
    const c2 = Math.cos(2 * theta)
    const s2 = -Math.sin(2 * theta)
    const nr = coefficients.b0 + coefficients.b1 * c1 + coefficients.b2 * c2
    const ni = coefficients.b1 * s1 + coefficients.b2 * s2
    const dr = 1 + coefficients.a1 * c1 + coefficients.a2 * c2
    const di = coefficients.a1 * s1 + coefficients.a2 * s2
    const discrete = complexDivide(nr, ni, dr, di)
    discreteMagnitude[i] = 20 * Math.log10(Math.max(Math.hypot(discrete.re, discrete.im), 1e-12))
    discretePhase[i] = Math.atan2(discrete.im, discrete.re) * 180 / Math.PI
  }
  return { frequencies, continuousMagnitude, continuousPhase, discreteMagnitude, discretePhase }
}

export function frequenciasLog(min, max, count) {
  const result = new Float64Array(count)
  const start = Math.log10(min)
  const span = Math.log10(max) - start
  for (let i = 0; i < count; i += 1) result[i] = 10 ** (start + span * i / (count - 1))
  return result
}

export function encontrarCorte(response) {
  // Primeira travessia descendente em -3 dB depois do maior pico.
  let peak = 0
  for (let i = 1; i < response.continuousMagnitude.length; i += 1) {
    if (response.continuousMagnitude[i] > response.continuousMagnitude[peak]) peak = i
  }
  for (let i = peak + 1; i < response.frequencies.length; i += 1) {
    if (response.continuousMagnitude[i] <= -3) return response.frequencies[i]
  }
  return null
}
