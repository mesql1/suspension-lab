export function fft(realInput) {
  const n = realInput.length
  if (n < 2 || (n & (n - 1)) !== 0) throw new RangeError('FFT exige tamanho potência de 2.')

  const real = Float64Array.from(realInput)
  const imag = new Float64Array(n)

  // Permutação bit-reversal in-place.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    while (j & bit) { j ^= bit; bit >>= 1 }
    j ^= bit
    if (i < j) {
      const temp = real[i]
      real[i] = real[j]
      real[j] = temp
    }
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = -2 * Math.PI / size
    for (let start = 0; start < n; start += size) {
      for (let j = 0; j < half; j += 1) {
        const angle = step * j
        const wr = Math.cos(angle)
        const wi = Math.sin(angle)
        const even = start + j
        const odd = even + half
        const tr = wr * real[odd] - wi * imag[odd]
        const ti = wr * imag[odd] + wi * real[odd]
        real[odd] = real[even] - tr
        imag[odd] = imag[even] - ti
        real[even] += tr
        imag[even] += ti
      }
    }
  }
  return { real, imag }
}

export function espectroMagnitude(samples, fs) {
  const n = samples.length
  const windowed = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
    windowed[i] = samples[i] * hann
  }
  const result = fft(windowed)
  const bins = n / 2
  const frequencies = new Float64Array(bins)
  const db = new Float64Array(bins)
  for (let i = 0; i < bins; i += 1) {
    frequencies[i] = i * fs / n
    const magnitude = (2 / n) * Math.hypot(result.real[i], result.imag[i])
    db[i] = 20 * Math.log10(Math.max(magnitude, 1e-8))
  }
  return { frequencies, db }
}
