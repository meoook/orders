import fs from 'node:fs'
import { CfgLogger } from './datatype/config'

enum LogLevel { DEBUG, INFO, WARNING, ERROR, CRITICAL }
type LogLevelString = keyof typeof LogLevel

export default class Logger {
  readonly #logLevel: LogLevel
  readonly #enableColors: boolean
  readonly #toFile: boolean
  readonly #fileName: string = ''
  #streamData: string = ''

  constructor(cfg: CfgLogger) {
    this.#logLevel = LogLevel[cfg.level.toUpperCase() as LogLevelString] || LogLevel.DEBUG
    this.#enableColors = cfg.enableColors || false

    this.#toFile = cfg.writeToFile || false
    if (this.#toFile && cfg.folder) {
      const writeInterval = cfg.writeInterval || 5
      this.#checkFolder(cfg.folder)
      this.#fileName = `${cfg.folder}/log.log`
      setInterval(this.#fileStream, writeInterval * 1000) // Make `filestream`
    }
  }

  d = (module: string, text: string): void => this.#log(LogLevel.DEBUG, module, text)
  i = (module: string, text: string): void => this.#log(LogLevel.INFO, module, text)
  w = (module: string, text: string): void => this.#log(LogLevel.WARNING, module, text)
  e = (module: string, text: string): void => this.#log(LogLevel.ERROR, module, text)
  c = (module: string, text: string): void => this.#log(LogLevel.CRITICAL, module, text)

  #log = (level: LogLevel, module: string, text: string): void => {
    if (level < this.#logLevel) return
    const nowString = this.#nowStr()
    let colorPart = `${nowString} ${this.#levelTag(level)} [${module}]`
    if (this.#toFile) this.#streamData += `${colorPart} ${text}\n`
    if (this.#enableColors) colorPart = this.#colorTextByLevel(level, colorPart)
    console.log(`${colorPart} ${text}`)
  }

  // Create log directory if not exists
  #checkFolder = (folder: string): void | Error => {
    if (!fs.existsSync(folder)) {
      try {
        fs.mkdirSync(folder)
      } catch (e) {
        throw e
      }
    }
  }

  #fileStream = (): void => {
    if (!this.#streamData) return
    fs.appendFile(this.#fileName, this.#streamData, (err: any) => {
      if (err) console.log(`Error writing log data to disk: ${err}`)
    })
    this.#streamData = ''
  }

  #colorTextByLevel = (level: LogLevel, text: string): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return `\x1b[32m${text}\x1b[0m`
      case LogLevel.INFO:
        return `\x1b[36m${text}\x1b[0m`
      case LogLevel.WARNING:
        return `\x1b[33m${text}\x1b[0m`
      case LogLevel.ERROR: // light red
        return `\x1b[1;31m${text}\x1b[0m`
      case LogLevel.CRITICAL:
        return `\x1b[31m${text}\x1b[0m`
      default: // white
        return `\x1b[37m${text}\x1b[0m`
    }
  }

  #levelTag = (level: LogLevel): string => {
    switch (level) {
      case 0:
        return '[D]'
      case 1:
        return '[I]'
      case 2:
        return '[W]'
      case 3:
        return '[E]'
      case 4:
        return '[C]'
      default:
        return '[-]'
    }
  }

  #nowStr = (): string => {
    const d = new Date()
    const day = this.#lenTwo(d.getDay())
    const month = this.#lenTwo(d.getMonth())
    const year = d.getFullYear()
    const hours = this.#lenTwo(d.getHours())
    const minutes = this.#lenTwo(d.getMinutes())
    const seconds = this.#lenTwo(d.getSeconds())
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
  }

  #lenTwo = (datePart: number): string => (datePart > 9) ? `${datePart}` : `0${datePart}`
}
