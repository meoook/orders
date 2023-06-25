import CfgRpc from './datatype/cfgRpc'
import Logger from './logger'
import RpcClient from './rpc.js'
const logSystem = 'daemon'

interface OkResponse {
  [key: string]: any
}
type AnyResponse = OkResponse | null

export default class RpcDaemonInterface {
  readonly #daemons: RpcClient[] = []
  readonly #params = { "rules": ["segwit"] }

  constructor(private readonly log: Logger, daemonsCfg: Array<CfgRpc | string>) {
    if (Array.isArray(daemonsCfg)) daemonsCfg.forEach(cfg => this.#daemons.push(new RpcClient(cfg)))
  }

  // TODO: Create request quee if more then one daemon
  #makeRequest = async (daemon: RpcClient, method: string, params?: Array<any>): Promise<AnyResponse> => {
    this.log.d(logSystem, `Request '${method}' to ${daemon.info}`)
    try {
      return await daemon.doRequest(method, params) as OkResponse
    } catch (err) {
      this.log.e(logSystem, `Request fail - ${err}`)
    }
    return null
  }

  // Check online all rpc daemons
  isOnline = async (): Promise<boolean> => {
    if (this.#daemons.length < 1) this.log.e(logSystem, 'Rpc node config not found')
    else {
      return this.#daemons.every(async (daemon) => {
        try {
          await daemon.doRequest('getNetworkHashps')
          return true
        }
        catch (err: any) {
          this.log.e(logSystem, `Check online failed - ${err.message}`)
          return false
        }
      })
    }
    return false
  }

  validateAddress = async (address: string) => await this.#makeRequest(this.#daemons[0], 'validateAddress', [address])
  getBalance = async () => await this.#makeRequest(this.#daemons[0], 'getBalance')
  getDifficulty = async () => await this.#makeRequest(this.#daemons[0], 'getDifficulty')
  getNetworkHashRate = async () => await this.#makeRequest(this.#daemons[0], 'getNetworkHashps')
  getMiningInfo = async () => await this.#makeRequest(this.#daemons[0], 'getMiningInfo')
  getNetworkInfo = async () => await this.#makeRequest(this.#daemons[0], 'getNetworkInfo')
  submitBlock = async (blockhash: string) => await this.#makeRequest(this.#daemons[0], 'submitBlock', [blockhash])
  getBlockTemplate = async () => await this.#makeRequest(this.#daemons[0], 'getBlockTemplate', [this.#params])
  getBlock = async (blockhash: string) => await this.#makeRequest(this.#daemons[0], 'getBlock', [blockhash])
  getPeerInfo = async () => await this.#makeRequest(this.#daemons[0], 'getPeerInfo')
}
