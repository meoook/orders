import events from 'events'
import Logger from '../logger'
import WebSocket from 'ws'

const logSystem = 'tracker'

export default class SymbolTracker extends events.EventEmitter {
  #socket: WebSocket
  #name: string
  #price: number = 0
  #low: number = 0
  #high: number = 0

  constructor(private readonly symbol: string, private readonly log: Logger) {
    super()
    this.#name = `Symbol ${this.symbol}`
    this.#socket = new WebSocket(`wss://stream.binance.com:9443/ws/${this.symbol.toLowerCase()}@ticker`)
    this.#setupSocket()
  }

  set low(price: number) {
    if (this.#low === 0) this.#low = price
    else if (price > this.#low) this.#low = price
  }

  set high(price: number) {
    if (this.#high === 0) this.#high = price
    else if (price < this.#high) this.#high = price
  }

  get alife(): boolean {
    return !this.#socket.isPaused // && this.#socket.ping()
  }

  reset = (): void => {
    this.#high = 0
    this.#low = 0
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
      this.log.i(logSystem, `${this.#name} ${this.symbol} price ${this.#price}`)
      if (this.#low && this.#price < this.#low) this.emit('low', this.#price)
      if (this.#high && this.#price > this.#high) this.emit('high', this.#price)
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
