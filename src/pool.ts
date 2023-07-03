import Logger from './logger'
import OrdersMonitor from './symbols/monitor.js'
import { IConfig } from './datatype/config'
import DataControl from './db/controller'
import { SqlOrder } from './db/data_types'
import BnApi, { IOrder } from './bn_api/api'
import { OrderSide } from './bn_api/datatype'

const logSystem = 'pool'

export default class Pool {
  #monitor: OrdersMonitor
  #sql: DataControl
  #bn: BnApi

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    this.log.d(logSystem, `Start ${logSystem}`)
    this.#sql = new DataControl(log, this.cfg.db)
    this.#monitor = new OrdersMonitor(log, this.cfg)
    this.#bn = new BnApi(log, this.cfg)
    this.#start()
  }

  #start = async (): Promise<void> => {
    this.#setupMonitor()
    this.#setupOrdersCheck()
    await this.#ordersMonitorAdd()
    await this.#ordersCheckByApi()
    // Go tests
    setTimeout(() => {
      this.#monitor.orderAdd(1, 'ETHUSDT', OrderSide.BUY, 1500, 1)
      this.#monitor.orderAdd(1, 'ETHUSDT', OrderSide.BUY, 1925, 2)
      this.#monitor.orderAdd(1, 'ETHUSDT', OrderSide.SELL, 1990, 3)
      this.#monitor.orderAdd(1, 'ETHUSDT', OrderSide.SELL, 1930, 4)
      this.#monitor.orderAdd(1, 'BNBUSDT', OrderSide.BUY, 230, 5)
      this.#monitor.orderAdd(1, 'BNBUSDT', OrderSide.BUY, 245, 6)
      this.#monitor.orderAdd(1, 'BNBUSDT', OrderSide.SELL, 260, 7)
      this.#monitor.orderAdd(1, 'BNBUSDT', OrderSide.SELL, 250, 8)
    }, 5000)
  }

  #setupMonitor = (): void => {
    this.log.i(logSystem, 'Setup monitor')
    this.#monitor.on('order', async (orderID: number) => {
      this.log.i(logSystem, `Price triggered for order ${orderID}`)
      const order: SqlOrder | undefined = await this.#sql.orderGet(orderID)
      if (!order) {
        // TODO: check order not expire, not filled and not already in exchange
        this.log.c(logSystem, `Order ${orderID} not found in DB`)
      } else {
        const apiOrderID = await this.#bn.orderCreate(order)
        this.log.i(logSystem, `Created binance order ${apiOrderID}`)
        await this.#sql.orderUpdate(orderID) // set order_id
      }
    })
  }

  #setupOrdersCheck = () => {
    this.log.i(logSystem, `Setup orders check every ${this.cfg.timers.expire} seconds`)
    setInterval(async () => {
      await this.#ordersCheckByApi()
    }, this.cfg.timers.expire * 1000)
  }

  #ordersCheckByApi = async (): Promise<void> => {
    const orders: SqlOrder[] | undefined = await this.#sql.ordersGet(true)
    if (!orders || !orders.length) return
    this.log.d(logSystem, `Go to check ${orders.length} orders from DB`)
    const now: number = Date.now()
    for (const order of orders) {
      const expired: number = now - order.expire
      const apiOrder: IOrder | undefined = await this.#bn.orderGet(order.order_id)
      if (!apiOrder) {
        this.log.c(logSystem, `Failed to get order ${order.order_id} by API`)
      } else if (apiOrder.status === 'FILLED') {
        this.log.i(logSystem, `Order ${order.id} with exchange id ${order.order_id} successfully FILLED`)
        this.#monitor.ordersCancel(order.bot_id, order.symbol, [order.id])
        await this.#sql.orderUpdate(order.id) // filled
      } else if (expired > 0) {
        await this.#bn.orderDelete(order.order_id)
        await this.#orderExpire(order, expired)
      }
    }
  }

  #ordersMonitorAdd = async (): Promise<void> => {
    const orders: SqlOrder[] | undefined = await this.#sql.ordersGet(false)
    if (!orders || !orders.length) return
    this.log.d(logSystem, `Load ${orders.length} orders from DB`)
    const now: number = Date.now()
    for (const order of orders) {
      const expired: number = now - order.expire
      if (expired > 0) {
        await this.#orderExpire(order, expired)
      } else {
        const side: OrderSide = order.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL
        this.#monitor.orderAdd(order.bot_id, order.symbol, side, order.price, order.id)
      }
    }
  }

  #orderExpire = async (order: SqlOrder, expired: number) => {
    this.log.w(logSystem, `Order ${order.id} for bot ${order.bot_id} expired ${expired} seconds ago`)
    this.#monitor.ordersCancel(order.bot_id, order.symbol, [order.id])
    await this.#sql.orderDelete(order.order_id)
  }
}
