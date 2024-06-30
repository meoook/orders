import express, { Request, Response } from 'express'
import Logger from './logger'
import Pool from './pool'
import { IConfig, OrderStatus, SqlOrderCreate } from './datatypes'

const logSystem = 'server'

export default class ApiServer {
  #app: any
  #pool: Pool

  constructor(private readonly log: Logger, private readonly cfg: IConfig) {
    this.log.i(logSystem, `Start ${logSystem} ${this.cfg.api.hostname}:${this.cfg.api.port}`)
    this.#pool = new Pool(this.log, this.cfg)
    this.#app = express()
    this.#app.use(express.json())

    this.#apiSetEndppooints()
    this.#app.listen(this.cfg.api.port, () => {
      this.log.d(logSystem, `Run API Server on ${this.cfg.api.hostname} port ${this.cfg.api.port}`)
    })
  }

  #apiSetEndppooints = () => {
    this.#app.get('/api/orders', async (req: Request, res: Response) => {
      // Get all open orders
      const { bot_id } = req.query
      if (!bot_id) {
        this.log.w(logSystem, `Bot id not set to get open orders`)
        res.status(400).json({ error: 'Bot id not set to get open orders' })
      } else {
        this.log.d(logSystem, `Try to get open orders for bot with id ${bot_id}`)
        const orders = await this.#pool.ordersGet(Number(bot_id))
        this.log.i(logSystem, `Bot ${bot_id} get ${orders.length} open orders`)
        res.status(200).json(orders)
      }
    })

    this.#app.get('/api/orders/:id', async (req: Request, res: Response) => {
      // Get order by ID
      const orderID = req.params.id
      if (!orderID || typeof orderID !== 'number') {
        this.log.w(logSystem, `Order id ${orderID} not a number`)
        res.status(400).json({ error: 'order id invalid parameter' })
      } else {
        this.log.d(logSystem, `Try to get order with id ${orderID}`)
        const order = await this.#pool.orderGet(orderID)
        if (order) {
          this.log.i(logSystem, `Get order with id ${orderID}`)
          res.status(200).json(order)
        } else {
          this.log.e(logSystem, `Failed to get order with id:${orderID}`)
          res.status(404).json({ error: 'order not found' })
        }
      }
    })

    this.#app.post('/api/orders', async (req: Request, res: Response) => {
      // Create order
      const { bot_id, symbol, side, borrow, quantity, price, timeframe } = req.body
      if (!bot_id || !symbol || !side || !borrow || !quantity || !price || !timeframe) {
        this.log.w(logSystem, `Wrong parameters to create order - ${req.body}`)
        res.status(400).json({ error: 'wrong parameters to create order' })
      } else {
        const now: number = (Date.now() / 1000) | 0
        const newOrder: SqlOrderCreate = {
          bot_id,
          symbol,
          order_id: 0,
          status: OrderStatus.NEW,
          side,
          borrow,
          quantity,
          price,
          time: now,
          expire: Math.round(this.#timeframeToSec(timeframe) + now),
        }
        this.log.d(logSystem, `Try to new create order ${newOrder}`)
        const details: string = `qty: ${newOrder.quantity} price: ${newOrder.price}`
        try {
          const order = await this.#pool.orderCreate(newOrder)
          this.log.i(logSystem, `New order created (id:${order.id}) with ${details}`)
          res.status(200).json(order)
        } catch (err) {
          this.log.e(logSystem, `Failed to create ${newOrder.side} order for bot id:${newOrder.bot_id} with ${details}`)
          res.status(400).json({ error: 'order failed to create' })
        }
      }
    })

    this.#app.delete('/api/orders', async (req: Request, res: Response) => {
      // Cancel all open orders
      // const { bot_id } = req.body
      const { bot_id } = req.query
      if (!bot_id) {
        this.log.w(logSystem, `Bot id not set to cancel open orders`)
        res.status(400).json({ error: 'Bot id not set to cancel open orders' })
      } else {
        this.log.d(logSystem, `Try to cancel open orders for bot with id ${bot_id}`)
        try {
          const amount = await this.#pool.ordersCancel(Number(bot_id))
          this.log.i(logSystem, `Bot ${bot_id} cancel ${amount} open orders`)
          res.status(200).json({ amount })
        } catch (err) {
          this.log.e(logSystem, `Bot ${bot_id} failed to cancel open orders - ${err}`)
          res.status(400).json({ error: 'failed to cancel open orders' })
        }
      }
    })
  }

  #timeframeToSec(timeframe: string): number {
    if (timeframe.length > 3) throw new Error(`invalid timeframe ${timeframe}`)
    const lenTwo: boolean = timeframe.length === 2
    const value = timeframe.slice(0, lenTwo ? 1 : 2)
    const units = timeframe.slice(lenTwo ? 1 : 2)
    let result: number = 0
    if (units === 'm') result = 60
    else if (units === 'h') result = 60 * 60
    else if (units === 'd') result = 60 * 60 * 24
    else if (units === 'w') result = 60 * 60 * 24 * 7
    else if (units === 'M') result = 60 * 60 * 24 * 30
    else throw new Error(`unknown timeframe ${timeframe} to get seconds`)
    return result * Number(value)
  }
}
