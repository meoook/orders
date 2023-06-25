import { CfgSql } from '../datatype/config.js'
import Logger from '../logger.js'
import { SqlIncomes } from './data_types.js'
import PgSql from './pgsql.js'

const logSystem = 'sql:pay'


export default class QuerysPayout {
  #sql: PgSql

  constructor(private readonly log: Logger, cfgSql: CfgSql) {
    this.#sql = new PgSql(this.log, cfgSql)
  }

  /** Get shares data to make incomes (Payment) */
  workerShares = async (): Promise<number[] | null> => {
    let query = 'SELECT worker_id, AVG(job_diff), COUNT(*) FROM shares WHERE is_valid IS true GROUP BY worker_id;'
    const worker = await this.#sql.makeQuery(query)
    if (worker === null) this.log.e(logSystem, `Failed to get workers with shares`)
    else if (worker && worker.length === 1) return worker[0]
    return null
  }

  /** Delete shares by list of ids */
  sharesDelete = async (sharesIDs: number[]): Promise<boolean> => {
    if (!sharesIDs || !sharesIDs.length) return false
    const query = `DELETE FROM shares WHERE id IN (${sharesIDs.join(', ')});`
    const deleted = await this.#sql.makeQuery(query)
    if (deleted !== null) return true
    this.log.e(logSystem, `Failed to delete shares: ${sharesIDs}`)
    return false
  }

  /** Create income (Payment) */
  incomeCreate = async (workerID: number, hashrate: number, nShares: number, nPay: number): Promise<number> => {
    if (!workerID) return 0
    let query = 'INSERT INTO incomes (worker_id, hashrate, shares_amount, pay_amount) '
    query += `VALUES (${workerID}, ${hashrate}, ${nShares}, ${nPay}) RETURNING id;`
    const income = await this.#sql.makeQuery(query)
    if (income && income[0].id) return income[0].id
    this.log.e(logSystem, `Failed to create income for worker(${workerID}) with hs: ${hashrate}`)
    return 0
  }

  /** Get worker incomes not payed (Payment) */
  incomesToPay = async (workerID: number): Promise<SqlIncomes[] | null> => {
    if (!workerID) return null
    let query = `SELECT id, created, hashrate, shares_amount, pay_amount FROM incomes `
    query += `WHERE worker_id = ${workerID} AND is_payed IS false;`
    const incomes = await this.#sql.makeQuery(query)
    if (incomes !== null) return incomes
    this.log.e(logSystem, `Failed to get worker(${workerID}) incomes`)
    return null
  }

  /** Update incomes pay status (Payment) */
  incomesSetPayed = async (incomesIDs: number[]): Promise<boolean> => {
    // TODO: concate toPay and setPayed methods with 'returning'
    if (!incomesIDs || !incomesIDs.length) return false
    const query = `UPDATE incomes SET is_payed = true WHERE id IN (${incomesIDs.join(', ')});`
    const updateIncomes = await this.#sql.makeQuery(query)
    if (updateIncomes !== null) return true
    this.log.e(logSystem, 'Failed to update incomes')
    return false
  }

  /** Create pay for account (Payment) */
  payCreate = async (accID: number, address: string, amount: number): Promise<number> => {
    if (!accID || !address || !amount) return 0
    let query = `INSERT INTO pays (acc_id, pay_address, amount) `
    query += `VALUES (${accID}, '${address}', ${amount}) RETURNING id;`
    const newPay = await this.#sql.makeQuery(query)
    if (newPay && newPay[0].id) return newPay[0].id
    this.log.e(logSystem, `Failed to create payout for account(${accID}) to address '${address}' amount: ${amount}`)
    return 0
  }
}
