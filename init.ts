import fs from 'fs'
import { IConfig } from './src/datatype/config'
import Logger from './src/logger'
import Pool from './src/pool'

const cfgPath = './config.json'

if (!fs.existsSync(cfgPath)) {
  console.log(`Config path not found: ${cfgPath}`)
  process.exit(1)
}

const config: IConfig = JSON.parse(fs.readFileSync(cfgPath, { encoding: 'utf8' }))
const logger: Logger = new Logger(config.logging)

try {
  new Pool(logger, config)
} catch (e) {
  logger.c('initializer', `Server stoped - ${e}`)
}
