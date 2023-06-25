export type StratumErr = [number, string, null]

export class StratumErrors {
  // 20 - Other / Unknown
  // 21 - Job not found(=stale)
  // 22 - Duplicate share
  // 23 - Low difficulty share
  // 24 - Unauthorized worker
  // 25 - Not subscribed
  static nonce2size: StratumErr = [20, "Incorrect size of extranonce2", null]
  static noncesize: StratumErr = [20, "Incorrect size of nonce", null]
  static timesize: StratumErr = [20, "Incorrect size of ntime", null]
  static timerange: StratumErr = [20, "ntime out of range", null]
  static noname: StratumErr = [20, "No worker name", null]
  static noab: StratumErr = [20, "Assic boost not configured", null]
  static errmask: StratumErr = [20, "Invalid version mask", null]
  static nojob: StratumErr = [21, "Job not found", null]
  static double: StratumErr = [22, "Duplicate share", null]
  static lowdiff: StratumErr = [23, "Low share difficulty", null]
  static noauth: StratumErr = [24, "Unauthorized worker", null]
  static nosubscribe: StratumErr = [25, "Not subscribed", null]
}
