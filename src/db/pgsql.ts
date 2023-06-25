import { ClientConfig, Pool } from 'pg'
import fs from 'fs'
import { CfgSql } from '../datatype/config'
import Logger from '../logger'
const logSystem = 'pg'

export default class PgSql {
  #pool: Pool
  // #filename = './src/db/sql.sql'  // To create db schema
  connected: boolean = false

  constructor(private readonly log: Logger, cfg: CfgSql) {
    // const settings = 'postgresql://dbuser:secretpassword@database.server.com:3211/mydb'
    const settings: ClientConfig = {
      // max: 20,
      host: cfg.host,
      port: Number(cfg.port),
      user: cfg.user,
      password: cfg.password,
      database: cfg.database
    }
    this.#pool = new Pool(settings)
    this.#init()
  }

  #init = async (): Promise<void> => {
    await this.#checkConnection()
    // if (this.connected) await this.#createFromFile(this.#filename)
  }

  #checkConnection = async (): Promise<void> => {
    this.log.i(logSystem, 'Checking online status...')
    const result = await this.makeQuery('SELECT NOW()')
    this.connected = Boolean(result)
    if (result) this.log.i(logSystem, `Sql online on '${result[0].now}'`)
    else this.log.c(logSystem, 'Check connection fail')
  }

  makeQuery = async (text: string) => {
    /**
        {
          command: 'CREATE',
          rowCount: null,
          oid: null,
          rows: [],
          fields: [],
          RowCtor: null,
          rowAsArray: false
        }
     */
    try {
      const result = await this.#pool.query(text)
      // if (result.rowCount < 1) return null
      this.log.d(logSystem, `Query ok: ${text}`)
      return result.rows
    } catch (err) {
      this.log.e(logSystem, `Query failed: ${text} - ${err}`)
      return null
    }
  }

  createFromFile = async (filename: string): Promise<void> => {
    this.log.i(logSystem, `Load from file '${filename}'`)
    let fileString = fs.readFileSync(filename).toString()
      .replace(/(\r\n|\n|\r)/gm, " ")       // remove newlines
      .replace(/\s+/g, ' ')                 // excess white space
    const queries = fileString.split(";")   // split into statements
    for (let idx = 0; idx < queries.length; idx++) {
      const query = queries[idx].trim()
      if (query) await this.makeQuery(query)
    }
  }
}
