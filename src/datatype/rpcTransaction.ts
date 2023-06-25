export default interface RpcTransaction {
  txid: string // hex - len 64
  hash: string // hex - len 64
  data: string
  depends: []  // Array?
  fee: number
  sigops: number
  weight: number
}
