/**

import fs from "fs"
import Logger from "./src/logger"
import { IConfig } from './src/datatype/config'
// import PgSql from './src/db/pgsql'
import { PoolShare } from './src/datatype/share'
import QuerysStratum from './src/db/pg_stratum'

const logSystem = 'test'

const cfgPath = './config.json'
// Init
if (!fs.existsSync(cfgPath)) {
  console.log(`Config path not found: ${cfgPath}`)
  process.exit(1)
}

const config: IConfig = JSON.parse(fs.readFileSync(cfgPath, { encoding: 'utf8' }))
const logger: Logger = new Logger(config.logging)

// Mock data
const ip = '10.10.10.10'
const accName = 'testAcc'

// Start test
const xa = new QuerysStratum(logger, config.sql)

const waitDb = new Promise((resolve, _) => {
  setTimeout(() => {
    logger.i(logSystem, `=============== DB created =================`)
    resolve('foo')
  }, 3000)
})


const testBan = async () => {
  // Ban add/remove/reason
  const banned = await xa.banAdd(ip)
  if (banned) logger.i(logSystem, `Ip ${ip} banned`)
  else logger.w(logSystem, `Ip ${ip} NOT banned`)

  const removeBan = await xa.banRemove(ip)
  if (removeBan) logger.i(logSystem, `Ip ${ip} ban remove`)
  else logger.w(logSystem, `Ip ${ip} ban NOT removed`)

  const banned2 = await xa.banAdd(ip, 'too much')
  if (banned2) logger.i(logSystem, `Ip ${ip} banned with reason 'too much'`)
  else logger.w(logSystem, `Ip ${ip} NOT banned with reason`)
  await xa.banRemove(ip) // Remove data
  logger.i(logSystem, `======= BAN TEST PASSED =======`)
}

const testAcc = async (uid: number) => {
  // Ban add/remove/reason

  const accID = await xa.accCreate(uid, accName)
  if (accID) logger.i(logSystem, `Account created ${accName}:${accID}`)
  else logger.w(logSystem, `Failed to create account ${accName}`)

  const acc = await xa.accGet(accName)
  if (acc) {
    logger.i(logSystem, `Account getted`)
    console.dir(acc)
  }
  else logger.w(logSystem, `Failed to create account ${accName}`)

  const workerID = await xa.workerCreate(accID, '001')
  if (workerID) logger.i(logSystem, `Worker created ${accName}.001 with id:${workerID}`)
  else logger.w(logSystem, `Failed to create worker ${accName}.001`)

  await xa.workerCreate(accID, '001') // error

  await xa.workerCreate(accID, '002')

  const worker02 = await xa.workerGet(accName, '002')
  if (worker02) {
    logger.i(logSystem, `Worker 002`)
  }
  else logger.w(logSystem, `Failed to get Worker 002`)

  await xa.workerOnline(worker02?.id || 0)
  await xa.workerDifficulty(worker02?.id || 0, 20)

  // const accWorkers = await xa.apiWorkers(acc?.acc_name || '')
  // if (accWorkers) {
  //   logger.i(logSystem, `Account workers`)
  //   console.dir(accWorkers)
  // }
  // else logger.w(logSystem, `Failed to get account workers`)

  const share = {
    jobDiff: 1231,
    valid: true,
  } as PoolShare

  const createdShare = await xa.shareCreate(workerID, share)
  if (createdShare) logger.i(logSystem, `Share created ${createdShare}`)
  else logger.e(logSystem, `Failed to create share`)

  await xa.shareCreate(workerID, share)
  const hashShare = { ...share, blockHash: '0xfe0c3d1' }
  await xa.shareCreate(workerID, hashShare)

  const getShares = await xa.sharesGet(workerID)
  if (getShares) console.dir(getShares)
  else logger.e(logSystem, `Failed to get shares`)

  // const incomeID = await xa.incomeCreate(workerID, 10, 5, 10)
  // if (incomeID) logger.i(logSystem, `Income created ${incomeID}`)
  // else logger.e(logSystem, `Failed to create income`)
  // await xa.incomeCreate(workerID, 9, 4, 9)
  // await xa.incomeCreate(workerID, 12, 7, 12)

  const lastDaysAmount = 10

  // const incomes = await xa.incomesGet(workerID)
  if (incomes) console.dir(incomes)
  else logger.e(logSystem, `Failed to create income`)

  // await xa.incomesSetPayed(incomes?.map<number>(_e => _e.id) ?? [])

  // await xa.incomesGet(workerID)

  // const payId = await xa.payCreate(accID, 'af41', 21)
  // if (payId) logger.i(logSystem, `Pay created ${payId}`)
  // else logger.e(logSystem, `Failed to create pay`)

  // const getPay = await xa.paysGet(accID)
  // if (getPay) console.dir(getPay)
  // else logger.e(logSystem, `Failed to get pays`)

  // await xa.paysGet(accID, lastDaysAmount)

  // await xa.accDelete(accID)

  logger.i(logSystem, `======= ACC TEST PASSED =======`)
}

const testFull = async () => {
  waitDb.then(async () => {
    // const pgSql = new PgSql(logger, config.sql)
    // const sqlRes = await pgSql.makeQuery(`INSERT INTO users (login) VALUES ('test') RETURNING id;`)
    // if (sqlRes) logger.i(logSystem, `Created user test:${sqlRes[0].id}`)
    // else return
    const uid = 1 // sqlRes[0].id
    await testBan()
    await testAcc(uid)
    // await pgSql.makeQuery(`DELETE FROM users WHERE login = 'test';`) // Remove data
    process.exit(0)
  })
}

testFull()

 */
