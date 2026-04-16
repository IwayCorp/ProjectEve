import { NextResponse } from 'next/server'
import { computeAlphaFactors } from '@/lib/alphaFactors'
import { detectRegime } from '@/lib/regimeDetector'
import { computeEnsemble } from '@/lib/ensembleEngine'
import { computePositionSize } from '@/lib/positionSizer'
import { analyzeSentiment } from '@/lib/sentimentEngine'
import { computeCorrelations } from '@/lib/correlationEngine'

export const runtime = 'edge'

// Fetch candles from Yahoo Finance
async function fetchCandles(symbol, range = '6mo', interval = '1d') {
  const yahooSymbol = symbol === 'USDJPY' ? 'JPY=X' : symbol === 'EURUSD' ? 'EURUSD=X'
    : symbol === 'GBPUSD' ? 'GBPUSD=X' : symbol === 'USDCHF' ? 'CHF=X'
    : symbol === 'AUDUSD' ? 'AUDUSD=X' : symbol === 'USDMXN' ? 'MXN=X'
    : symbol === 'EURGBP' ? 'EURGBP=X' : symbol === 'NZDUSD' ? 'NZDUSD=X'
    : symbol === 'BTC-USD' ? 'BTC-USD' : symbol
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}&includePrePost=false`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${yahooSymbol}`)
  const data = await res.json()
  const result = data.chart?.result?.[0]
  if (!result) return { candles: [], meta: {} }
  const ts = result.timestamp || []
  const q = result.indicators?.quote?.[0] || {}
  return {
    candles: ts.map((t, i) => ({
      time: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i], volume: q.volume?.[i],
    })).filter(c => c.close != null && c.open != null),
    meta: result.meta || {},
  }
}

// ============================================================
// INDICATOR LIBRARY — edge-compatible, no external dependencies
// ============================================================

function calcRSI(closes, period = 14) {
  let avgGain = 0, avgLoss = 0, rsi = null
  for (let i = 1; i < closes.length; i++) {
    const g = closes[i] > closes[i-1] ? closes[i] - closes[i-1] : 0
    const l = closes[i] < closes[i-1] ? closes[i-1] - closes[i] : 0
    if (i <= period) { avgGain += g; avgLoss += l; if (i === period) { avgGain /= period; avgLoss /= period; rsi = avgLoss === 0 ? 100 : 100 - 100/(1 + avgGain/avgLoss) } }
    else { avgGain = (avgGain*(period-1)+g)/period; avgLoss = (avgLoss*(period-1)+l)/period; rsi = avgLoss === 0 ? 100 : 100 - 100/(1 + avgGain/avgLoss) }
  }
  return rsi
}

function calcSMA(closes, period) {
  if (closes.length < period) return null
  let s = 0; for (let i = closes.length - period; i < closes.length; i++) s += closes[i]
  return s / period
}

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null
  let atr = 0
  for (let i = 1; i <= period; i++) {
    atr += Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i-1].close), Math.abs(candles[i].low - candles[i-1].close))
  }
  atr /= period
  for (let i = period + 1; i < candles.length; i++) {
    const tr = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i-1].close), Math.abs(candles[i].low - candles[i-1].close))
    atr = (atr * (period - 1) + tr) / period
  }
  return atr
}

function calcEMA(closes, period) {
  if (closes.length < period) return null
  let ema = 0; for (let i = 0; i < period; i++) ema += closes[i]; ema /= period
  const m = 2 / (period + 1)
  for (let i = period; i < closes.length; i++) ema = (closes[i] - ema) * m + ema
  return ema
}

function calcMACD(closes) {
  if (closes.length < 35) return null
  const k12 = 2 / 13, k26 = 2 / 27, k9 = 2 / 10
  let ema12 = 0, ema26 = 0
  for (let i = 0; i < 12; i++) ema12 += closes[i]; ema12 /= 12
  for (let i = 0; i < 26; i++) ema26 += closes[i]; ema26 /= 26
  const macdSeries = []
  for (let i = 26; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12)
    ema26 = closes[i] * k26 + ema26 * (1 - k26)
    macdSeries.push(ema12 - ema26)
  }
  if (macdSeries.length < 9) return null
  let signal = 0
  for (let i = 0; i < 9; i++) signal += macdSeries[i]; signal /= 9
  for (let i = 9; i < macdSeries.length; i++) signal = macdSeries[i] * k9 + signal * (1 - k9)
  const macd = macdSeries[macdSeries.length - 1]
  // Also compute histogram trend (last 3 bars)
  const histLen = macdSeries.length
  let histTrend = 'flat'
  if (histLen >= 3) {
    const h1 = macdSeries[histLen-3] - (histLen >= 12 ? macdSeries[histLen-12] : 0)
    const h2 = macdSeries[histLen-2] - (histLen >= 11 ? macdSeries[histLen-11] : 0)
    const h3 = macdSeries[histLen-1] - signal
    if (h3 > h2 && h2 > h1) histTrend = 'expanding'
    else if (h3 < h2 && h2 < h1) histTrend = 'contracting'
  }
  return { macd, signal, histogram: macd - signal, histTrend }
}

function calcBollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const sma = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period
  const std = Math.sqrt(variance)
  return { upper: sma + mult * std, middle: sma, lower: sma - mult * std, std, bandwidth: (mult * 2 * std) / sma }
}

function analyzeVolume(candles, lookback = 20) {
  if (candles.length < lookback + 5) return { ratio: 1, trend: 'flat' }
  const recent5 = candles.slice(-5)
  const prior = candles.slice(-(lookback + 5), -5)
  const avgRecent = recent5.reduce((a, c) => a + (c.volume || 0), 0) / 5
  const avgPrior = prior.reduce((a, c) => a + (c.volume || 0), 0) / prior.length
  const ratio = avgPrior > 0 ? avgRecent / avgPrior : 1
  const trend = ratio > 1.3 ? 'rising' : ratio < 0.7 ? 'declining' : 'flat'
  return { ratio: r(ratio, 2), trend, avgRecent: Math.round(avgRecent), avgPrior: Math.round(avgPrior) }
}

function calcATRPercentile(candles, period = 14) {
  if (candles.length < period + 60) return 50
  const atrValues = []
  for (let end = period + 1; end <= candles.length; end++) {
    const slice = candles.slice(end - period - 1, end)
    let atr = 0
    for (let i = 1; i < slice.length; i++) {
      atr += Math.max(slice[i].high - slice[i].low, Math.abs(slice[i].high - slice[i-1].close), Math.abs(slice[i].low - slice[i-1].close))
    }
    atrValues.push(atr / period)
  }
  const currentATR = atrValues[atrValues.length - 1]
  const sorted = [...atrValues].sort((a, b) => a - b)
  const rank = sorted.findIndex(v => v >= currentATR)
  return Math.round((rank / sorted.length) * 100)
}

// ============================================================
// NEW: ADX — Average Directional Index (trend strength 0-100)
// ADX > 25 = trending, < 20 = range-bound
// ============================================================
function calcADX(candles, period = 14) {
  if (candles.length < period * 2 + 1) return { adx: 20, plusDI: 0, minusDI: 0 }

  let smoothPlusDM = 0, smoothMinusDM = 0, smoothTR = 0
  // First period calculation
  for (let i = 1; i <= period; i++) {
    const upMove = candles[i].high - candles[i-1].high
    const downMove = candles[i-1].low - candles[i].low
    smoothPlusDM += (upMove > downMove && upMove > 0) ? upMove : 0
    smoothMinusDM += (downMove > upMove && downMove > 0) ? downMove : 0
    smoothTR += Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i-1].close),
      Math.abs(candles[i].low - candles[i-1].close)
    )
  }

  const dxValues = []
  for (let i = period + 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i-1].high
    const downMove = candles[i-1].low - candles[i].low
    const plusDM = (upMove > downMove && upMove > 0) ? upMove : 0
    const minusDM = (downMove > upMove && downMove > 0) ? downMove : 0
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i-1].close),
      Math.abs(candles[i].low - candles[i-1].close)
    )

    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDM
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM
    smoothTR = smoothTR - (smoothTR / period) + tr

    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0
    const diSum = plusDI + minusDI
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0
    dxValues.push({ dx, plusDI, minusDI })
  }

  if (dxValues.length < period) return { adx: 20, plusDI: 0, minusDI: 0 }

  // Smooth ADX
  let adx = 0
  for (let i = 0; i < period; i++) adx += dxValues[i].dx
  adx /= period
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i].dx) / period
  }

  const last = dxValues[dxValues.length - 1]
  return { adx: r(adx, 1), plusDI: r(last.plusDI, 1), minusDI: r(last.minusDI, 1) }
}

// ============================================================
// NEW: Hurst Exponent — regime detection
// H > 0.55 = trending, H < 0.45 = mean-reverting, 0.45-0.55 = random walk
// Uses Rescaled Range (R/S) analysis
// ============================================================
function calcHurst(closes, maxWindow = 100) {
  const n = Math.min(closes.length, maxWindow)
  if (n < 20) return 0.5

  const series = closes.slice(-n)
  const returns = []
  for (let i = 1; i < series.length; i++) {
    returns.push(Math.log(series[i] / series[i-1]))
  }

  const scales = []
  const rsValues = []

  // Use multiple sub-period lengths
  for (let scale = 4; scale <= Math.floor(returns.length / 2); scale = Math.floor(scale * 1.5)) {
    const numBlocks = Math.floor(returns.length / scale)
    if (numBlocks < 1) continue

    let rsSum = 0
    let validBlocks = 0

    for (let b = 0; b < numBlocks; b++) {
      const block = returns.slice(b * scale, (b + 1) * scale)
      const mean = block.reduce((a, v) => a + v, 0) / block.length
      const std = Math.sqrt(block.reduce((a, v) => a + (v - mean) ** 2, 0) / block.length)

      if (std < 1e-10) continue

      // Cumulative deviation from mean
      let cumDev = 0, maxCum = -Infinity, minCum = Infinity
      for (const val of block) {
        cumDev += val - mean
        maxCum = Math.max(maxCum, cumDev)
        minCum = Math.min(minCum, cumDev)
      }

      const range = maxCum - minCum
      rsSum += range / std
      validBlocks++
    }

    if (validBlocks > 0) {
      scales.push(Math.log(scale))
      rsValues.push(Math.log(rsSum / validBlocks))
    }
  }

  if (scales.length < 3) return 0.5

  // Linear regression: log(R/S) = H * log(n) + c
  const n2 = scales.length
  const sumX = scales.reduce((a, v) => a + v, 0)
  const sumY = rsValues.reduce((a, v) => a + v, 0)
  const sumXY = scales.reduce((a, v, i) => a + v * rsValues[i], 0)
  const sumX2 = scales.reduce((a, v) => a + v * v, 0)

  const H = (n2 * sumXY - sumX * sumY) / (n2 * sumX2 - sumX * sumX)
  return Math.max(0.01, Math.min(0.99, r(H, 3)))
}

// ============================================================
// NEW: Market Regime — broad market context from SPY/QQQ data
// This determines whether to bias long, short, or neutral
// ============================================================
function determineMarketRegime(spyCandles) {
  if (!spyCandles || spyCandles.length < 50) return { regime: 'neutral', strength: 0, trend: 'flat' }

  const closes = spyCandles.map(c => c.close)
  const price = closes[closes.length - 1]
  const ma20 = calcSMA(closes, 20) || price
  const ma50 = calcSMA(closes, 50) || price
  const ma200 = calcSMA(closes, 200) || price
  const rsi = calcRSI(closes) || 50
  const adx = calcADX(spyCandles)
  const hurst = calcHurst(closes)

  // 5-day return
  const ret5d = closes.length >= 6 ? (price - closes[closes.length - 6]) / closes[closes.length - 6] : 0
  // 20-day return
  const ret20d = closes.length >= 21 ? (price - closes[closes.length - 21]) / closes[closes.length - 21] : 0

  let score = 0

  // Price position relative to MAs (heavily weighted)
  if (price > ma20 && price > ma50 && price > ma200) score += 3
  else if (price > ma50 && price > ma200) score += 2
  else if (price > ma200) score += 1
  else if (price < ma20 && price < ma50 && price < ma200) score -= 3
  else if (price < ma50 && price < ma200) score -= 2
  else if (price < ma200) score -= 1

  // MA alignment (golden/death cross)
  if (ma20 > ma50 && ma50 > ma200) score += 2
  else if (ma20 < ma50 && ma50 < ma200) score -= 2

  // Momentum
  if (ret5d > 0.02) score += 1
  else if (ret5d < -0.02) score -= 1
  if (ret20d > 0.05) score += 1
  else if (ret20d < -0.05) score -= 1

  // ADX confirms trend strength
  const trendStrong = adx.adx > 25

  let regime, trend
  if (score >= 4) { regime = 'strong-bull'; trend = 'bullish' }
  else if (score >= 2) { regime = 'bull'; trend = 'bullish' }
  else if (score >= 1) { regime = 'lean-bull'; trend = 'bullish' }
  else if (score <= -4) { regime = 'strong-bear'; trend = 'bearish' }
  else if (score <= -2) { regime = 'bear'; trend = 'bearish' }
  else if (score <= -1) { regime = 'lean-bear'; trend = 'bearish' }
  else { regime = 'neutral'; trend = 'flat' }

  return {
    regime,
    trend,
    score,
    strength: Math.abs(score),
    adx: adx.adx,
    hurst,
    trendStrong,
    rsi: r(rsi, 1),
    ret5d: r(ret5d * 100, 2),
    ret20d: r(ret20d * 100, 2),
    priceVsMa200: r(((price / ma200) - 1) * 100, 2),
  }
}

function findSR(candles, lookback = 60) {
  const recent = candles.slice(-lookback)
  const price = recent[recent.length - 1].close
  const atr = calcATR(recent) || price * 0.02
  const threshold = atr * 0.5

  const levels = []
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].high > recent[i-1].high && recent[i].high > recent[i+1].high && recent[i].high > recent[i-2].high && recent[i].high > recent[i+2].high) {
      levels.push({ price: recent[i].high, type: 'high' })
    }
    if (recent[i].low < recent[i-1].low && recent[i].low < recent[i+1].low && recent[i].low < recent[i-2].low && recent[i].low < recent[i+2].low) {
      levels.push({ price: recent[i].low, type: 'low' })
    }
  }

  levels.sort((a, b) => a.price - b.price)
  const clusters = []
  for (const l of levels) {
    const existing = clusters.find(c => Math.abs(c.price - l.price) < threshold)
    if (existing) { existing.price = (existing.price + l.price) / 2; existing.count++ }
    else clusters.push({ price: l.price, count: 1 })
  }

  clusters.sort((a, b) => b.count - a.count)
  const support = clusters.filter(c => c.price < price).sort((a, b) => b.price - a.price).slice(0, 3).map(c => c.price)
  const resistance = clusters.filter(c => c.price > price).sort((a, b) => a.price - b.price).slice(0, 3).map(c => c.price)

  const h = Math.max(...recent.slice(-5).map(c => c.high))
  const l = Math.min(...recent.slice(-5).map(c => c.low))
  const pp = (h + l + price) / 3

  return { support, resistance, pivotPoints: { pp: r(pp), r1: r(2*pp - l), r2: r(pp + h - l), s1: r(2*pp - h), s2: r(pp - h + l) } }
}

function r(v, d = 2) { return v != null ? Math.round(v * 10**d) / 10**d : null }
function fmt(v) { if (v == null) return '\u2014'; return Math.abs(v) < 10 ? v.toFixed(4) : v.toFixed(2) }

// ============================================================
// CORE: Generate signal for a single symbol
// Now regime-aware, trend-following dominant, with institutional filters
// ============================================================
function generateSignal(candles, symbol, assetType, name, marketRegime, smartMoney) {
  if (candles.length < 50) return null
  const closes = candles.map(c => c.close)
  const price = closes[closes.length - 1]
  const rsi = calcRSI(closes) || 50
  const atr = calcATR(candles) || price * 0.02
  const ma20 = calcSMA(closes, 20) || price
  const ma50 = calcSMA(closes, 50) || price
  const ma200 = calcSMA(closes, 200) || price
  const ema9 = calcEMA(closes, 9) || price
  const ema21 = calcEMA(closes, 21) || price
  const macd = calcMACD(closes)
  const bb = calcBollingerBands(closes)
  const vol = analyzeVolume(candles)
  const atrPctile = calcATRPercentile(candles)
  const adx = calcADX(candles)
  const hurst = calcHurst(closes)
  const sr = findSR(candles)
  const { support, resistance } = sr

  // Is forex?
  const isForex = assetType === 'forex'

  // ================================================================
  // STEP 1: Determine the ASSET's own trend (not just indicators)
  // This is what AutoPilot gets right — pure price action first
  // ================================================================

  // Price action trend: higher highs + higher lows = uptrend
  const recent20 = candles.slice(-20)
  const recent10 = candles.slice(-10)
  const highsRising = recent10.every((c, i) => i === 0 || c.high >= recent10[i-1].high * 0.995)
  const lowsRising = recent10.every((c, i) => i === 0 || c.low >= recent10[i-1].low * 0.995)
  const highsFalling = recent10.every((c, i) => i === 0 || c.high <= recent10[i-1].high * 1.005)
  const lowsFalling = recent10.every((c, i) => i === 0 || c.low <= recent10[i-1].low * 1.005)

  const priceActionUp = highsRising && lowsRising
  const priceActionDown = highsFalling && lowsFalling

  // Multi-timeframe return analysis
  const ret1d = closes.length >= 2 ? (price - closes[closes.length - 2]) / closes[closes.length - 2] : 0
  const ret5d = closes.length >= 6 ? (price - closes[closes.length - 6]) / closes[closes.length - 6] : 0
  const ret20d = closes.length >= 21 ? (price - closes[closes.length - 21]) / closes[closes.length - 21] : 0
  const ret60d = closes.length >= 61 ? (price - closes[closes.length - 61]) / closes[closes.length - 61] : 0

  // ================================================================
  // STEP 2: Regime-aware scoring
  // In trending markets (Hurst > 0.55, ADX > 25): FOLLOW THE TREND
  // In mean-reverting markets (Hurst < 0.45): fade extremes
  // ================================================================

  const isTrending = hurst > 0.52 && adx.adx > 22
  const isStrongTrend = hurst > 0.58 && adx.adx > 30
  const isMeanReverting = hurst < 0.45 && adx.adx < 20

  let dirScore = 0
  const factors = {}

  // ---- TIER 1: Trend direction (HEAVIEST WEIGHT) ----
  // These factors determine which side of the market we're on

  // Factor 1: Market regime alignment (NEW — most important factor)
  if (!isForex && marketRegime) {
    const regimeWeight = marketRegime.strength >= 4 ? 3.0 : marketRegime.strength >= 2 ? 2.0 : 1.0
    if (marketRegime.trend === 'bullish') { dirScore += regimeWeight; factors.marketRegime = regimeWeight }
    else if (marketRegime.trend === 'bearish') { dirScore -= regimeWeight; factors.marketRegime = -regimeWeight }
    else { factors.marketRegime = 0 }
  } else { factors.marketRegime = 0 }

  // Factor 2: Price vs MAs — stacked alignment (2x weight in trending)
  const maWeight = isTrending ? 2.0 : 1.0
  if (price > ma20 && price > ma50 && price > ma200) { dirScore += 1.5 * maWeight; factors.maStack = 1.5 * maWeight }
  else if (price > ma50 && price > ma200) { dirScore += 1.0 * maWeight; factors.maStack = 1.0 * maWeight }
  else if (price > ma200) { dirScore += 0.5 * maWeight; factors.maStack = 0.5 * maWeight }
  else if (price < ma20 && price < ma50 && price < ma200) { dirScore -= 1.5 * maWeight; factors.maStack = -1.5 * maWeight }
  else if (price < ma50 && price < ma200) { dirScore -= 1.0 * maWeight; factors.maStack = -1.0 * maWeight }
  else if (price < ma200) { dirScore -= 0.5 * maWeight; factors.maStack = -0.5 * maWeight }
  else { factors.maStack = 0 }

  // Factor 3: EMA crossover (short-term momentum)
  if (ema9 > ema21) { dirScore += 1.0; factors.emaCross = 1.0 }
  else { dirScore -= 1.0; factors.emaCross = -1.0 }

  // Factor 4: ADX directional index (+DI vs -DI tells you WHO is winning)
  if (adx.adx > 20) {
    if (adx.plusDI > adx.minusDI) { dirScore += 1.5; factors.adxDir = 1.5 }
    else { dirScore -= 1.5; factors.adxDir = -1.5 }
  } else { factors.adxDir = 0 }

  // Factor 5: Multi-timeframe momentum (the trend is your friend)
  let mtfScore = 0
  if (ret5d > 0.01) mtfScore += 0.5
  else if (ret5d < -0.01) mtfScore -= 0.5
  if (ret20d > 0.03) mtfScore += 0.5
  else if (ret20d < -0.03) mtfScore -= 0.5
  if (ret60d > 0.08) mtfScore += 0.5
  else if (ret60d < -0.08) mtfScore -= 0.5
  dirScore += mtfScore; factors.mtfMomentum = r(mtfScore, 2)

  // ---- TIER 2: Confirmation signals (moderate weight) ----

  // Factor 6: MACD — but context-dependent
  if (macd) {
    if (isTrending) {
      // In trends, MACD histogram EXPANDING with trend = strong signal
      if (macd.histogram > 0 && macd.histTrend === 'expanding') { dirScore += 1.0; factors.macd = 1.0 }
      else if (macd.histogram < 0 && macd.histTrend === 'expanding') { dirScore -= 1.0; factors.macd = -1.0 }
      else if (macd.histogram > 0) { dirScore += 0.5; factors.macd = 0.5 }
      else if (macd.histogram < 0) { dirScore -= 0.5; factors.macd = -0.5 }
      else { factors.macd = 0 }
    } else {
      // In range-bound, MACD crossovers matter more
      if (macd.histogram > 0) { dirScore += 0.75; factors.macd = 0.75 }
      else if (macd.histogram < 0) { dirScore -= 0.75; factors.macd = -0.75 }
      else { factors.macd = 0 }
    }
  } else { factors.macd = 0 }

  // Factor 7: RSI — CONTEXT-DEPENDENT (this was the biggest flaw)
  // In trending markets: RSI 50-70 = bullish momentum, NOT overbought
  // Only use extreme RSI (>80/<20) for actual mean reversion signals
  if (isTrending || isStrongTrend) {
    // Trending: RSI confirms direction, extremes only at 80/20
    if (rsi > 80) { dirScore -= 0.5; factors.rsi = -0.5 } // genuinely overbought
    else if (rsi > 55) { dirScore += 0.5; factors.rsi = 0.5 } // healthy bullish momentum
    else if (rsi < 20) { dirScore += 0.5; factors.rsi = 0.5 } // genuinely oversold
    else if (rsi < 45) { dirScore -= 0.5; factors.rsi = -0.5 } // bearish momentum
    else { factors.rsi = 0 }
  } else if (isMeanReverting) {
    // Mean-reverting: RSI extremes are actionable
    if (rsi < 25) { dirScore += 1.5; factors.rsi = 1.5 }
    else if (rsi < 35) { dirScore += 0.75; factors.rsi = 0.75 }
    else if (rsi > 75) { dirScore -= 1.5; factors.rsi = -1.5 }
    else if (rsi > 65) { dirScore -= 0.75; factors.rsi = -0.75 }
    else { factors.rsi = 0 }
  } else {
    // Neutral: moderate RSI sensitivity
    if (rsi < 30) { dirScore += 1.0; factors.rsi = 1.0 }
    else if (rsi > 70) { dirScore -= 1.0; factors.rsi = -1.0 }
    else if (rsi < 40) { dirScore += 0.25; factors.rsi = 0.25 }
    else if (rsi > 60) { dirScore -= 0.25; factors.rsi = -0.25 }
    else { factors.rsi = 0 }
  }

  // Factor 8: Volume confirmation
  if (vol.trend === 'rising' && ret5d > 0) { dirScore += 0.75; factors.volume = 0.75 }
  else if (vol.trend === 'rising' && ret5d < 0) { dirScore -= 0.75; factors.volume = -0.75 }
  else if (vol.trend === 'declining') {
    if (ret5d > 0.02) { dirScore -= 0.25; factors.volume = -0.25 }
    else if (ret5d < -0.02) { dirScore += 0.25; factors.volume = 0.25 }
    else { factors.volume = 0 }
  } else { factors.volume = 0 }

  // Factor 9: Bollinger Band position (only in mean-reverting regime)
  if (bb) {
    const bbPos = (price - bb.lower) / (bb.upper - bb.lower)
    if (isMeanReverting) {
      if (bbPos > 0.95) { dirScore -= 1.0; factors.bollinger = -1.0 }
      else if (bbPos < 0.05) { dirScore += 1.0; factors.bollinger = 1.0 }
      else { factors.bollinger = 0 }
    } else {
      // In trends, BB breakouts confirm direction
      if (bbPos > 0.95 && ret5d > 0.02) { dirScore += 0.5; factors.bollinger = 0.5 } // bullish breakout
      else if (bbPos < 0.05 && ret5d < -0.02) { dirScore -= 0.5; factors.bollinger = -0.5 } // bearish breakdown
      else { factors.bollinger = 0 }
    }
  } else { factors.bollinger = 0 }

  // Factor 10: Support/Resistance proximity
  const nearestSupport = support.length > 0 ? support[0] : null
  const nearestResist = resistance.length > 0 ? resistance[0] : null
  if (nearestSupport && nearestResist) {
    const distToSupport = (price - nearestSupport) / price
    const distToResist = (nearestResist - price) / price
    if (distToResist > distToSupport * 2) { dirScore += 0.5; factors.srRatio = 0.5 }
    else if (distToSupport > distToResist * 2) { dirScore -= 0.5; factors.srRatio = -0.5 }
    else { factors.srRatio = 0 }
  } else { factors.srRatio = 0 }

  // ================================================================
  // STEP 3: REGIME GATE — the key innovation
  // In a strong bull market, DO NOT SHORT unless extreme conditions
  // In a strong bear market, DO NOT GO LONG unless extreme conditions
  // ================================================================

  let regimeOverride = null
  if (!isForex && marketRegime) {
    if (marketRegime.regime === 'strong-bull' || marketRegime.regime === 'bull') {
      // In bull markets: only allow shorts if dirScore is VERY negative AND RSI > 80
      if (dirScore < 0 && !(rsi > 80 && adx.adx > 30 && ret5d < -0.03)) {
        // Force to long or skip — don't short into a bull market
        if (dirScore > -2) {
          dirScore = Math.abs(dirScore) * 0.5 // flip to weak long
          regimeOverride = 'forced-long-bull-regime'
        } else {
          // Very bearish individual signal in bull market = skip entirely
          return null
        }
      }
    } else if (marketRegime.regime === 'strong-bear' || marketRegime.regime === 'bear') {
      // In bear markets: only allow longs if dirScore is VERY positive AND RSI < 20
      if (dirScore > 0 && !(rsi < 20 && adx.adx > 30 && ret5d > 0.03)) {
        if (dirScore < 2) {
          dirScore = -Math.abs(dirScore) * 0.5
          regimeOverride = 'forced-short-bear-regime'
        } else {
          return null
        }
      }
    }
  }

  // ================================================================
  // STEP 4: Strategy classification
  // ================================================================
  let strategy
  if (isMeanReverting && (rsi < 25 || rsi > 75) && bb) {
    strategy = 'mean-reversion'
  } else if (isStrongTrend && adx.adx > 30) {
    strategy = 'momentum'
  } else if (isTrending && adx.adx > 22) {
    strategy = 'momentum'
  } else if (atr / price < 0.012) {
    strategy = 'carry'
  } else {
    strategy = 'breakout'
  }

  // ================================================================
  // STEP 5: Direction from composite score
  // ================================================================
  let direction
  if (strategy === 'mean-reversion') {
    if (rsi < 30 && bb && price <= bb.lower) direction = 'long'
    else if (rsi > 70 && bb && price >= bb.upper) direction = 'short'
    else direction = dirScore >= 0 ? 'long' : 'short'
  } else {
    direction = dirScore >= 0 ? 'long' : 'short'
  }

  // ================================================================
  // STEP 6: Confidence scoring — now regime-adjusted
  // ================================================================
  const dirSign = direction === 'long' ? 1 : -1
  const factorValues = Object.values(factors)
  const agreeingFactors = factorValues.filter(f => (f * dirSign) > 0).length
  const totalFactors = factorValues.filter(f => f !== 0).length
  const agreementRatio = totalFactors > 0 ? agreeingFactors / totalFactors : 0.5

  let confidence = 35 + Math.round(agreementRatio * 35)

  const absScore = Math.abs(dirScore)
  if (absScore >= 8) confidence += 20
  else if (absScore >= 6) confidence += 15
  else if (absScore >= 4) confidence += 10
  else if (absScore >= 2) confidence += 5

  // REGIME BONUS: trading with the market regime = higher confidence
  if (!isForex && marketRegime) {
    if ((marketRegime.trend === 'bullish' && direction === 'long') ||
        (marketRegime.trend === 'bearish' && direction === 'short')) {
      confidence += 10 // aligned with broad market
    } else if (marketRegime.trend !== 'flat') {
      confidence -= 12 // fighting the market
    }
  }

  // ADX bonus: strong trend + aligned direction
  if (adx.adx > 30 && ((adx.plusDI > adx.minusDI && direction === 'long') || (adx.minusDI > adx.plusDI && direction === 'short'))) {
    confidence += 8
  }

  // Hurst bonus: trending regime + momentum strategy
  if (hurst > 0.55 && strategy === 'momentum') confidence += 5
  if (hurst < 0.45 && strategy === 'mean-reversion') confidence += 5

  // Price action confirmation
  if ((priceActionUp && direction === 'long') || (priceActionDown && direction === 'short')) {
    confidence += 7
  }

  // Clean MA stacking
  if ((ma20 > ma50 && ma50 > ma200 && direction === 'long') || (ma20 < ma50 && ma50 < ma200 && direction === 'short')) {
    confidence += 8
  }

  // Penalties
  const conflicting = factorValues.filter(f => (f * dirSign) < 0).length
  if (conflicting >= 4) confidence -= 12
  else if (conflicting >= 3) confidence -= 8
  else if (conflicting >= 2) confidence -= 4

  if (atrPctile > 80) confidence -= 8
  else if (atrPctile > 60) confidence -= 3

  if (vol.trend === 'declining') confidence -= 5
  else if (vol.ratio > 1.5) confidence += 3

  if (bb && bb.bandwidth < 0.03) confidence -= 6

  if (regimeOverride) confidence -= 10 // forced direction = lower conviction

  // ================================================================
  // SMART MONEY v4 DEEP INTEGRATION — granular institutional analysis
  // Uses C-suite buying, cluster signals, fund consensus, deal flow,
  // congressional bipartisan signals, STOCK Act violations, and more
  // to boost/penalize confidence and adjust directional scoring
  // ================================================================
  let smartMoneySignal = null
  let smBreakdown = { insider: null, hedgeFund: null, dealFlow: null, congress: null }
  if (smartMoney) {
    const sm = smartMoney.influence || {}
    const ins = smartMoney.insider?.summary || {}
    const hf = smartMoney.hedgeFund?.summary || {}
    const deal = smartMoney.pe?.summary || {}
    const cong = smartMoney.congress?.summary || {}

    smartMoneySignal = {
      composite: sm.composite || 0,
      direction: sm.direction || 'neutral',
      confidence: sm.confidence || 0,
      dominant: sm.dominant || null,
    }

    let smDirScore = 0
    let smConfBoost = 0
    const smReasons = []

    // ---- INSIDER SIGNALS (highest alpha — C-suite open-market buys are gold) ----
    if (ins.totalTrades > 0) {
      // C-Suite buying: strongest insider signal (+3 to +5 confidence)
      if (ins.cSuiteBuying && !ins.cSuiteSelling) {
        smDirScore += 2.0; smConfBoost += 5
        smReasons.push('C-suite executive buying')
      } else if (ins.cSuiteSelling && !ins.cSuiteBuying) {
        smDirScore -= 1.5; smConfBoost -= 3
        smReasons.push('C-suite executive selling')
      }

      // Cluster signals (3+ unique insiders acting together = very significant)
      if (ins.clusterBuy && !ins.clusterSell) {
        smDirScore += 1.5; smConfBoost += 4
        smReasons.push(`insider cluster buy (${ins.uniqueInsiders} insiders)`)
      } else if (ins.clusterSell && !ins.clusterBuy) {
        smDirScore -= 1.5; smConfBoost -= 4
        smReasons.push('insider cluster sell')
      }

      // Open-market trades (most meaningful — excludes exercises/awards)
      if (ins.openMarketBuys > 0 && ins.openMarketSells === 0) {
        smDirScore += 1.0; smConfBoost += 3
        smReasons.push(`${ins.openMarketBuys} open-market buys, 0 sells`)
      } else if (ins.openMarketSells > ins.openMarketBuys * 3) {
        smDirScore -= 1.0; smConfBoost -= 2
        smReasons.push('heavy open-market selling')
      }

      // Ownership % change — large increases are very bullish
      if (ins.maxOwnershipChange > 20) {
        smDirScore += 0.5
        smReasons.push(`${ins.maxOwnershipChange}% ownership increase`)
      }

      // Strong insider signal direction
      if (ins.signalDirection === 'strong-bullish') { smDirScore += 1.0; smConfBoost += 3 }
      else if (ins.signalDirection === 'strong-bearish') { smDirScore -= 1.0; smConfBoost -= 3 }
    }
    smBreakdown.insider = { score: r(smDirScore, 1), reasons: [...smReasons] }

    // ---- HEDGE FUND 13F SIGNALS ----
    const hfScore0 = smDirScore
    if (hf.totalHolders > 0) {
      // Fund consensus — multiple notable funds holding = bullish
      if (hf.fundConsensus >= 5) { smDirScore += 1.5; smConfBoost += 4; smReasons.push(`${hf.fundConsensus} notable funds holding`) }
      else if (hf.fundConsensus >= 3) { smDirScore += 0.75; smConfBoost += 2; smReasons.push(`${hf.fundConsensus} notable funds holding`) }

      // Net flow signal
      if (hf.netFlow === 'accumulating') { smDirScore += 0.5; smReasons.push('institutional accumulation') }
      else if (hf.netFlow === 'distributing') { smDirScore -= 0.5; smReasons.push('institutional distribution') }

      // Activist fund styles present = potential catalyst
      if ((hf.notableStyles || []).includes('activist')) {
        smDirScore += 0.5; smReasons.push('activist fund involvement')
      }
    }
    smBreakdown.hedgeFund = { score: r(smDirScore - hfScore0, 1), reasons: smReasons.slice(smBreakdown.insider?.reasons?.length || 0) }

    // ---- DEAL FLOW / M&A SIGNALS ----
    const dfScore0 = smDirScore
    if (deal.totalMoves > 0) {
      // Activist 13D stakes are strongly directional
      if (deal.activistStakes > 0) {
        smDirScore += 1.5; smConfBoost += 4
        smReasons.push(`${deal.activistStakes} activist 13D stake(s)`)
      }
      // Known activist involvement
      if ((deal.knownActivists || []).length > 0) {
        smDirScore += 1.0; smConfBoost += 3
        smReasons.push(`known activist: ${deal.knownActivists[0]}`)
      }
      // M&A activity = potential upside catalyst
      if (deal.mnaActivity > 2) {
        smDirScore += 0.75; smReasons.push(`${deal.mnaActivity} M&A filings`)
      }
    }
    smBreakdown.dealFlow = { score: r(smDirScore - dfScore0, 1) }

    // ---- CONGRESSIONAL SIGNALS ----
    const cgScore0 = smDirScore
    if (cong.totalTrades > 0) {
      // Bipartisan buying = very strong signal (both parties agree)
      if (cong.bipartisan && cong.buys > cong.sells) {
        smDirScore += 2.0; smConfBoost += 6
        smReasons.push('bipartisan congressional buying')
      } else if (cong.buys > cong.sells * 2) {
        smDirScore += 1.0; smConfBoost += 3
        smReasons.push(`congressional net buying (${cong.buys}B/${cong.sells}S)`)
      } else if (cong.sells > cong.buys * 2) {
        smDirScore -= 1.0; smConfBoost -= 3
        smReasons.push('congressional net selling')
      }

      // STOCK Act violations = insider foreknowledge signal (controversial but high-alpha)
      if (cong.stockActViolations > 0 && cong.buys > cong.sells) {
        smDirScore += 0.5; smConfBoost += 2
        smReasons.push(`${cong.stockActViolations} late disclosure(s) — possible foreknowledge`)
      }
    }
    smBreakdown.congress = { score: r(smDirScore - cgScore0, 1) }

    // ---- AGGREGATE: Apply Smart Money to signal ----
    // Alignment check: does SM agree with our technical direction?
    const smDirection = smDirScore > 1 ? 'bullish' : smDirScore < -1 ? 'bearish' : 'neutral'
    const smAligned = (smDirection === 'bullish' && direction === 'long') || (smDirection === 'bearish' && direction === 'short')
    const smConflict = (smDirection === 'bullish' && direction === 'short') || (smDirection === 'bearish' && direction === 'long')

    if (smAligned) {
      confidence += Math.min(15, smConfBoost)
      dirScore += Math.min(3, Math.abs(smDirScore) * 0.5)
      factors.smartMoney = r(Math.min(3, smDirScore * 0.5), 1)
    } else if (smConflict) {
      confidence -= Math.min(12, Math.abs(smConfBoost))
      dirScore -= Math.min(2, Math.abs(smDirScore) * 0.3)
      factors.smartMoney = r(-Math.min(2, Math.abs(smDirScore) * 0.3), 1)
    } else {
      // Neutral SM — slight composite-based adjustment
      if (sm.composite > 20) { dirScore += 0.5; factors.smartMoney = 0.5 }
      else if (sm.composite < -20) { dirScore -= 0.5; factors.smartMoney = -0.5 }
      else { factors.smartMoney = 0 }
    }

    smartMoneySignal.breakdown = smBreakdown
    smartMoneySignal.smReasons = smReasons
    smartMoneySignal.smDirScore = r(smDirScore, 1)
    smartMoneySignal.aligned = smAligned
    smartMoneySignal.conflict = smConflict
  }

  // ================================================================
  // ALPHA FACTOR LIBRARY — WorldQuant-inspired formulaic alphas
  // ================================================================
  let alphaFactorData = null
  try {
    if (candles.length >= 60) {
      alphaFactorData = computeAlphaFactors(candles, closes)
      // Alpha composite alignment bonus
      if (alphaFactorData && alphaFactorData.composite != null) {
        const alphaAligned = (alphaFactorData.composite > 20 && direction === 'long') ||
                             (alphaFactorData.composite < -20 && direction === 'short')
        const alphaConflict = (alphaFactorData.composite > 20 && direction === 'short') ||
                              (alphaFactorData.composite < -20 && direction === 'long')
        if (alphaAligned) confidence += 6
        else if (alphaConflict) confidence -= 6
      }
    }
  } catch (e) { /* alpha factors are non-critical */ }

  // ================================================================
  // HMM REGIME DETECTION — probabilistic state identification
  // ================================================================
  let regimeAnalysis = null
  try {
    regimeAnalysis = detectRegime(candles, closes, marketRegime || {})
    if (regimeAnalysis) {
      // Strategy-regime alignment bonus
      const regimeStrategy = regimeAnalysis.recommendedStrategy
      if (regimeStrategy === strategy) confidence += 5
      else if (regimeAnalysis.confidence > 0.7) confidence -= 4

      // High transition risk penalty
      if (regimeAnalysis.transitionRisk > 0.6) confidence -= 5
    }
  } catch (e) { /* regime detection is non-critical */ }

  // ================================================================
  // ENSEMBLE STRATEGY ENGINE — multi-strategy consensus scoring
  // ================================================================
  let ensembleData = null
  try {
    const strategyScores = {
      momentum: (strategy === 'momentum' ? 1 : 0) * (direction === 'long' ? 1 : -1) * (confidence / 100),
      meanReversion: (strategy === 'mean-reversion' ? 1 : 0) * (direction === 'long' ? 1 : -1) * (confidence / 100),
      breakout: (strategy === 'breakout' ? 1 : 0) * (direction === 'long' ? 1 : -1) * (confidence / 100),
      carry: (strategy === 'carry' ? 1 : 0) * (direction === 'long' ? 1 : -1) * (confidence / 100),
    }
    ensembleData = computeEnsemble(
      strategyScores,
      regimeAnalysis || { currentRegime: 'unknown', confidence: 0.5 },
      alphaFactorData || {}
    )
    if (ensembleData) {
      // Ensemble conflict detection penalty
      if (ensembleData.conflictDetected) confidence -= 6
      // Ensemble direction agreement bonus
      if (ensembleData.direction === direction && ensembleData.confidence > 0.65) confidence += 5
      else if (ensembleData.direction !== direction && ensembleData.confidence > 0.7) confidence -= 8
    }
  } catch (e) { /* ensemble is non-critical */ }

  // Clamp
  confidence = Math.max(25, Math.min(95, confidence))

  // ================================================================
  // MINIMUM CONFIDENCE GATE — don't take garbage trades
  // ================================================================
  const minConfidence = isForex ? 50 : 55
  if (confidence < minConfidence) return null

  // ================================================================
  // STEP 7: Entry, Target, Stop — with trailing stop logic
  // ================================================================

  // Entry zone
  let entryLow, entryHigh
  if (direction === 'long') {
    entryLow = r(Math.max(support[0] || price - atr * 1.5, price - atr * 0.75))
    entryHigh = r(price + atr * 0.25)
  } else {
    entryHigh = r(Math.min(resistance[0] || price + atr * 1.5, price + atr * 0.75))
    entryLow = r(price - atr * 0.25)
  }

  // Target — more conservative, based on ATR and regime
  let target
  const targetMultiplier = isStrongTrend ? 3.5 : isTrending ? 2.5 : 2.0
  if (direction === 'long') {
    target = resistance.length >= 1 ? r(Math.min(resistance[0] + atr * 1.0, price + atr * targetMultiplier)) : r(price + atr * targetMultiplier)
  } else {
    target = support.length >= 1 ? r(Math.max(support[0] - atr * 1.0, price - atr * targetMultiplier)) : r(price - atr * targetMultiplier)
  }

  // Stop loss — volatility-adjusted with tighter default
  const volMultiplier = atrPctile > 80 ? 1.5 : atrPctile > 60 ? 1.2 : 1.0
  let stopLoss
  if (direction === 'long') {
    stopLoss = support.length > 0 ? r(Math.max(support[0] - atr * 0.3 * volMultiplier, price - atr * 1.5 * volMultiplier)) : r(price - atr * 1.5 * volMultiplier)
  } else {
    stopLoss = resistance.length > 0 ? r(Math.min(resistance[0] + atr * 0.3 * volMultiplier, price + atr * 1.5 * volMultiplier)) : r(price + atr * 1.5 * volMultiplier)
  }

  // Sanity: ensure stop is on the right side
  if (direction === 'long' && stopLoss >= entryLow) stopLoss = r(entryLow - atr * 0.5)
  if (direction === 'short' && stopLoss <= entryHigh) stopLoss = r(entryHigh + atr * 0.5)

  // Risk
  const stopDist = (Math.abs(price - stopLoss) / price) * 100
  const risk = stopDist < 2 ? 'LOW' : stopDist > 4 ? 'HIGH' : 'MEDIUM'

  // Risk/reward
  const reward = Math.abs(target - price)
  const riskAmt = Math.abs(price - stopLoss)
  const rr = riskAmt > 0 ? reward / riskAmt : 1

  // R:R gate — don't take trades worse than 1.5:1
  if (rr < 1.5) {
    // Try to adjust target to get better R:R
    if (direction === 'long') { target = r(price + riskAmt * 2.0) }
    else { target = r(price - riskAmt * 2.0) }
    const newRR = riskAmt > 0 ? Math.abs(target - price) / riskAmt : 1
    if (newRR < 1.5) return null // still bad — skip
  }

  const finalRR = riskAmt > 0 ? Math.abs(target - price) / riskAmt : 1

  // Final R:R confidence adjustment
  if (finalRR >= 3) confidence += 5
  else if (finalRR >= 2) confidence += 2
  confidence = Math.max(25, Math.min(95, confidence))

  // ================================================================
  // POSITION SIZER — Kelly + ATR dynamic sizing
  // ================================================================
  let positionSizing = null
  try {
    positionSizing = computePositionSize({
      confidence: confidence / 100,
      atr,
      price,
      stopDistance: Math.abs(price - stopLoss),
      winRate: confidence > 70 ? 0.6 : confidence > 55 ? 0.52 : 0.48,
      avgWin: Math.abs(target - price),
      avgLoss: Math.abs(price - stopLoss),
      regime: regimeAnalysis ? regimeAnalysis.currentRegime : 'unknown',
      volatilityPercentile: atrPctile,
    })
  } catch (e) { /* position sizing is non-critical */ }

  // Trailing stop levels (NEW — AutoPilot-style)
  const trailingStop = {
    breakEvenAt: direction === 'long' ? r(price + atr * 0.8) : r(price - atr * 0.8),
    trail1At: direction === 'long' ? r(price + atr * 1.5) : r(price - atr * 1.5),
    trail1Stop: direction === 'long' ? r(price + atr * 0.5) : r(price - atr * 0.5),
    trail2At: direction === 'long' ? r(price + atr * 2.5) : r(price - atr * 2.5),
    trail2Stop: direction === 'long' ? r(price + atr * 1.5) : r(price - atr * 1.5),
  }

  // Timeframe
  const daysEst = Math.max(1, Math.round(Math.abs(target - price) / atr))
  const timeframe = daysEst <= 3 ? '1-3 days' : daysEst <= 7 ? '3-7 days' : daysEst <= 14 ? '5-14 days' : '10-21 days'

  // Timing
  const now = new Date()
  let entryHours = strategy === 'mean-reversion' ? 36 : strategy === 'momentum' ? 72 : strategy === 'carry' ? 96 : 48
  const atrPct = (atr / price) * 100
  if (atrPct > 3) entryHours *= 0.6
  else if (atrPct > 2) entryHours *= 0.8
  else if (atrPct < 1) entryHours *= 1.3
  if (confidence >= 70) entryHours *= 0.85
  else if (confidence < 50) entryHours *= 1.2
  entryHours = Math.max(8, Math.min(168, Math.round(entryHours)))

  let holdHours = daysEst * 24
  if (strategy === 'mean-reversion') holdHours = Math.max(48, Math.min(168, holdHours))
  else if (strategy === 'momentum') holdHours = Math.max(72, Math.min(240, holdHours))
  else holdHours = Math.max(48, Math.min(192, holdHours))

  const entryBy = new Date(now.getTime() + entryHours * 3600000).toISOString().slice(0, 16)
  const expiresAt = new Date(now.getTime() + (entryHours + holdHours) * 3600000).toISOString().slice(0, 16)

  // Entry window text
  const entryWindow = direction === 'long'
    ? `Enter on dips toward $${fmt(entryLow)}-$${fmt(entryHigh)}${support.length > 0 ? '; support at $' + fmt(support[0]) : ''}`
    : `Enter on rallies toward $${fmt(entryLow)}-$${fmt(entryHigh)}${resistance.length > 0 ? '; resistance at $' + fmt(resistance[0]) : ''}`

  // Thesis — now regime-aware
  const devFromMA = (Math.abs(price - ma50) / (atr || 1)).toFixed(1)
  const regimeStr = marketRegime ? ` Market regime: ${marketRegime.regime} (SPY ${marketRegime.ret5d > 0 ? '+' : ''}${marketRegime.ret5d}% 5d).` : ''
  let thesis
  if (strategy === 'mean-reversion') {
    thesis = `${name} (${symbol}) shows RSI at ${r(rsi, 1)} in ${rsi < 30 ? 'deeply oversold' : 'overbought'} territory. Hurst ${hurst} confirms mean-reverting regime. Price is ${devFromMA}x ATR from MA50 ($${fmt(ma50)}).${regimeStr} Volume ${vol.trend}${vol.ratio > 1.3 ? ' ('+vol.ratio+'x avg)' : ''}.`
  } else if (strategy === 'momentum') {
    thesis = `${name} (${symbol}) in confirmed ${direction === 'long' ? 'uptrend' : 'downtrend'}. ADX ${adx.adx} confirms trend strength, Hurst ${hurst} shows persistence. MAs stacked ${ma20 > ma50 ? 'bullish' : 'bearish'}: MA20 $${fmt(ma20)} ${ma20 > ma50 ? '>' : '<'} MA50 $${fmt(ma50)} ${ma50 > ma200 ? '>' : '<'} MA200 $${fmt(ma200)}.${regimeStr}`
  } else {
    thesis = `${name} (${symbol}) presents a ${direction === 'long' ? 'bullish' : 'bearish'} ${strategy} setup. Price at $${fmt(price)} near key ${direction === 'long' ? 'support' : 'resistance'}. ATR $${fmt(atr)} (${atrPctile}th percentile).${regimeStr}`
  }

  // Append Smart Money thesis when available
  if (smartMoneySignal?.smReasons?.length > 0) {
    const smLabel = smartMoneySignal.aligned ? 'Smart Money confirms' : smartMoneySignal.conflict ? 'Smart Money DISAGREES' : 'Smart Money signals'
    thesis += ` ${smLabel}: ${smartMoneySignal.smReasons.slice(0, 4).join('; ')}.`
  }

  // Catalyst
  const confLevel = confidence >= 75 ? 'high' : confidence >= 60 ? 'moderate' : 'low'
  const agreeParts = []
  if (factors.marketRegime && factors.marketRegime * dirSign > 0) agreeParts.push('market regime aligned')
  if (factors.maStack * dirSign > 0) agreeParts.push(`price ${direction === 'long' ? 'above' : 'below'} key MAs`)
  if (factors.adxDir * dirSign > 0) agreeParts.push(`ADX ${adx.adx} confirming`)
  if (factors.macd * dirSign > 0) agreeParts.push(`MACD ${direction === 'long' ? 'positive' : 'negative'}`)
  if (factors.emaCross * dirSign > 0) agreeParts.push('EMA9/21 aligned')
  if (factors.mtfMomentum * dirSign > 0) agreeParts.push('multi-TF momentum')
  if (factors.volume * dirSign > 0) agreeParts.push('volume confirming')

  // Smart Money reasons injected into catalyst
  if (smartMoneySignal?.smReasons?.length > 0) {
    agreeParts.push(...smartMoneySignal.smReasons.slice(0, 3))
  }

  let catalyst = `${confLevel[0].toUpperCase() + confLevel.slice(1)}-confidence (${confidence}%) \u2014 `
  if (regimeOverride) catalyst += `[${regimeOverride}] `
  if (agreeParts.length > 0) catalyst += `supported by ${agreeParts.join(', ')}. `
  else catalyst += `mixed signals. `
  catalyst += `R:R ${finalRR.toFixed(1)}:1. Hurst ${hurst}, ADX ${adx.adx}.`

  // Hold reason
  const holdReason = strategy === 'mean-reversion' ? 'Hold through initial volatility \u2014 mean reversion thesis needs time. Trail stop to break-even at +0.8 ATR.'
    : strategy === 'momentum' ? `Hold with trend \u2014 ADX ${adx.adx} confirms strength. Use trailing stops: break-even at +0.8 ATR, trail to +0.5 ATR at +1.5 ATR profit.`
    : 'Hold for breakout confirmation. Move stop to break-even once +0.8 ATR is reached.'

  // Historical context
  const recentH = candles.slice(-20)
  const highH = Math.max(...recentH.map(c => c.high))
  const lowL = Math.min(...recentH.map(c => c.low))
  const historicalContext = `Price at $${fmt(price)} within 20-day range $${fmt(lowL)}-$${fmt(highH)}. MA50 $${fmt(ma50)}, MA200 $${fmt(ma200)}. ATR $${fmt(atr)} (${((atr/price)*100).toFixed(1)}% daily vol). ADX ${adx.adx}, Hurst ${hurst}.`

  // Bond correlation & macro
  const bondCorrelation = direction === 'long'
    ? `Bullish setup correlates with risk-on sentiment. Monitor yields for confirmation.`
    : `Bearish setup suggests risk-off rotation. Bond rally would confirm thesis.`
  const globalMacro = marketRegime
    ? `Market regime: ${marketRegime.regime}. SPY 5d: ${marketRegime.ret5d > 0 ? '+' : ''}${marketRegime.ret5d}%, 20d: ${marketRegime.ret20d > 0 ? '+' : ''}${marketRegime.ret20d}%. ${direction === 'long' ? 'Risk appetite supports longs.' : 'Defensive positioning favors shorts.'}`
    : `${ma50 > ma200 ? 'Bullish' : 'Bearish'} macro regime.`

  // News drivers
  const newsDrivers = [
    `ADX at ${adx.adx} \u2014 ${adx.adx > 30 ? 'strong trend' : adx.adx > 20 ? 'moderate trend' : 'range-bound'}`,
    `Hurst ${hurst} \u2014 ${hurst > 0.55 ? 'trending regime' : hurst < 0.45 ? 'mean-reverting regime' : 'neutral regime'}`,
    `RSI at ${r(rsi, 1)} \u2014 ${rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral'}`,
    `MAs: ${price > ma50 ? 'above' : 'below'} MA50, ${ma50 > ma200 ? 'golden cross' : 'death cross'}`,
    `${strategy} strategy at ${confidence}% confidence`,
  ]

  // Technical levels
  const technicalLevels = {
    support: support.slice(0, 3).map(s => r(s)),
    resistance: resistance.slice(0, 3).map(x => r(x)),
    pivotPoints: sr.pivotPoints,
    movingAverages: { ma20: r(ma20), ma50: r(ma50), ma200: r(ma200), ema9: r(ema9), ema21: r(ema21) },
  }

  // Risk factors
  const riskFactors = [
    `Gap risk: Large move against position invalidates setup`,
    `Volatility: ATR at ${atrPctile}th percentile${atrPctile > 70 ? ' (elevated \u2014 wider stops active)' : ''}`,
    `Thesis invalidation at $${fmt(stopLoss)} \u2014 exit immediately if breached`,
    `Trailing stop: move to break-even at $${fmt(trailingStop.breakEvenAt)}`,
  ]

  return {
    id: `SIG-${symbol}-${Date.now()}`,
    ticker: symbol,
    name,
    asset: assetType,
    strategy,
    direction,
    entryLow, entryHigh, target, stopLoss,
    rsi: r(rsi, 1), risk, timeframe,
    entryBy, expiresAt, entryWindow,
    holdReason, thesis, catalyst,
    confidence,
    // New regime data
    adx: adx.adx,
    hurst,
    regimeOverride,
    smartMoneySignal,
    trailingStop,
    bollingerBands: bb ? { upper: r(bb.upper), lower: r(bb.lower), bandwidth: r(bb.bandwidth, 4) } : null,
    volumeProfile: vol,
    atrPercentile: atrPctile,
    volMultiplier,
    marketRegime: marketRegime ? { regime: marketRegime.regime, trend: marketRegime.trend } : null,
    // New engine layers
    alphaFactors: alphaFactorData,
    regimeAnalysis: regimeAnalysis ? {
      currentRegime: regimeAnalysis.currentRegime,
      confidence: r(regimeAnalysis.confidence, 3),
      regimeProbabilities: regimeAnalysis.regimeProbabilities,
      transitionRisk: r(regimeAnalysis.transitionRisk, 3),
      recommendedStrategy: regimeAnalysis.recommendedStrategy,
    } : null,
    ensemble: ensembleData ? {
      direction: ensembleData.direction,
      confidence: r(ensembleData.confidence, 3),
      weights: ensembleData.weights,
      conflictDetected: ensembleData.conflictDetected,
      dominantStrategy: ensembleData.dominantStrategy,
      ensembleScore: r(ensembleData.ensembleScore, 2),
    } : null,
    positionSizing,
    dataPacket: {
      historicalContext, bondCorrelation, globalMacro, newsDrivers,
      technicalLevels,
      sectorContext: `${direction === 'long' ? 'Bullish' : 'Bearish'} setup. ADX ${adx.adx}, Hurst ${hurst}. ${regimeAnalysis ? `HMM: ${regimeAnalysis.currentRegime} (${(regimeAnalysis.confidence * 100).toFixed(0)}%).` : ''} Monitor sector relative strength.`,
      riskFactors,
    },
  }
}

// Default watchlist
const WATCHLIST = {
  equities: [
    { symbol: 'MSFT', name: 'Microsoft Corp', asset: 'equity' },
    { symbol: 'AAPL', name: 'Apple Inc', asset: 'equity' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', asset: 'equity' },
    { symbol: 'AMZN', name: 'Amazon.com', asset: 'equity' },
    { symbol: 'GOOGL', name: 'Alphabet Inc', asset: 'equity' },
    { symbol: 'META', name: 'Meta Platforms', asset: 'equity' },
    { symbol: 'XOM', name: 'Exxon Mobil', asset: 'equity' },
    { symbol: 'RTX', name: 'RTX Corp (Raytheon)', asset: 'equity' },
    { symbol: 'CAT', name: 'Caterpillar Inc', asset: 'equity' },
    { symbol: 'LMT', name: 'Lockheed Martin', asset: 'equity' },
    { symbol: 'GC=F', name: 'Gold Futures', asset: 'commodity' },
    { symbol: 'CL=F', name: 'WTI Crude Oil Futures', asset: 'commodity' },
    { symbol: 'XLF', name: 'Financial Select SPDR', asset: 'equity' },
    { symbol: 'IWM', name: 'Russell 2000 ETF', asset: 'equity' },
    { symbol: 'HYG', name: 'High Yield Corp Bond', asset: 'equity' },
    { symbol: 'KRE', name: 'Regional Banking ETF', asset: 'equity' },
    { symbol: 'TSLA', name: 'Tesla Inc', asset: 'equity' },
    { symbol: 'COIN', name: 'Coinbase Global', asset: 'equity' },
    { symbol: 'ARKK', name: 'ARK Innovation ETF', asset: 'equity' },
    { symbol: 'MARA', name: 'Marathon Digital', asset: 'equity' },
    { symbol: 'XYZ', name: 'Block Inc', asset: 'equity' },
    { symbol: 'SNAP', name: 'Snap Inc', asset: 'equity' },
    { symbol: 'BTC-USD', name: 'Bitcoin', asset: 'crypto' },
    { symbol: 'RIOT', name: 'Riot Platforms', asset: 'equity' },
  ],
  forex: [
    { symbol: 'USDJPY', name: 'USD/JPY', asset: 'forex' },
    { symbol: 'EURUSD', name: 'EUR/USD', asset: 'forex' },
    { symbol: 'GBPUSD', name: 'GBP/USD', asset: 'forex' },
    { symbol: 'USDCHF', name: 'USD/CHF', asset: 'forex' },
    { symbol: 'AUDUSD', name: 'AUD/USD', asset: 'forex' },
    { symbol: 'USDMXN', name: 'USD/MXN', asset: 'forex' },
    { symbol: 'EURGBP', name: 'EUR/GBP', asset: 'forex' },
    { symbol: 'NZDUSD', name: 'NZD/USD', asset: 'forex' },
  ],
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'all'
  const singleSymbol = searchParams.get('symbol')

  try {
    // ================================================================
    // FIRST: Fetch SPY to determine broad market regime
    // This is the single most impactful change — knowing which way the market is going
    // ================================================================
    let marketRegime = null
    try {
      const { candles: spyCandles } = await fetchCandles('SPY', '6mo', '1d')
      if (spyCandles.length >= 50) {
        marketRegime = determineMarketRegime(spyCandles)
      }
    } catch (e) {
      // If SPY fetch fails, proceed without regime data
      console.error('SPY regime fetch failed:', e.message)
    }

    if (singleSymbol) {
      const name = searchParams.get('name') || singleSymbol
      const asset = searchParams.get('asset') || 'equity'
      // For single-symbol queries, fetch smart money, sentiment, and correlations in parallel
      const [{ candles }, smartMoneyRes, sentimentRes, correlationsRes] = await Promise.all([
        fetchCandles(singleSymbol, '6mo', '1d'),
        fetch(new URL(`/api/smartmoney?symbol=${singleSymbol}&mode=signal`, request.url))
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        analyzeSentiment(singleSymbol, asset === 'forex' ? 'forex' : undefined)
          .catch(() => null),
        computeCorrelations(singleSymbol, asset)
          .catch(() => null),
      ])
      const signal = generateSignal(candles, singleSymbol, asset, name, marketRegime, smartMoneyRes)
      // Attach sentiment and correlations to the signal (these are async, can't be inside generateSignal which is sync)
      if (signal) {
        signal.sentiment = sentimentRes
        signal.correlations = correlationsRes
        // Sentiment alignment bonus/penalty
        if (sentimentRes && sentimentRes.composite != null) {
          const sentAligned = (sentimentRes.composite > 25 && signal.direction === 'long') ||
                              (sentimentRes.composite < -25 && signal.direction === 'short')
          const sentConflict = (sentimentRes.composite > 25 && signal.direction === 'short') ||
                               (sentimentRes.composite < -25 && signal.direction === 'long')
          if (sentAligned) signal.confidence = Math.min(95, signal.confidence + 4)
          else if (sentConflict) signal.confidence = Math.max(25, signal.confidence - 4)
        }
        // Correlation-based risk flag
        if (correlationsRes && correlationsRes.diversificationScore != null) {
          signal.diversificationScore = r(correlationsRes.diversificationScore, 2)
          signal.beta = correlationsRes.beta != null ? r(correlationsRes.beta, 2) : null
        }
      }
      return NextResponse.json({ signals: signal ? [signal] : [], errors: [], marketRegime })
    }

    const signals = { long: [], short: [], forex: [] }
    const errors = []

    const lists = []
    if (category === 'all' || category === 'long' || category === 'short') {
      lists.push({ items: WATCHLIST.equities, isForex: false })
    }
    if (category === 'all' || category === 'forex') {
      lists.push({ items: WATCHLIST.forex, isForex: true })
    }

    for (const { items, isForex } of lists) {
      for (let batch = 0; batch < items.length; batch += 4) {
        const batchItems = items.slice(batch, batch + 4)
        const results = await Promise.allSettled(
          batchItems.map(async (item) => {
            const { candles } = await fetchCandles(item.symbol, '6mo', '1d')
            return generateSignal(candles, item.symbol, item.asset, item.name, marketRegime)
          })
        )
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'fulfilled' && results[j].value) {
            const sig = results[j].value
            if (isForex) {
              signals.forex.push(sig)
            } else {
              signals[sig.direction === 'long' ? 'long' : 'short'].push(sig)
            }
          } else if (results[j].status === 'rejected') {
            errors.push({ symbol: batchItems[j].symbol, error: results[j].reason?.message || 'Failed' })
          }
          // null signals (filtered out by confidence gate or regime gate) are silently skipped
        }
        if (batch + 4 < items.length) await new Promise(r => setTimeout(r, 200))
      }
    }

    // Sort by confidence descending — best signals first
    signals.long.sort((a, b) => b.confidence - a.confidence)
    signals.short.sort((a, b) => b.confidence - a.confidence)
    signals.forex.sort((a, b) => b.confidence - a.confidence)

    return NextResponse.json({ signals, errors, marketRegime, generatedAt: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: error.message, signals: { long: [], short: [], forex: [] } }, { status: 500 })
  }
}
