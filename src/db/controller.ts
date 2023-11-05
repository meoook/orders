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
  #table: string = 'monitor_order'
  #short: string = 'mo'
  #values: string

  constructor(private readonly log: Logger, cfgSql: CfgSql) {
    this.log.d(logSystem, `Start db controller ${cfgSql.host}`)
    this.#values = cols.map((col: string) => `${this.#short}.${col}`).join(', ')
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
    let query = `SELECT ${this.#short}.id, ${this.#values} `
    query += `FROM ${this.#table} ${this.#short} `
    query += `WHERE status <> '${OrderStatus.FILLED}' AND order_id ${inExchange ? '<>' : '='} 0;`
    this.log.d(logSystem, `Try to get ${inExchange ? 'exchange' : 'fake'} orders`)
    const orders = await this.#sql.makeQuery(query)
    if (orders && orders.length > 0) return orders.map((o) => this.#orderSerialize(o))
    return []
  }

  ordersBotGet = async (botID: number): Promise<SqlOrder[]> => {
    let query = `SELECT ${this.#short}.id, ${this.#values} `
    query += `FROM ${this.#table} ${this.#short} `
    query += `WHERE status <> '${OrderStatus.FILLED}' AND bot_id = ${botID};`
    this.log.d(logSystem, `Try to get bot id:${botID} orders`)
    const orders = await this.#sql.makeQuery(query)
    if (orders && orders.length > 0) return orders.map((o) => this.#orderSerialize(o))
    return []
  }

  ordersDelete = async (botID: number): Promise<number> => {
    if (!botID) throw new Error('bot id not set to delete orders')
    let query = `DELETE FROM ${this.#table} WHERE bot_id = ${botID} and status <> ${OrderStatus.FILLED};`
    this.log.d(logSystem, `Try to delete bot id:${botID} orders`)
    const deleted = await this.#sql.makeQuery(query)
    console.log('DELETED', deleted) // TODO: RM
    if (deleted !== null) return 3 // TODO: get number
    this.log.e(logSystem, `Failed to delete bot id:${botID} orders`)
    throw new Error(`failed to delete bot id:${botID} orders`)
  }

  orderGet = async (orderID: number, botID?: number): Promise<SqlOrder> => {
    if (!orderID) throw new Error('order id not set to get it')
    let query = `SELECT ${this.#short}.id, ${this.#values} `
    query += `FROM ${this.#table} ${this.#short} WHERE `
    query += Boolean(botID) ? `${this.#short}.botID = '${botID}' AND ` : ''
    query += `${this.#short}.id = '${orderID}';`
    this.log.d(logSystem, `Try to get order: ${query}`)
    const found = await this.#sql.makeQuery(query)
    if (found && found.length === 1) return this.#orderSerialize(found[0])
    this.log.e(logSystem, `Failed to get order with id '${orderID}'`)
    throw new Error(`order id:${orderID} not found`)
  }

  orderCreate = async (order: SqlOrderCreateParams): Promise<SqlOrder> => {
    const values = cols.map((col: keyof SqlOrderCreateParams) => `${order[col]}`).join(', ')
    const query = `INSERT INTO ${this.#table} (${cols.join(', ')}) VALUES (${values}) RETURNING id;`
    this.log.d(logSystem, `Try to create order: ${query} `)
    const orderCreated = await this.#sql.makeQuery(query)
    if (orderCreated && orderCreated[0].id) return orderCreated[0]
    this.log.e(logSystem, `failed to create order '${order}'`)
    throw new Error(`failed to create order '${order}'`)
  }

  orderUpdate = async (orderID: number, changes: SqlOrderUpdateParams): Promise<void> => {
    let updates: string = ''
    Object.entries(changes).forEach(([key, value]) => {
      if (!value) this.log.e(logSystem, `Order ${orderID} try to set ${key} = ${value} (ignored)`)
      else if (updates) updates += `, ${key} = ${value}`
      else updates = `${key} = ${value}`
    })
    if (updates) {
      let query = `UPDATE ${this.#table} SET ${updates} WHERE ${this.#short}.id = '${orderID}';`
      this.log.d(logSystem, `Try to update order: ${query}`)
      const result = await this.#sql.makeQuery(query)
      this.log.d(logSystem, `Order ${orderID} updated - ${result}`)
    } else {
      this.log.e(logSystem, `Try to update order id: ${orderID} but no updates - ${changes}`)
    }
  }

  orderDelete = async (orderID: number): Promise<boolean> => {
    this.log.d(logSystem, `Try to delete order id: ${orderID}`)
    if (!orderID) return false
    let query = `DELETE FROM ${this.#table} WHERE id = ${orderID};`
    const deleted = await this.#sql.makeQuery(query)
    console.log('DELETED2', deleted) // TODO: RM
    if (deleted !== null) return true
    this.log.e(logSystem, `Failed to delete order with id: (${orderID})`)
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
