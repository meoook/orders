import * as crypto from 'crypto'
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import Logger from '../logger'

const logSystem = 'binance:base'

export enum ApiErrorCode {
  UNKNOWN = 0,
  INVALID_MESSAGE = -1013, // Invalid message
  INVALID_TIMESTAMP = -1021, // Timestamp for this request is outside recvWindow - 1000ms ahead of the server time
  BAD_PRECISION = -1111, // Precision is over the maximum defined for this asset
  NEW_ORDER_REJECTED = -2010, // New order rejected
  MARGIN_NOT_SUFFICIENT = -2019, // Margin is insufficient
  HAS_PENDING_TRANSACTION = -3007, // You have pending transaction, please try again later
  SYSTEM_BUSY = -3044, // System busy
  SYSTEM = -3045, // The system doesn't have enough asset now
  BORROWABLE_LIMIT = -11007, // Exceeding the maximum borrowable limit
}

class BnApiException extends Error {
  public code: ApiErrorCode = 0
  public message: string = ''

  constructor(response: AxiosResponse<Record<string, any>>) {
    super()

    try {
      this.code = ApiErrorCode[response.data.code as keyof typeof ApiErrorCode]
      this.message = response.data.message
    } catch (err) {
      this.message = response.data ? JSON.stringify(response.data) : `Unhandled error ${err}`
    }
  }

  public toString = (): string => `API Error code: ${this.code} ${this.message}`
}

class BnBaseApi {
  #URL_API: string = 'https://api.binance.com'

  #PRIVATE_API_VERSION: string = 'v3'
  #PUBLIC_API_VERSION: string = 'v1'
  #MARGIN_API_VERSION: string = 'v1'

  #TIMEOUT: number = 20
  #timestampOffset: number = 0
  #debug: boolean

  #session: AxiosInstance

  constructor(private readonly log: Logger, debug: boolean = false) {
    this.#timestampOffset = 0
    this.#debug = debug
    // Initialize session
    if (this.#debug) this.log.d(logSystem, `Base API module initializing with debug=${debug}`)
    this.#session = axios.create({ timeout: this.#TIMEOUT * 1000 })
    this.#compareTime()
  }

  #getHeaders = (apiKey: string | null = null): Record<string, string> => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey) headers['X-MBX-APIKEY'] = apiKey
    return headers
  }

  #generateSignature = (apiSecret: string, data: Record<string, any>): string => {
    if (!apiSecret) throw new Error('API Secret required for private endpoints')
    const query_string = Object.entries(data)
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    const hmac = crypto.createHmac('sha256', apiSecret)
    return hmac.update(query_string).digest('hex')
  }

  #getRequestParams = (apiSecret: string | null, params: Record<string, any> | null = null): Record<string, any> => {
    const result: Record<string, any> = params ? { ...params } : {}
    if (apiSecret) {
      result['timestamp'] = Math.floor(Date.now() + this.#timestampOffset)
      result['signature'] = this.#generateSignature(apiSecret, result)
    }
    return result
  }

  #request = async (
    method: string,
    url: string,
    apiKey: string | null,
    apiSecret: string | null,
    params: Record<string, any> | null = null
  ): Promise<Record<string, any> | any[]> => {
    const requestParams: Record<string, any> = this.#getRequestParams(apiSecret, params)

    if (this.#debug) this.log.i(logSystem, `API request ${method} ${url} ${JSON.stringify(requestParams)}`)

    try {
      const response: AxiosResponse = await this.#session.request({
        method,
        url,
        headers: this.#getHeaders(apiKey),
        params: requestParams,
      })
      return this.#handleResponse(response)
    } catch (err) {
      if (err instanceof BnApiException && err.code === ApiErrorCode.INVALID_TIMESTAMP) {
        this.log.w(logSystem, 'API Timestamp for this request is outside of the recvWindow - compare again and retry')
        this.#compareTime()
        return this.#request(method, url, apiKey, apiSecret, params)
      }
      throw err
    }
  }

  #handleResponse = (response: AxiosResponse): Record<string, any> | any[] => {
    if (Math.floor(response.status / 100) !== 2) throw new BnApiException(response)
    return response.data
  }

  #requestApi = async (
    method: string,
    path: string,
    apiKey: string | null,
    apiSecret: string | null,
    version: string | null = null,
    params: Record<string, any> | null = null
  ): Promise<Record<string, any> | any[]> => {
    const _version = apiKey ? this.#PRIVATE_API_VERSION : version || this.#PUBLIC_API_VERSION
    const response = await this.#request(method, `${this.#URL_API}/api/${_version}/${path}`, apiKey, apiSecret, params)
    return response as Promise<Record<string, any> | any[]>
  }

  requestApiMargin = async (
    method: string,
    path: string,
    apiKey: string | null,
    apiSecret: string | null,
    params: Record<string, any> | null = null
  ): Promise<Record<string, any> | any[]> => {
    const url = `${this.#URL_API}/sapi/${this.#MARGIN_API_VERSION}/${path}`
    const response = await this.#request(method, url, apiKey, apiSecret, params)
    return response as Promise<Record<string, any> | any[]>
  }

  get = async (
    path: string,
    apiKey: string | null,
    apiSecret: string | null,
    version: string | null = null,
    params: Record<string, any> | null = null
  ): Promise<Record<string, any> | any[]> => {
    const response = await this.#requestApi('GET', path, apiKey, apiSecret, version, params)
    return response as Promise<Record<string, any> | any[]>
  }

  post = async (
    path: string,
    apiKey: string | null,
    apiSecret: string | null,
    version: string | null = null,
    params: Record<string, any> | null = null
  ): Promise<Record<string, any> | any[]> => {
    const response = await this.#requestApi('POST', path, apiKey, apiSecret, version, params)
    return response as Promise<Record<string, any> | any[]>
  }

  put = async (
    path: string,
    apiKey: string | null,
    apiSecret: string | null,
    version: string | null = null,
    params: Record<string, any> | null = null
  ): Promise<Record<string, any> | any[]> => {
    const response = await this.#requestApi('PUT', path, apiKey, apiSecret, version, params)
    return response as Promise<Record<string, any> | any[]>
  }

  delete = async (
    path: string,
    apiKey: string | null,
    apiSecret: string | null,
    version: string | null = null,
    params: Record<string, any> | null = null
  ): Promise<Record<string, any> | any[]> => {
    const response = await this.#requestApi('DELETE', path, apiKey, apiSecret, version, params)
    return response as Promise<Record<string, any> | any[]>
  }

  #compareTime = async (): Promise<void> => {
    try {
      const serverTime = await this.#serverTime()
      const timeDelta = serverTime - Math.floor(Date.now() + this.#timestampOffset)
      if (this.#debug) this.log.i(logSystem, `Set time offset with API server: ${timeDelta}`)
      this.#timestampOffset = timeDelta
    } catch (err) {
      this.log.e(logSystem, `Failed to compare time - ${err}`)
    }
  }

  #serverTime = async (): Promise<number> => {
    const response = (await this.get('time', null, null, this.#PRIVATE_API_VERSION)) as Record<string, any>
    return response['serverTime']
  }
}

export { BnBaseApi, BnApiException }
