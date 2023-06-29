import { CfgSql } from '../datatype/config'
import Logger from '../logger'
// import QuerysPool from './pg_pool'

const logSystem = 'data'

/** Stratum server data control */
export default class DataControl {
  // #dbPool: QuerysPool

  constructor(private readonly log: Logger, cfgSql: CfgSql) {
    // this.#dbPool = new QuerysPool(this.log, cfgSql)
    this.log.i(logSystem, `Start db controller ${cfgSql.host}`)
  }
}
