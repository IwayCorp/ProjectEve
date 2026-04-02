import { NextResponse } from 'next/server'

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

// --- Inline indicators for edge runtime ---

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
  const f = calcEMA(closes, 12), s = calcEMA(closes, 26)
  if (f == null || s == null) return null
  const macd = f - s
  // approximate signal line from recent macd values
  return { macd, histogram: macd * 0.7 } // simplified for edge
}

function findSR(candles, lookback = 60) {
  const recent = candles.slice(-lookback)
  const price = recent[recent.length - 1].close
  const atr = calcATR(recent) || price * 0.02
  const threshold = atr * 0.5

  // Cluster highs and lows
  const levels = []
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].high > recent[i-1].high && recent[i].high > recent[i+1].high && recent[i].high > recent[i-2].high && recent[i].high > recent[i+2].high) {
      levels.push({ price: recent[i].high, type: 'high' })
    }
    if (recent[i].low < recent[i-1].low && recent[i].low < recent[i+1].low && recent[i].low < recent[i-2].low && recent[i].low < recent[i+2].low) {
      levels.push({ price: recent[i].low, type: 'low' })
    }
  }

  // Cluster nearby levels
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

  // Pivot points
  const h = Math.max(...recent.slice(-5).map(c => c.high))
  const l = Math.min(...recent.slice(-5).map(c => c.low))
  const pp = (h + l + price) / 3

  return { support, resistance, pivotPoints: { pp: r(pp), r1: r(2*pp - l), r2: r(pp + h - l), s1: r(2*pp - h), s2: r(pp - h + l) } }
}

function r(v, d = 2) { return v != null ? Math.round(v * 10**d) / 10**d : null }
function fmt(v) { if (v == null) return '—'; return Math.abs(v) < 10 ? v.toFixed(4) : v.toFixed(2) }

// Generate signal for a single symbol
function generateSignal(candles, symbol, assetType, name) {
  if (candles.length < 50) return null
  const closes = candles.map(c => c.close)
  const price = closes[closes.length - 1]
  const rsi = calcRSI(closes) || 50
  const atr = calcATR(candles) || price * 0.02
  const ma20 = calcSMA(closes, 20) || price
  const ma50 = calcSMA(closes, 50) || price
  const ma200 = calcSMA(closes, 200) || price
  const macd = calcMACD(closes)
  const sr = findSR(candles)
  const { support, resistance } = sr

  // ---- Multi-factor direction scoring ----
  // Each factor adds directional conviction from -1 (bearish) to +1 (bullish)
  let dirScore = 0
  const factors = {}

  // Factor 1: Price vs MA50 (trend position)
  if (price > ma50) { dirScore += 1; factors.priceVsMa50 = 1 }
  else { dirScore -= 1; factors.priceVsMa50 = -1 }

  // Factor 2: MA alignment (MA50 vs MA200)
  if (ma50 > ma200) { dirScore += 1; factors.maAlignment = 1 }
  else { dirScore -= 1; factors.maAlignment = -1 }

  // Factor 3: Short-term trend (MA20 vs MA50)
  if (ma20 > ma50) { dirScore += 0.5; factors.shortTrend = 0.5 }
  else { dirScore -= 0.5; factors.shortTrend = -0.5 }

  // Factor 4: RSI momentum
  if (rsi < 30) { dirScore += 1.5; factors.rsi = 1.5 } // oversold bounce
  else if (rsi < 40) { dirScore += 0.5; factors.rsi = 0.5 }
  else if (rsi > 70) { dirScore -= 1.5; factors.rsi = -1.5 } // overbought fade
  else if (rsi > 60) { dirScore -= 0.5; factors.rsi = -0.5 }
  else { factors.rsi = 0 }

  // Factor 5: MACD histogram
  if (macd && macd.histogram > 0) { dirScore += 1; factors.macd = 1 }
  else if (macd && macd.histogram < 0) { dirScore -= 1; factors.macd = -1 }
  else { factors.macd = 0 }

  // Factor 6: Price relative to support/resistance
  const nearestSupport = support.length > 0 ? support[0] : null
  const nearestResist = resistance.length > 0 ? resistance[0] : null
  if (nearestSupport && nearestResist) {
    const distToSupport = (price - nearestSupport) / price
    const distToResist = (nearestResist - price) / price
    if (distToResist > distToSupport * 2) { dirScore += 0.5; factors.srRatio = 0.5 } // more room to upside
    else if (distToSupport > distToResist * 2) { dirScore -= 0.5; factors.srRatio = -0.5 } // more room to downside
    else { factors.srRatio = 0 }
  } else { factors.srRatio = 0 }

  // Factor 7: Recent price momentum (5-day return)
  const recentReturn = candles.length >= 6 ? (price - candles[candles.length - 6].close) / candles[candles.length - 6].close : 0
  if (recentReturn > 0.03) { dirScore += 0.5; factors.momentum5d = 0.5 }
  else if (recentReturn < -0.03) { dirScore -= 0.5; factors.momentum5d = -0.5 }
  else { factors.momentum5d = 0 }

  // ---- Strategy classification ----
  let strategy = 'breakout'
  if (rsi < 30 || rsi > 70) {
    strategy = 'mean-reversion'
  } else if ((ma20 > ma50 && ma50 > ma200) || (ma20 < ma50 && ma50 < ma200)) {
    strategy = 'momentum'
  } else if (atr / price < 0.015) {
    strategy = 'carry' // low-vol environment
  } else {
    strategy = 'breakout'
  }

  // ---- Direction from composite score ----
  let direction
  if (strategy === 'mean-reversion') {
    direction = rsi < 50 ? 'long' : 'short'
  } else {
    direction = dirScore >= 0 ? 'long' : 'short'
  }

  // ---- Multi-factor confidence scoring (30–92 range) ----
  // Base: how many factors agree with the chosen direction
  const dirSign = direction === 'long' ? 1 : -1
  const factorValues = Object.values(factors)
  const agreeingFactors = factorValues.filter(f => (f * dirSign) > 0).length
  const totalFactors = factorValues.filter(f => f !== 0).length
  const agreementRatio = totalFactors > 0 ? agreeingFactors / totalFactors : 0.5

  let confidence = 35 + Math.round(agreementRatio * 35) // 35-70 base from factor agreement

  // Boost for extreme conviction signals
  const absScore = Math.abs(dirScore)
  if (absScore >= 5) confidence += 15 // very strong alignment
  else if (absScore >= 3.5) confidence += 10
  else if (absScore >= 2) confidence += 5

  // Boost for RSI extremes (mean-reversion setups)
  if (strategy === 'mean-reversion') {
    const rsiExtreme = Math.abs(rsi - 50)
    confidence += Math.min(12, Math.round(rsiExtreme / 3))
  }

  // Boost for clean MA stacking
  if ((ma20 > ma50 && ma50 > ma200 && direction === 'long') || (ma20 < ma50 && ma50 < ma200 && direction === 'short')) {
    confidence += 8
  }

  // Penalty for conflicting signals
  const conflicting = factorValues.filter(f => (f * dirSign) < 0).length
  if (conflicting >= 3) confidence -= 8
  else if (conflicting >= 2) confidence -= 4

  // Risk/reward adjustment — better R:R = higher confidence
  // (calculated after entry/target/stop are set, adjusted below)

  // Clamp
  confidence = Math.max(30, Math.min(92, confidence))

  // Entry zone
  let entryLow, entryHigh
  if (direction === 'long') {
    entryLow = r(Math.max(support[0] || price - atr * 1.5, price - atr * 0.75))
    entryHigh = r(price + atr * 0.25)
  } else {
    entryHigh = r(Math.min(resistance[0] || price + atr * 1.5, price + atr * 0.75))
    entryLow = r(price - atr * 0.25)
  }

  // Target
  let target
  if (direction === 'long') {
    target = resistance.length >= 1 ? r(resistance[0] + atr * 1.5) : r(price + atr * 3)
  } else {
    target = support.length >= 1 ? r(support[0] - atr * 1.5) : r(price - atr * 3)
  }

  // Stop loss
  let stopLoss
  if (direction === 'long') {
    stopLoss = support.length > 0 ? r(support[0] - atr * 0.5) : r(price - atr * 2)
  } else {
    stopLoss = resistance.length > 0 ? r(resistance[0] + atr * 0.5) : r(price + atr * 2)
  }

  // Sanity: ensure stop is on the right side
  if (direction === 'long' && stopLoss >= entryLow) stopLoss = r(entryLow - atr * 0.5)
  if (direction === 'short' && stopLoss <= entryHigh) stopLoss = r(entryHigh + atr * 0.5)

  // Risk
  const stopDist = (Math.abs(price - stopLoss) / price) * 100
  const risk = stopDist < 2 ? 'LOW' : stopDist > 4 ? 'HIGH' : 'MEDIUM'

  // Final confidence adjustment: risk/reward ratio
  const reward = Math.abs(target - price)
  const riskAmt = Math.abs(price - stopLoss)
  const rr = riskAmt > 0 ? reward / riskAmt : 1
  if (rr >= 3) confidence += 5
  else if (rr >= 2) confidence += 2
  else if (rr < 1) confidence -= 5

  // Re-clamp after R:R adjustment
  confidence = Math.max(30, Math.min(92, confidence))

  // Timeframe
  const daysEst = Math.max(1, Math.round(Math.abs(target - price) / atr))
  const timeframe = daysEst <= 3 ? '1-3 days' : daysEst <= 7 ? '3-7 days' : daysEst <= 14 ? '5-14 days' : '10-21 days'

  // Timing
  const now = new Date()
  const entryDays = strategy === 'breakout' ? 2 : strategy === 'mean-reversion' ? 3 : 4
  const holdDays = strategy === 'breakout' ? 5 : strategy === 'mean-reversion' ? 7 : 8
  const entryBy = new Date(now.getTime() + entryDays * 86400000).toISOString().slice(0, 16)
  const expiresAt = new Date(now.getTime() + (entryDays + holdDays) * 86400000).toISOString().slice(0, 16)

  // Entry window text
  const entryWindow = direction === 'long'
    ? `Enter on dips toward $${fmt(entryLow)}-$${fmt(entryHigh)}${support.length > 0 ? '; support at $' + fmt(support[0]) : ''}`
    : `Enter on rallies toward $${fmt(entryLow)}-$${fmt(entryHigh)}${resistance.length > 0 ? '; resistance at $' + fmt(resistance[0]) : ''}`

  // Thesis
  const devFromMA = (Math.abs(price - ma50) / (atr || 1)).toFixed(1)
  let thesis
  if (strategy === 'mean-reversion') {
    thesis = `${name} (${symbol}) shows RSI at ${r(rsi, 1)} in ${rsi < 30 ? 'deeply oversold' : 'overbought'} territory. Price is ${devFromMA}x ATR from the 50-day MA ($${fmt(ma50)}). Similar extremes historically resolve with ${rsi < 30 ? '8-12% bounces' : '6-10% pullbacks'} within 1-2 weeks.`
  } else if (strategy === 'momentum') {
    thesis = `${name} (${symbol}) is in confirmed ${direction === 'long' ? 'uptrend' : 'downtrend'} with price ${price > ma50 ? 'above' : 'below'} major MAs. MA50 ($${fmt(ma50)}) is ${ma50 > ma200 ? 'above' : 'below'} MA200 ($${fmt(ma200)}), confirming ${direction === 'long' ? 'bullish' : 'bearish'} regime.`
  } else {
    thesis = `${name} (${symbol}) presents a ${direction === 'long' ? 'bullish' : 'bearish'} breakout setup. Price at $${fmt(price)} near key ${direction === 'long' ? 'resistance' : 'support'}. ATR of $${fmt(atr)} implies target at $${fmt(target)}.`
  }

  // Catalyst — describe what's driving the confidence score
  const confLevel = confidence >= 75 ? 'high' : confidence >= 55 ? 'moderate' : 'low'
  const agreeParts = []
  if (factors.priceVsMa50 * dirSign > 0) agreeParts.push(`price ${direction === 'long' ? 'above' : 'below'} MA50`)
  if (factors.maAlignment * dirSign > 0) agreeParts.push('MA alignment')
  if (factors.macd * dirSign > 0) agreeParts.push(`MACD ${direction === 'long' ? 'positive' : 'negative'}`)
  if (factors.rsi * dirSign > 0) agreeParts.push(`RSI ${rsi < 40 ? 'oversold' : rsi > 60 ? 'overbought' : 'neutral'} at ${r(rsi, 1)}`)
  if (factors.momentum5d * dirSign > 0) agreeParts.push('5-day momentum')

  let catalyst = `${confLevel[0].toUpperCase() + confLevel.slice(1)}-confidence (${confidence}%) — `
  if (agreeParts.length > 0) catalyst += `supported by ${agreeParts.join(', ')}. `
  else catalyst += `mixed technical signals. `
  if (rr >= 2) catalyst += `R:R of ${rr.toFixed(1)}:1 favors entry.`
  else catalyst += `R:R of ${rr.toFixed(1)}:1.`

  // Hold reason
  const holdReason = strategy === 'mean-reversion' ? 'Hold through initial volatility — mean reversion thesis needs time to play out.'
    : strategy === 'momentum' ? 'Hold with trend — momentum strategies work best with patience.'
    : 'Hold for breakout confirmation — initial move often retraces before continuation.'

  // Historical context
  const recent = candles.slice(-20)
  const highH = Math.max(...recent.map(c => c.high))
  const lowL = Math.min(...recent.map(c => c.low))
  const historicalContext = `Price at $${fmt(price)} within 20-day range $${fmt(lowL)}-$${fmt(highH)}. MA50 at $${fmt(ma50)}, MA200 at $${fmt(ma200)}. ATR of $${fmt(atr)} implies ${((atr/price)*100).toFixed(1)}% daily volatility.`

  // Bond correlation & macro
  const bondCorrelation = direction === 'long'
    ? `Bullish setup correlates with risk-on sentiment. Monitor yields for confirmation.`
    : `Bearish setup suggests risk-off rotation. Bond rally would confirm thesis.`
  const globalMacro = `${ma50 > ma200 ? 'Bullish' : 'Bearish'} macro regime. ${direction === 'long' ? 'Risk appetite supports longs.' : 'Defensive positioning favors shorts.'}`

  // News drivers (technical)
  const newsDrivers = [
    `RSI at ${r(rsi, 1)} — ${rsi < 30 ? 'extreme oversold' : rsi > 70 ? 'extreme overbought' : 'neutral'} condition`,
    `Price ${price > ma50 ? 'above' : 'below'} 50-day MA ($${fmt(ma50)})`,
    support.length > 0 ? `Support at $${fmt(support[0])}` : 'No clear support nearby',
    resistance.length > 0 ? `Resistance at $${fmt(resistance[0])}` : 'No clear resistance nearby',
    `${strategy} strategy at ${confidence}% confidence`,
  ]

  // Technical levels
  const technicalLevels = {
    support: support.slice(0, 3).map(s => r(s)),
    resistance: resistance.slice(0, 3).map(x => r(x)),
    pivotPoints: sr.pivotPoints,
    movingAverages: { ma20: r(ma20), ma50: r(ma50), ma200: r(ma200) },
  }

  // Risk factors
  const riskFactors = [
    `Gap risk: Large move against position invalidates setup`,
    `Volatility spike: ATR beyond $${fmt(atr * 2)} could trigger early stop`,
    `Thesis invalidation at $${fmt(stopLoss)} — exit immediately if breached`,
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
    dataPacket: {
      historicalContext, bondCorrelation, globalMacro, newsDrivers,
      technicalLevels,
      sectorContext: `${direction === 'long' ? 'Bullish' : 'Bearish'} setup. Monitor sector relative strength for confirmation.`,
      riskFactors,
    },
  }
}

// Default watchlist
const WATCHLIST = {
  long: [
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
  ],
  short: [
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
  const category = searchParams.get('category') || 'all' // long, short, forex, all
  const singleSymbol = searchParams.get('symbol') // optional: generate for one symbol

  try {
    if (singleSymbol) {
      const name = searchParams.get('name') || singleSymbol
      const asset = searchParams.get('asset') || 'equity'
      const { candles } = await fetchCandles(singleSymbol, '6mo', '1d')
      const signal = generateSignal(candles, singleSymbol, asset, name)
      return NextResponse.json({ signals: signal ? [signal] : [], errors: [] })
    }

    // Generate signals for watchlist
    const categories = category === 'all' ? ['long', 'short', 'forex'] : [category]
    const signals = { long: [], short: [], forex: [] }
    const errors = []

    // Merge all non-forex watchlists for signal generation
    const allEquities = [...(WATCHLIST.long || []), ...(WATCHLIST.short || [])]
    // Deduplicate by symbol
    const seen = new Set()
    const uniqueEquities = allEquities.filter(item => {
      if (seen.has(item.symbol)) return false
      seen.add(item.symbol)
      return true
    })

    const lists = []
    if (categories.includes('long') || categories.includes('short')) lists.push({ items: uniqueEquities, isForex: false })
    if (categories.includes('forex')) lists.push({ items: WATCHLIST.forex || [], isForex: true })

    for (const { items, isForex } of lists) {
      for (let batch = 0; batch < items.length; batch += 4) {
        const batchItems = items.slice(batch, batch + 4)
        const results = await Promise.allSettled(
          batchItems.map(async (item) => {
            const { candles } = await fetchCandles(item.symbol, '6mo', '1d')
            return generateSignal(candles, item.symbol, item.asset, item.name)
          })
        )
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'fulfilled' && results[j].value) {
            const sig = results[j].value
            if (isForex) {
              signals.forex.push(sig)
            } else {
              // Categorize by actual computed direction
              if (sig.direction === 'long') signals.long.push(sig)
              else signals.short.push(sig)
            }
          } else {
            errors.push({ symbol: batchItems[j].symbol, error: results[j].reason?.message || 'Failed' })
          }
        }
        if (batch + 4 < items.length) await new Promise(r => setTimeout(r, 200))
      }
    }

    return NextResponse.json({ signals, errors, generatedAt: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: error.message, signals: { long: [], short: [], forex: [] } }, { status: 500 })
  }
}
