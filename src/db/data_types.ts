// Model types
export interface SqlAccount {
  id: number
  created: number
  user_id: number
  acc_name: string
  pay_adderss: string
  pay_min: number
}

export interface SqlOrder {
  id: number
  bot_id: number
  symbol: string
  side: string
  quantity: number
  price: number
  fee: number
  time: number
  expire: number
  filled: boolean
  order_id: number
}
