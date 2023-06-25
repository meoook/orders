import RpcDaemonInterface from './daemon'
import DataControl from './db/controller'
import * as util from './util.js'
import { IConfig } from './datatype/config'
import Logger from './logger'

const logSystem = `init`

interface NetInfo {
  net?: string
  connections?: number
  difficulty?: number
  hashrate?: string  // FIXME - HashRate
  port?: number
  protocolVersion?: null
}

export default class SrvInitializer {
  info: NetInfo = {}
  readonly rpc: RpcDaemonInterface
  readonly dataControl: DataControl
  addressScript!: util.AddressScript

  constructor(readonly cfg: IConfig, readonly log: Logger) {
    this.dataControl = new DataControl(log, cfg.db_shares, cfg.db_shares)
    this.info.port = typeof this.cfg.port === 'string' ? Number(this.cfg.port) : this.cfg.port
    this.rpc = new RpcDaemonInterface(log, this.cfg.daemons)
  }

  initChain = async (): Promise<boolean> => {
    this.log.i(logSystem, 'Initializing server...')
    if (!(await this.rpc.isOnline())) {
      this.log.e(logSystem, 'Daemon connection problems. Cannot start!')
      return false
    }
    if (await this.#setAddress() && await this.#setNetMining() && await this.#setChainNetwork()) return true
    return false
  }

  // Set pool address and binary addr for block
  #setAddress = async (): Promise<boolean> => {
    if (!this.cfg.address) this.log.e(logSystem, 'Pool address not set. Pool cannot start!')
    else {
      const addrInfo = await this.rpc.validateAddress(this.cfg.address)
      if (addrInfo && addrInfo.isvalid) {
        this.addressScript = util.addressToScript(this.cfg.address)
        this.log.i(logSystem, `Set pool address: ${this.cfg.address} `)
        return true
      }
      this.log.e(logSystem, `Invalid pool address: ${this.cfg.address} `)
    }
    return false
  }

  // Set difficulty, hashrate and net type (main/test)
  #setNetMining = async (): Promise<boolean> => {
    const data = await this.rpc.getMiningInfo()
    if (data) {
      this.info.net = data.chain
      this.info.difficulty = Number(data.difficulty)
      this.info.hashrate = data.networkhashps
      this.log.i(logSystem, `Network connected: ${this.info.net}net`)
      this.log.i(logSystem, `Network difficulty: ${this.info.difficulty}`)
      this.log.i(logSystem, `Network hash rate: ${util.hashRateString(this.info.hashrate)}`)
      return true
    }
    this.log.e(logSystem, 'Failed to set mining info')
    return false
  }

  // Set connections and protocol version
  #setChainNetwork = async (): Promise<boolean> => {
    const data = await this.rpc.getNetworkInfo()
    if (data) {
      this.info['connections'] = Number(data.connections)
      this.info['protocolVersion'] = data.protocolversion
      this.log.i(logSystem, `Set chain protocol version ${data.protocolversion} with ${data.connections} peers`)
      return true
    }
    this.log.e(logSystem, 'Failed to set network info')
    return false
  }

  // Log download progress of daemon chain (if daemon not ready)
  logDaemonProgress = async (): Promise<void> => {
    const miningInfo = await this.rpc.getMiningInfo()
    const peers = await this.rpc.getPeerInfo()
    if (!miningInfo || !peers) return
    // Get list of peers and their highest block height to compare to ours
    const totalBlocks = peers.sort((a: any, b: any) => b.startingheight - a.startingheight)[0].startingheight
    // FIXME: - DataClass for peer ^^
    const percent = (miningInfo.blocks / totalBlocks * 100).toFixed(2)
    this.log.w(logSystem, `Downloaded ${percent}% of blockchain from ${peers.length} peers`)
  }

  // Log server\chain info
  logInfo = () => {
    const coinInfo: string = `[${this.cfg.coin.symbol.toUpperCase()}] (${this.cfg.coin.algorithm})`
    this.log.i(logSystem, `Pool Server started for ${this.cfg.coin.name} ${coinInfo} on ${this.info.port} port`)
  }
}
