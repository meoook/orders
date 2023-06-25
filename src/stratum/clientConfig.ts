// /*
//   * '''"version-rolling"'''
//   * '''"minimum-difficulty"'''
//   * '''"subscribe-extranonce"'''

//   request
//   {
//     "id": 1,
//     "method": "mining.configure",    
//     "params": [
//       ["minimum-difficulty", "version-rolling"],
//       {
//         "minimum-difficulty.value": 2048,
//         "version-rolling.mask": "1fffe000",
//         "version-rolling.min-bit-count": 2
//       }
//     ]
//   }

//   response 
//     {
//       "id": 1,
//       "error": null,
//       "result": {
//         "version-rolling": true,
//         "version-rolling.mask": "18000000",
//         "minimum-difficulty": true
//       }
//     }

//     {"error": null, "id": 1, "result": {"version-rolling": false}}
// */

// import Logger from '../logger'


// const logSystem = 'client-cfg'

// interface RequestParams {
//   "minimum-difficulty.value"?: number
//   "version-rolling.mask"?: string  // Hex 1fffe000
//   "version-rolling.min-bit-count"?: number
// }

// type ReqestConfig = [string[], RequestParams]

// export default class ClientConfig {
//   #DIFF = 'minimum-difficulty'
//   #ROLL = 'version-rolling'
//   #NONCE = 'subscribe-extranonce'
//   #INFO = 'info'

//   constructor(private readonly log: Logger) { }

//   #handleConfigure = (reqCfg: ReqestConfig) => {
//     if (!this.#checkRequest(reqCfg)) return
//     const exts: string[] = reqCfg[0]
//     const params: RequestParams = (reqCfg.length === 2) ? reqCfg[1] : {}
//     let result = {}

//     for (let ext in exts) {
//       let toAdd = null
//       const extParams = this.#getParamsForExt(ext, params)

//       if (ext === this.#ROLL) toAdd = this.#handleVersionRolling(extParams)
//       else if (ext === this.#DIFF) toAdd = this.#handleMinDifficulty(extParams)
//       else if (ext === this.#NONCE) toAdd = this.#handleSubscribeExtranonce()
//       else if (ext === this.#INFO) toAdd = this.#handleInfo(extParams)
//       else this.log.w(logSystem, `Unknown extension in request: ${ext}`)

//       if (toAdd) result = { ...result, ...toAdd }
//       else result[ext] = false
//     }
//     return result
//   }

//   #checkRequest = (reqCfg: ReqestConfig): boolean => {
//     let err = null
//     if (reqCfg.length === 0) err = 'Invalid request without extentions list'
//     else if (reqCfg[0] !== 'array') err = 'Extentions list parameter error'
//     else if (reqCfg[0].length === 0) err = 'Extentions list is empty'
//     else if (reqCfg.length === 1) {  // Only alone `subscribe-extranonce` request is valid with no params
//       if (reqCfg[0].length !== 1 && reqCfg[0][0] !== this.#NONCE) err = 'No config parameters in request'
//     }
//     else if (reqCfg.length !== 2) err = 'Invalid request structure'
//     else if (typeof reqCfg[1] === 'object') err = 'Invalid parameters structure in request'

//     if (!err) return true
//     this.log.e(logSystem, err)
//     return false
//   }

//   #getParamsForExt = (ext: string, params: RequestParams) => {
//     const requestParams = {}
//     for (let param in params) {
//       const paramGroups = param.split('.')
//       if (paramGroups.length === 2 && paramGroups[0] === ext) requestParams[paramGroups[1]] = params[param]
//     }
//     return requestParams
//   }

//   #handleVersionRolling = (params: object) => {
//     for (let param in params) {
//       if (param === 'mask') {

//         if (param < '1fffe000') false
//       }
//       if (paramGroups.length === 2 && paramGroups[0] === ext) requestParams[paramGroups[1]] = params[param]
//     }
//     // This extension allows the miner to change the value of some bits in the version field in the block header.Currently there are no standard bits used for version rolling so they need to be negotiated between a miner and a server.
//     // A miner sends the server a mask describing bits which the miner is capable of changing. 1 = changeable bit, 0 = not changeable(miner_mask) and a minimum number of bits that it needs for efficient version rolling.
//     // The server responds to the configuration message by sending a mask with common bits intersection of the miner's mask and its a mask (response = server_mask & miner_mask)
//     // When responded with true, the server will accept new parameter of "mining.submit", see later.
//     if (!fullParams) return false
//     const result = {}
//     for (let param in fullParams) {
//       if (param === 'mask') 1 + 1 // CHECK MASK
//       else if (param === 'min-bit-count') 2 + 2
//       //   if (param === 'min-bit-count')
//     }
//   }

//   #handleMinDifficulty = (fullParams) => {
//     // This extension allows the miner to change the value of some bits in the version field in the block header.Currently there are no standard bits used for version rolling so they need to be negotiated between a miner and a server.
//     // A miner sends the server a mask describing bits which the miner is capable of changing. 1 = changeable bit, 0 = not changeable(miner_mask) and a minimum number of bits that it needs for efficient version rolling.
//     // The server responds to the configuration message by sending a mask with common bits intersection of the miner's mask and its a mask (response = server_mask & miner_mask)
//     const params = this.#getParamsForExt('versi', fullParams)
//   }

//   #handleSubscribeExtranonce = (fullParams) => {
//     // This extension allows the miner to change the value of some bits in the version field in the block header.Currently there are no standard bits used for version rolling so they need to be negotiated between a miner and a server.
//     // A miner sends the server a mask describing bits which the miner is capable of changing. 1 = changeable bit, 0 = not changeable(miner_mask) and a minimum number of bits that it needs for efficient version rolling.
//     // The server responds to the configuration message by sending a mask with common bits intersection of the miner's mask and its a mask (response = server_mask & miner_mask)
//     const params = this.#getParamsForExt('versi', fullParams)
//   }

//   #handleInfo = (infoParams) => {

//   }
// }
