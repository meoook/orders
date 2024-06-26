import { IConfig, IOrder, OrderSide, SqlOrderCreateParams } from '../datatypes'
import Logger from '../logger'

const logSystem = 'binance'

export default class BnApi {
  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    this.log.d(logSystem, `Start ${logSystem} ${this.cfg.api.hostname}`)
  }

  orderGet = async (orderID: number): Promise<IOrder | undefined> => {
    this.log.i(logSystem, `Try to get order id: ${orderID}`)

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

  orderCreate = async (order: SqlOrderCreateParams): Promise<number> => {
    this.log.i(logSystem, `Try to create order ${order}`)
    // const params = {
    //   symbol: 'symbol',
    //   side: 'side',
    //   type: 'order_type',
    //   isIsolated: 'isolated',
    //   timeInForce: 'time_in_force',
    //   quantity: 'quantity',
    //   quoteOrderQty: 'quote_qty',
    //   price: 'price',
    //   stopPrice: 'stop_price',
    //   newClientOrderId: 'client_id',
    //   icebergQty: 'iceberg_qty',
    //   newOrderRespType: 'ACK', // ACK, RESULT, FULL
    //   sideEffectType: 'side_effect',
    // }
    return 123
  }

  orderDelete = async (order_id: number): Promise<boolean> => {
    this.log.i(logSystem, `Try to cancel order ${order_id}`)
    return true
  }
}
