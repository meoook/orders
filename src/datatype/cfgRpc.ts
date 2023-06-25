export type ProtocolType = 'http' | 'https'

export default interface CfgRpc {
  host: string
  port: string | number
  user: string
  pass: string
  protocol?: ProtocolType
}
