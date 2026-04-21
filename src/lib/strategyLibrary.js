// strategyLibrary.js — Institutional Strategy Library for Noctis
// Implements proven strategies from Renaissance, AQR, Bridgewater, DE Shaw,
// Two Sigma, Man AHL, WorldQuant, and others.
// Pure JavaScript — runs in Vercel Edge Runtime, no external dependencies.

// ============ MATH HELPERS ============

function mean(arr) { return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length }
function stddev(arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}
function zscore(value, arr) {
  const sd = stddev(arr)
  return sd === 0 ? 0 : (value - mean(arr)) / sd
}
function rank(arr) {
  const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(arr.length)
  sorted.forEach((item, rank) => { ranks[item.i] = rank / (arr.length - 1) })
  return ranks
}
function correlation(x, y) {
  if (x.length !== y.length || x.length < 3) return 0
  const mx = mean(x), my = mean(y)
  let cov = 0, sx = 0, sy = 0
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx, dy = y[i] - my
    cov += dx * dy; sx += dx * dx; sy += dy * dy
  }
  const denom = Math.sqrt(sx * sy)
  return denom === 0 ? 0 : cov / denom
}
function ols(x, y) {
  // Simple OLS regression: y = a + b*x, returns { slope, intercept, rSquared }
  const n = Math.min(x.length, y.length)
  if (n < 3) return { slope: 0, intercept: 0, rSquared: 0 }
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i]; sxy += x[i] * y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1)
  const intercept = (sy - slope * sx) / n
  const ssTot = syy - sy * sy / n
  const ssRes = syy - intercept * sy - slope * sxy + intercept * slope * sx
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  return { slope, intercept, rSquared }
}
function rollingMean(arr, window) {
  const result = []
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1)
    result.push(mean(arr.slice(start, i + 1)))
  }
  return result
}
function returns(closes) {
  const ret = []
  for (let i = 1; i < closes.length; i++) {
    ret.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  return ret
}
function logReturns(closes) {
  const ret = []
  for (let i = 1; i < closes.length; i++) {
    ret.push(Math.log(closes[i] / closes[i - 1]))
  }
  return ret
}
function r(v, d = 4) { return Math.round(v * 10 ** d) / 10 ** d }

// ============ STRATEGY 1: Z-SCORE MEAN REVERSION (RenTech / DE Shaw) ============
// Compute spread z-score between two cointegrated assets. Trade when z deviates.

export function pairsMeanReversion(closesA, closesB, params = {}) {
  const window = params.window || 60
  const entryZ = params.entryZ || 2.0
  const exitZ = params.exitZ || 0.5
  const stopZ = params.stopZ || 4.0

  if (closesA.length < window + 10 || closesB.length < window + 10) {
    return { signal: 'none', score: 0, details: 'insufficient data' }
  }

  const n = Math.min(closesA.length, closesB.length)
  const a = closesA.slice(-n), b = closesB.slice(-n)

  // Compute hedge ratio via OLS
  const reg = ols(b, a)
  const beta = reg.slope

  // Compute spread
  const spread = a.map((v, i) => v - beta * b[i])

  // Rolling z-score of spread
  const recentSpread = spread.slice(-window)
  const spreadMean = mean(recentSpread)
  const spreadStd = stddev(recentSpread)
  const currentZ = spreadStd === 0 ? 0 : (spread[spread.length - 1] - spreadMean) / spreadStd

  // Ornstein-Uhlenbeck half-life estimation
  const dSpread = spread.slice(1).map((v, i) => v - spread[i])
  const lagSpread = spread.slice(0, -1)
  const ouReg = ols(lagSpread, dSpread)
  const theta = -ouReg.slope
  const halfLife = theta > 0 ? Math.log(2) / theta : 999

  let signal = 'none', score = 0
  if (Math.abs(currentZ) > stopZ) {
    signal = 'stop' // regime break
    score = 0
  } else if (currentZ < -entryZ) {
    signal = 'long_spread' // buy A, short B
    score = Math.min(100, Math.abs(currentZ) * 25)
  } else if (currentZ > entryZ) {
    signal = 'short_spread' // short A, buy B
    score = Math.min(100, Math.abs(currentZ) * 25)
  } else if (Math.abs(currentZ) < exitZ) {
    signal = 'exit' // close position
    score = 0
  }

  return {
    signal,
    score: Math.round(score),
    zscore: r(currentZ, 2),
    hedgeRatio: r(beta, 4),
    halfLife: r(halfLife, 1),
    spreadMean: r(spreadMean),
    rSquared: r(reg.rSquared, 3),
    feasible: halfLife > 0.5 && halfLife < 15, // Good for 4-day lifecycle
  }
}


// ============ STRATEGY 2: CROSS-SECTIONAL MOMENTUM (AQR / WorldQuant) ============
// Rank stocks by trailing returns. Long winners, short losers.

export function crossSectionalMomentum(universe, params = {}) {
  // universe = [{ ticker, closes: [...] }, ...]
  const lookback = params.lookback || 252 // 12 months
  const skipRecent = params.skipRecent || 21 // skip last month (reversal)
  const topPct = params.topPct || 0.2

  if (!Array.isArray(universe) || universe.length < 5) {
    return { longs: [], shorts: [], score: 0 }
  }

  const scored = universe.map(stock => {
    const c = stock.closes
    if (c.length < lookback + skipRecent) return null
    const endIdx = c.length - 1 - skipRecent
    const startIdx = endIdx - lookback
    if (startIdx < 0) return null
    const ret = (c[endIdx] - c[startIdx]) / c[startIdx]
    return { ticker: stock.ticker, momentum: ret }
  }).filter(Boolean)

  scored.sort((a, b) => b.momentum - a.momentum)

  const topN = Math.max(1, Math.floor(scored.length * topPct))
  const longs = scored.slice(0, topN)
  const shorts = scored.slice(-topN)

  // Signal strength: how separated are winners from losers
  const longAvg = mean(longs.map(s => s.momentum))
  const shortAvg = mean(shorts.map(s => s.momentum))
  const spread = longAvg - shortAvg
  const score = Math.min(100, Math.max(0, spread * 200))

  return {
    longs: longs.map(s => ({ ticker: s.ticker, momentum: r(s.momentum * 100, 1) + '%' })),
    shorts: shorts.map(s => ({ ticker: s.ticker, momentum: r(s.momentum * 100, 1) + '%' })),
    spread: r(spread * 100, 1) + '%',
    score: Math.round(score),
    universeSize: scored.length,
  }
}


// ============ STRATEGY 3: TIME-SERIES MOMENTUM / TREND FOLLOWING (Man AHL) ============
// Multi-speed trend signal: go long if own trailing return positive, short if negative.

export function timeSeriesMomentum(closes, params = {}) {
  const windows = params.windows || [21, 63, 126, 252] // 1mo, 3mo, 6mo, 12mo
  const volLookback = params.volLookback || 60

  if (closes.length < Math.max(...windows) + 10) {
    return { signal: 'neutral', score: 0, details: 'insufficient data' }
  }

  const price = closes[closes.length - 1]
  const signals = []

  for (const w of windows) {
    const pastPrice = closes[closes.length - 1 - w]
    const ret = (price - pastPrice) / pastPrice
    const windowRets = returns(closes.slice(-w - 1))
    const vol = stddev(windowRets) * Math.sqrt(252) || 1
    const riskAdjRet = ret / vol // Sharpe-like signal
    signals.push({
      window: w,
      return: r(ret * 100, 2),
      volAdjusted: r(riskAdjRet, 3),
      direction: ret > 0 ? 1 : -1,
    })
  }

  // Composite: average of vol-adjusted signals
  const composite = mean(signals.map(s => s.volAdjusted))
  const agreeing = signals.filter(s => Math.sign(s.direction) === Math.sign(composite)).length

  let signal = 'neutral'
  if (composite > 0.3) signal = 'long'
  else if (composite < -0.3) signal = 'short'

  const confidence = Math.min(100, Math.abs(composite) * 50 + (agreeing / signals.length) * 30)

  return {
    signal,
    score: Math.round(confidence),
    composite: r(composite, 3),
    agreement: `${agreeing}/${signals.length}`,
    signals,
  }
}


// ============ STRATEGY 4: CARRY TRADE (AQR / PIMCO / Bridgewater) ============
// Long high-yield, short low-yield. Works across FX, bonds, commodities.

export function carrySignal(assets, params = {}) {
  // assets = [{ ticker, yield, price, closes }, ...]
  // For FX: yield = interest rate differential
  // For bonds: yield = yield-to-maturity
  // For commodities: yield = roll return (backwardation = positive)
  const topPct = params.topPct || 0.33

  if (!Array.isArray(assets) || assets.length < 3) {
    return { longs: [], shorts: [], score: 0 }
  }

  const sorted = [...assets].sort((a, b) => (b.yield || 0) - (a.yield || 0))
  const topN = Math.max(1, Math.floor(sorted.length * topPct))
  const longs = sorted.slice(0, topN)
  const shorts = sorted.slice(-topN)

  const carrySpread = mean(longs.map(a => a.yield || 0)) - mean(shorts.map(a => a.yield || 0))
  const score = Math.min(100, carrySpread * 100)

  return {
    longs: longs.map(a => ({ ticker: a.ticker, yield: r(a.yield * 100, 2) + '%' })),
    shorts: shorts.map(a => ({ ticker: a.ticker, yield: r(a.yield * 100, 2) + '%' })),
    carrySpread: r(carrySpread * 100, 2) + '%',
    score: Math.round(score),
  }
}


// ============ STRATEGY 5: RISK PARITY (Bridgewater All Weather) ============
// Allocate so each asset contributes equal risk to the portfolio.

export function riskParity(assets, params = {}) {
  // assets = [{ ticker, closes, assetClass }, ...]
  const volLookback = params.volLookback || 60

  if (!Array.isArray(assets) || assets.length < 2) {
    return { weights: {}, score: 0 }
  }

  // Compute trailing volatility for each asset
  const vols = assets.map(a => {
    const rets = returns(a.closes.slice(-volLookback - 1))
    return { ticker: a.ticker, vol: stddev(rets) * Math.sqrt(252) || 0.15 }
  })

  // Inverse-volatility weighting
  const invVols = vols.map(v => 1 / v.vol)
  const totalInvVol = invVols.reduce((s, v) => s + v, 0)
  const weights = {}
  vols.forEach((v, i) => {
    weights[v.ticker] = r(invVols[i] / totalInvVol, 4)
  })

  // Risk contribution check
  const riskContribs = vols.map((v, i) => ({
    ticker: v.ticker,
    weight: invVols[i] / totalInvVol,
    vol: v.vol,
    riskContrib: r((invVols[i] / totalInvVol) * v.vol, 4),
  }))

  return {
    weights,
    riskContribs,
    score: 100, // Risk parity is always "on"
    rebalanceNeeded: false, // Caller should check drift
  }
}


// ============ STRATEGY 6: VOLATILITY RISK PREMIUM (Susquehanna / Wolverine) ============
// Harvest the gap between implied and realized volatility.

export function volRiskPremium(closes, impliedVol, params = {}) {
  // impliedVol = current VIX or ATM IV (annualized, as decimal e.g. 0.18)
  const rvWindow = params.rvWindow || 20

  if (closes.length < rvWindow + 5 || impliedVol == null) {
    return { signal: 'neutral', vrp: 0, score: 0 }
  }

  // Compute realized vol
  const logRets = logReturns(closes.slice(-rvWindow - 1))
  const realizedVol = stddev(logRets) * Math.sqrt(252)

  const vrp = impliedVol - realizedVol
  const vrpPct = vrp * 100

  let signal = 'neutral'
  let score = 0

  if (vrpPct > 5) {
    signal = 'sell_vol' // Rich premium, sell options
    score = Math.min(100, vrpPct * 10)
  } else if (vrpPct > 3) {
    signal = 'sell_vol_cautious'
    score = Math.min(80, vrpPct * 8)
  } else if (vrpPct < 0) {
    signal = 'buy_vol' // Realized > implied, buy options
    score = Math.min(80, Math.abs(vrpPct) * 10)
  }

  return {
    signal,
    score: Math.round(score),
    impliedVol: r(impliedVol * 100, 1) + '%',
    realizedVol: r(realizedVol * 100, 1) + '%',
    vrp: r(vrpPct, 1) + '%',
  }
}


// ============ STRATEGY 7: BOND-EQUITY CORRELATION REGIME (Cross-Asset) ============
// Track stock-bond correlation to detect inflation vs deflation regime.

export function bondEquityRegime(spyCloses, tltCloses, params = {}) {
  const window = params.window || 60

  if (spyCloses.length < window + 5 || tltCloses.length < window + 5) {
    return { regime: 'unknown', correlation: 0, score: 0 }
  }

  const n = Math.min(spyCloses.length, tltCloses.length)
  const spyRets = returns(spyCloses.slice(-n))
  const tltRets = returns(tltCloses.slice(-n))

  // Rolling correlation
  const recentSpyRets = spyRets.slice(-window)
  const recentTltRets = tltRets.slice(-window)
  const corr = correlation(recentSpyRets, recentTltRets)

  // Longer-term for trend
  const longCorr = spyRets.length >= 120 && tltRets.length >= 120
    ? correlation(spyRets.slice(-120), tltRets.slice(-120))
    : corr

  let regime = 'transition'
  if (corr < -0.2) regime = 'risk-off-hedge' // Normal: bonds hedge stocks
  else if (corr > 0.2) regime = 'inflation' // Danger: both fall together
  else regime = 'transition'

  const trendDirection = corr > longCorr ? 'correlating' : 'decorrelating'

  return {
    regime,
    correlation: r(corr, 3),
    longCorrelation: r(longCorr, 3),
    trendDirection,
    recommendation: regime === 'inflation'
      ? 'Replace bond hedges with gold/commodities. Reduce overall exposure.'
      : regime === 'risk-off-hedge'
      ? 'Traditional 60/40 works. Bonds provide diversification.'
      : 'Monitor closely. Reduce leverage.',
    score: Math.round(Math.abs(corr) * 100),
  }
}


// ============ STRATEGY 8: CREDIT SPREAD PREDICTOR ============
// Widening credit spreads lead equity declines by 1-3 months.

export function creditSpreadSignal(igSpreadHistory, hySpreadHistory, params = {}) {
  // igSpreadHistory = array of daily IG OAS values
  // hySpreadHistory = array of daily HY OAS values
  const momentumWindow = params.momentumWindow || 20

  if (!igSpreadHistory || igSpreadHistory.length < momentumWindow + 5) {
    return { signal: 'neutral', score: 0 }
  }

  const hy = hySpreadHistory || igSpreadHistory
  const current = hy[hy.length - 1]
  const past = hy[hy.length - 1 - momentumWindow]
  const momentum = current - past // In bps

  const zs = zscore(current, hy.slice(-252)) // 1-year z-score
  const igHyRatio = igSpreadHistory.length > 0 && hySpreadHistory.length > 0
    ? igSpreadHistory[igSpreadHistory.length - 1] / hy[hy.length - 1]
    : 0

  let signal = 'neutral', score = 0
  if (momentum > 50) {
    signal = 'risk_off' // Spreads widening fast — reduce equity
    score = Math.min(100, momentum / 2)
  } else if (momentum < -30) {
    signal = 'risk_on' // Spreads tightening — increase equity
    score = Math.min(100, Math.abs(momentum) / 1.5)
  }

  return {
    signal,
    score: Math.round(score),
    currentSpread: r(current),
    momentum: r(momentum) + 'bps',
    zScore: r(zs, 2),
    igHyRatio: r(igHyRatio, 3),
    detail: signal === 'risk_off'
      ? `HY spreads widened ${r(momentum)}bps in ${momentumWindow}d. Historically leads equity decline 1-3 months.`
      : signal === 'risk_on'
      ? `HY spreads tightened ${r(Math.abs(momentum))}bps. Risk appetite improving.`
      : 'Credit spreads stable.',
  }
}


// ============ STRATEGY 9: GOLD-REAL YIELDS (Cross-Asset Relative Value) ============

export function goldRealYieldSignal(goldCloses, realYieldHistory, params = {}) {
  const window = params.window || 252

  if (!goldCloses || goldCloses.length < window + 5 || !realYieldHistory || realYieldHistory.length < window + 5) {
    return { signal: 'neutral', score: 0 }
  }

  const n = Math.min(goldCloses.length, realYieldHistory.length, window)
  const g = goldCloses.slice(-n), ry = realYieldHistory.slice(-n)

  // Regression: gold = a + b * realYield
  const reg = ols(ry, g)
  const fairValue = reg.intercept + reg.slope * ry[ry.length - 1]
  const currentGold = g[g.length - 1]
  const deviation = (currentGold - fairValue) / fairValue
  const deviationZ = zscore(deviation, g.map((v, i) => (v - (reg.intercept + reg.slope * ry[i])) / (reg.intercept + reg.slope * ry[i])))

  let signal = 'neutral', score = 0
  if (deviationZ < -1.5) {
    signal = 'long_gold' // Gold cheap relative to real yields
    score = Math.min(90, Math.abs(deviationZ) * 30)
  } else if (deviationZ > 1.5) {
    signal = 'short_gold' // Gold expensive
    score = Math.min(90, Math.abs(deviationZ) * 30)
  }

  return {
    signal,
    score: Math.round(score),
    currentGold: r(currentGold, 2),
    fairValue: r(fairValue, 2),
    deviation: r(deviation * 100, 1) + '%',
    deviationZScore: r(deviationZ, 2),
    rSquared: r(reg.rSquared, 3),
  }
}


// ============ STRATEGY 10: ORDER FLOW IMBALANCE (Microstructure) ============

export function orderFlowImbalance(trades, params = {}) {
  // trades = [{ price, volume, prevPrice }, ...]
  const window = params.window || 50

  if (!trades || trades.length < window) {
    return { ofi: 0, signal: 'neutral', score: 0 }
  }

  const recent = trades.slice(-window)
  let buyVol = 0, sellVol = 0
  for (const t of recent) {
    if (t.price > (t.prevPrice || t.price)) buyVol += t.volume
    else if (t.price < (t.prevPrice || t.price)) sellVol += t.volume
    else {
      buyVol += t.volume / 2; sellVol += t.volume / 2
    }
  }

  const total = buyVol + sellVol
  const ofi = total === 0 ? 0 : (buyVol - sellVol) / total

  let signal = 'neutral', score = 0
  if (ofi > 0.3) { signal = 'buying_pressure'; score = Math.min(100, ofi * 100) }
  else if (ofi < -0.3) { signal = 'selling_pressure'; score = Math.min(100, Math.abs(ofi) * 100) }

  return {
    ofi: r(ofi, 3),
    buyVol: Math.round(buyVol),
    sellVol: Math.round(sellVol),
    signal,
    score: Math.round(score),
  }
}


// ============ STRATEGY 11: VPIN — Toxicity/Informed Trading Detection ============

export function computeVPIN(trades, params = {}) {
  // trades = [{ price, volume, open, close }] grouped into volume buckets
  const numBuckets = params.numBuckets || 50

  if (!trades || trades.length < numBuckets) {
    return { vpin: 0.5, toxicity: 'unknown', score: 0 }
  }

  // Bulk Volume Classification
  const buckets = trades.slice(-numBuckets)
  let absImbalanceSum = 0

  for (const bucket of buckets) {
    const sigma = stddev(logReturns([bucket.open || bucket.price, bucket.close || bucket.price].filter(Boolean)))
    const logRet = bucket.close && bucket.open ? Math.log(bucket.close / bucket.open) : 0
    // CDF approximation (Abramowitz-Stegun)
    const x = sigma === 0 ? 0 : logRet / (sigma || 0.01)
    const t = 1 / (1 + 0.2316419 * Math.abs(x))
    const d = 0.3989422804 * Math.exp(-x * x / 2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    const cdf = x > 0 ? 1 - p : p

    const vBuy = bucket.volume * cdf
    const vSell = bucket.volume * (1 - cdf)
    absImbalanceSum += Math.abs(vBuy - vSell)
  }

  const totalVolume = buckets.reduce((s, b) => s + b.volume, 0)
  const vpin = totalVolume === 0 ? 0.5 : absImbalanceSum / totalVolume

  let toxicity = 'normal', score = 0
  if (vpin > 0.7) { toxicity = 'high'; score = 90 }
  else if (vpin > 0.5) { toxicity = 'elevated'; score = 60 }
  else if (vpin < 0.3) { toxicity = 'low'; score = 20 }

  return {
    vpin: r(vpin, 3),
    toxicity,
    score,
    recommendation: toxicity === 'high'
      ? 'Informed traders active. Widen stops, reduce position sizes. Flash crash risk elevated.'
      : toxicity === 'elevated'
      ? 'Moderate informed trading. Proceed with caution.'
      : 'Low toxicity. Safe to provide liquidity / tighter stops.',
  }
}


// ============ STRATEGY 12: POST-EARNINGS ANNOUNCEMENT DRIFT (PEAD) ============
// Enter day after earnings surprise, ride the 4-day drift.

export function peadSignal(params = {}) {
  // params: { earningsSurprise, priorDayReturn, volume, avgVolume, priorCloses }
  const surprise = params.earningsSurprise || 0 // % surprise vs consensus
  const dayReturn = params.priorDayReturn || 0 // earnings day return
  const volRatio = params.volume && params.avgVolume ? params.volume / params.avgVolume : 1

  if (Math.abs(surprise) < 2) {
    return { signal: 'neutral', score: 0, detail: 'Earnings surprise < 2%, no PEAD signal' }
  }

  let score = 0
  let signal = 'neutral'

  // Positive surprise + positive day = continuation drift
  if (surprise > 5 && dayReturn > 0.02) {
    signal = 'long'
    score = Math.min(95, 40 + surprise * 3 + volRatio * 10)
  } else if (surprise > 2 && dayReturn > 0) {
    signal = 'long'
    score = Math.min(80, 30 + surprise * 3 + volRatio * 5)
  }
  // Negative surprise + negative day = downward drift
  else if (surprise < -5 && dayReturn < -0.02) {
    signal = 'short'
    score = Math.min(95, 40 + Math.abs(surprise) * 3 + volRatio * 10)
  } else if (surprise < -2 && dayReturn < 0) {
    signal = 'short'
    score = Math.min(80, 30 + Math.abs(surprise) * 3 + volRatio * 5)
  }
  // Reversal candidates: surprise and price disagree
  else if (surprise > 5 && dayReturn < -0.01) {
    signal = 'long' // Market overreacted down
    score = Math.min(70, 25 + surprise * 2)
  }

  return {
    signal,
    score: Math.round(score),
    surprise: r(surprise, 1) + '%',
    dayReturn: r(dayReturn * 100, 1) + '%',
    volumeRatio: r(volRatio, 1) + 'x',
    detail: signal !== 'neutral'
      ? `PEAD: ${surprise > 0 ? 'positive' : 'negative'} ${r(Math.abs(surprise), 1)}% surprise. Historical drift continues 1-5 days post-earnings.`
      : 'No actionable PEAD signal.',
    optimalHold: '1-5 days', // Perfect for 4-day lifecycle
  }
}


// ============ STRATEGY 13: SHORT-TERM REVERSAL (1-WEEK) ============
// Stocks that fell the most in the past week tend to bounce back.

export function shortTermReversal(universe, params = {}) {
  const lookback = params.lookback || 5 // 1 week
  const topPct = params.topPct || 0.2

  if (!Array.isArray(universe) || universe.length < 5) {
    return { longs: [], shorts: [], score: 0 }
  }

  const scored = universe.map(stock => {
    const c = stock.closes
    if (c.length < lookback + 2) return null
    const ret = (c[c.length - 1] - c[c.length - 1 - lookback]) / c[c.length - 1 - lookback]
    return { ticker: stock.ticker, weekReturn: ret }
  }).filter(Boolean)

  scored.sort((a, b) => a.weekReturn - b.weekReturn) // Worst first

  const topN = Math.max(1, Math.floor(scored.length * topPct))
  const longs = scored.slice(0, topN) // Biggest losers → expected to bounce
  const shorts = scored.slice(-topN)   // Biggest winners → expected to fade

  const spread = mean(shorts.map(s => s.weekReturn)) - mean(longs.map(s => s.weekReturn))

  return {
    longs: longs.map(s => ({ ticker: s.ticker, weekReturn: r(s.weekReturn * 100, 1) + '%' })),
    shorts: shorts.map(s => ({ ticker: s.ticker, weekReturn: r(s.weekReturn * 100, 1) + '%' })),
    spread: r(spread * 100, 1) + '%',
    score: Math.round(Math.min(100, spread * 300)),
    strategy: 'short-term-reversal',
    optimalHold: '3-5 days',
  }
}


// ============ STRATEGY 14: SEASONAL PATTERNS ============

export function seasonalSignal(params = {}) {
  const now = params.date || new Date()
  const day = now.getDate()
  const month = now.getMonth() // 0-indexed
  const dayOfWeek = now.getDay()

  const signals = []

  // Turn of month effect (last 2 trading days + first 3 of new month)
  if (day >= 28 || day <= 3) {
    signals.push({ pattern: 'turn_of_month', direction: 'bullish', strength: 65, detail: 'Institutional rebalancing flows favor equities around month boundaries.' })
  }

  // Santa Claus rally (last 5 trading days of Dec + first 2 of Jan)
  if ((month === 11 && day >= 25) || (month === 0 && day <= 3)) {
    signals.push({ pattern: 'santa_rally', direction: 'bullish', strength: 76, detail: 'Santa Claus Rally: positive in 76% of years historically.' })
  }

  // Options expiration week (3rd Friday of each month ± 2 days)
  // Rough proxy: if day is between 14-21 and it's near a Friday
  if (day >= 14 && day <= 21 && Math.abs(dayOfWeek - 5) <= 2) {
    signals.push({ pattern: 'opex_week', direction: 'volatile', strength: 55, detail: 'Options expiration: increased volume and volatility. Gamma effects dominate.' })
  }

  // Monday effect (historically negative)
  if (dayOfWeek === 1) {
    signals.push({ pattern: 'monday_effect', direction: 'bearish', strength: 40, detail: 'Monday effect: historically weakest day. Consider entering longs on dips.' })
  }

  // Sell in May
  if (month >= 4 && month <= 9) {
    signals.push({ pattern: 'sell_in_may', direction: 'cautious', strength: 45, detail: 'May-Oct historically underperforms Nov-Apr. Reduce exposure or hedge.' })
  }

  const compositeDirection = signals.length === 0 ? 'neutral'
    : signals.filter(s => s.direction === 'bullish').length > signals.filter(s => s.direction === 'bearish').length ? 'bullish' : 'cautious'

  return {
    signals,
    compositeDirection,
    score: signals.length > 0 ? Math.round(mean(signals.map(s => s.strength))) : 0,
  }
}


// ============ STRATEGY 15: FACTOR TIMING (AQR / BlackRock) ============
// When to increase/decrease factor exposure based on valuation and momentum.

export function factorTiming(factorReturns, params = {}) {
  // factorReturns = { value: [...], momentum: [...], quality: [...], lowVol: [...] }
  const lookback = params.lookback || 63 // 3 months

  const factors = {}
  for (const [name, rets] of Object.entries(factorReturns)) {
    if (!rets || rets.length < lookback + 5) continue

    const recentRets = rets.slice(-lookback)
    const cumReturn = recentRets.reduce((acc, r) => acc * (1 + r), 1) - 1
    const vol = stddev(recentRets) * Math.sqrt(252)
    const sharpe = vol === 0 ? 0 : (cumReturn / (lookback / 252)) / vol
    const momentum = cumReturn > 0 ? 'positive' : 'negative'

    factors[name] = {
      return3m: r(cumReturn * 100, 1) + '%',
      annualizedVol: r(vol * 100, 1) + '%',
      sharpe: r(sharpe, 2),
      momentum,
      recommendation: sharpe > 0.5 ? 'increase' : sharpe < -0.5 ? 'decrease' : 'hold',
    }
  }

  return {
    factors,
    topFactor: Object.entries(factors).sort((a, b) => parseFloat(b[1].sharpe) - parseFloat(a[1].sharpe))[0]?.[0] || 'none',
    score: 70,
  }
}


// ============ MASTER: RUN ALL STRATEGIES ============

export function runStrategyLibrary(data) {
  const results = {}

  // Time-series momentum on any single asset
  if (data.closes && data.closes.length >= 260) {
    results.trendFollowing = timeSeriesMomentum(data.closes)
  }

  // Vol risk premium
  if (data.closes && data.impliedVol) {
    results.volRiskPremium = volRiskPremium(data.closes, data.impliedVol)
  }

  // Bond-equity regime
  if (data.spyCloses && data.tltCloses) {
    results.bondEquityRegime = bondEquityRegime(data.spyCloses, data.tltCloses)
  }

  // Seasonal
  results.seasonal = seasonalSignal({})

  // PEAD
  if (data.earningsSurprise != null) {
    results.pead = peadSignal(data)
  }

  // Aggregate scores
  const activeStrategies = Object.entries(results).filter(([, v]) => v.score > 0)
  const avgScore = activeStrategies.length > 0
    ? Math.round(mean(activeStrategies.map(([, v]) => v.score)))
    : 0

  return {
    strategies: results,
    activeCount: activeStrategies.length,
    avgConfidence: avgScore,
    timestamp: new Date().toISOString(),
  }
}
