import { CfgSql } from '../datatype/config'
import Logger from '../logger'
import PgSql from './pg_sql.js'
import { SqlAccount, SqlOrder } from './data_types.js'

const logSystem: string = 'data'
const cols: string[] = ['bot_id', 'symbol', 'side', 'quantity', 'price', 'fee', 'time', 'expire', 'filled', 'order_id']

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

  accGet = async (botID: number): Promise<SqlAccount | null> => {
    this.log.d(logSystem, `Try to get account for bot id: ${botID}`)
    if (!botID) return null
    let query = 'SELECT ta.api_key, ta.api_secret FROM subscribers_tradeaccount ta '
    query += 'LEFT JOIN subscribers_bot sb ON sb.account_id = ta.id '
    query += `WHERE sb.id = '${botID}';`
    const found = await this.#sql.makeQuery(query)
    if (found && found.length === 1) return found[0]
    this.log.e(logSystem, `Failed to get account for bot id: '${botID}'`)
    return null
  }

  ordersGet = async (inExchange: boolean): Promise<SqlOrder[] | undefined> => {
    this.log.d(logSystem, 'Try to get active orders')
    let query = `SELECT ${this.#short}.id, ${this.#values} `
    query += `FROM ${this.#table} ${this.#short} `
    query += 'WHERE filled is false AND '
    query += inExchange ? 'order_id <> 0;' : 'order_id = 0;'
    const orders = await this.#sql.makeQuery(query)
    if (orders && orders.length > 0) return orders
    this.log.e(logSystem, 'Failed to get active orders')
  }

  orderGet = async (orderID: number): Promise<SqlOrder | undefined> => {
    if (!orderID) return
    this.log.d(logSystem, `Try to get order id: ${orderID}`)
    let query = `SELECT ${this.#short}.id, ${this.#values} `
    query += `FROM ${this.#table} ${this.#short} WHERE ${this.#short}.id = '${orderID}';`
    const found = await this.#sql.makeQuery(query)
    if (found && found.length === 1) return found[0]
    this.log.e(logSystem, `Failed to get order with id '${orderID}'`)
  }

  orderCreate = async (orderID: number): Promise<number> => {
    const workerName: string = 'some'
    this.log.d(logSystem, `Try to create order id: ${orderID}`)

    if (!orderID || !workerName) return 0
    const query = `INSERT INTO ${this.#table} (${cols.join(', ')}) VALUES (${orderID}, '${workerName}') RETURNING id;`

    const worker = await this.#sql.makeQuery(query)
    if (worker && worker[0].id) return worker[0].id
    this.log.e(logSystem, `Failed to create worker '${workerName}' for account(${orderID})`)
    return 0
  }

  orderUpdate = async (orderID: number): Promise<void> => {
    this.log.d(logSystem, `Try to update order id: ${orderID}`)
  }

  orderDelete = async (orderID: number): Promise<boolean> => {
    this.log.d(logSystem, `Try to delete order id: ${orderID}`)

    if (!orderID) return false
    let query = `DELETE FROM ${this.#table} WHERE id = ${orderID};`
    const deleted = await this.#sql.makeQuery(query)
    if (deleted !== null) return true
    this.log.e(logSystem, `Failed to delete order with id: (${orderID})`)
    return false
  }
}
