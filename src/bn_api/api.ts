import Logger from '../logger'
import { ApiErrorCode, BnApiException, BnBaseApi } from './base'
import { OrderSide, OrderStatus, SqlOrder, BnOrder, IConfig } from '../datatypes'

const logSystem = 'binance'

export default class BnApi {
  #TRIES_MAX: number = 4
  #api: BnBaseApi

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
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

  orderCreate = async (order: SqlOrder): Promise<number> => {
    let borrow: boolean = false
    let quantity: number = order.quantity

    for (let tryN = 0; tryN < this.#TRIES_MAX; tryN++) {
      const details: string = `${order.side} order quantity=${quantity} price=${order.price}`
      try {
        const apiOrder = await this.#orderCreate(order, quantity, borrow)
        return apiOrder.order_id
      } catch (err) {
        if (err instanceof BnApiException) {
          const _try: string = `try:(${tryN} of ${this.#TRIES_MAX})`
          const fail: string = `Failed to create ${details}`
          if (err.code === ApiErrorCode.HAS_PENDING_TRANSACTION) {
            this.log.w(logSystem, `${fail} - API have pending transaction. Retry after ${tryN}s ${_try}`)
            await this.#sleep(tryN)
          } else if (err.code === ApiErrorCode.NEW_ORDER_REJECTED && !borrow) {
            borrow = true
            this.log.w(logSystem, `${fail} - retry with borrow=${borrow} ${_try}`)
          } else if (err.code === ApiErrorCode.SYSTEM) {
            this.log.w(logSystem, `${fail} - system asset error ${_try}`)
            // TODO: mb throw
            // throw new Error('system asset error')
          } else if (err.code === ApiErrorCode.INVALID_MESSAGE && err.message.indexOf('NOTIONAL') !== -1) {
            quantity = this.#quantityFix(order, quantity)
            this.log.w(logSystem, `${fail} - retry with quantity=${quantity} ${_try}`)
          } else if (err.code === ApiErrorCode.SYSTEM_BUSY) {
            this.log.w(logSystem, `${fail} - system busy, retry ${_try}`)
            await this.#sleep(1)
          } else if (err.code === ApiErrorCode.BAD_PRECISION) {
            throw new Error(`quantity=${quantity} or price=${order.price} precision error`)
          } else if (err.code === ApiErrorCode.MARGIN_NOT_SUFFICIENT) {
            throw new Error('margin balance insufficient')
          } else if (err.code === ApiErrorCode.BORROWABLE_LIMIT) {
            throw new Error('borrowable limit exceeding')
          }
        } else {
          this.log.e(logSystem, `Failed to create order id: ${order.id} - unknown error: ${err}`)
          throw new Error(`Failed to create order id: ${order.id} - unknown error: ${err}`)
        }
      }
    }
    throw new Error(`Failed to create order id: ${order.id} - try limit reached`)
  }

  #orderCreate = async (order: SqlOrder, quantity: number, borrow: boolean): Promise<BnOrder> => {
    if (!order.api_key || !order.api_secret) throw new Error(`Fail to create order id: ${order.id} - no credentials`)
    const details: string = `quantity ${order.quantity} price ${order.price}` + borrow ? ' (borrow)' : ''
    this.log.i(logSystem, `Try to create ${order.side} order for ${order.symbol} with ${details}`)
    const params = {
      symbol: order.symbol,
      side: order.side,
      type: Boolean(order.price) ? 'LIMIT' : 'MARKET',
      isIsolated: true,
      timeInForce: 'GTC',
      quantity: quantity,
      price: Boolean(order.price) ? order.price : null,
      newOrderRespType: 'RESULT',
      sideEffectType: borrow ? 'MARGIN_BUY' : 'AUTO_REPAY',
    }
    this.log.d(logSystem, `Create order with params ${params}`)
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

  #quantityFix = (order: SqlOrder, quantity: number): number => {
    const decimals: number = order.qty_step ? this.#getDecimalPlaces(order.qty_step) : this.#getDecimalPlaces(quantity)
    const qtyStep: number = order.qty_step ? order.qty_step : this.#getQtyStep(decimals)
    if (!order.base || !order.quote) return this.#round(quantity + qtyStep, decimals)
    const price: number = order.price ? order.price * order.quote : order.base
    const minQuantity: number = this.#round(this.cfg.minOrder / price, decimals)
    if (quantity <= minQuantity) return this.#round(minQuantity + qtyStep, decimals)
    return this.#round(quantity + qtyStep, decimals)
  }

  #getDecimalPlaces = (num: number) => {
    const numStr = num.toString()
    const pointIndex = numStr.indexOf('.')
    if (pointIndex === -1) return 0
    return numStr.length - pointIndex - 1
  }

  #getQtyStep = (decimals: number): number => {
    const result: number = Math.pow(0.1, decimals)
    return this.#round(result, decimals)
  }

  #round = (value: number, decimals: number) => Number(value.toFixed(decimals))
  #sleep = (seconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}
