import fs from 'node:fs'
import { CfgLogger } from './datatypes'

enum LogLevel {
  DEBUG,
  INFO,
  WARNING,
  ERROR,
  CRITICAL,
  SUCCESS,
  DATETIME,
  MODULE,
}
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
      const writeInterval: number = cfg.writeInterval || 5
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
  s = (module: string, text: string): void => this.#log(LogLevel.SUCCESS, module, text)

  #log = (level: LogLevel, module: string, text: string): void => {
    if (level < this.#logLevel) return
    const nowString: string = this.#nowStr()
    const levelTag: string = this.#levelTag(level)
    if (this.#toFile) this.#streamData += `${nowString} ${levelTag} [${module}] ${text}\n`
    const stdout: string = this.#logColorize(level, nowString, levelTag, module, text)
    console.log(stdout)
  }

  #logColorize = (level: LogLevel, now: string, tag: string, module: string, text: string): string => {
    if (this.#enableColors) {
      const _now: string = this.#colorize(LogLevel.DATETIME, now)
      const _tag: string = this.#colorize(level, tag)
      const _module: string = this.#colorize(LogLevel.MODULE, `[${module}]`)
      const _text: string = this.#colorize(level, text)
      return `${_now} ${_tag} ${_module} ${_text}`
    }
    return `${now} ${tag} [${module}] ${text}`
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

  #colorize = (level: LogLevel, text: string): string => {
    switch (level) {
      case LogLevel.DEBUG:
        return `\x1b[32m${text}\x1b[0m`
      case LogLevel.INFO:
        return `\x1b[37m${text}\x1b[0m`
      case LogLevel.WARNING:
        return `\x1b[33m${text}\x1b[0m`
      case LogLevel.ERROR: // light red
        return `\x1b[1;31m${text}\x1b[0m`
      case LogLevel.CRITICAL:
        return `\x1b[31m${text}\x1b[0m`
      case LogLevel.SUCCESS:
        return `\x1b[1;32m${text}\x1b[0m`
      case LogLevel.MODULE:
        return `\x1b[1;34m${text}\x1b[0m`
      case LogLevel.DATETIME:
        return `\x1b[34m${text}\x1b[0m`
      default: // white
        return `\x1b[36m${text}\x1b[0m`
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
      case 5:
        return '[S]'
      default:
        return '[-]'
    }
  }

  #nowStr = (): string => {
    const d = new Date()
    const day: string = this.#lenTwo(d.getDate())
    const month: string = this.#lenTwo(d.getMonth())
    const year: number = d.getFullYear()
    const hours: string = this.#lenTwo(d.getHours())
    const minutes: string = this.#lenTwo(d.getMinutes())
    const seconds: string = this.#lenTwo(d.getSeconds())
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  #lenTwo = (datePart: number): string => (datePart > 9 ? `${datePart}` : `0${datePart}`)
}
