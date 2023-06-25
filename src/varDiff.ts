import events from 'events'
import StratumClient from './stratum/client'
import { CfgVariableDifficulty } from './datatype/config'


class RingBuffer {
  #data: number[] = []
  #cursor: number = 0
  #isFull: boolean = false

  constructor(private readonly maxSize: number) { }

  append = (value: number): void => {
    if (this.#isFull) {
      this.#data[this.#cursor] = value
      this.#cursor = (this.#cursor + 1) % this.maxSize
    }
    else {
      this.#data.push(value)
      this.#cursor++
      if (this.#data.length === this.maxSize) {
        this.#cursor = 0
        this.#isFull = true
      }
    }
  }

  get avg(): number {
    const sum = this.#data.reduce((a, b) => a + b)
    return sum / (this.#isFull ? this.maxSize : this.#cursor)
  }

  get isFull(): boolean { return !this.#isFull }

  clear = (): void => {
    this.#data = []
    this.#cursor = 0
    this.#isFull = false
  }
}


export default class VariableDifficulty extends events.EventEmitter {
  #bufferSize: number
  #tMin: number
  #tMax: number
  constructor(private readonly cfg: CfgVariableDifficulty) {
    super()
    const variance = this.cfg.targetTime * this.cfg.variancePercent / 100 | 0
    this.#bufferSize = (this.cfg.retargetTime / this.cfg.targetTime | 0) * 4
    this.#tMin = this.cfg.targetTime - variance
    this.#tMax = this.cfg.targetTime + variance
  }

  manageClient = (client: StratumClient): void => {
    let lastSubmitTs: number
    let lastRetargetTs: number
    let tsDeltaBuffer: RingBuffer

    client.on('submit', (): void => {
      const submitTs: number = (Date.now() / 1000) | 0

      if (!lastRetargetTs) { // First submit
        lastRetargetTs = submitTs - this.cfg.retargetTime / 2
        lastSubmitTs = submitTs
        tsDeltaBuffer = new RingBuffer(this.#bufferSize)
        return
      }

      const sinceLast: number = submitTs - lastSubmitTs
      tsDeltaBuffer.append(sinceLast)

      lastSubmitTs = submitTs

      // Check if time to retarget or buffer is full
      if (!tsDeltaBuffer.isFull && submitTs - lastRetargetTs < this.cfg.retargetTime) return

      lastRetargetTs = submitTs

      const average: number = tsDeltaBuffer.avg
      let ddiff: number = this.cfg.targetTime / average

      if (average > this.#tMax && client.difficulty > this.cfg.minDiff) {
        if (ddiff * client.difficulty < this.cfg.minDiff) ddiff = this.cfg.minDiff / client.difficulty
      } else if (average < this.#tMin) {
        if (ddiff * client.difficulty > this.cfg.maxDiff) ddiff = this.cfg.maxDiff / client.difficulty
      }
      else return

      const newDiff: number = this.#toFixed(client.difficulty * ddiff, 8)
      tsDeltaBuffer.clear()
      // client.enqueueDifficulty(newDiff)
      this.emit('newDifficulty', client, newDiff)
    })
  }

  // Truncate a number to a fixed amount of decimal places
  #toFixed = (num: number, len: number): number => parseFloat(num.toFixed(len))
}
