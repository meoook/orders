type StratumJob = [
  string,  // JobID
  string,  // Previous hash reversed
  string,  // Coinbase part 1
  string,   // Coinbase part 2
  Array<string>, // Merkle Branch
  string, // version
  string,  // nbits
  string,  // ntime
  boolean  // clean_jobs
]
export default StratumJob
