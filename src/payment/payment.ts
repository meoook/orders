/**
import Logger from '../logger'
import { IConfig } from '../datatype/config.js'
import RpcDaemonInterface from '../daemon'
import QuerysPayout from '../db/pg_pay'

const logSystem = 'incomes'
 */
/** Job manager to create payouts */
/**
export default class PaymentIncomes {
  readonly #dMinInterval = 120  // Time in seconds to replay a task
  readonly #dMinPay = 0.001  // Default minimum payout (variable for each coin)

  #makeIncomesTimeout!: NodeJS.Timeout // Make incomes from shares
  #makePayoutTimeout!: NodeJS.Timeout  // Make payouts from incomes

  static DIFF_COEFICIENT: number = 10  // To get pay amount for difficulty per share

  readonly #intervalSec: number
  readonly #minPayout: number
  readonly #daemon: RpcDaemonInterface
  readonly #sql: QuerysPayout

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    if (this.cfg.pay.minPay < this.#dMinPay)
      this.log.w(logSystem, `Min pay of ${this.#dMinPay} is recommended`)
    if (this.cfg.pay.incomesInterval < this.#dMinInterval)
      this.log.w(logSystem, `Min interval of ${this.#dMinInterval} is recommended`)

    this.#intervalSec = Math.max(this.cfg.pay.incomesInterval, this.#dMinInterval)
    this.#minPayout = Math.max(this.cfg.pay.minPay, this.#dMinPay) // Don't allow 0 conf transactions.

    // TODO - actions as in poolStart
    // validate address, get balance, get info
    this.#daemon = new RpcDaemonInterface(this.log, this.cfg.daemons)
    this.#sql = new PgDataControl(this.log, this.cfg.sql)
    this.#runIntervals()
    this.#removeMe()
  }

  makeIncomes = async (): Promise<void> => {
    clearTimeout(this.#makeIncomesTimeout)

    const workerIDs = await this.#sql.workerShares()
    if (!workerIDs) {
      this.log.w(logSystem, `No shares for last ${this.#intervalSec}s`)
      return false
    }
    workerIDs.forEach(async (_wID: number): Promise<void> => {
      await this.#sql.sharesGet(_wID)
    })

    this.#makeIncomesTimeout = setTimeout(async () => {
      await this.makeIncomes()
    }, this.cfg.timers.jobRebroadcast * 1000)
  }

  #runIntervals = () => {
    this.log.i(logSystem, `Starting 'incomes count' jobs every ${this.#intervalSec}s`)
    setInterval(async () => {
      await this.#jobCountIncomes()
    }, this.#intervalSec * 1000)
  }

  #jobCountIncomes = async (): Promise<boolean> => {
    this.log.d(logSystem, `Counting incomes`)

    const workerIDs = await this.#sql.workerShares()
    if (!workerIDs) {
      this.log.w(logSystem, `No shares for last ${this.#intervalSec}s`)
      return false
    }
    workerIDs.forEach(async (_wID: number): Promise<void> => {
      await this.#sql.sharesGet(_wID)
    })
    return false
  }

}
 */
