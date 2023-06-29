import Logger from './logger'
import OrdersMonitor, { OrderSide } from './symbols/monitor.js'
import { IConfig } from './datatype/config'
// import DataControl from './db/controller'

const logSystem = 'pool'

export default class Pool {
  #symbols: OrdersMonitor
  // #sql: DataControl

  constructor(private readonly cfg: IConfig, private readonly log: Logger) {
    // this.#sql = new DataControl(log, this.cfg.db)
    this.#symbols = new OrdersMonitor(this.cfg, log)
    this.#start()
  }

  #start = async (): Promise<void> => {
    this.log.i(logSystem, 'Pool initializing...')
    this.#setupSymbols()
  }

  #setupSymbols = (): void => {
    this.log.i(logSystem, 'Setup symbols...')
    this.#symbols.on('order', (orderID: number) => {
      this.log.i(logSystem, `Price triggered for order ${orderID}`)
    })
    // Go tests
    setTimeout(() => {
      this.#symbols.orderAdd(1, 'ETHUSDT', OrderSide.BUY, 1500, 123456789)
      this.log.i(logSystem, 'Add order')
    }, 5000)
  }
}
