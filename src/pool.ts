import Logger from './logger'
import SrvInitializer from './poolStart'
import VariableDifficulty from './varDiff'
import JobManager from './block/jobManager'
import StratumServer from './stratum/stratum.js'
import StratumClient from './stratum/client'
import StratumJob from './datatype/stratumJob'
import { RpcBlock, RpcBlockTemplate } from './datatype/rpcBlock'
import { WorkerShare, PoolShare } from './datatype/share'
import { IConfig } from './datatype/config'
import { StratumErr } from './stratum/stratumErrors'

const logSystem = 'pool'


export default class Pool extends SrvInitializer {
  #jobManager!: JobManager
  lastSubmitBlockHex: string = ''
  #stratumServer!: StratumServer
  variableDifficulty!: VariableDifficulty

  constructor(cfg: IConfig, log: Logger) {
    super(cfg, log)
    this.#start()
  }

  #start = async (): Promise<void> => {
    this.log.i(logSystem, 'Pool initializing...')
    if (await this.initChain()) await this.#checkAndRun()
    else this.log.e(logSystem, 'Chain connection problems. Pool cannot start!')
  }

  // Run pool when daemon finish syncing blockchain
  #checkAndRun = async (): Promise<void> => {
    const synced = await this.rpc.getBlockTemplate()
    if (synced) {
      this.#setupJobManager()
      this.#setupJobRefresh()
      this.log.i(logSystem, 'Generate first job...')
      await this.#refreshJob()
      this.#setupStratumServer()
      this.logInfo()
    } else {
      setTimeout(this.#checkAndRun, 5000)
      this.log.w(logSystem, 'Daemon is syncing with network...')
      await this.logDaemonProgress()
    }
  }

  #setupJobManager = (): void => {
    this.log.i(logSystem, 'Starting job manager...')
    this.#jobManager = new JobManager(this.addressScript)
    this.#jobManager
      .on('newJob', (job) => {
        if (!this.#stratumServer) return
        this.log.i(logSystem, `New job(id:${job[0]}) send to stratum with bits: ${job[6]}`)
        this.#stratumServer.broadcastJob(job)
      })
      .on('reJob', (job: StratumJob): void => {
        if (!this.#stratumServer) return
        this.log.i(logSystem, `Re job(id:${job[0]}) send to stratum with bits: ${job[6]}`)
        this.#stratumServer.broadcastJob(job)
      })
      .on('share', async (share: PoolShare) => {
        let isValidBlockToSubmit = Boolean(share.blockHex)

        if (!isValidBlockToSubmit) await this.dataControl.share(share)
        else if (this.lastSubmitBlockHex === share.blockHex)
          this.log.w(logSystem, `Ignored duplicate share with hash: ${share.blockHex}`)
        else if (share.blockHex && await this.#blockSubmit(share.blockHex)) {
          if (!share.blockHash) this.log.w(logSystem, `Block hash not found for submited block`)
          else {
            const rpcBlock: RpcBlock | null = await this.#blockCheckAccepted(share.blockHash)
            isValidBlockToSubmit = Boolean(rpcBlock)
            if (rpcBlock) await this.dataControl.blockCreate(share.workerID, rpcBlock) // FIXME - no need await
          }
          if (isValidBlockToSubmit) this.log.i(logSystem, `Block found with hex: ${share.blockHex}`)
          await this.dataControl.share(share)
          await this.#refreshJob()
        }
        // FIXME - else ? (emit.share?)
      })
  }

  #setupJobRefresh = (): void => {
    if (!this.cfg.timers.blockRefresh || this.cfg.timers.blockRefresh <= 0) {
      this.cfg.timers.blockRefresh = 10
      this.log.w(logSystem, `Config 'blockRefresh' value error, using default: ${this.cfg.timers.blockRefresh}s`)
    }
    setInterval(async () => {
      this.log.d(logSystem, `Refresh job on timeout ${this.cfg.timers.blockRefresh}s`)
      await this.#refreshJob()
    }, this.cfg.timers.blockRefresh * 1000)
    this.log.i(logSystem, `Set job refresh every ${this.cfg.timers.blockRefresh}s`)
  }

  #setupStratumServer = (): void => {
    this.#stratumServer = new StratumServer(this.cfg, this.dataControl.auth, this.log)

    this.#stratumServer.on('started', () => {
      this.log.i(logSystem, `Stratum server started and broadcast first job`)
      this.#stratumServer.broadcastJob(this.#jobManager.job.params)
    })
    this.#stratumServer.on('broadcastTimeout', async () => {
      // TODO - move to pool
      this.log.i(logSystem, `Rebroadcast job on stratum timeout: ${this.cfg.timers.jobRebroadcast}s`)
      await this.#refreshJob(true)
    })
    this.#stratumServer.on('client.connected', (client: StratumClient) => {
      this.log.i(logSystem, `Client connected ${client.info.ip}`)

      client.on('subscription', (resultCallback: Function) => {
        this.log.i(logSystem, `Client subscribed ${client.label}`)
        if (this.variableDifficulty) this.variableDifficulty.manageClient(client)

        const extraNonce1 = this.#jobManager.nextNonce
        const extraNonce2Size = this.#jobManager.extraNonce2Size
        // First send to worker extraNonce1 and size
        resultCallback(extraNonce1, extraNonce2Size)
        // Finaly send job
        client.sendMiningJob(this.#jobManager.job.params)
      })

      // Startum submit
      client.on('submit', (shareData: WorkerShare, resultCallback: Function): void => {
        this.log.i(logSystem, `Client ${client.label} submit share`)
        const err: StratumErr | null = this.#jobManager.processShare(shareData, client.info)
        resultCallback(err)
      })

      // Startum difficulty change from client
      client.on('difficultyChanged', async (diff: number): Promise<void> => {
        this.log.i(logSystem, `Client ${client.label} difficulty change to ${diff}`)
        // await this.dataControl.diffUpdate(client.info, diff)  // FIXME - check
      })

      // FIXME - time limited ban(no need to add in DB - mb redis or remove trigger)
      client.on('banAdd', async (reason: string): Promise<void> => {
        this.log.w(logSystem, `Banned triggered for ${client.label} with reason - ${reason}`)
        await this.dataControl.banAdd(client.info.ip, reason)
      })
    })
    this.#stratumServer.on('client.disconnected', (client: StratumClient) => {
      // TODO - control online/offline client status
      this.log.i(logSystem, `Client disconnected ${client.label}`)
    })

  }

  #refreshJob = async (updateEvenOldBlock: boolean = false): Promise<void> => {
    // Refresh job with block template
    const block = await this.rpc.getBlockTemplate() as RpcBlockTemplate
    if (block) {
      const addMsg = updateEvenOldBlock ? ' (even block is not new)' : ''
      this.log.d(logSystem, `Try to refresh job from template with height: ${block.height}${addMsg}`)
      const created = this.#jobManager.createJobFromTemplate(block, updateEvenOldBlock)
      if (!created) this.log.d(logSystem, `No need to refresh job from template with height: ${block.height}`)
    } else
      this.log.e(logSystem, 'Getting block template failed from daemon')
  }

  #blockSubmit = async (blockHex: string): Promise<boolean> => {
    const result = await this.rpc.submitBlock(blockHex)
    if (!result) this.log.e(logSystem, `Rpc error when submitting block`)
    else if (result.response === 'rejected') this.log.e(logSystem, `Daemon rejected a supposedly valid block`)
    else {
      this.lastSubmitBlockHex = blockHex  // TODO - mb set on fn call?
      this.log.i(logSystem, `Block submitted successfully`)
      return true
    }
    return false
  }

  /** Check block confirmations and return block if confirmed */
  #blockCheckAccepted = async (blockHash: string): Promise<RpcBlock | null> => {
    // https://developer.bitcoin.org/reference/rpc/getblock.html
    const data = await this.rpc.getBlock(blockHash)
    if (data && data.hash === blockHash && data.confirmations >= 0) return data as RpcBlock
    return null
  }
}
