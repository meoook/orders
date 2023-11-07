import events from 'events'
import Logger from '../logger'
import WebSocket from 'ws'

const logSystem = 'tracker'

export default class SymbolTracker extends events.EventEmitter {
  #socket: WebSocket
  #name: string
  #price: number = 0
  #buy: number = 0
  #sell: number = 0

  constructor(private readonly log: Logger, private readonly symbol: string) {
    super()
    this.log.d(logSystem, `Start ${logSystem} for ${symbol} symbol`)
    this.#name = `Symbol ${this.symbol}`
    this.#socket = new WebSocket(`wss://stream.binance.com:9443/ws/${this.symbol.toLowerCase()}@ticker`)
    this.#setupSocket()
  }

  set buy(price: number) {
    if (this.#buy === 0) {
      this.log.i(logSystem, `${this.#name} set buy ${price}`)
      this.#buy = price
    } else if (price > this.#buy) {
      this.log.i(logSystem, `${this.#name} change buy from ${this.#buy} to ${price}`)
      this.#buy = price
    }
  }

  set sell(price: number) {
    if (this.#sell === 0) {
      this.log.i(logSystem, `${this.#name} set sell ${price}`)
      this.#sell = price
    } else if (price < this.#sell) {
      this.log.i(logSystem, `${this.#name} change sell from ${this.#sell} to ${price}`)
      this.#sell = price
    }
  }

  get alife(): boolean {
    this.log.i(logSystem, `${this.#name} price: ${this.#price} with buy: ${this.#buy} sell: ${this.#sell}`)
    return !this.#socket.isPaused // && this.#socket.ping()
  }

  reset = (): void => {
    this.log.d(logSystem, `${this.#name} reset buy/sell prices`)
    this.#sell = 0
    this.#buy = 0
  }

  stop = (): void => {
    this.log.i(logSystem, `${this.#name} close connection`)
    this.#socket.close()
  }

  // Socket data handler
  #setupSocket = (): void => {
    // Connection opened event
    this.#socket.on('open', () => {
      this.log.i(logSystem, `${this.#name} open connection`)
    })
    // Message received event
    this.#socket.on('message', (data: any) => {
      const message = JSON.parse(data)
      this.#price = parseFloat(message.c)
      if (this.#buy && this.#price < this.#buy) this.emit('low', this.#price)
      if (this.#sell && this.#price > this.#sell) this.emit('high', this.#price)
    })
    // Connection closed event
    this.#socket.on('close', (withErr: boolean) => {
      this.log.w(logSystem, `${this.#name} close connection${withErr ? ' with error' : ''}`)
      this.emit('close')
    })
    // Error event
    this.#socket.on('error', (error: any) => {
      this.log.w(logSystem, `${this.#name} socket error - ${JSON.stringify(error)}`)
      this.emit('error')
    })
  }
}
