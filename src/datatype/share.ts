export interface WorkerShare {
  jobID: string
  extraNonce2: string
  nTime: string
  nonce: string
  versionMask?: string
}

export interface WorkerInfo {
  id: number // Sql ID
  ip: string  // Worker IP
  account: string  // Miner account
  name: string  // Miner name
  // sqlid: ??
  extraNonce1: string  // Worker part of extranonce
  difficulty: number  // Difficulty set to miner worker
  difficultyPrev: number  // Difficulty before (if diff was changed)
}

export interface PoolShare {
  workerID: number
  height?: number
  blockReward?: number
  jobDiff: number
  blockHash?: string
  blockHex?: string
  valid: boolean
}
