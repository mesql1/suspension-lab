/**
 * Coeficientes do sistema massa–mola–amortecedor usando Tustin com pre-warp.
 *
 * H(s) = (c s + k) / (m s² + c s + k)
 * s = K(1-z⁻¹)/(1+z⁻¹), K = ωn/tan(ωn Ts/2), ωn = √(k/m)
 *
 * Multiplicando numerador e denominador por (1+z⁻¹)²:
 * B0 = cK+k,       B1 = 2k,          B2 = k-cK
 * A0 = mK²+cK+k,   A1 = -2mK²+2k,   A2 = mK²-cK+k
 *
 * Todos são normalizados por A0, produzindo
 * y[n] = b0x[n]+b1x[n-1]+b2x[n-2]-a1y[n-1]-a2y[n-2].
 */
export function gerarCoeficientes(m, c, k, fs) {
  if (![m, c, k, fs].every(Number.isFinite) || m <= 0 || c < 0 || k <= 0 || fs <= 0) {
    throw new RangeError('m, k e fs devem ser positivos; c não pode ser negativo.')
  }

  const omegaN = Math.sqrt(k / m)
  const ts = 1 / fs
  const angle = Math.min(omegaN * ts * 0.5, Math.PI * 0.499999)
  const K = omegaN / Math.tan(angle)
  const K2 = K * K
  const A0 = m * K2 + c * K + k
  const A1 = -2 * m * K2 + 2 * k
  const A2 = m * K2 - c * K + k

  const coefficients = {
    b0: (c * K + k) / A0,
    b1: (2 * k) / A0,
    b2: (k - c * K) / A0,
    a1: A1 / A0,
    a2: A2 / A0,
    omegaN,
    K,
    fs,
  }
  const poles = polosDiscretos(coefficients)
  return {
    ...coefficients,
    poles,
    stable: poles.every((pole) => Math.hypot(pole.re, pole.im) < 1),
  }
}

export function criarEstadoFiltro() {
  return { x1: 0, x2: 0, y1: 0, y2: 0 }
}

export function processarAmostra(x, coefficients, state) {
  const y = coefficients.b0 * x
    + coefficients.b1 * state.x1
    + coefficients.b2 * state.x2
    - coefficients.a1 * state.y1
    - coefficients.a2 * state.y2

  state.x2 = state.x1
  state.x1 = x
  state.y2 = state.y1
  state.y1 = Number.isFinite(y) ? y : 0
  return state.y1
}

export function polosDiscretos({ a1, a2 }) {
  const discriminant = a1 * a1 - 4 * a2
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant)
    return [
      { re: (-a1 + root) / 2, im: 0 },
      { re: (-a1 - root) / 2, im: 0 },
    ]
  }
  const imag = Math.sqrt(-discriminant) / 2
  return [
    { re: -a1 / 2, im: imag },
    { re: -a1 / 2, im: -imag },
  ]
}

export function polosZerosContinuos(m, c, k) {
  const discriminant = c * c - 4 * m * k
  let poles
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant)
    poles = [
      { re: (-c + root) / (2 * m), im: 0 },
      { re: (-c - root) / (2 * m), im: 0 },
    ]
  } else {
    poles = [
      { re: -c / (2 * m), im: Math.sqrt(-discriminant) / (2 * m) },
      { re: -c / (2 * m), im: -Math.sqrt(-discriminant) / (2 * m) },
    ]
  }
  return { poles, zeros: [{ re: -k / c, im: 0 }] }
}
