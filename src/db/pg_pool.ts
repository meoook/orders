import { CfgSql } from '../datatype/config.js'
import { RpcBlock } from '../datatype/rpcBlock.js'
import Logger from '../logger.js'
import { SqlAccount, SqlWorker } from './data_types.js'
import PgSql from './pgsql.js'

const logSystem = 'sql:stratum'


export default class QuerysPool {
  #sql: PgSql

  constructor(private readonly log: Logger, cfgSql: CfgSql) {
    this.#sql = new PgSql(this.log, cfgSql)
  }

  /** Get mining account by name (Stratum) */
  accGet = async (accName: string): Promise<SqlAccount | null> => {
    if (!accName) return null
    let query = 'SELECT id, created, user_id, acc_name, pay_adderss, pay_min FROM accounts '
    query += `WHERE acc_name = '${accName}';`
    const found = await this.#sql.makeQuery(query)
    if (found && found.length === 1) return found[0]
    this.log.e(logSystem, `Failed to get account with name '${accName}'`)
    return null
  }

  /** Delete mining account by id (-) */
  accDelete = async (accID: number): Promise<boolean> => {
    if (!accID) return false
    let query = `DELETE FROM accounts WHERE id = ${accID};`
    const deleted = await this.#sql.makeQuery(query)
    if (deleted !== null) return true
    this.log.e(logSystem, `Failed to delete account(${accID})`)
    return false
  }

  /** Worker get by account name and worker name (Stratum) */
  workerGet = async (accName: string, workerName: string): Promise<SqlWorker | null> => {
    if (!accName || !workerName) return null
    let query = 'SELECT w.id, w.created, w.last_online, a.acc_name, w.worker_name, w.difficulty '
    query += `FROM workers AS w LEFT JOIN accounts AS a ON a.id = w.acc_id `
    query += `WHERE a.acc_name = '${accName}' AND w.worker_name = '${workerName}';`
    const worker = await this.#sql.makeQuery(query)
    if (worker === null) this.log.e(logSystem, `Failed to get worker '${accName}.${workerName}'`)
    else if (worker && worker.length === 1) return worker[0]
    return null
  }

  /** Worker create by account id and worker name and return id (Stratum) */
  workerCreate = async (accID: number, workerName: string): Promise<number> => {
    if (!accID || !workerName) return 0
    const query = `INSERT INTO workers (acc_id, worker_name) VALUES (${accID}, '${workerName}') RETURNING id;`
    const worker = await this.#sql.makeQuery(query)
    if (worker && worker[0].id) return worker[0].id
    this.log.e(logSystem, `Failed to create worker '${workerName}' for account(${accID})`)
    return 0
  }

  /** Delete worker by ID */
  workerDelete = async (workerID: number): Promise<boolean> => {
    if (!workerID) return false
    let query = `DELETE FROM workers WHERE id = ${workerID};`
    const deleted = await this.#sql.makeQuery(query)
    if (deleted !== null) return true
    this.log.e(logSystem, `Failed to delete worker(${workerID})`)
    return false
  }

  /** Create mined block (workerID - who have found block hash) */
  blockCreate = async (workerID: number, block: RpcBlock): Promise<number> => {
    if (!workerID || !block.hash || !block.revard) return 0
    let query = `INSERT INTO blocks (worker_id, block_height, block_hash, pow_amount) `
    query += `VALUES (${workerID}, ${block.height}, '${block.hash}', ${block.revard}) RETURNING id;`
    const newBlock = await this.#sql.makeQuery(query)
    if (newBlock && newBlock[0].id) return newBlock[0].id
    this.log.e(logSystem, `Failed to create block with height '${block.height}'`)
    return 0
  }
}
