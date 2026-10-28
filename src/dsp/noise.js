// Filtro de ruído rosa de Paul Kellet. O estado é mutável para evitar alocações.
export function criarEstadoRuidoRosa() {
  return { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, seed: 0x1234abcd }
}

function randomBipolar(state) {
  // PRNG xorshift32 reproduzível; evita depender de Math.random nos testes.
  let x = state.seed | 0
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  state.seed = x | 0
  return ((x >>> 0) / 4294967296) * 2 - 1
}

export function ruidoRosa(state) {
  const white = randomBipolar(state)
  state.b0 = 0.99886 * state.b0 + white * 0.0555179
  state.b1 = 0.99332 * state.b1 + white * 0.0750759
  state.b2 = 0.96900 * state.b2 + white * 0.1538520
  state.b3 = 0.86650 * state.b3 + white * 0.3104856
  state.b4 = 0.55000 * state.b4 + white * 0.5329522
  state.b5 = -0.7616 * state.b5 - white * 0.0168980
  const pink = state.b0 + state.b1 + state.b2 + state.b3 + state.b4 + state.b5 + state.b6 + white * 0.5362
  state.b6 = white * 0.115926
  return pink * 0.11
}
