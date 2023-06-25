import { CfgSql } from '../datatype/config.js'
import { PoolShare } from '../datatype/share.js'
import Logger from '../logger.js'
import { SqlShare } from './data_types.js'
import PgSql from './pgsql.js'

const logSystem = 'sql:stratum'


export default class QuerysShares {
  #sql: PgSql

  constructor(private readonly log: Logger, cfgSql: CfgSql) {
    this.#sql = new PgSql(this.log, cfgSql)
    this.#sql.createFromFile('./src/db/sql_shares.sql')
  }

  /** Add ip to ban list (Stratum) */
  banAdd = async (ip: string, reason: string = 'Too much invalid shares'): Promise<boolean> => {
    if (!ip) return false
    const query = `INSERT INTO bans (ip, reason) VALUES ('${ip}', '${reason}') RETURNING id;`
    const banned = await this.#sql.makeQuery(query)
    if (banned && banned[0].id) return true
    this.log.e(logSystem, `Failed to add ip '${ip}' to bans with reason - ${reason}`)
    return false
  }

  /** Remove ip from ban list (Stratum) */
  banRemove = async (ip: string): Promise<boolean> => {
    if (!ip) return false
    const removed = await this.#sql.makeQuery(`DELETE FROM bans where ip = '${ip}';`)
    if (removed !== null) return true
    this.log.e(logSystem, `Failed to remove ip '${ip}' from bans`)
    return false
  }

  /** Check ip in ban list (Stratum) */
  banCheck = async (ip: string): Promise<boolean> => {
    if (!ip) return false
    let query = `SELECT id, ip FROM bans WHERE ip = '${ip}';`
    const found = await this.#sql.makeQuery(query)
    if (found !== null) return (found.length > 0)
    this.log.w(logSystem, `Failed to find ip '${ip}' in bans`)
    return false
  }

  /** Get last shares */
  sharesGet = async (workerID: number): Promise<SqlShare[] | null> => {
    if (!workerID) return null
    let query = `SELECT id, created, job_diff FROM shares `
    query += `WHERE is_valid IS true AND worker_id = ${workerID} AND created < NOW();`
    const shares = await this.#sql.makeQuery(query)
    if (shares !== null) return shares
    this.log.e(logSystem, `Failed to get worker(${workerID}) shares`)
    return null
  }

  /** Create share for worker (Stratum) */
  shareCreate = async (workerID: number, share: PoolShare): Promise<boolean> => {
    if (!workerID || !share) return false
    let query = 'INSERT INTO shares (worker_id, job_diff, is_valid'
    let queryVals = `${workerID}, ${share.jobDiff}, ${share.valid}`
    if (Boolean(share.blockHash)) {
      query += ', block_hash'
      queryVals += `, '${share.blockHash}'`
    }
    query += `) VALUES (${queryVals}) RETURNING id;`
    const created = await this.#sql.makeQuery(query)
    if (created && created[0].id) return true
    this.log.e(logSystem, `Failed to create share for worker: ${workerID} with diff: ${share.jobDiff}`)
    return false
  }
}
