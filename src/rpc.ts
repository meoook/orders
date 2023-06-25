import http from 'http'
import { Http2ServerResponse } from 'http2'
import https from 'https'
import CfgRpc from './datatype/cfgRpc'

export default class RpcClient {
  readonly #protocol: any
  readonly #auth: string
  readonly #cfg: CfgRpc
  readonly info: string

  constructor(config: CfgRpc | string) {
    if (typeof config === 'string') {
      const url = new URL(config)
      this.#cfg = {
        host: url.hostname,
        port: parseInt(url.port, 10),
        user: url.username,
        pass: url.password
      }
      this.#protocol = url.protocol === 'https:' ? https : http
    } else {
      this.#cfg = config
      this.#protocol = config.protocol === 'https' ? https : http
    }
    this.#auth = Buffer.from(`${this.#cfg.user}:${this.#cfg.pass}`,).toString('base64')
    this.info = `${this.#protocol.globalAgent.protocol}//${this.#cfg.host}:${this.#cfg.port}`
  }

  doRequest = (method: string, params: Array<string> = []): Promise<any> => new Promise((resolve, reject) => {
    const strRequest = JSON.stringify({
      id: (Math.random() * 100000).toFixed(),
      method: method.toLowerCase(),
      params: params
    })
    const options = { method: 'POST', host: this.#cfg.host, port: this.#cfg.port, rejectUnauthorized: false }

    const request = this.#protocol.request(options, (res: Http2ServerResponse) => {
      let buf: string = ''
      res.on('data', (chunk: Buffer | string) => buf += chunk)
      res.on('end', () => {
        if (res.statusCode === 401) reject('Connection rejected 401 unnauthorized')
        else if (res.statusCode === 403) reject('Connection rejected 403 forbidden')
        else if (res.statusCode === 500 && buf.toString() === 'Work queue depth exceeded') reject('Too many requests')
        else {
          try {
            const parsedBuf = JSON.parse(buf)
            if (parsedBuf.error) reject(`${parsedBuf.error.message}`)
            else resolve(parsedBuf.result)
          } catch (e: any) {
            reject(`Error parsing JSON - ${e.message}`)
          }
        }
      })
    })

    const timeout: number = 5  // FIXME - make normal timeout
    request.setTimeout(timeout * 1000, () => {
      request.abort()
    })
    request.on('error', (err: any) => reject(err))
    request.setHeader('Content-Length', strRequest.length)
    request.setHeader('Content-Type', 'application/json')
    request.setHeader('Authorization', `Basic ${this.#auth}`)
    request.write(strRequest)
    request.end()
  })
}

