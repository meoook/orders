import { IConfig, BnOrder, OrderSide, SqlOrderCreate, OrderStatus } from '../datatypes'
import Logger from '../logger'
import { BnBaseApi } from './base'

const logSystem = 'binance'

export default class BnApi {
  #api: BnBaseApi

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    this.log.d(logSystem, `Start ${logSystem} ${this.cfg.api.hostname}`)
    this.#api = new BnBaseApi(this.log)
  }

  orderGet = async (orderID: number): Promise<BnOrder | undefined> => {
    this.log.i(logSystem, `Try to get order id: ${orderID}`)

    return {
      orderID: 1,
      symbol: 'BNBUSDT',
      origQty: 0.12,
      price: 320,
      side: OrderSide.BUY,
      status: OrderStatus.CANCELED,
      time: 12345678,
    }
    const params = {
      symbol: order.symbol,
      isIsolated: true,
      orderId: orderID,
    }
    const response = await this.#api.requestApiMargin('get', 'margin/order', order.api_key, order.api_secret, params)
    return response
  }

  orderCreate = async (order: SqlOrderCreate, borrow: boolean): Promise<number> => {
    this.log.i(logSystem, `Try to create order ${order}`)
    const params = {
      symbol: order.symbol,
      side: order.side,
      type: Boolean(order.price) ? 'LIMIT' : 'MARKET',
      isIsolated: true,
      timeInForce: 'time_in_force',
      quantity: order.quantity,
      price: Boolean(order.price) ? order.price : null,
      sideEffectType: borrow ? 'MARGIN_BUY' : 'AUTO_REPAY',
    }
    const response = await this.#api.requestApiMargin('post', 'margin/order', order.api_key, order.api_secret, params)
    return response
  }

  orderDelete = async (order_id: number): Promise<boolean> => {
    // Return binance order
    this.log.i(logSystem, `Try to cancel order ${order_id}`)
    const params = {
      symbol: order.symbol,
      isIsolated: true,
      orderId: orderID,
    }
    const response = await this.#api.requestApiMargin('delete', 'margin/order', order.api_key, order.api_secret, params)
    return response
  }
}
