import Decimal from 'decimal.js'
import { RpcBlockTemplate } from '../datatype/rpcBlock'
import RpcTransaction from '../datatype/rpcTransaction'
import StratumJob from '../datatype/stratumJob'
import * as util from '../util'
import MerkleTree from './merkleTree'
import createGeneration from './transactions'


// FIXME - move to CONSTs
const diff1: Decimal = new Decimal('0x00000000ffff0000000000000000000000000000000000000000000000000000')

export default class JobTemplate {
  readonly #submits: string[] = []
  readonly merkleTree: MerkleTree
  readonly #merkleBranch: string[]
  readonly #transactionData: Buffer
  #coinBase: Buffer[]
  target: Decimal
  difficulty: Decimal
  readonly #prevHashReversed: string

  constructor(
    readonly jobId: string,
    readonly block: RpcBlockTemplate,
    poolAddressScript: util.AddressScript,
    extraNoncePlaceholder: Buffer
  ) {
    // rpcData -> Block data  (height)
    this.target = new Decimal(`0x${block.target}`)  // to check is share valid
    this.difficulty = diff1.dividedBy(this.target)  // to check is share valid
    this.#prevHashReversed = util.reverseByteOrder(Buffer.from(block.previousblockhash, 'hex')).toString('hex')
    this.#transactionData = Buffer.concat(block.transactions.map(tx => Buffer.from(tx.data, 'hex')))

    const txBuff = this.#getTxsHashBuffers(block.transactions)
    this.merkleTree = new MerkleTree(txBuff)
    this.#merkleBranch = this.#getMerkleHashes(this.merkleTree.steps)

    this.#coinBase = createGeneration(block, poolAddressScript, extraNoncePlaceholder)
  }

  // FIXME - txid ?
  #getTxsHashBuffers = (txs: RpcTransaction[]): Buffer[] => txs.map(tx => util.uint256BufferFromHash(tx.txid))

  #getMerkleHashes = (steps: Buffer[]): string[] => steps.map(step => step.toString('hex'))

  serializeCoinbase = (extraNonce1: Buffer, extraNonce2: Buffer) => Buffer.concat(
    [this.#coinBase[0], extraNonce1, extraNonce2, this.#coinBase[1]]
  )

  //https://en.bitcoin.it/wiki/Protocol_specification#Block_Headers
  serializeHeader = (merkleRoot: string, nTime: number, nonce: number, versionMask?: number): Buffer => {
    // The server computes nVersion for the submit as follows:
    //   nVersion = (job_version & ~last_mask) | (version_bits & last_mask)
    //   version_bits & ~last_mask ==  0
    //  where job_version is the block version sent to miner as part of job with id job_id
    let header = Buffer.alloc(80)
    let position = 0


    if (versionMask) {
      header.writeUInt32LE(this.block.version | versionMask, position)
    } else {
      header.writeUInt32LE(this.block.version, position)
    }

    // header.writeInt32LE(this.block.version, position) // int32_t Block version information
    header.write(this.block.previousblockhash, position += 4, 32, 'hex')  // char[32] hash value of the previous block
    header.write(merkleRoot, position += 32, 32, 'hex')  // char[32] hash of all transactions related to this block
    header.writeUInt32LE(nTime, position += 32)  // uint32_t timestamp recording when this block was created
    header.write(this.block.bits, position += 4, 4, 'hex')  // uint32_t difficulty for this block
    header.writeUInt32LE(nonce, position += 4)  // uint32_t nonce used to generate this block
    return util.reverseBuffer(header)
    // return header
  }

  //https://en.bitcoin.it/wiki/Protocol_specification#Block_Headers
  // serializeHeader2 = function (merkleRoot, nTime, nonce, versionMask) {

  //   var header = Buffer.alloc(80)
  //   var position = 0
  //   header.write(nonce, position, 4, 'hex')
  //   header.write(rpcData.bits, position += 4, 4, 'hex')
  //   header.write(nTime, position += 4, 4, 'hex')
  //   header.write(merkleRoot, position += 4, 32, 'hex')
  //   header.write(rpcData.previousblockhash, position += 32, 32, 'hex')
  //   if (versionMask) {
  //     header.writeUInt32BE(rpcData.version | versionMask, position + 32)
  //   } else {
  //     header.writeUInt32BE(rpcData.version, position + 32)
  //   }

  //   var header = util.reverseBuffer(header)
  //   return header
  // };

  serializeBlock = (header: Buffer, coinbase: Buffer) => {
    return Buffer.concat([
      header,
      util.varIntBuffer(this.block.transactions.length + 1),
      coinbase,
      this.#transactionData,
      Buffer.from([])
    ])
  }

  registerSubmit = (extraNonce1: string, extraNonce2: string, nTime: string, nonce: string): boolean => {
    // TODO - version mask parameter
    const submission = extraNonce1 + extraNonce2 + nTime + nonce
    if (this.#submits.indexOf(submission) === -1) {
      this.#submits.push(submission)
      return true
    }
    return false  // already submited
  }

  get params(): StratumJob {
    return [
      this.jobId,
      this.#prevHashReversed,
      this.#coinBase[0].toString('hex'),  // The miner inserts ExtraNonce1 and ExtraNonce2 after this section of the transaction data
      this.#coinBase[1].toString('hex'),  // The miner appends this after the first part of the transaction data and the two ExtraNonce values.
      this.#merkleBranch, // array hashes
      util.packInt32BE(this.block.version).toString('hex'), // version
      this.block.bits,  // nbits
      util.packUInt32BE(this.block.curtime).toString('hex'),  // ntime
      true  // clean_jobs
    ]
  }

}
