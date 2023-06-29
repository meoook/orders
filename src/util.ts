import crypto from 'crypto'

// Base58 implementation
// import basex from 'base-x'
// const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
// const base58 = basex(ALPHABET)

const sha256 = (buf: Buffer): Buffer => crypto.createHash('sha256').update(buf).digest()
export const dhash = (buffer: Buffer): Buffer => sha256(sha256(buffer))
