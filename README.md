Consts
===
Target_Max = 2**236 = 0x00000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
Target_Min = 2**0 = 0x0000000000000000000000000000000000000000000000000000000000000001
Often truncated: 0x00000000FFFF0000000000000000000000000000000000000000000000000000

Diff
===
Difficulty = 0xFFFF * 2**208 / target = 2**224/target
difficulty_min= 2**(-12)
Network performance = 2**256 / target / Tb = D * 2**256 / (2**224) / Tb = D * 2**32 / Tb

where
D - difficulty,
Tb - block issuance period in seconds


Calculations
===
Simple probability calculations:
a. p = target / 2**256 = 2**224 / D / 2**256 = 1 / ( D * 2**32 ) - probability of getting one valid(difficult enough) block hash per one try (iteration/every single block hash calculation)
b. ph = H / ( D * 2**32 ) = 2.3 * 10**(-10) * H / D - probability of getting one valid hash per second as a function of Network Difficulty D and miner’s hashrate H [h/s],
c. ph = H / ( D * 2**32 ) = H / ( TH * Tb ) - probability of getting one valid hash per second as a function of Total Network Hashrate TH [h/s], miner’s hashrate H [h/s] and block issuance period Tb [s]
d. pB = H / TH - probability of getting valid hash per Block ROUND (lasts Tb seconds) as a function of Total Network Hashrate TH [h/s] and miner’s hashrate H [h/s]


// hashrate = shares * difficulty * 2 ^ 32



// ===========================
>>> bits = 0x1903a30c
>>> exp = bits >> 24
>>> mant = bits & 0xffffff
>>> target_hexstr = '%064x' % (mant * (1 << (8 * (exp - 3))))
>>> target_hexstr
'0000000000000003a30c00000000000000000000000000000000000000000000'

Другой термин, отражающий сложность майнинга, — difficulty. Например для блока #449.584 он равнялся 392,963,262,344.37. Этот параметр представляет из себя отношение max_target / current_target, где max_target — максимально возможный target, а именно 0x00000000FFFF0000000000000000000000000000000000000000000000000000 (0x1d00ffff в формате bits). Именно bits как правило указывается во все block explorer.
