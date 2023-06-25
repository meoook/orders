import RpcTransaction from './rpcTransaction'

export type TimeStamp = number

export interface RpcBlockTemplate {
  capabilities: Array<string>
  version: number
  rules: Array<string>
  vbrequired: number
  previousblockhash: string // hex - len 64,
  coinbaseaux: object
  coinbasevalue: number
  longpollid: string // hex - len 72 
  target: string // hex - len 64
  mintime: number
  mutable: Array<string>
  noncerange: string // hex - 00000000ffffffff
  sigoplimit: number
  sizelimit: number
  weightlimit: number
  curtime: TimeStamp
  bits: string  // hex
  height: number
  default_witness_commitment: string  // hex - len 76
  transactions: Array<RpcTransaction>
}

export interface RpcBlock {
  height: number
  hash: string
  revard: number
}

/**
 * {                                 (json object)
  "hash" : "hex",                 (string) the block hash (same as provided)
  "confirmations" : n,            (numeric) The number of confirmations, or -1 if the block is not on the main chain
  "size" : n,                     (numeric) The block size
  "strippedsize" : n,             (numeric) The block size excluding witness data
  "weight" : n,                   (numeric) The block weight as defined in BIP 141
  "height" : n,                   (numeric) The block height or index
  "version" : n,                  (numeric) The block version
  "versionHex" : "hex",           (string) The block version formatted in hexadecimal
  "merkleroot" : "hex",           (string) The merkle root
  "tx" : [                        (json array) The transaction ids
    "hex",                        (string) The transaction id
    ...
  ],
  "time" : xxx,                   (numeric) The block time expressed in UNIX epoch time
  "mediantime" : xxx,             (numeric) The median block time expressed in UNIX epoch time
  "nonce" : n,                    (numeric) The nonce
  "bits" : "hex",                 (string) The bits
  "difficulty" : n,               (numeric) The difficulty
  "chainwork" : "hex",            (string) Expected number of hashes required to produce the chain up to this block (in hex)
  "nTx" : n,                      (numeric) The number of transactions in the block
  "previousblockhash" : "hex",    (string) The hash of the previous block
  "nextblockhash" : "hex"         (string) The hash of the next block
}
*/
