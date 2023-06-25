const redis = require('redis')
const logSystem = 'redis'

/*
This module deals with handling shares when in internal payment processing mode. It connects to a redis
database and inserts shares with the database structure of:

key: coin_name + ':' + block_height
value: a hash with..
        key:

 */
module.exports = class RedisDB {
  #minVersion = 2.6  // Redis version
  #client

  constructor() {  // FIXME - use cfg
    this.connected = false
    // this.#client = redis.createClient(config.redis.host, config.redis.port)
    if (config.redis.password) this.#client.auth(config.redis.password)
    // this.#init()
  }

  handleShare = (isValidShare, isValidBlock, shareData) => {
    if (!this.connected) logger.e(logSystem, `No connection to control ${isValidShare ? '' : 'in'}valid share`)

    const redisCommands = []
    if (isValidShare) {
      redisCommands.push(['hincrbyfloat', 'shares:roundCurrent', shareData.worker, shareData.difficulty])
      redisCommands.push(['hincrby', 'stats', 'validShares', 1])
    } else {
      redisCommands.push(['hincrby', 'stats', 'invalidShares', 1])
    }
    /* Stores share diff, worker, and unique value with a score that is the timestamp. Unique value ensures it
       doesn't overwrite an existing entry, and timestamp as score lets us query shares from last X minutes to
       generate hashrate for each worker and pool. */
    const dateNow = Date.now()
    const hashrateData = [isValidShare ? shareData.difficulty : -shareData.difficulty, shareData.worker, dateNow]
    redisCommands.push(['zadd', 'hashrate', dateNow / 1000 | 0, hashrateData.join(':')])

    if (isValidBlock) {
      redisCommands.push(['rename', 'shares:roundCurrent', `shares:round${shareData.height}`])
      redisCommands.push(['sadd', 'blocksPending', `${shareData.blockHash}:${shareData.txHash}:${shareData.height}`])
      redisCommands.push(['hincrby', 'stats', 'validBlocks', 1])
    } else if (shareData.blockHash) {
      redisCommands.push(['hincrby', 'stats', 'invalidBlocks', 1])
    }

    this.#client.multi(redisCommands).exec((err, replies) => {
      if (err) logger.e(logSystem, `Error saving share - ${JSON.stringify(err)}`)
    })
  }

  #init = () => {
    this.#client.on('ready', () => this.#changeStatus(true))
    this.#client.on('error', (err) => logger.e(logSystem, `Client error: ${JSON.stringify(err)}`))
    this.#client.on('end', () => this.#changeStatus(false))
    // Check version
    this.#client.info((error, response) => {
      if (error) logger.e(logSystem, 'Redis version check failed')
      else {
        const version = this.#getVersion(response)
        if (!version) logger.e(logSystem, 'Client version not found')
        else if (version < this.#minVersion)
          logger.e(logSystem, `Client version ${version} must be ${this.#minVersion} or higher`)
        else return
      }
      this.#client.quit()
    })
  }

  #changeStatus = (status) => {
    if (status) {
      this.connected = true
      logger.i(logSystem, `Processing up on ${config.redis.host}:${config.redis.port}`)
    } else {
      this.connected = false
      logger.e(logSystem, 'Lost connection')
    }
  }

  #getVersion = (response) => {
    const parts = response.split('\r\n')
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].indexOf(':') !== -1) {
        const valParts = parts[i].split(':')
        if (valParts[0] === 'redis_version') return parseFloat(valParts[1])
      }
    }
    return 0
  }
}
