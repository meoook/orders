import Logger from '../logger'
import PgSql from './pg_sql.js'
import { CfgSql, OrderSide, OrderStatus, SqlAccount, SqlOrder, SqlOrderCreate, SqlOrderUpdate } from '../datatypes'

const logSystem: string = 'controller'
const cols: (keyof SqlOrderCreate)[] = [
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

export default class DataControl {
  #sql: PgSql
  #TABLE: string = 'monitor_order'
  #SHORT: string = 'mo'
  #values: string
  #from: string
  #join: string
  #other = 'ta.api_key, ta.api_secret, cp.qty_step, cc.usdt_price as base, ccc.usdt_price as quote'

  constructor(private readonly log: Logger, cfgSql: CfgSql) {
    this.log.d(logSystem, `Start db controller ${cfgSql.host}`)
    const values: string = cols.map((col: string) => `${this.#SHORT}.${col}`).join(', ')
    this.#values = `${this.#SHORT}.id, ${values}`
    this.#from = `${this.#TABLE} ${this.#SHORT}`
    this.#sql = PgSql.getInstance(this.log, cfgSql)
    this.#join = `LEFT JOIN subscribers_bot sb on ${this.#SHORT}.bot_id = sb.id `
    this.#join += `LEFT JOIN subscribers_tradeaccount ta on sb.account_id = ta.id `
    this.#join += `LEFT JOIN core_pair cp on sb.pair_id = cp.id `
    this.#join += `LEFT JOIN core_coin cc on cp.coin_base_id = cc.id `
    this.#join += `LEFT JOIN core_coin ccc on cp.coin_quote_id = ccc.id`
  }

  accGet = async (botID: number): Promise<SqlAccount | undefined> => {
    this.log.d(logSystem, `Try to get account for bot id: ${botID}`)
    if (!botID) return
    let query: string = 'SELECT ta.api_key, ta.api_secret FROM subscribers_tradeaccount ta '
    query += 'LEFT JOIN subscribers_bot sb ON sb.account_id = ta.id '
    query += `WHERE sb.id = ${botID};`
    const found = await this.#sql.makeQuery(query)
    if (found && found.length === 1) return found[0]
    this.log.e(logSystem, `Failed to get account for bot id: '${botID}'`)
    return
  }

  ordersGet = async (onlyFake: boolean): Promise<SqlOrder[]> => {
    this.log.d(logSystem, `Try to get ${onlyFake ? 'exchange' : 'fake'} orders`)
    const condition: string = onlyFake ? ` AND ${this.#SHORT}.order_id = 0` : ''
    const where: string = `${this.#SHORT}.status <> '${OrderStatus.FILLED}'${condition}`
    const query: string = `SELECT ${this.#values} FROM ${this.#from} WHERE ${where};`
    const orders = await this.#sql.makeQuery(query)
    return orders.map((order) => this.#orderSerialize(order))
  }

  ordersBotGet = async (botID: number): Promise<SqlOrder[]> => {
    this.log.d(logSystem, `Try to get bot id:${botID} orders`)
    const where: string = `${this.#SHORT}.bot_id = ${botID}`
    const query: string = `SELECT ${this.#values} FROM ${this.#from} WHERE ${where};`
    const orders = await this.#sql.makeQuery(query)
    return orders.map((order) => this.#orderSerialize(order))
  }

  orderGet = async (orderID: number): Promise<SqlOrder | undefined> => {
    if (!orderID) throw new Error('order id not set to get it')
    this.log.d(logSystem, `Try to get order id:${orderID}`)
    let query: string = `SELECT ${this.#values} ${this.#other} FROM ${this.#from} `
    query += `${this.#join} WHERE ${this.#SHORT}.id = ${orderID};`
    const found = await this.#sql.makeQuery(query)
    if (found && found.length === 1) return this.#orderSerialize(found[0])
    this.log.e(logSystem, `Order id:${orderID} not found`)
    return
  }

  orderCreate = async (order: SqlOrderCreate): Promise<SqlOrder> => {
    this.log.d(logSystem, `Bot id:${order.bot_id} try to create ${order.side} order price:${order.price}`)
    const values = cols.map((col: keyof SqlOrderCreate) => `${order[col]}`).join(', ')
    const query = `INSERT INTO ${this.#from} (${cols.join(', ')}) VALUES (${values}) RETURNING ${this.#values};`
    const orderCreated = await this.#sql.makeQuery(query)
    if (orderCreated && orderCreated[0].id) return this.#orderSerialize(orderCreated[0])
    this.log.e(logSystem, `Failed to create order '${order}'`)
    throw new Error('failed to create order')
  }

  orderUpdate = async (orderID: number, changes: SqlOrderUpdate): Promise<SqlOrder> => {
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
    if (result && result[0].id) return this.#orderSerialize(result[0])
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
      status: OrderStatus[data.status as keyof typeof OrderStatus],
      side: OrderSide[data.side as keyof typeof OrderSide],
      quantity: data.quantity,
      price: data.price,
      time: data.time,
      expire: data.expire,
      api_key: data.api_key ? data.api_key : undefined,
      api_secret: data.api_secret ? data.api_secret : undefined,
      qty_step: data.qty_step ? data.qty_step : undefined,
      base: data.base ? data.base : undefined,
      quote: data.quote ? data.quote : undefined,
    }
  }
}
