
// Model types
export interface SqlAccount {
  id: number
  created: number
  user_id: number
  acc_name: string
  pay_adderss: string
  pay_min: number
}

export interface SqlWorker {
  id: number
  created: number
  last_online: number
  acc_name: string
  worker_name: string
  difficulty: number
}

export interface SqlShare {
  id: number
  worker_id: number
  job_diff: number
  is_valid: boolean
  block_hash?: string
}

export interface SqlIncomes {
  id: number
  created: number
  worker_id: number
  hashrate: number
  shares_amount: number
  pay_amount: number
  is_payed: boolean
}
