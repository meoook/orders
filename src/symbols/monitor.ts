import events from 'events'
import TrackingSymbol from './tracker'
import { IConfig } from '../datatypes'
import Logger from '../logger'
import { OrderSide } from '../bn_api/datatypes'

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
      let _orders: IOrder[] = []
      if (orders) {
        _orders = this.#orders[symbol].filter((o: IOrder) => o.botID !== botID || !orders.includes(o.orderID))
      } else {
        _orders = this.#orders[symbol].filter((o: IOrder) => o.botID !== botID)
      }
      const changed: boolean = _orders.length !== this.#orders[symbol].length
      this.#orders[symbol] = _orders

      if (changed) {
        this.#symbolReset(symbol) // reset if have orders to delete
        this.#symbolCheckTimer(symbol)
      } else {
        this.log.w(logSystem, `Symbol ${symbol} bot id:${botID} orders not found to cancel`)
      }
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
        else this.log.e(logSystem, `Symbol ${symbol} is not alife`)
      }
    }, this.cfg.timers.keepAlife * 1000)
  }

  #symbolReset(symbol: string): void {
    /// Reset buy and sell prices for symbol
    this.log.d(logSystem, `Symbol ${symbol} reset buy/sell prices`)
    this.#symbols[symbol].reset()
    this.#orders[symbol].forEach((order: IOrder) => {
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

  #symbolCheck(symbol: string): boolean {
    /// Stop tracking symbol without bots
    this.log.d(logSystem, `Symbol ${symbol} check for orders`)
    if (symbol in this.#orders && this.#orders[symbol].length) {
      if (symbol in this.#symbols) return true
      this.log.w(logSystem, `Symbol ${symbol} have orders but not tracking`)
      this.#symbolAdd(symbol)
      this.#symbolReset(symbol)
      return true
    }
    this.log.i(logSystem, `Symbol ${symbol} no orders - symbol remove`)
    this.#symbolRemove(symbol)
    return false
  }

  #symbolCheckTimer(symbol: string): void {
    this.log.d(logSystem, `Symbol ${symbol} check for orders after ${this.cfg.timers.symbolRemove} seconds`)
    setTimeout(() => {
      console.log(`Symbol ${symbol} check on timer`) // TODO: RM
      this.#symbolCheck(symbol)
    }, this.cfg.timers.symbolRemove * 1000)
  }

  #symbolPriceTriger(symbol: string, price: number, side: OrderSide): void {
    if (!(symbol in this.#symbols)) {
      this.log.c(logSystem, `Symbol ${symbol} trigger ${OrderSide[side]} for price ${price} but non-tracking`)
      return
    } else {
      this.log.d(logSystem, `Symbol ${symbol} trigger ${OrderSide[side]} for price ${price}`)
    }
    console.log(`Symbol ${symbol} check on trigger`) // TODO: RM
    if (!this.#symbolCheck(symbol)) return
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
