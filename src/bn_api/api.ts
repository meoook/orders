import { IConfig } from '../datatypes'
import { SqlOrderCreateParams } from '../db/datatypes'
import Logger from '../logger'
import { OrderSide } from './datatypes'

const logSystem = 'binance'

export interface IOrder {
  orderID: number
  symbol: string
  origQty: number
  price: number
  side: OrderSide
  status: string // 'CANCELED'
  time: number
}

export default class BnApi {
  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    this.log.d(logSystem, `Start ${logSystem} ${this.cfg.api.hostname}`)
  }

  orderGet = async (orderID: number): Promise<IOrder | undefined> => {
    this.log.i(logSystem, `Try to get order id ${orderID}`)
    return {
      orderID: 1,
      symbol: 'BNBUSDT',
      origQty: 0.12,
      price: 320,
      side: OrderSide.BUY,
      status: 'CANCELED',
      time: 12345678,
    }
  }
  orderCreate = async (order: SqlOrderCreateParams): Promise<number | undefined> => {
    this.log.i(logSystem, `Try to create order ${order}`)
    return 123
  }

  orderDelete = async (order_id: number): Promise<boolean> => {
    this.log.i(logSystem, `Try to cancel order ${order_id}`)
    return true
  }
}
