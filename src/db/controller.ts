import { CfgSql } from '../datatypes'
import Logger from '../logger'
import PgSql from './pg_sql.js'
import { OrderStatus, SqlAccount, SqlOrder, SqlOrderCreateParams, SqlOrderUpdateParams } from './datatypes.js'

const logSystem: string = 'data'
const cols: (keyof SqlOrderCreateParams)[] = [
  'bot_id',
  'symbol',
  'order_id',
  'status',
  'side',
  'quantity',
  'price',
  'time',
  'expire',
]

/** Stratum server data control */
export default class DataControl {
  #sql: PgSql
  #TABLE: string = 'monitor_order'
  #SHORT: string = 'mo'
  #values: string
  #from: string

  constructor(private readonly log: Logger, cfgSql: CfgSql) {
    this.log.d(logSystem, `Start db controller ${cfgSql.host}`)
    const values: string = cols.map((col: string) => `${this.#SHORT}.${col}`).join(', ')
    this.#values = `${this.#SHORT}.id, ${values}`
    this.#from = `${this.#TABLE} ${this.#SHORT}`
    this.#sql = PgSql.getInstance(this.log, cfgSql)
  }

  accGet = async (botID: number): Promise<SqlAccount | undefined> => {
    this.log.d(logSystem, `Try to get account for bot id: ${botID}`)
    if (!botID) return
    let query = 'SELECT ta.api_key, ta.api_secret FROM subscribers_tradeaccount ta '
    query += 'LEFT JOIN subscribers_bot sb ON sb.account_id = ta.id '
    query += `WHERE sb.id = ${botID};`
    const found = await this.#sql.makeQuery(query)
    if (found && found.length === 1) return found[0]
    this.log.e(logSystem, `Failed to get account for bot id: '${botID}'`)
    return
  }

  ordersGet = async (inExchange: boolean): Promise<SqlOrder[]> => {
    this.log.d(logSystem, `Try to get ${inExchange ? 'exchange' : 'fake'} orders`)
    const condition: string = `${this.#SHORT}.order_id ${inExchange ? '<>' : '='} 0`
    const where: string = `${this.#SHORT}.status <> '${OrderStatus.FILLED}' AND ${condition}`
    const query = `SELECT ${this.#values} FROM ${this.#from} WHERE ${where};`
    const orders = await this.#sql.makeQuery(query)
    if (orders && orders.length > 0) return orders.map((o) => this.#orderSerialize(o))
    return []
  }

  ordersBotGet = async (botID: number): Promise<SqlOrder[]> => {
    this.log.d(logSystem, `Try to get bot id:${botID} orders`)
    const where: string = `${this.#SHORT}.status <> '${OrderStatus.FILLED}' AND ${this.#SHORT}.bot_id = ${botID}`
    const query = `SELECT ${this.#values} FROM ${this.#from} WHERE ${where};`
    const orders = await this.#sql.makeQuery(query)
    if (orders && orders.length > 0) return orders.map((o) => this.#orderSerialize(o))
    return []
  }

  ordersBotDelete = async (botID: number): Promise<number> => {
    if (!botID) throw new Error('bot id not set to delete orders')
    this.log.d(logSystem, `Try to delete bot id:${botID} active orders`)
    const where: string = `${this.#SHORT}.status <> '${OrderStatus.FILLED}' AND ${this.#SHORT}.bot_id = ${botID}`
    const query = `DELETE FROM ${this.#from} WHERE ${where} RETURNING ${this.#values};`
    const deleted = await this.#sql.makeQuery(query)
    if (deleted !== null) return deleted.length
    this.log.e(logSystem, `Failed to delete bot id:${botID} active orders`)
    throw new Error(`failed to delete bot id:${botID} orders`)
  }

  orderGet = async (orderID: number, botID?: number): Promise<SqlOrder> => {
    if (!orderID) throw new Error('order id not set to get it')
    this.log.d(logSystem, `Try to get order id:${orderID}`)
    let where: string = Boolean(botID) ? `${this.#SHORT}.botID = ${botID} AND ` : ''
    where += `${this.#SHORT}.id = ${orderID};`
    const query = `SELECT ${this.#values} FROM ${this.#from} WHERE ${where};`
    const found = await this.#sql.makeQuery(query)
    if (found && found.length === 1) return this.#orderSerialize(found[0])
    this.log.e(logSystem, `Failed to get order id:${orderID}`)
    throw new Error(`order id:${orderID} not found`)
  }

  orderCreate = async (order: SqlOrderCreateParams): Promise<SqlOrder> => {
    this.log.d(logSystem, `Bot id:${order.bot_id} try to create ${order.side} order price:${order.price}`)
    const values = cols.map((col: keyof SqlOrderCreateParams) => `${order[col]}`).join(', ')
    const query = `INSERT INTO ${this.#from} (${cols.join(', ')}) VALUES (${values}) RETURNING ${this.#values};`
    const orderCreated = await this.#sql.makeQuery(query)
    if (orderCreated && orderCreated[0].id) return orderCreated[0]
    this.log.e(logSystem, `Failed to create order '${order}'`)
    throw new Error('failed to create order')
  }

  orderUpdate = async (orderID: number, changes: SqlOrderUpdateParams): Promise<SqlOrder> => {
    let updates: string = ''
    Object.entries(changes).forEach(([key, value]) => {
      if (!value) this.log.e(logSystem, `Order ${orderID} try to set ${key} = ${value} (ignored)`)
      else if (updates) updates += `, ${key} = ${value}`
      else updates = `${key} = ${value}`
    })
    if (!updates) throw new Error('no changes to update order')
    this.log.d(logSystem, `Order id:${orderID} try to update`)
    const where: string = `${this.#SHORT}.id = '${orderID}'`
    const query = `UPDATE ${this.#from} SET ${updates} WHERE ${where} RETURNING ${this.#values};`
    const result = await this.#sql.makeQuery(query)
    if (result && result[0].id) return result[0]
    this.log.e(logSystem, `Order id:${orderID} failed to update`)
    throw new Error('failed to update order')
  }

  orderDelete = async (orderID: number): Promise<boolean> => {
    this.log.d(logSystem, `Order id:${orderID} try to delete`)
    if (!orderID) return false
    let query = `DELETE FROM ${this.#from} WHERE ${this.#SHORT}.id = ${orderID} RETURNING ${this.#SHORT}.id;`
    const result = await this.#sql.makeQuery(query)
    if (result && result[0].id) return true
    this.log.e(logSystem, `Order id:${orderID} failed to delete`)
    return false
  }

  #orderSerialize = (data: any): SqlOrder => {
    return {
      id: data.id,
      bot_id: data.bot_id,
      symbol: data.symbol,
      order_id: data.order_id,
      status: data.status,
      side: data.side,
      quantity: data.quantity,
      price: data.price,
      time: data.time,
      expire: data.expire,
    }
  }
}
