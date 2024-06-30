import { EventEmitter } from 'events'
import Logger from '../logger'
import TrackingSymbol from './tracker'
import { IConfig, OrderSide, SqlOrder } from '../datatypes'

const logSystem = 'monitor'

interface ISymbols {
  [index: string]: TrackingSymbol
}

interface IBots {
  [symbol: string]: SqlOrder[]
}

export default class OrdersMonitor extends EventEmitter {
  #symbols: ISymbols = {}
  #orders: IBots = {}

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    super()
    this.log.i(logSystem, `Start ${logSystem}`)
    this.#setupKeepAlife()
  }

  orderAdd(order: SqlOrder): void {
    this.log.i(logSystem, `Bot id:${order.bot_id} adding ${order.symbol} ${order.side} order with price ${order.price}`)
    if (order.symbol in this.#orders) this.#orders[order.symbol].push(order)
    else this.#orders[order.symbol] = [order]
    this.#symbolAdd(order.symbol)
    if (order.side === OrderSide.BUY) this.#symbols[order.symbol].buy = order.price
    else this.#symbols[order.symbol].sell = order.price
  }

  ordersCancel(botID: number, symbol: string, orders?: number[]): void {
    /// Cancel tracking symbol selected orders or all bot orders if orders parameter not set
    this.log.d(logSystem, `Symbol ${symbol} bot id:${botID} cancel orders: [${orders ? orders : 'all'}]`)
    if (symbol in this.#orders) {
      let _orders: SqlOrder[] = []
      if (orders) _orders = this.#orders[symbol].filter((o: SqlOrder) => !orders.includes(o.id))
      else _orders = this.#orders[symbol].filter((o: SqlOrder) => o.bot_id !== botID)

      if (_orders.length === 0) {
        this.log.d(logSystem, `Symbol ${symbol} no more orders`)
        this.#symbolRemove(symbol)
        return
      }
      if (_orders.length !== this.#orders[symbol].length) {
        this.#orders[symbol] = _orders
        this.#symbolReset(symbol)
      } else {
        this.log.w(logSystem, `Symbol ${symbol} bot id:${botID} orders not found to cancel`)
      }
    } else {
      this.log.e(logSystem, `Symbol ${symbol} not found tracking orders to cancel`)
    }
  }

  #setupKeepAlife(): void {
    this.log.i(logSystem, `Setup keep alife check every ${this.cfg.timers.keepAlife} seconds`)
    setInterval(() => {
      this.log.i(logSystem, 'Symbols keep alife check')
      for (let symbol in this.#symbols) {
        if (this.#symbols[symbol].alife) this.log.i(logSystem, `Symbol ${symbol} is alife`)
        else this.log.e(logSystem, `Symbol ${symbol} is not alife`) //  TODO: #symbolRestart (delete and reset)
      }
    }, this.cfg.timers.keepAlife * 1000)
  }

  #symbolReset(symbol: string): void {
    /// Reset buy and sell prices for symbol
    this.log.d(logSystem, `Symbol ${symbol} reset buy/sell prices`)
    this.#symbols[symbol].reset()
    this.#orders[symbol].forEach((order: SqlOrder) => {
      if (order.side === OrderSide.BUY) this.#symbols[symbol].buy = order.price
      else this.#symbols[symbol].sell = order.price
    })
  }

  #symbolAdd(symbol: string): void {
    if (symbol in this.#symbols) this.log.d(logSystem, `Symbol ${symbol} already tracking`)
    else this.#symbolSetup(symbol)
  }

  #symbolSetup(symbol: string): void {
    this.log.i(logSystem, `Symbol ${symbol} added to track`)
    const tracker = new TrackingSymbol(this.log, symbol, this.cfg.wsCloseCode)
    tracker.on('low', (price: number) => {
      this.#symbolPriceTriger(symbol, price, OrderSide.BUY)
    })
    tracker.on('high', (price: number) => {
      this.#symbolPriceTriger(symbol, price, OrderSide.SELL)
    })
    tracker.on('close', (code: number) => {
      if (code === this.cfg.wsCloseCode) {
        this.log.i(logSystem, `Symbol ${symbol} connection closed on stop`)
      } else {
        this.log.w(logSystem, `Symbol ${symbol} connection closed (code:${code}) - restart`)
        this.#symbolSetup(symbol)
      }
    })
    // TODO: tacker.on(error)
    this.#symbols[symbol] = tracker
  }

  #symbolRemove(symbol: string): void {
    if (symbol in this.#orders) delete this.#orders[symbol]
    if (symbol in this.#symbols) {
      this.log.i(logSystem, `Symbol ${symbol} stop tracking`)
      this.#symbols[symbol].stop()
      delete this.#symbols[symbol]
    } else {
      this.log.w(logSystem, `Symbol ${symbol} not tracking to remove`)
    }
  }

  #symbolPriceTriger(symbol: string, price: number, side: OrderSide): void {
    if (!(symbol in this.#symbols)) {
      this.log.c(logSystem, `Symbol ${symbol} trigger ${OrderSide[side]} for price ${price} but non-tracking`)
      return
    } else {
      this.log.d(logSystem, `Symbol ${symbol} trigger ${OrderSide[side]} for price ${price}`)
    }
    let amount: number = 0
    for (const order of this.#orders[symbol]) {
      const info: string = `Symbol ${symbol} ${OrderSide[order.side]} order id:${order.order_id} triggered`
      if (order.side === side && side === OrderSide.BUY ? order.price >= price : order.price <= price) {
        amount++
        this.log.i(logSystem, `${info}`)
        this.emit('order', order.order_id)
        this.ordersCancel(order.bot_id, symbol, [order.order_id])
      } else {
        this.log.c(logSystem, `${info} but side: ${OrderSide[side]}`)
      }
    }
    if (amount) this.log.i(logSystem, `Symbol ${symbol} triggered ${amount} orders on price: ${price}`)
    else this.log.e(logSystem, `Symbol ${symbol} triggered but orders to emit not found`)
  }
}
