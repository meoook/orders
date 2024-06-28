import { OrderSide, OrderStatus, SqlOrder, BnOrder } from '../datatypes'
import Logger from '../logger'
import { BnBaseApi } from './base'

const logSystem = 'binance'

export default class BnApi {
  #api: BnBaseApi

  constructor(private readonly log: Logger) {
    this.log.d(logSystem, `Start ${logSystem}`)
    this.#api = new BnBaseApi(this.log)
  }

  orderGet = async (order: SqlOrder): Promise<BnOrder | undefined> => {
    if (!order.api_key || !order.api_secret) throw new Error(`Fail to get order id: ${order.id} - no credentials`)
    this.log.i(logSystem, `Try to get order with biance id: ${order.order_id}`)
    const params = {
      symbol: order.symbol,
      isIsolated: true,
      orderId: order.order_id,
    }
    const response = await this.#api.requestApiMargin('get', 'margin/order', order.api_key, order.api_secret, params)
    return this.#serializeOrder(response)
  }

  orderCreate = async (order: SqlOrder): Promise<number> => {
    let borrow: boolean = false
    const apiOrder = await this.#orderCreate(order, borrow)
    return apiOrder.order_id
  }

  orderDelete = async (order: SqlOrder): Promise<BnOrder> => {
    if (!order.api_key || !order.api_secret) throw new Error(`Fail to create order id: ${order.id} - no credentials`)

    this.log.i(logSystem, `Try to cancel order with binance id: ${order.order_id}`)
    const params = {
      symbol: order.symbol,
      isIsolated: true,
      orderId: order.order_id,
    }
    const response = await this.#api.requestApiMargin('delete', 'margin/order', order.api_key, order.api_secret, params)
    return this.#serializeOrder(response)
  }

  #orderCreate = async (order: SqlOrder, borrow: boolean): Promise<BnOrder> => {
    if (!order.api_key || !order.api_secret) throw new Error(`Fail to create order id: ${order.id} - no credentials`)
    const details: string = `quantity ${order.quantity} price ${order.price}` + borrow ? ' (borrow)' : ''
    this.log.i(logSystem, `Try to create ${order.side} order for ${order.symbol} with ${details}`)
    const params = {
      symbol: order.symbol,
      side: order.side,
      type: Boolean(order.price) ? 'LIMIT' : 'MARKET',
      isIsolated: true,
      timeInForce: 'GTC',
      quantity: order.quantity,
      price: Boolean(order.price) ? order.price : null,
      newOrderRespType: 'RESULT',
      sideEffectType: borrow ? 'MARGIN_BUY' : 'AUTO_REPAY',
    }
    const response = await this.#api.requestApiMargin('post', 'margin/order', order.api_key, order.api_secret, params)
    return this.#serializeOrder(response)
  }

  #serializeOrder = (data: any): BnOrder => {
    return {
      symbol: data.symbol,
      order_id: data.orderId,
      status: OrderStatus[data.status as keyof typeof OrderStatus],
      side: OrderSide[data.side as keyof typeof OrderSide],
      quantity: data.origQty,
      price: data.price,
      time: data.transactTime ? data.transactTime : 0,
    }
  }
}
