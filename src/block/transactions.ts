import { RpcBlockTemplate } from '../datatype/rpcBlock'
import * as util from '../util'

/*
This function creates the coinbase transaction that accepts the reward for
successfully mining a new block.
Documentation: https://en.bitcoin.it/wiki/Protocol_specification#tx
 */


const generateOutputTransactions = (poolRecipient: util.AddressScript, rpcData: RpcBlockTemplate) => {
  const txOutputBuffers: Buffer[] = []

  txOutputBuffers.unshift(Buffer.concat([
    util.packInt64LE(rpcData.coinbasevalue),
    util.varIntBuffer(poolRecipient.length),
    poolRecipient
  ]))

  // 6a24aa21a9edb509c05d3f279b2b9e8a496d462471f3385ea45fae2a08304773717fd0788b87
  const witness_commitment = Buffer.from(rpcData.default_witness_commitment, 'hex')
  txOutputBuffers.unshift(Buffer.concat([
    util.packInt64LE(0),
    util.varIntBuffer(witness_commitment.length),
    witness_commitment
  ]))

  return Buffer.concat([util.varIntBuffer(txOutputBuffers.length), Buffer.concat(txOutputBuffers)])
}

const createGeneration = (rpcData: RpcBlockTemplate, publicKey: util.AddressScript, extraNoncePlaceholder: Buffer) => {
  /**
   * Вместо настоящего transaction hash указывается 32 нулевых байта
      Вместо output index указывается 0xFFFFFFFF.
      В поле unlocking script можно указать что угодно размером от 2 до 100 бай
   */
  let txVersion = 1
  let txInputsCount = 1
  let txInPrevOutHash = ""
  // previous transaction index
  let txInPrevOutIndex = Math.pow(2, 32) - 1

  let txInSequence = 0
  let txLockTime = 0

  const scriptSigPart1 = Buffer.concat([
    util.serializeNumber(rpcData.height),
    util.serializeNumber(Date.now() / 1000 | 0),
    Buffer.from([extraNoncePlaceholder.length])
  ])

  const scriptSigPart2 = util.serializeString(`/nodeStratum/`)

  // version, input count, previous transaction hash, previous transaction index and input scriptlen
  const p1 = Buffer.concat([
    util.packUInt32LE(txVersion),
    //transaction input
    util.varIntBuffer(txInputsCount),
    util.uint256BufferFromHash(txInPrevOutHash),
    util.packUInt32LE(txInPrevOutIndex),
    util.varIntBuffer(scriptSigPart1.length + extraNoncePlaceholder.length + scriptSigPart2.length),
    scriptSigPart1
  ])

  /*
  The coinbase transaction must be split at the extranonce (which located in the transaction input
  scriptSig). Miners send us unique extranonces that we use to join the two parts in attempt to create
  a valid share and/or block.
   */
  const outputTransactions = generateOutputTransactions(publicKey, rpcData)

  // The rest of the coinbase transaction is packed in the coinbase2 parameter
  const p2 = Buffer.concat([
    scriptSigPart2,
    util.packUInt32LE(txInSequence),
    //end transaction input

    //transaction output
    outputTransactions,  // output count, value, scriptlen, script

    //end transaction ouput
    util.packUInt32LE(txLockTime)
  ])
  return [p1, p2]
}

export default createGeneration
