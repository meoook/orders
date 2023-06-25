import events from 'events'
import crypto from 'crypto'
import Decimal from 'decimal.js'
import * as util from '../util'

import { RpcBlockTemplate } from '../datatype/rpcBlock'
import JobTemplate from './jobTemplate'
import { WorkerShare, PoolShare, WorkerInfo } from '../datatype/share'
import { StratumErr, StratumErrors } from '../stratum/stratumErrors'


//Unique extranonce per subscriber
class ExtraNonceCounter {
  size: number = 4 //bytes
  #counter: number = crypto.randomBytes(this.size).readUInt32LE(0)
  next = (): string => {
    const extraNonce = util.packUInt32BE(Math.abs(this.#counter++))
    return extraNonce.toString('hex')
  }
}

//Unique job per new block template
class JobCounter {
  #counter = 0
  #cur = (): string => this.#counter.toString(16)
  next = (): string => {
    this.#counter++
    if (this.#counter % 0xffff === 0) this.#counter = 1
    return this.#cur()
  }
}

interface ValidJobs {
  [index: string]: JobTemplate
}

/**
 * Emits:
 * - newJob(blockTemplate) - When a new block (previously unknown to the JobManager) is added
 * - reJob(blockTemplate) - When a new block need to refresh job for workers by timeout
 * - share(shareData, blockHex) - When a worker submits a share. It will have blockHex if a block was found
**/
export default class JobManager extends events.EventEmitter {
  readonly #jobCounter: JobCounter
  readonly #extraNoncePlaceholder: Buffer = Buffer.from('f000000ff111111f', 'hex')
  readonly #extraNonce1Counter: ExtraNonceCounter
  readonly extraNonce2Size: number
  job!: JobTemplate
  #validJobs: ValidJobs = {}

  constructor(private readonly poolAddrScript: util.AddressScript, private readonly vMask: string) {
    super()
    this.#jobCounter = new JobCounter()
    this.#extraNonce1Counter = new ExtraNonceCounter() // Needs to be unique(pseudo - random) per stratum connection
    this.extraNonce2Size = this.#extraNoncePlaceholder.length - this.#extraNonce1Counter.size
  }

  get nextNonce(): string {
    return this.#extraNonce1Counter.next()
  }

  #blockHasher = (d: Buffer): Buffer => util.reverseBuffer(util.dhash(d))

  #isNewTemplate = (height: number, previousblockhash: string): boolean => {
    if (!this.job) return true // new if no jobs before
    if (this.job.block.previousblockhash !== previousblockhash && this.job.block.height < height) return true
    return false
  }

  createJobFromTemplate = (rpcData: RpcBlockTemplate, updateEvenOld: boolean): boolean => {
    const isNewTemplate = this.#isNewTemplate(rpcData.height, rpcData.previousblockhash)
    if (!isNewTemplate && !updateEvenOld) return false

    this.job = new JobTemplate(this.#jobCounter.next(), rpcData, this.poolAddrScript, this.#extraNoncePlaceholder)
    const jobParams = this.job.params

    if (!isNewTemplate) {
      jobParams[8] = false  // clean_jobs
      this.emit('reJob', jobParams)
    } else {
      this.#validJobs = {}
      this.emit('newJob', jobParams)
    }
    this.#validJobs[this.job.jobId] = this.job
    return true
  }

  #shareError = (worker: WorkerInfo, err: StratumErr): StratumErr => {
    const blankShare: PoolShare = { workerID: worker.id, valid: false, blockHash: '', blockHex: '', jobDiff: 0 }
    this.emit('share', worker, blankShare)
    return err
  }


  // On submit - prepare share to save and check diff for submit (add blockHex, blockHash to result)
  processShare = (share: WorkerShare, worker: WorkerInfo): StratumErr | null => {
    /**
     *  header = ( 
          struct.pack("<L", ver) +
          prev_block.decode('hex')[::-1] +
          merkle_root.decode('hex')[::-1] +
          struct.pack("<LLL", timestamp, bits, nonce)
        )
        hash = dsha256(header)
        sys.stdout.write("\rNonce: {}, hash: {}".format(nonce, hash[::-1].encode('hex')))
     */

    if (!(share.jobID in this.#validJobs)) return this.#shareError(worker, StratumErrors.nojob)
    if (share.extraNonce2.length !== 8) return this.#shareError(worker, StratumErrors.nonce2size)
    if (share.nTime.length !== 8) return this.#shareError(worker, StratumErrors.timesize)
    if (share.nonce.length !== 8) return this.#shareError(worker, StratumErrors.noncesize)

    const submitTime = Date.now() / 1000 | 0
    const nTimeInt = parseInt(share.nTime, 16)
    const job = this.#validJobs[share.jobID]

    /**
     * Во-первых, он должен быть больше, чем среднее арифметическое timestamp-ов предыдущих 11 блоков. Это делается для того, чтобы не получилось так, что блок #123 вышел 12 марта 2011 года, а #124 — 13 февраля 1984. Но в тоже время допускается некоторая погрешность.

      Во-вторых, timestamp должен быть меньше чем network adjusted time. То есть нода, при получении нового блока, интересуется текущим временем у своих "соседей" по сети, считает среднее арифметическое и если block timestamp меньше получившегося значения + 2 часа, то все в порядке.
     */
    if (nTimeInt < job.block.curtime || nTimeInt > submitTime + 7200)
      return this.#shareError(worker, StratumErrors.timerange)
    if (!job.registerSubmit(worker.extraNonce1, share.extraNonce2, share.nTime, share.nonce))
      return this.#shareError(worker, StratumErrors.double)

    const extraNonce1Buffer = Buffer.from(worker.extraNonce1, 'hex')
    const extraNonce2Buffer = Buffer.from(share.extraNonce2, 'hex')
    // if (extraNonce2Buffer.toString('hex').length !== 8) return shareError(20, 'incorrect size of e-nonce')

    const coinbaseBuffer: Buffer = job.serializeCoinbase(extraNonce1Buffer, extraNonce2Buffer)
    const coinbaseHash: Buffer = util.dhash(coinbaseBuffer)
    const merkleRoot: string = util.reverseBuffer(job.merkleTree.withFirst(coinbaseHash)).toString('hex')

    const headerBuffer: Buffer = job.serializeHeader(merkleRoot, nTimeInt, parseInt(share.nonce, 16), parseInt(this.vMask, 16))
    const headerHash: Buffer = util.dhash(headerBuffer)

    // const headerBigNum = bignum.fromBuffer(headerHash, { endian: 'little', size: 32 })
    const headerDecimal: Decimal = new Decimal(`0x${headerHash.toString('hex')}`)
    // FIXME - move to CONSTs
    const maxTarget: Decimal = new Decimal('0x00000000ffff0000000000000000000000000000000000000000000000000000')
    const shareDiff = maxTarget.dividedBy(headerDecimal).toNumber()
    // TODO: set share (in)valid

    const poolShare: PoolShare = { workerID: worker.id, valid: false, jobDiff: worker.difficulty }
    console.log(`Header: ${headerHash.toString('hex')} |  ${headerHash.toString()}`) // FIXME REMOVE
    console.log(`Header: ${headerDecimal.toNumber().toString(16)}`) // FIXME REMOVE
    console.log(`Target: ${job.target.toNumber().toString(16)}`) // FIXME REMOVE
    console.log(`OUTCOME SHARE diff: ${shareDiff.toString(16)} | ${shareDiff}`) // FIXME REMOVE
    console.log(`OUTCOME WORKE diff: ${worker.difficulty.toString(16)} | ${worker.difficulty}`) // FIXME REMOVE
    console.dir(worker) // FIXME REMOVE

    // Check if share is a block candidate (matched network difficulty)
    if (job.target.gte(headerDecimal)) {
      poolShare.blockHex = job.serializeBlock(headerBuffer, coinbaseBuffer).toString('hex')
      poolShare.blockHash = this.#blockHasher(headerBuffer /*nTime*/).toString('hex')
    } else {
      // Check if share didn't reached the miner's difficulty
      if (shareDiff / worker.difficulty < 0.99) {
        // Check if share matched a previous difficulty from before a vardiff retarget
        if (worker.difficultyPrev && shareDiff >= worker.difficultyPrev) poolShare.jobDiff = worker.difficultyPrev
        else return this.#shareError(worker, StratumErrors.lowdiff)
      }
    }

    console.dir(poolShare) // FIXME REMOVE
    this.emit('share', poolShare)
    return null
  }
}
