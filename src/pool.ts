import Logger from './logger'
import OrdersMonitor from './symbols/monitor.js'
import DataControl from './db/controller'
import BnApi from './bn_api/api'
import { IConfig, BnOrder, OrderStatus, SqlOrder, SqlOrderCreate } from './datatypes'

const logSystem = 'pool'

export default class Pool {
  #monitor: OrdersMonitor
  #sql: DataControl
  #bn: BnApi

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    this.log.i(logSystem, `Start ${logSystem}`)
    this.#sql = new DataControl(log, this.cfg.db)
    this.#monitor = new OrdersMonitor(log, this.cfg)
    this.#bn = new BnApi(log, this.cfg)
    setTimeout(() => {
      this.#start()
    }, 1000) // wait a sec to db connect
  }

  #start = async (): Promise<void> => {
    this.#setupMonitor()
    this.#setupOrdersCheck(this.cfg.timers.expire)
    await this.#ordersMonitorAddItems()
    await this.#ordersCheck()
  }

  #ordersMonitorAddItems = async (): Promise<void> => {
    // Add sql orders to monitor at start
    const orders: SqlOrder[] = await this.#sql.ordersGet(true)
    let amount: number = 0
    const now: number = (Date.now() / 1000) | 0
    for (const order of orders) {
      if (this.#orderIsExpired(order, now)) await this.#sql.orderDelete(order.id)
      else {
        this.#monitor.orderAdd(order)
        amount++
      }
    }
    this.log.i(logSystem, `Monitor loaded ${amount} of ${orders.length} orders from DB`)
  }

  #setupMonitor = (): void => {
    this.log.d(logSystem, 'Setup monitor')
    this.#monitor.on('order', async (orderID: number) => {
      /// TODO: check expire
      this.log.i(logSystem, `Order id:${orderID} price triggered`)
      const order: SqlOrder | undefined = await this.#sql.orderGet(orderID)
      if (!order) {
        this.log.c(logSystem, `Order id:${orderID} triggered but not found in DB`)
      } else if (this.#orderIsExpired(order)) {
        await this.#orderDelete(order)
      } else if (order.status !== OrderStatus.NEW) {
        this.log.c(logSystem, `Order id:${orderID} triggered but with ${order.status} status`)
        this.#monitor.ordersCancel(order.bot_id, order.symbol, [order.id])
      } else {
        try {
          const apiOrderID = await this.#bn.orderCreate(order)
          this.log.i(logSystem, `Order id:${orderID} created in binance with id:${apiOrderID}`)
          await this.#sql.orderUpdate(orderID, { order_id: apiOrderID })
        } catch (err) {
          this.log.e(logSystem, `Order id:${orderID} failed to create - ${err}`)
        }
      }
    })
  }

  #setupOrdersCheck = (timeout: number) => {
    this.log.i(logSystem, `Setup orders check every ${timeout} seconds`)
    setInterval(async () => {
      await this.#ordersCheck()
    }, timeout * 1000)
  }

  #ordersCheck = async (): Promise<void> => {
    const orders: SqlOrder[] = await this.#sql.ordersGet(false)
    this.log.d(logSystem, `Try to check status for ${orders.length} exchange orders`)
    const now: number = (Date.now() / 1000) | 0
    for (const order of orders) await this.#orderCheck(order, now)
  }

  #orderCheck = async (order: SqlOrder, now: number): Promise<void> => {
    if (this.#orderIsExpired(order, now)) {
      await this.#orderDelete(order)
      return
    }
    if (order.order_id === 0) return
    const apiOrder: BnOrder | undefined = await this.#bn.orderGet(order) // TODO: no credentials
    if (!apiOrder) {
      this.log.c(logSystem, `Failed to get order ${order.order_id} by API`)
      await this.#orderDelete(order)
    } else if (apiOrder.status === order.status) {
      this.log.d(logSystem, `Order ${order.order_id} status not changed: ${order.status}`)
    } else if (apiOrder.status === OrderStatus.FILLED || apiOrder.status === OrderStatus.PARTIALLY_FILLED) {
      this.log.s(logSystem, `Order id:${order.id} with order_id:${order.order_id} successfully ${apiOrder.status}`)
      await this.#sql.orderUpdate(order.id, { status: OrderStatus.FILLED })
    } else if (apiOrder.status === OrderStatus.CANCELED || apiOrder.status === OrderStatus.EXPIRED) {
      this.log.w(logSystem, `Order id:${order.id} with order_id:${order.order_id} was ${apiOrder.status}`)
      await this.#sql.orderDelete(order.id)
      this.#monitor.ordersCancel(order.bot_id, order.symbol, [order.id])
    } else {
      this.log.d(logSystem, `Order ${order.id} with order_id:${order.order_id} checked, status ${apiOrder.status}`)
    }
  }

  #orderDelete = async (order: SqlOrder): Promise<void> => {
    // Delete order from exchange, db and monitor
    if (order.order_id > 0) {
      this.log.d(logSystem, `Order id:${order.id} try to delete (exchange)`)
      const apiOrder = await this.#bn.orderDelete(order)
      if (!apiOrder) return
      if ([OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED].includes(apiOrder.status)) {
        await this.#sql.orderUpdate(order.id, { status: OrderStatus.FILLED })
        return
      }
    }
    this.log.d(logSystem, `Order id:${order.id} try to delete`)
    await this.#sql.orderDelete(order.id)
    this.#monitor.ordersCancel(order.bot_id, order.symbol, [order.id])
  }

  #orderIsExpired = (order: SqlOrder, now?: number): boolean => {
    const _now: number = now ? now : (Date.now() / 1000) | 0
    const expired: number = Math.round(_now - order.expire)
    if (expired < 0) return false
    this.log.w(logSystem, `Order ${order.id} for bot ${order.bot_id} expired ${expired} seconds ago`)
    return true
  }

  /// Cancel bor orders
  ordersCancel = async (botID: number): Promise<number> => {
    const orders = await this.#sql.ordersBotGet(botID)
    orders.forEach(async (order) => {
      await this.#orderDelete(order)
    })
    return orders.length
  }

  /// Get bot orders
  ordersGet = async (botID: number): Promise<SqlOrder[]> => {
    const orders = await this.#sql.ordersBotGet(botID)
    // TODO: orders.filter((o) => o.order_id !== 0)
    return orders.map(({ api_key, api_secret, qty_step, base, quote, ...rest }) => rest)
  }

  /// Get order by ID
  orderGet = async (orderID: number): Promise<SqlOrder | undefined> => {
    return await this.#sql.orderGet(orderID)
  }

  /// Create order by api and save order_id and time
  orderCreate = async (order: SqlOrderCreate): Promise<SqlOrder> => {
    const { api_key, api_secret, qty_step, base, quote, ...rest } = await this.#sql.orderCreate(order)
    this.#monitor.orderAdd(rest)
    return rest
  }
}
