import events from 'events'
import TrackingSymbol from './tracker'
import { IConfig } from '../datatype/config'
import Logger from '../logger'
import { OrderSide } from '../bn_api/datatype'

const logSystem = 'monitor'

interface ISymbols {
  [index: string]: TrackingSymbol
}

interface IOrder {
  botID: number
  orderID: number
  price: number
  side: OrderSide
}

interface IBots {
  [symbol: string]: IOrder[]
}

export default class OrdersMonitor extends events.EventEmitter {
  #symbols: ISymbols = {}
  #bots: IBots = {}

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    super()
    this.log.d(logSystem, `Start ${logSystem}`)
    this.#start()
  }

  #start = () => {
    this.#symbolsKeepAlife()
  }

  orderAdd(botID: number, symbol: string, side: OrderSide, price: number, orderID: number): void {
    this.log.i(logSystem, `Bot id: ${botID} add ${symbol} ${OrderSide[side]} order with price ${price}`)
    if (symbol in this.#bots) this.#bots[symbol].push({ botID: botID, price: price, side: side, orderID: orderID })
    else this.#bots[symbol] = [{ botID: botID, price: price, side: side, orderID: orderID }]
    this.#symbolAdd(symbol)
    if (side === OrderSide.BUY) this.#symbols[symbol].low = price
    else this.#symbols[symbol].high = price
  }

  ordersCancel(botID: number, symbol: string, orders?: number[]): void {
    /// Cancel tracking selected orders or for all orders if not set
    this.log.i(logSystem, `Bot id: ${botID} cancel ${symbol} orders: ${orders ? orders : 'all'}`)
    if (symbol in this.#bots) {
      if (orders) {
        this.#bots[symbol] = this.#bots[symbol].filter((o: IOrder) => o.botID !== botID && !orders.includes(o.orderID))
      } else {
        this.#bots[symbol] = this.#bots[symbol].filter((o: IOrder) => o.botID !== botID)
      }
      this.#symbolReset(symbol) // reset if deleted
      this.#symbolCheckTimer(symbol)
    }
  }

  #symbolsKeepAlife(): void {
    this.log.d(logSystem, `Set keep alife check every ${this.cfg.timers.keepAlife} seconds`)
    setInterval(() => {
      this.log.i(logSystem, 'Symbols keep alife check')
      for (let symbol in this.#symbols) {
        if (this.#symbols[symbol].alife) this.log.i(logSystem, `Symbol ${symbol} is alife`)
        else this.log.e(logSystem, `Symbol ${symbol} is not alife`)
      }
    }, this.cfg.timers.keepAlife * 1000)
  }

  #symbolReset(symbol: string): void {
    /// Recheck low and high for symbol
    this.log.d(logSystem, `Symbol ${symbol} reset buy/sell price`)
    this.#symbols[symbol].reset()
    this.#bots[symbol].forEach((order: IOrder) => {
      if (order.side === OrderSide.BUY) this.#symbols[symbol].low = order.price
      else this.#symbols[symbol].high = order.price
    })
  }

  #symbolAdd(symbol: string): void {
    if (symbol in this.#symbols) {
      this.log.d(logSystem, `Already tracking symbol ${symbol}`)
    } else {
      this.log.i(logSystem, `Add symbol to track ${symbol}`)
      const tracker = new TrackingSymbol(this.log, symbol)
      tracker.on('low', (price: number) => {
        this.#symbolCheckPrice(symbol, price, OrderSide.BUY)
      })
      tracker.on('high', (price: number) => {
        this.#symbolCheckPrice(symbol, price, OrderSide.SELL)
      })
      // TODO: tacker.on(error)
      this.#symbols[symbol] = tracker
    }
  }

  #symbolRemove(symbol: string): void {
    if (symbol in this.#bots) delete this.#bots[symbol]
    if (symbol in this.#symbols) {
      this.log.i(logSystem, `Stop tracking symbol ${symbol}`)
      this.#symbols[symbol].stop()
      delete this.#symbols[symbol]
    } else {
      this.log.w(logSystem, `No tracking symbol ${symbol} to remove`)
    }
  }

  #symbolCheck(symbol: string): boolean {
    /// Stop tracking symbol without bots
    this.log.d(logSystem, `${symbol} check for orders`)
    if (symbol in this.#bots && this.#bots[symbol].length) return true
    this.log.i(logSystem, `${symbol} no orders - symbol remove`)
    this.#symbolRemove(symbol)
    return false
  }

  #symbolCheckTimer(symbol: string): void {
    this.log.d(logSystem, `${symbol} check for orders after ${this.cfg.timers.symbolRemove} seconds`)
    setTimeout(() => {
      this.#symbolCheck(symbol)
    }, this.cfg.timers.symbolRemove * 1000)
  }

  #symbolCheckPrice(symbol: string, price: number, side: OrderSide): void {
    this.log.d(logSystem, `${symbol} check ${OrderSide[side]} for price: ${price}`)
    if (!(symbol in this.#symbols)) {
      this.log.e(logSystem, `Emit 'check' on non-tracking symbol ${symbol}`)
      return
    }
    if (!this.#symbolCheck(symbol)) return
    let amount: number = 0
    for (const order of this.#bots[symbol]) {
      if (side === OrderSide.BUY ? order.price >= price : order.price <= price) {
        amount++
        const info: string = `${symbol} ${order.side} order id:${order.orderID} triggered`
        if (side === OrderSide.BUY ? order.price >= price : order.price <= price) {
          this.log.i(logSystem, `${info} on side: ${OrderSide[side]}`)
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
