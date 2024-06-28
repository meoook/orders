/// CONFIG
export interface CfgSql {
  host: string
  port: string | number
  user: string
  password: string
  database: string
}

export interface CfgLogger {
  level: string
  enableColors?: boolean
  writeToFile?: boolean
  folder?: string
  writeInterval?: number
}

export interface CfgApi {
  hostname: string
  port: string | number
}

export interface IConfig {
  timers: {
    keepAlife: number
    symbolRemove: number
    expire: number
  }
  logging: CfgLogger
  db: CfgSql
  api: CfgApi
}

/// ORDER
export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  NEW = 'NEW',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export interface BnOrder {
  orderID: number
  symbol: string
  origQty: number
  price: number
  side: OrderSide
  status: OrderStatus
  time: number
}

// Model types
export interface SqlOrderUpdate {
  order_id?: number
  status?: OrderStatus
  time?: number
}

export interface SqlOrderCreate {
  bot_id: number
  symbol: string
  order_id: number
  status: OrderStatus
  side: OrderSide
  quantity: number
  price: number
  time: number
  expire: number
}

export interface SqlOrder extends SqlOrderCreate {
  id: number
  api_key?: string
  api_secret?: string
}

export interface SqlAccount {
  // id: number
  // created: number
  // user_id: number
  // acc_name: string
  // pay_address: string
  // pay_min: number
  api_key: string
  api_secret: string
}
