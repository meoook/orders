import { dhash } from '../util.js'

export default class MerkleTree {
  readonly steps: Buffer[] = []

  constructor(data: Buffer[]) {
    this.#calculateSteps(data)
  }

  #calculateSteps = (data: Buffer[]): void => {
    if (data.length === 0) return
    const emptyBuffer: Buffer = Buffer.alloc(1)
    let arr: Buffer[] = [emptyBuffer, ...data]
    let arrLen: number = arr.length

    while (true) {
      if (arrLen === 1) break
      this.steps.push(arr[1])
      if (arrLen % 2) arr.push(arr[arr.length - 1])
      const tempArr: Buffer[] = []
      const rangeArr = this.#range(2, arrLen, 2)
      rangeArr.forEach(idx => tempArr.push(this.#merkleJoin(arr[idx], arr[idx + 1])))
      arr = [emptyBuffer, ...tempArr]
      arrLen = arr.length
    }
  }

  withFirst = (buff: Buffer): Buffer => {
    let result = Buffer.from(buff)
    this.steps.forEach((s) => result = dhash(Buffer.concat([result, s])))
    return result
  }

  #merkleJoin = (hash1: Buffer, hash2: Buffer): Buffer => dhash(Buffer.concat([hash1, hash2]))

  #range = (start: number, stop?: number, step?: number): number[] => {
    if (!stop) [start, stop] = [0, start]
    if (!step) step = 1
    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) return []
    const result: number[] = []
    for (let i = start; step > 0 ? i < stop : i > stop; i += step)
      result.push(i)
    return result
  }
}

