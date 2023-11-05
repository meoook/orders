import fs from 'fs'
import { IConfig } from './src/datatypes'
import Logger from './src/logger'
import ApiServer from './src/server'

const cfgPath = './config.json'

if (!fs.existsSync(cfgPath)) {
  console.log(`Config path not found: ${cfgPath}`)
  process.exit(1)
}

const config: IConfig = JSON.parse(fs.readFileSync(cfgPath, { encoding: 'utf8' }))
const logger: Logger = new Logger(config.logging)

try {
  new ApiServer(logger, config)
} catch (e) {
  logger.c('initializer', `Server stoped - ${e}`)
}
