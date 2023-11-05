export enum OrderStatus {
  NEW = 'NEW',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

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
  order_id: number
  status: OrderStatus
  side: string
  quantity: number
  price: number
  time: number
  expire: number
  api_key?: string
  api_secret?: string
}

export interface SqlOrderUpdateParams {
  order_id?: number
  status?: OrderStatus
  time?: number
}

export interface SqlOrderCreateParams {
  bot_id: number
  symbol: string
  order_id: number
  status: OrderStatus
  side: string
  quantity: number
  price: number
  time: number
  expire: number
}
