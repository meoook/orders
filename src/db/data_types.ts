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
