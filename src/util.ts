import crypto from 'crypto'

// Base58 implementation
import basex from 'base-x'
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const base58 = basex(ALPHABET)

const sha256 = (buf: Buffer): Buffer => crypto.createHash('sha256').update(buf).digest()
export const dhash = (buffer: Buffer): Buffer => sha256(sha256(buffer))


// Bitcoin Address = Base58Encode(Key hash concatenated with Checksum)
// format wallet address for use in coinbase transaction's output
export type AddressScript = Buffer
export const addressToScript = (addr: string): AddressScript => {
  /* Py variant
  def script_to_address(addr):
    ver, pubkeyhash = address_to_pubkeyhash(addr)
    return b'\x76\xa9\x14' + pubkeyhash + b'\x88\xac'

 def address_to_pubkeyhash(addr):
    addr = b58decode(addr, 25)
    ver = addr[0]
    cksumA = addr[-4:]
    cksumB = doublesha(addr[:-4])[:4]

    if cksumA != cksumB:
        return None
    return (ver, addr[1:-4])
  */
  const decoded: Buffer = base58.decode(addr)
  if (!decoded) {
    console.error(`base58 decode failed for ${addr}`)
    throw new Error()
  }
  if (decoded.length != 25) {
    console.error(`invalid address length for ${addr}`)
    throw new Error()
  }
  const pubkey: Buffer = decoded.slice(1, -4)
  return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), pubkey, Buffer.from([0x88, 0xac])])
}

export const hashRateString = (hashrate: number | string = 0): string => {
  let i = -1
  let hs = Number(hashrate)
  const byteUnits = ['KH', 'MH', 'GH', 'TH', 'PH', 'EH', 'ZH', 'YH']
  do {
    hs = hs / 1024
    i++
  } while (hs > 1024)
  return `${hs.toFixed(2)} ${byteUnits[i]}`
}

export const reverseBuffer = (buff: Buffer): Buffer => {
  let result = Buffer.alloc(buff.length)
  for (let i = 0, j = buff.length - 1; i <= j; ++i, --j)
    [result[i], result[j]] = [buff[j], buff[i]]
  return result
}

export const reverseByteOrder = (buff: Buffer): Buffer => {
  for (let i = 0; i < 8; i++) buff.writeUInt32LE(buff.readUInt32BE(i * 4), i * 4)
  return reverseBuffer(buff)
}

export const uint256BufferFromHash = (hex: string): Buffer => {
  const fromHex = (Number(hex) !== 0) ? Buffer.from(hex, 'hex') : Buffer.alloc(32)
  return reverseBuffer(fromHex)
}

export const packUInt16LE = (num: number): Buffer => {
  var buff = Buffer.alloc(2)
  buff.writeUInt16LE(num, 0)
  return buff
}
export const packInt32LE = (num: number): Buffer => {
  var buff = Buffer.alloc(4)
  buff.writeInt32LE(num, 0)
  return buff
}
export const packInt32BE = (num: number): Buffer => {
  var buff = Buffer.alloc(4)
  buff.writeInt32BE(num, 0)
  return buff
}
export const packUInt32LE = (num: number): Buffer => {
  var buff = Buffer.alloc(4)
  buff.writeUInt32LE(num, 0)
  return buff
}
export const packUInt32BE = (num: number): Buffer => {
  var buff = Buffer.alloc(4)
  buff.writeUInt32BE(num, 0)
  return buff
}
export const packInt64LE = (num: number): Buffer => {
  var buff = Buffer.alloc(8)
  buff.writeUInt32LE(num % Math.pow(2, 32), 0)
  buff.writeUInt32LE(Math.floor(num / Math.pow(2, 32)), 4)
  return buff
}

/*
Defined in bitcoin protocol here:
 https://en.bitcoin.it/wiki/Protocol_specification#Variable_length_integer
 */
export const varIntBuffer = (n: number): Buffer => {
  if (n < 0xfd)
    return Buffer.from([n])
  else if (n <= 0xffff) {
    var buff = Buffer.alloc(3)
    buff[0] = 0xfd
    buff.writeUInt16LE(n, 1)
    return buff
  }
  else if (n <= 0xffffffff) {
    var buff = Buffer.alloc(5)
    buff[0] = 0xfe
    buff.writeUInt32LE(n, 1)
    return buff
  }
  else {
    var buff = Buffer.alloc(9)
    buff[0] = 0xff
    packUInt16LE(n).copy(buff, 1)
    return buff
  }
}

/*
"serialized CScript" formatting as defined here:
 https://github.com/bitcoin/bips/blob/master/bip-0034.mediawiki#specification
Used to format height and date when putting into script signature:
 https://en.bitcoin.it/wiki/Script
 */
export const serializeNumber = (n: number): Buffer => {
  //Version from TheSeven
  if (n >= 1 && n <= 16) return Buffer.from([0x50 + n])
  var l = 1
  var buff = Buffer.alloc(9)
  while (n > 0x7f) {
    buff.writeUInt8(n & 0xff, l++)
    n >>= 8
  }
  buff.writeUInt8(l, 0)
  buff.writeUInt8(n, l++)
  return buff.slice(0, l)

}

/*
Used for serializing strings used in script signature
 */
export const serializeString = (s: string): Buffer => {
  if (s.length < 253)
    return Buffer.concat([
      Buffer.from([s.length]),
      Buffer.from(s)
    ])
  else if (s.length < 0x10000)
    return Buffer.concat([
      Buffer.from([253]),
      packUInt16LE(s.length),
      Buffer.from(s)
    ])
  else if (s.length < 0x100000000)
    return Buffer.concat([
      Buffer.from([254]),
      packUInt32LE(s.length),
      Buffer.from(s)
    ])
  else
    return Buffer.concat([
      Buffer.from([255]),
      packUInt16LE(s.length),
      Buffer.from(s)
    ])
}
