import fs from 'fs'
import Logger from './src/logger'
import ApiServer from './src/server'
import { CfgSql, IConfig } from './src/datatypes'

const cfgPath = './config.json'

if (!fs.existsSync(cfgPath)) {
  console.log(`Config path not found: ${cfgPath}`)
  process.exit(1)
}

function readConfig(): IConfig {
  const config: IConfig = JSON.parse(fs.readFileSync(cfgPath, { encoding: 'utf8' }))
  config.minOrder = Number(process.env.MIN_ORDER_IN_USD) || config.minOrder
  const dbConfig: CfgSql = {
    host: process.env.POSTGRES_HOST || config.db.host,
    database: process.env.POSTGRES_DB || config.db.database,
    user: process.env.POSTGRES_USER || config.db.user,
    password: process.env.POSTGRES_PASSWORD || config.db.password,
    port: process.env.POSTGRES_PORT || config.db.port,
  }
  config.db = dbConfig
  return config
}

const config: IConfig = readConfig()
const logger: Logger = new Logger(config.logging)

try {
  new ApiServer(logger, config)
} catch (err) {
  logger.c('initializer', `Server stoped - ${err}`)
}
