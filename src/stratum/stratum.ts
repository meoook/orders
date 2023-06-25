import net, { Socket } from 'net'
import events from 'events'
import tls from 'tls'
import fs from 'fs'
import * as util from '../util'
import StratumClient from './client'
import { IConfig, CfgBan } from '../datatype/config'
import Logger from '../logger'
import StratumJob from '../datatype/stratumJob'

const logSystem = 'stratum'

class SubscriptionCounter {
  #count: number = 0
  // #padding = 'deadbeefcafebabe'

  next = (): string => {
    this.#count++
    if (Number.MAX_VALUE === this.#count) this.#count = 1
    return util.packInt64LE(this.#count).toString('hex')
    // return this.#padding + util.packInt64LE(this.#count).toString('hex')
  }
}

type TimeStamp = number

interface BannedIP {
  [index: string]: TimeStamp
}

interface Clients {
  [index: string]: StratumClient
}

export default class StratumServer extends events.EventEmitter {
  #bannedIPs: BannedIP = {} // {IP: BanTime}
  #permanentBannedIPs: string[] = []  // TODO: get banned ips from DB or...
  #rebroadcastTimeout!: NodeJS.Timeout
  #banning: boolean = false
  #clients: Clients = {}
  #subscriptionCounter: SubscriptionCounter

  constructor(private readonly cfg: IConfig, private readonly authorizeFn: Function, private readonly log: Logger) {
    super()
    this.#subscriptionCounter = new SubscriptionCounter()
    this.#banningSetup(cfg.banning)
    this.#init()
  }

  #banningSetup = (banCfg: CfgBan): void => {
    if (!banCfg || !banCfg.enabled) return
    this.#banning = true
    setInterval(() => {
      for (let ip in this.#bannedIPs) {
        if (this.#banTimeLeft(ip) <= 0) delete this.#bannedIPs[ip]
      }
    }, banCfg.purgeInterval || 300 * 1000)
  }

  #banTimeLeft = (ip: string): number => this.cfg.banning.time || 60 * 1000 + this.#bannedIPs[ip] - Date.now()

  // Check in current and permanent banned IP's
  #banControl = (client: StratumClient): void => {
    const ip: string = client.info.ip
    if (this.#banning) {
      let err: string = ''
      if (!ip) {
        err = `Rejected incoming connection from ${client.label} - proxy get ip failed`
      }
      else if (this.#permanentBannedIPs.includes(ip)) {
        err = `Rejected incoming connection from ${client.label} - permanent ban`
      }
      else if (ip in this.#bannedIPs) {
        const timeLeft: number = this.#banTimeLeft(ip)
        if (timeLeft > 0) err = `Rejected incoming connection from ${client.label} banned for ${timeLeft}s`
        else {
          delete this.#bannedIPs[ip]
          this.log.i(logSystem, `Forgave banned IP ${client.label}`)
        }
      }

      if (err) {
        client.socket.destroy()
        this.log.w(logSystem, err)
      }
    }
  }

  #banAddIP = (ip: string): void => { this.#bannedIPs[ip] = Date.now() }

  broadcastJob = (job: StratumJob): void => {
    clearTimeout(this.#rebroadcastTimeout)

    for (let clientId in this.#clients) {
      this.log.d(logSystem, `Send new job to worker with subscription ${clientId}`)
      this.#clients[clientId].sendMiningJob(job)
    }
    // Some miners will consider the pool dead if it doesn't receive a job for around a minute.
    // So every time we broadcast jobs, set a timeout to rebroadcast in X seconds unless cleared.
    this.#rebroadcastTimeout = setTimeout(() => this.emit('broadcastTimeout'), this.cfg.timers.jobRebroadcast * 1000)
  }

  handleClient = (socket: Socket): string => {
    socket.setKeepAlive(true)
    // socket.setTimeout(3000)
    socket.setEncoding('utf8')

    const subscriptionId: string = this.#subscriptionCounter.next()

    const client = new StratumClient(socket, this.log, this.authorizeFn, this.cfg)
    this.#clients[subscriptionId] = client
    this.log.d(logSystem, `Client ${client.label} connected with subscription: ${subscriptionId}`)

    client.on('socketDisconnect', (): void => {
      delete this.#clients[subscriptionId]
      this.log.d(logSystem, `Client ${client.label} disconnected`)
      this.emit('client.disconnected', client)
    })
    client.on('checkBan', (): void => this.#banControl(client))
    client.on('banAdd', (): void => this.#banAddIP(client.info.ip))
    this.emit('client.connected', client)
    return subscriptionId
  }

  #getTLSoptions = (): tls.TlsOptions | null => {
    if (this.cfg.tls && this.cfg.tls.enabled) {
      return {
        key: fs.readFileSync(this.cfg.tls.serverKey),
        cert: fs.readFileSync(this.cfg.tls.serverCert),
        // requireCert: true
      }
    }
    return null
  }

  #init = () => {
    const port = typeof this.cfg.port === 'string' ? parseInt(this.cfg.port) : this.cfg.port
    this.log.d(logSystem, `Starting stratum server${this.cfg.tls?.enabled ? '(TLS)' : ''} on ${port} port...`)
    const tlsCfg = this.#getTLSoptions()
    if (tlsCfg) {
      tls.createServer(tlsCfg, (socket) => this.handleClient(socket))
        .listen(port, () => this.emit('started'))
    } else {
      net.createServer({ allowHalfOpen: false }, (socket) => this.handleClient(socket))
        .listen(port, () => this.emit('started'))
    }
  }
}
