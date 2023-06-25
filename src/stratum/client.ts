import events from 'events'
import { Socket } from 'net'
import { IConfig } from '../datatype/config'
import { TimeStamp } from '../datatype/rpcBlock'
import { WorkerShare, WorkerInfo } from '../datatype/share'
import StratumJob from '../datatype/stratumJob'
import Logger from '../logger'
import { StratumErrors, StratumErr } from './stratumErrors'
const logSystem = 'client'

/** NETWORK PERFORMANCE
 * Network performance = 2**256 / target / Tb = D * 2**256 / (2**224) / Tb = D * 2**32 / Tb
 * where
 * D - difficulty
 * Tb - block issuance period in seconds
 */

/** Request from miner */
interface MsgRequest {
  id: number
  method: string
  params: any[]
}

/** Response to miner */
interface MsgResponse {
  id: number
  result: boolean | null | object | any[]
  error: null | StratumErr | true
}

/** Response to miner */
interface MsgStratum {
  id: null
  method: string
  params: any[]
}

interface SharesCounter {
  valid: number
  invalid: number
}

export default class StratumClient extends events.EventEmitter {
  #sqlID: number = 0
  #ip: string
  #account: string = ''
  #name: string = ''
  #extraNonce1!: string

  #asicBoost: boolean = false
  #lastActivity: TimeStamp

  readonly #shares: SharesCounter = { valid: 0, invalid: 0 }
  #pendingDifficulty: number = 0
  #previousDifficulty: number = 0
  difficulty: number
  // this.minDifficulty = parseFloat(1 / 0xffff)
  // this.middleDifficulty = 0xffff
  // this.maxDifficulty = 0xffffffffffff;
  #subscribeBeforeAuth: boolean = false

  constructor(
    public socket: Socket,
    private readonly log: Logger,
    private readonly authorizeFn: Function,
    private readonly cfg: IConfig
  ) {
    super()
    this.#ip = this.socket?.remoteAddress?.replace(/(:|f)*/, '') || 'ip_error'
    this.#lastActivity = (Date.now() / 1000) | 0
    this.difficulty = this.cfg.variableDifficulty.minDiff
    this.#setupSocket()
  }

  get fullName(): string { return `${this.#account}.${this.#name}` }
  get label(): string {
    const fullName = this.#account ? `${this.fullName}` : '(unauthorized)'
    return `${fullName} [${this.#ip}]`
  }
  get info(): WorkerInfo {
    return {
      id: this.#sqlID,
      ip: this.#ip,
      account: this.#account,
      name: this.#name,
      difficulty: this.difficulty,
      difficultyPrev: this.#previousDifficulty,
      extraNonce1: this.#extraNonce1,
    }
  }

  // Consider ban on % failed shares (destroy socket)
  #considerBan = (shareValid: boolean): boolean => {
    if (!this.cfg.banning) return false

    if (shareValid) this.#shares.valid++
    else this.#shares.invalid++

    const totalShares = this.#shares.valid + this.#shares.invalid
    if (totalShares >= this.cfg.banning.checkThreshold) {
      const percentBad = (this.#shares.invalid / totalShares) * 100
      if (percentBad < this.cfg.banning.invalidPercent) {
        // this.#shares = { valid: 0, invalid: 0 } //reset
        this.#shares.valid = Math.floor(this.#shares.valid / 2)
        this.#shares.invalid = Math.floor(this.#shares.invalid / 2)
      }
      else {
        this.emit('banAdd', `${this.#shares.invalid} out of last ${totalShares} shares invalid`)
        this.socket.destroy()
        return true
      }
    }
    return false
  }

  #sendJson = (json: MsgResponse | MsgStratum): void => {
    const response: string = JSON.stringify(json)
    this.log.d(logSystem, `Send: ${response}`)
    this.socket.write(response + '\n')
  }

  // Socket data handler
  #setupSocket = (): void => {
    let dataBuffer = ''

    if (this.cfg.tcpProxyProtocol) {  // Get IP if proxy
      this.socket.once('data', (d) => {
        if (d.indexOf('PROXY') === 0) this.#ip = d.toString('utf8').split(' ')[2]
        else this.log.e(logSystem, `Client get IP failed - did not receive proxy protocol message, instead got: ${d}`)
        this.emit('checkBan')
      })
    } else this.emit('checkBan')

    this.socket.on('data', (data: Buffer): void => {
      dataBuffer += data
      if (Buffer.byteLength(dataBuffer, 'utf8') > 10240) { //10KB
        dataBuffer = ''
        this.socket.destroy()
        this.log.w(logSystem, `Detected socket flooding from ${this.label}`)
        return
      }
      if (dataBuffer.indexOf('\n') !== -1) {
        const messages: string[] = dataBuffer.split('\n')
        const incomplete: string = dataBuffer.slice(-1) === '\n' ? '' : messages.pop() || ''
        messages.forEach((message: string) => {
          if (!message) return
          this.log.d(logSystem, `Received: ${message}`)
          try {
            const messageJson: MsgRequest = JSON.parse(message)
            this.#messageRouter(messageJson)
          } catch (e) {
            this.log.e(logSystem, `Client ${this.label} route message - ${e}`)
            if (!this.cfg.tcpProxyProtocol || data.indexOf('PROXY') !== 0) {
              this.log.w(logSystem, `Malformed message from ${this.label} - ${message}`)
              this.socket.destroy()
            }
            return
          }
        })
        dataBuffer = incomplete
      }
    })
    // TODO - MB move to Stratum ?
    this.socket.on('close', (withErr: boolean): void => {
      this.log.w('client', `Close connection ${this.label}${withErr ? ' with error' : ''}`)
      this.emit('socketDisconnect')  // Control connection\online status
    })
    this.socket.on('error', (err: Error) => {
      this.log.w(logSystem, `Socket error from ${this.label} - ${JSON.stringify(err)}`)
    })
  }

  #messageRouter = (message: MsgRequest): void => {
    this.log.c(logSystem, `Route to ${message.method}`)  // FIXME - remove
    switch (message.method) {
      case 'mining.authorize':
        // The result from an authorize request is usually true (successful), or false. The password may be omitted if the server does not require passwords.
        // mining.authorize("username", "password")
        this.#handleAuthorize(message, true)
        break
      case 'mining.extranonce.subscribe':
        // Indicates to the server that the client supports the mining.set_extranonce method.
        // mining.extranonce.subscribe()
        // this.#supportExtraNonce = true
        this.#sendJson({ id: message.id, result: true, error: null })
        break
      case 'mining.subscribe':
        // The optional second parameter specifies a mining.notify subscription id the client wishes to resume working with (possibly due to a dropped connection). If provided, a server MAY (at its option) issue the connection the same extranonce1. Note that the extranonce1 may be the same (allowing a resumed connection) even if the subscription id is changed!
        // mining.subscribe("user agent/version", "extranonce1")
        this.#handleSubscribe(message)
        break
      case 'mining.submit':
        // Miners submit shares using the method "mining.submit". Client submissions contain:
        //   1. Worker Name.
        //   2. Job ID.
        //   3. ExtraNonce2.
        //   4. nTime.
        //   5. nOnce.
        //   6. nVersion mask (OPTIONAL)
        // Server response is result: true for accepted, false for rejected(or you may get an error with more details).
        // mining.submit("username", "job id", "ExtraNonce2", "nTime", "nOnce", "mask"?)
        this.#handleSubmit(message)
        break
      case 'mining.configure':
        // Set configuration for client
        // min diff, version rolling, info
        this.#handleConfigure(message)
        break
      case 'mining.get_transactions':
        // Server should send back an array with a hexdump of each transaction in the block specified for the given job id.
        // mining.get_transactions("job id")
        this.#sendJson({ id: message.id, result: [], error: true })
        break
      case 'mining.suggest_target':
        // Used to indicate a preference for share target to the pool, usually prior to mining.subscribe. Servers are not required to honour this request, even if they support the stratum method.
        // mining.suggest_target("full hex share target")
        this.#sendJson({ id: message.id, result: [], error: true })
        break
      case 'mining.suggest_difficulty':
        // Used to indicate a preference for share difficulty to the pool. Servers are not required to honour this request, even if they support the stratum method.
        // mining.suggest_difficulty(preferred share difficulty Number)
        this.#sendJson({ id: message.id, result: [], error: true })
        break
      default:
        this.log.i(logSystem, `Unknown stratum method from ${this.label} - ${message.method}`)
        break
    }
  }

  #handleConfigure = (message: MsgRequest): void => {
    // message.params [[extensions],{extension - parameters}]
    this.log.d(logSystem, `Handle configure params: ${message.params.toString()}`)
    if (/^[0-9A-Fa-f]+$/.test(this.cfg.coin.versionMask)) {
      this.#sendJson({
        id: message.id,
        result: {
          'version-rolling': true,
          'version-rolling.mask': this.cfg.coin.versionMask  // FIXME - ?
        },
        error: null
      })
      this.#asicBoost = true
    }
  }

  #handleSubscribe = (message: MsgRequest): void => {
    // client sends: mining.subscribe("user agent/version", "extranonce1")
    if (!this.#sqlID) this.#subscribeBeforeAuth = true

    this.emit('subscription', (extraNonce1: string, extraNonce2Size: number) => {
      this.#extraNonce1 = extraNonce1
      // Subscriptions details - 2-tuple with name of subscribed notification and subscription ID. Teoretically it may be used for unsubscribing, but obviously miners won't use it
      this.#sendJson({
        id: message.id,
        result: [
          [
            ["mining.set_difficulty", "b4b6693b72a50c7116db18d6497cac52"], // FIXME - subscription id 1
            ["mining.notify", "ae6812eb4cd7735a302a8a9dd95cf71f"]  // FIXME - subscription id 2
          ],
          extraNonce1,
          extraNonce2Size
        ],
        error: null
      })
    })
  }

  // Auth with worker name
  #handleAuthorize = async (message: MsgRequest, replyToSocket: boolean): Promise<void> => {
    if (!this.#setName(message.params[0])) {
      this.log.e(logSystem, `Auth from ${this.#ip} with no worker name`)
      const json: MsgResponse = { id: message.id, result: false, error: StratumErrors.noname }
      if (replyToSocket) this.#sendJson(json)
      return // FIXME - socket disconnect ?
    }
    const pass: string = message.params[1]
    this.log.d(logSystem, `Auth ${this.label}${pass ? ` with pass: ${pass}` : ''}`)

    this.authorizeFn(this.#ip, this.#account, this.#name).then((sqlID: number) => {
      this.#sqlID = sqlID
      const authed = Boolean(this.#sqlID)
      if (replyToSocket) {
        const json: MsgResponse = { id: message.id, result: authed, error: authed ? null : StratumErrors.noauth }
        this.#sendJson(json)
        if (this.#subscribeBeforeAuth && this.difficulty) this.sendNewDifficulty(this.difficulty)
      }
    })
  }

  // Share found
  #handleSubmit = (message: MsgRequest): void => {
    if (!this.#account) this.#setName(message.params[0])

    let _err: StratumErr | null = null
    if (!this.#sqlID) _err = StratumErrors.noauth
    if (!this.#extraNonce1) _err = StratumErrors.nosubscribe
    if (_err) {
      const json: MsgResponse = { id: message.id, result: null, error: _err }
      this.#sendJson(json)
      this.#considerBan(false)
      return
    }

    const share: WorkerShare = {
      jobID: message.params[1],
      extraNonce2: message.params[2],
      nTime: message.params[3].toLowerCase(),
      nonce: message.params[4].toLowerCase(),
    }

    if (message.params.length > 5 && /^[0-9A-Fa-f]+$/.test(message.params[5])) {
      if (!this.#asicBoost) {
        // FIXME - check err code numbers
        // TODO - Check response for wrong handle
        const json: MsgResponse = { id: message.id, result: null, error: StratumErrors.noab }
        this.#sendJson(json)
        return
      }
      const versionMask = parseInt(message.params[5], 16)
      if (!versionMask || (~parseInt(this.cfg.coin.versionMask, 16) & versionMask) !== 0) {
        const json: MsgResponse = { id: message.id, result: null, error: StratumErrors.errmask }
        this.#sendJson(json)
        this.#considerBan(false)
        return
      }
      share.versionMask = versionMask.toString(16)
    }

    this.emit('submit', share, (_err: StratumErr | null): void => {
      const isValid: boolean = !_err
      if (!this.#considerBan(isValid))
        this.#sendJson({ id: message.id, result: isValid ? true : null, error: _err })
    })
  }

  #setName = (fullName: string): boolean => {
    if (fullName.indexOf('.') === -1) return false
    const [account, name] = fullName.split('.', 2)
    const regEx = /^[0-9A-za-z]+$/
    if (!name || !regEx.test(account) || !regEx.test(name)) return false
    this.#account = account
    this.#name = name
    return true
  }

  // Set new difficulty for next job
  enqueueDifficulty = (nextJobDifficulty: number): boolean => {
    this.log.d(logSystem, `Worker ${this.label} set difficulty for next job: ${nextJobDifficulty}`)
    this.#pendingDifficulty = nextJobDifficulty
    return true
  }

  // IF the given difficulty is valid and new it'll send it to the client. Accept with next job.
  sendNewDifficulty = (difficulty: number): boolean => {
    if (this.difficulty === difficulty) return false
    this.log.d(logSystem, `Worker ${this.label} change difficulty to ${difficulty} from ${this.#previousDifficulty}`)
    this.#previousDifficulty = this.difficulty
    this.difficulty = difficulty
    const json: MsgStratum = { id: null, method: "mining.set_difficulty", params: [difficulty] }
    this.#sendJson(json)
    return true
  }

  sendMiningJob = (job: StratumJob): void => {
    if (!this.#sqlID) return
    // TODO - check auth ?
    const lastActivityAgo = (Date.now() / 1000) | 0 - this.#lastActivity
    if (lastActivityAgo > (this.cfg.timers.connectionTimeout || 600) * 1000) {
      this.log.w(logSystem, `Worker ${this.label} last submitted a share was ${(lastActivityAgo / 1000 | 0)}s ago`)
      this.socket.destroy()
      return
    }

    if (this.#pendingDifficulty) {
      this.log.w(logSystem, `Worker ${this.label} last submitted a share was ${(lastActivityAgo / 1000 | 0)}s ago`)
      const result = this.sendNewDifficulty(this.#pendingDifficulty)
      this.#pendingDifficulty = 0
      if (result) this.emit('difficultyChanged', this.difficulty)
    }

    const json: MsgStratum = { id: null, method: "mining.notify", params: job }
    this.#sendJson(json)
  }

  sendVersionMask = (mask: string): void => {
    const json: MsgStratum = { id: null, method: "mining.set_version_mask", params: [mask] }
    this.#sendJson(json)
  }
}
