export interface CfgSql {
  host: string
  port: string | number
  user: string
  password: string
  database: string
}

export interface CfgLogger {
  level: string
  enableColors?: boolean
  writeToFile?: boolean
  folder?: string
  writeInterval?: number
}

export interface CfgApi {
  hostname: string
  port: string | number
}

export interface IConfig {
  timers: {
    keepAlife: number
    symbolRemove: number
    expire: number
  }
  logging: CfgLogger
  db: CfgSql
  api: CfgApi
}
