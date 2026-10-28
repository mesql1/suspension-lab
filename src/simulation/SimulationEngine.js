import { criarEstadoFiltro, gerarCoeficientes, processarAmostra } from '../dsp/biquad'
import { criarEstadoRuidoRosa, ruidoRosa } from '../dsp/noise'
import { RingBuffer } from '../dsp/ringBuffer'

const DEFAULTS = {
  m: 340,
  c: 3200,
  k: 32000,
  speed: 18,
  waveAmplitude: 0.055,
  roughnessAmplitude: 0.018,
  noiseAmplitude: 0.012,
}

export class SimulationEngine {
  constructor(options = {}) {
    this.fs = 1000
    this.dt = 1 / this.fs
    this.params = { ...DEFAULTS, ...options }
    this.coefficients = gerarCoeficientes(this.params.m, this.params.c, this.params.k, this.fs)
    this.frontState = criarEstadoFiltro()
    this.rearState = criarEstadoFiltro()
    this.noiseState = criarEstadoRuidoRosa()
    this.input = new RingBuffer(32768)
    this.output = new RingBuffer(32768)
    this.roadHistory = new RingBuffer(32768)
    this.time = 0
    this.accumulator = 0
    this.current = { xFront: 0, xRear: 0, yFront: 0, yRear: 0, y: 0, pitch: 0 }
  }

  setParams(next) {
    const filterChanged = next.m !== undefined || next.c !== undefined || next.k !== undefined
    Object.assign(this.params, next)
    if (filterChanged) {
      // Estados x1/x2/y1/y2 são deliberadamente preservados: o filtro muda sem reset.
      this.coefficients = gerarCoeficientes(this.params.m, this.params.c, this.params.k, this.fs)
    }
  }

  generateRoadSample(t) {
    const { waveAmplitude, roughnessAmplitude, noiseAmplitude } = this.params
    const low = waveAmplitude * (
      0.72 * Math.sin(2 * Math.PI * 0.42 * t + 0.3)
      + 0.28 * Math.sin(2 * Math.PI * 1.15 * t + 1.7)
    )
    const high = roughnessAmplitude * (
      0.58 * Math.sin(2 * Math.PI * 13 * t + 0.8)
      + 0.27 * Math.sin(2 * Math.PI * 27 * t + 2.2)
      + 0.15 * Math.sin(2 * Math.PI * 46 * t + 0.1)
    )
    return low + high + noiseAmplitude * ruidoRosa(this.noiseState)
  }

  step() {
    const xFront = this.generateRoadSample(this.time)
    this.roadHistory.push(xFront)
    const axleDelay = 2.72 / Math.max(this.params.speed, 1)
    const xRear = this.roadHistory.getDelayed(axleDelay * this.fs)
    const yFront = processarAmostra(xFront, this.coefficients, this.frontState)
    const yRear = processarAmostra(xRear, this.coefficients, this.rearState)
    const x = (xFront + xRear) * 0.5
    const y = (yFront + yRear) * 0.5

    this.input.push(x)
    this.output.push(y)
    this.current.xFront = xFront
    this.current.xRear = xRear
    this.current.yFront = yFront
    this.current.yRear = yRear
    this.current.y = y
    this.current.pitch = Math.atan2(yFront - yRear, 2.72)
    this.time += this.dt
  }

  advance(realDeltaSeconds) {
    this.accumulator += Math.min(realDeltaSeconds, 0.1)
    let steps = 0
    while (this.accumulator >= this.dt && steps < 120) {
      this.step()
      this.accumulator -= this.dt
      steps += 1
    }
  }

  roadAtDistance(distanceBehindFront) {
    const delaySeconds = Math.max(0, distanceBehindFront) / Math.max(this.params.speed, 1)
    return this.roadHistory.getDelayed(delaySeconds * this.fs)
  }

  copyTimeSeries(length = 2000) {
    const x = new Float64Array(length)
    const y = new Float64Array(length)
    this.input.copyLatest(x)
    this.output.copyLatest(y)
    return { x, y, fs: this.fs }
  }
}

export const suspensionPresets = {
  Conforto: { m: 360, k: 24000, c: 3600 },
  Esportivo: { m: 320, k: 52000, c: 4800 },
  Subamortecido: { m: 340, k: 36000, c: 900 },
  Superamortecido: { m: 340, k: 30000, c: 9000 },
}
