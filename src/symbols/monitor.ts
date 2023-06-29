import events from 'events'
import TrackingSymbol from './tracker'
import { IConfig } from '../datatype/config'
import Logger from '../logger'

const logSystem = 'monitor'

export enum OrderSide {
  BUY,
  SELL,
}

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

  constructor(private readonly cfg: IConfig, private readonly log: Logger) {
    super()
    this.#start()
  }

  #start = () => {
    this.log.d(logSystem, 'Starting orders monitor...')
    this.#symbolsKeepAlife()
  }

  orderAdd(botID: number, symbol: string, side: OrderSide, price: number, orderID: number): void {
    this.log.i(logSystem, `Add order ${symbol} ${side}`)
    if (symbol in this.#bots) this.#bots[symbol].push({ botID: botID, price: price, side: side, orderID: orderID })
    else this.#bots[symbol] = [{ botID: botID, price: price, side: side, orderID: orderID }]
    this.#symbolAdd(symbol)
    if (side === OrderSide.BUY) this.#symbols[symbol].low = price
    else this.#symbols[symbol].high = price
  }

  ordersCancel(botID: number, symbol: string, orders?: number[]): void {
    /// Cancel tracking selected orders or for all orders if not set
    if (symbol in this.#bots) {
      if (orders) this.#bots[symbol].filter((o) => o.botID !== botID && !orders.includes(o.orderID))
      else this.#bots[symbol].filter((o) => o.botID !== botID)
      this.#symbolReset(symbol)
      this.#symbolCheckTimer(symbol)
    }
  }

  #symbolsKeepAlife(): void {
    setInterval(() => {
      for (let symbol in this.#symbols) {
        if (this.#symbols[symbol].alife) this.log.i(logSystem, `Symbol ${symbol} is alife`)
        else this.log.e(logSystem, `Symbol ${symbol} is not alife`)
      }
    }, this.cfg.timers.keepAlife * 1000)
  }

  #symbolReset(symbol: string): void {
    /// Recheck low and high for symbol
    this.#symbols[symbol].reset()
    this.#bots[symbol].forEach((o) => {
      if (o.side === OrderSide.BUY) this.#symbols[symbol].low = o.price
      else this.#symbols[symbol].high = o.price
    })
  }

  #symbolAdd(symbol: string): void {
    if (symbol in this.#symbols) {
      this.log.d(logSystem, `Already tracking symbol ${symbol}`)
    } else {
      this.log.i(logSystem, `Add symbol to track ${symbol}`)
      const tracker = new TrackingSymbol(symbol, this.log)
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
    if (symbol in this.#bots && this.#bots[symbol].length) return true
    this.#symbolRemove(symbol)
    return false
  }

  #symbolCheckTimer(symbol: string): void {
    setTimeout(() => {
      /// Check if symbol have active bots -> if no - stop tracking
      this.#symbolCheck(symbol)
    }, this.cfg.timers.symbolRemove * 1000)
  }

  #symbolCheckPrice(symbol: string, price: number, side: OrderSide): void {
    if (symbol in this.#symbols) {
      if (!this.#symbolCheck(symbol)) return
      let amount: number = 0
      for (const order of this.#bots[symbol]) {
        const triggered: boolean = side === OrderSide.BUY ? order.price >= price : order.price <= price
        const valid: boolean = side === OrderSide.BUY ? order.side === OrderSide.BUY : order.side === OrderSide.SELL
        if (triggered) {
          amount++
          if (valid) {
            this.log.i(logSystem, `${order.side} order id:${order.orderID} triggered on side: ${side}`)
          } else {
            this.log.c(logSystem, `${order.side} order id:${order.orderID} triggered but side: ${side}`)
          }
          this.emit('order', order.orderID)
        }
      }
      if (amount) this.log.i(logSystem, `Symbol ${symbol} triggered ${amount} orders on price: ${price}`)
      else this.log.e(logSystem, `Symbol ${symbol} triggered but orders to emit not found`)
    } else {
      this.log.e(logSystem, `Emit 'check' on non-tracking symbol ${symbol}`)
    }
  }
}
