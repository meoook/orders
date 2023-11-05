import Logger from './logger'
import OrdersMonitor from './symbols/monitor.js'
import { IConfig } from './datatypes'
import DataControl from './db/controller'
import { OrderStatus, SqlOrder, SqlOrderCreateParams } from './db/datatypes'
import BnApi, { IOrder } from './bn_api/api'
import { OrderSide } from './bn_api/datatypes'

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
    this.#setupOrdersCheck(this.cfg.timers.expire + 1) // add 1 sec to check after expire
    await this.#ordersMonitorAddItems()
    await this.#ordersCheck()
    // Go tests
    // setTimeout(() => {
    //   this.#monitor.orderAdd(1, 'ETHUSDT', OrderSide.BUY, 1500, 1)
    //   this.#monitor.orderAdd(1, 'ETHUSDT', OrderSide.BUY, 1925, 2)
    //   this.#monitor.orderAdd(1, 'ETHUSDT', OrderSide.SELL, 1990, 3)
    //   this.#monitor.orderAdd(1, 'ETHUSDT', OrderSide.SELL, 1930, 4)
    //   this.#monitor.orderAdd(1, 'BNBUSDT', OrderSide.BUY, 230, 5)
    //   this.#monitor.orderAdd(1, 'BNBUSDT', OrderSide.BUY, 245, 6)
    //   this.#monitor.orderAdd(1, 'BNBUSDT', OrderSide.SELL, 260, 7)
    //   this.#monitor.orderAdd(1, 'BNBUSDT', OrderSide.SELL, 250, 8)
    // }, 5000)
  }

  #setupMonitor = (): void => {
    this.log.i(logSystem, 'Setup monitor')
    this.#monitor.on('order', async (orderID: number) => {
      this.log.i(logSystem, `Price triggered for order ${orderID}`)
      const order: SqlOrder | undefined = await this.#sql.orderGet(orderID)
      if (!order) {
        // TODO: check order not expire, not filled and not already in exchange
        this.log.c(logSystem, `Order ${orderID} triggered but not found in DB`)
      } else {
        const apiOrderID = await this.#bn.orderCreate(order)
        this.log.i(logSystem, `Created binance order ${apiOrderID}`)
        await this.#sql.orderUpdate(orderID, { order_id: apiOrderID }) // set order_id
      }
    })
  }

  #setupOrdersCheck = (timeout: number) => {
    this.log.i(logSystem, `Setup orders check every ${timeout} seconds`)
    setInterval(async () => {
      await this.#ordersCheck()
    }, timeout * 1000)
  }

  #ordersMonitorAddItems = async (): Promise<void> => {
    // add sql orders to monitor at start
    const orders: SqlOrder[] = await this.#sql.ordersGet(false)
    let amount: number = 0
    const now: number = Date.now()
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
    this.log.i(logSystem, `Loaded ${amount} of ${orders.length} orders from DB to monitor`)
  }

  #ordersCheck = async (): Promise<void> => {
    // Check created in excange orders status
    const orders: SqlOrder[] | undefined = await this.#sql.ordersGet(true)
    if (!orders || !orders.length) return
    this.log.d(logSystem, `Go to check status for ${orders.length} created in exchange orders from DB`)
    const now: number = Date.now()
    for (const order of orders) await this.#orderCheck(order, now)
  }

  #orderCheck = async (order: SqlOrder, now: number): Promise<void> => {
    // Check created in excange order status - delete
    const expired: number = Math.round(now - order.expire)
    if (expired > 0) {
      this.log.w(logSystem, `Order ${order.id} for bot ${order.bot_id} expired ${expired} seconds ago`)
      await this.#orderDelete(order)
      return
    }
    if (order.order_id === 0) return
    const apiOrder: IOrder | undefined = await this.#bn.orderGet(order.order_id)
    if (!apiOrder) {
      this.log.c(logSystem, `Failed to get order ${order.order_id} by API`)
    } else if (apiOrder.status === order.status) {
      this.log.d(logSystem, `Order ${order.order_id} status not changed: ${order.status}`)
    } else if (apiOrder.status === OrderStatus.FILLED || apiOrder.status === OrderStatus.PARTIALLY_FILLED) {
      this.log.i(logSystem, `Order ${order.id} with exchange id ${order.order_id} successfully ${apiOrder.status}`)
      this.#monitor.ordersCancel(order.bot_id, order.symbol, [order.id])
      await this.#sql.orderUpdate(order.id, { status: apiOrder.status })
    } else if (apiOrder.status === OrderStatus.CANCELED || apiOrder.status === OrderStatus.EXPIRED) {
      this.log.w(logSystem, `Order ${order.id} with exchange id ${order.order_id} was ${apiOrder.status}`)
      await this.#bn.orderDelete(order.order_id)
    } else {
      this.log.d(logSystem, `Order ${order.id} with exchange id ${order.order_id} checked, status ${apiOrder.status}`)
    }
  }

  ordersCancel = async (botID: number): Promise<number> => {
    const orders = await this.#sql.ordersBotGet(botID)
    let deleted: number = 0
    if (!orders) return deleted
    orders.forEach(async (order) => {
      if (order.order_id > 0) {
        await this.#orderDelete(order)
        deleted++
      }
    })
    const amount: number = await this.#sql.ordersDelete(botID)
    return deleted + amount
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

  #orderDelete = async (order: SqlOrder): Promise<void> => {
    // Delete order from exchange, db and monitor
    if (order.order_id > 0) {
      await this.#bn.orderDelete(order.order_id)
      // Recheck status
      const apiOrder = await this.#bn.orderGet(order.order_id)
      if (apiOrder?.status === 'CANCELED') await this.#sql.orderDelete(order.order_id)
      else {
        this.log.w(logSystem, `Try to delete ${apiOrder?.status} order id:${order.id}`)
        // TODO: Set api order status
        await this.#sql.orderUpdate(order.id, { status: OrderStatus.FILLED })
      }
    } else {
      await this.#sql.orderDelete(order.order_id)
    }
    this.#monitor.ordersCancel(order.bot_id, order.symbol, [order.id])
  }
}
