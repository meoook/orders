import events from 'events'
import Logger from '../logger'
import TrackingSymbol from './tracker'
import { IConfig, OrderSide } from '../datatypes'

const logSystem = 'monitor'

interface ISymbols {
  [index: string]: TrackingSymbol
}

interface ImOrder {
  botID: number
  orderID: number
  price: number
  side: OrderSide
}

interface IBots {
  [symbol: string]: ImOrder[]
}

export default class OrdersMonitor extends events.EventEmitter {
  #symbols: ISymbols = {}
  #orders: IBots = {}

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    super()
    this.log.d(logSystem, `Start ${logSystem}`)
    this.#start()
  }

  #start = () => {
    this.#symbolsKeepAlife()
  }

  orderAdd(botID: number, symbol: string, side: OrderSide, price: number, orderID: number): void {
    this.log.i(logSystem, `Bot id:${botID} adding ${symbol} ${OrderSide[side]} order with price ${price}`)
    if (symbol in this.#orders) this.#orders[symbol].push({ botID, price, side, orderID })
    else this.#orders[symbol] = [{ botID, price, side, orderID }]
    this.#symbolAdd(symbol)
    if (side === OrderSide.BUY) this.#symbols[symbol].buy = price
    else this.#symbols[symbol].sell = price
  }

  ordersCancel(botID: number, symbol: string, orders?: number[]): void {
    /// Cancel tracking symbol selected orders or all orders if orders parameter not set
    this.log.d(logSystem, `Symbol ${symbol} bot id:${botID} cancel orders: ${orders ? orders : 'all'}`)
    if (symbol in this.#orders) {
      let _orders: ImOrder[] = []
      if (orders) _orders = this.#orders[symbol].filter((o: ImOrder) => !orders.includes(o.orderID))
      else _orders = this.#orders[symbol].filter((o: ImOrder) => o.botID !== botID)

      if (_orders.length === 0) {
        this.log.i(logSystem, `Symbol ${symbol} no more orders`)
        this.#symbolRemove(symbol)
        return
      }
      const changed: boolean = _orders.length !== this.#orders[symbol].length
      this.#orders[symbol] = _orders

      if (changed) this.#symbolReset(symbol)
      else this.log.w(logSystem, `Symbol ${symbol} bot id:${botID} orders not found to cancel`)
    } else {
      this.log.e(logSystem, `Symbol ${symbol} not found tracking orders to cancel`)
    }
  }

  #symbolsKeepAlife(): void {
    this.log.d(logSystem, `Set keep alife check every ${this.cfg.timers.keepAlife} seconds`)
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
    this.#orders[symbol].forEach((order: ImOrder) => {
      if (order.side === OrderSide.BUY) this.#symbols[symbol].buy = order.price
      else this.#symbols[symbol].sell = order.price
    })
  }

  #symbolAdd(symbol: string): void {
    if (symbol in this.#symbols) {
      this.log.d(logSystem, `Symbol ${symbol} already tracking`)
    } else {
      this.log.i(logSystem, `Symbol ${symbol} added to track`)
      const tracker = new TrackingSymbol(this.log, symbol)
      tracker.on('low', (price: number) => {
        this.#symbolPriceTriger(symbol, price, OrderSide.BUY)
      })
      tracker.on('high', (price: number) => {
        this.#symbolPriceTriger(symbol, price, OrderSide.SELL)
      })
      // TODO: tacker.on(error)
      this.#symbols[symbol] = tracker
    }
  }

  #symbolRemove(symbol: string): void {
    if (symbol in this.#orders) delete this.#orders[symbol]
    if (symbol in this.#symbols) {
      this.log.i(logSystem, `Stop tracking symbol ${symbol}`)
      this.#symbols[symbol].stop()
      delete this.#symbols[symbol]
    } else {
      this.log.w(logSystem, `No tracking symbol ${symbol} to remove`)
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
      if (side === OrderSide.BUY ? order.price >= price : order.price <= price) {
        amount++
        const info: string = `Symbol ${symbol} ${OrderSide[order.side]} order id:${order.orderID} triggered`
        if (side === OrderSide.BUY ? order.price >= price : order.price <= price) {
          this.log.i(logSystem, `${info}`)
        } else {
          this.log.c(logSystem, `${info} but side: ${OrderSide[side]}`)
        }
        this.emit('order', order.orderID)
        this.ordersCancel(order.botID, symbol, [order.orderID])
      }
    }
    if (amount) this.log.i(logSystem, `Symbol ${symbol} triggered ${amount} orders on price: ${price}`)
    else this.log.e(logSystem, `Symbol ${symbol} triggered but orders to emit not found`)
  }
}
