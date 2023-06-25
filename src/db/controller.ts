import { CfgRedis, CfgSql } from '../datatype/config'
import { RpcBlock } from '../datatype/rpcBlock'
import { PoolShare } from '../datatype/share'
import Logger from '../logger'
import QuerysPool from './pg_pool'
import QuerysShares from './pg_shares'

const logSystem = 'data'

/** Stratum server data control */
export default class DataControl {
  // #clientRedis: RedisDB
  #dbShares: QuerysShares
  #dbPool: QuerysPool

  constructor(private readonly log: Logger, cfgSql: CfgSql, cfgRedis?: CfgRedis) {
    this.#dbShares = new QuerysShares(this.log, cfgSql)
    this.#dbPool = new QuerysPool(this.log, cfgSql)
    if (cfgRedis) this.log.i(logSystem, `Redis configured`)
    // if (cfgRedis) this.#clientRedis = RedisDB(cfgRedis)
  }

  /** Stratum method */
  share = async (share: PoolShare): Promise<any> => {
    if (share.blockHex) this.log.i(logSystem, `Worker(id:${share.workerID}) - block found!`)
    else this.log.i(logSystem, `Worker(id:${share.workerID}) - share ${share.valid ? 'valid' : 'invalid'}`)
    const shareCreated = await this.#dbShares.shareCreate(share.workerID, share)
    if (shareCreated) this.log.d(logSystem, 'Share saved')
    else this.log.e(logSystem, 'Share save failed')
    return shareCreated
  }

  /** Stratum method */
  auth = async (ip: string, account: string, name: string): Promise<number> => {
    this.log.i(logSystem, `Try to auth ${account}.${name} from ip '${ip}'`)

    const banned = await this.#dbShares.banCheck(ip)
    if (banned) return 0

    const wasBefore = await this.#dbPool.workerGet(account, name)
    if (wasBefore) return wasBefore.id

    const acc = await this.#dbPool.accGet(account)
    if (!acc) {
      this.log.w(logSystem, `Auth from unknown account ${account} with ip '${ip}'`)
      return 0
    }
    const worker = await this.#dbPool.workerCreate(acc.id, name)
    if (!worker) this.log.w(logSystem, `Failed to created worker ${account}.${name}`)
    this.log.i(logSystem, `Created new worker ${account}.${name}`)
    return worker
  }

  /** Stratum method */
  banAdd = async (ip: string, reason?: string): Promise<boolean> => {
    this.log.i(logSystem, `Ban ip '${ip}' for ${reason}`)
    return await this.#dbShares.banAdd(ip, reason)
  }

  /** Remove ip from ban list */
  banRemove = async (ip: string): Promise<boolean> => {
    this.log.i(logSystem, `Disban ip '${ip}'`)
    return await this.#dbShares.banRemove(ip)
  }

  /** Create block when mined */
  blockCreate = async (workerID: number, block: RpcBlock): Promise<boolean> => {
    const blockID = await this.#dbPool.blockCreate(workerID, block)
    return Boolean(blockID)
  }
}

