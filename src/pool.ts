import Logger from './logger'
import OrdersMonitor from './symbols/monitor.js'
import DataControl from './db/controller'
import BnApi from './bn_api/api'
import { IConfig, IOrder, OrderSide, OrderStatus, SqlOrder, SqlOrderCreateParams } from './datatypes'

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
    setTimeout(() => {
      this.#start()
    }, 1000) // wait a sec to db connect
  }

  #start = async (): Promise<void> => {
    this.#setupMonitor()
    this.#setupExchangeOrdersCheck(this.cfg.timers.expire)
    await this.#ordersMonitorAddItems()
    await this.#exchangeOrdersCheck()
  }

  #setupMonitor = (): void => {
    this.log.i(logSystem, 'Setup monitor')
    this.#monitor.on('order', async (orderID: number) => {
      this.log.i(logSystem, `Order id:${orderID} price triggered`)
      const order: SqlOrder | undefined = await this.#sql.orderGet(orderID)
      if (!order) {
        // TODO: check order not expire, not filled and not already in exchange
        this.log.c(logSystem, `Order id:${orderID} price triggered but not found in DB`)
      } else {
        const apiOrderID = await this.#bn.orderCreate(order)
        this.log.i(logSystem, `Created binance order ${apiOrderID}`)
        await this.#sql.orderUpdate(orderID, { order_id: apiOrderID }) // set order_id
      }
    })
  }

  #setupExchangeOrdersCheck = (timeout: number) => {
    /// Check created in exchange orders every `timeout` seconds
    this.log.i(logSystem, `Setup exchange orders check every ${timeout} seconds`)
    setInterval(async () => {
      await this.#exchangeOrdersCheck()
    }, timeout * 1000)
  }

  #ordersMonitorAddItems = async (): Promise<void> => {
    // Add sql orders to monitor at start
    const orders: SqlOrder[] = await this.#sql.ordersGet(false)
    let amount: number = 0
    const now: number = (Date.now() / 1000) | 0
    for (const order of orders) {
      const expired: number = Math.round(now - order.expire)
      if (expired > 0) {
        this.log.w(logSystem, `Bot id:${order.bot_id} order id:${order.id} expired ${expired} seconds ago`)
        await this.#sql.orderDelete(order.id)
      } else {
        const side: OrderSide = order.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL
        this.#monitor.orderAdd(order.bot_id, order.symbol, side, order.price, order.id)
        amount++
      }
    }
    this.log.i(logSystem, `Monitor loaded ${amount} of ${orders.length} orders from DB`)
  }

  #exchangeOrdersCheck = async (): Promise<void> => {
    // Check created in excange orders status
    const orders: SqlOrder[] | undefined = await this.#sql.ordersGet(true)
    this.log.d(logSystem, `Try to check status for ${orders.length} exchange orders`)
    const now: number = (Date.now() / 1000) | 0
    for (const order of orders) await this.#exchangeOrderCheck(order, now)
  }

  #exchangeOrderCheck = async (order: SqlOrder, now: number): Promise<void> => {
    // Check created in excange order status - delete
    const expired: number = Math.round(now - order.expire)
    if (expired > 0) {
      this.log.w(logSystem, `Order ${order.id} for bot ${order.bot_id} expired ${expired} seconds ago`)
      await this.#exchangeOrderDelete(order)
      return
    }
    if (order.order_id === 0) return
    const apiOrder: IOrder | undefined = await this.#bn.orderGet(order.order_id)
    if (!apiOrder) {
      this.log.c(logSystem, `Failed to get order ${order.order_id} by API`)
      /// TODO: RM sql.order
    } else if (apiOrder.status === order.status) {
      this.log.d(logSystem, `Order ${order.order_id} status not changed: ${order.status}`)
    } else if (apiOrder.status === OrderStatus.FILLED || apiOrder.status === OrderStatus.PARTIALLY_FILLED) {
      this.log.s(logSystem, `Order id:${order.id} with order_id:${order.order_id} successfully ${apiOrder.status}`)
      await this.#sql.orderUpdate(order.id, { status: apiOrder.status })
    } else if (apiOrder.status === OrderStatus.CANCELED || apiOrder.status === OrderStatus.EXPIRED) {
      this.log.w(logSystem, `Order id:${order.id} with order_id:${order.order_id} was ${apiOrder.status}`)
      await this.#sql.orderDelete(order.id)
    } else {
      this.log.d(logSystem, `Order ${order.id} with order_id:${order.order_id} checked, status ${apiOrder.status}`)
    }
  }

  #exchangeOrderDelete = async (order: SqlOrder): Promise<void> => {
    // Delete order from exchange, db and monitor
    if (order.order_id > 0) {
      await this.#bn.orderDelete(order.order_id)
      // Recheck status
      const apiOrder = await this.#bn.orderGet(order.order_id)
      if (apiOrder?.status === 'CANCELED') await this.#sql.orderDelete(order.id)
      else {
        this.log.w(logSystem, `Try to delete ${apiOrder?.status} order id:${order.id}`)
        // TODO: Set api order status
        await this.#sql.orderUpdate(order.id, { status: OrderStatus.FILLED })
      }
    } else {
      await this.#sql.orderDelete(order.id)
    }
    this.#monitor.ordersCancel(order.bot_id, order.symbol, [order.id])
  }

  ordersCancel = async (botID: number): Promise<number> => {
    /// Cancel bor orders
    const orders = await this.#sql.ordersBotGet(botID)
    orders.forEach(async (order) => {
      if (order.order_id > 0) await this.#exchangeOrderDelete(order)
      else await this.#sql.orderDelete(order.id)
    })
    return orders.length
  }

  ordersGet = async (botID: number): Promise<SqlOrder[]> => {
    /// Get bot orders
    return await this.#sql.ordersBotGet(botID)
  }

  orderGet = async (orderID: number, botID: number): Promise<SqlOrder> => {
    /// Get order by ID
    return await this.#sql.orderGet(orderID, botID)
  }

  orderCreate = async (order: SqlOrderCreateParams): Promise<SqlOrder> => {
    /// Create order by api and save order_id and time
    const sqlOrder = await this.#sql.orderCreate(order)
    const side: OrderSide = order.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL
    this.#monitor.orderAdd(order.bot_id, order.symbol, side, order.price, sqlOrder.id)
    return sqlOrder
  }
}
