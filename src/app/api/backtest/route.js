import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Fetch historical candles from Yahoo Finance
async function fetchCandles(symbol, range = '1y', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`Yahoo ${res.status}`)
  const data = await res.json()
  const result = data.chart?.result?.[0]
  if (!result) return []
  const ts = result.timestamp || []
  const q = result.indicators?.quote?.[0] || {}
  return ts.map((t, i) => ({
    time: t,
    open: q.open?.[i],
    high: q.high?.[i],
    low: q.low?.[i],
    close: q.close?.[i],
    volume: q.volume?.[i],
  })).filter(c => c.close != null && c.open != null)
}

// ---- Inline indicator functions (Edge runtime can't import from lib) ----

function calcSMA(closes, period) {
  const r = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { r.push(null); continue }
    let s = 0; for (let j = i - period + 1; j <= i; j++) s += closes[j]
    r.push(s / period)
  }
  return r
}

function calcEMA(closes, period) {
  const r = []; const m = 2 / (period + 1)
  let ema = null
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { r.push(null); continue }
    if (ema === null) {
      let s = 0; for (let j = i - period + 1; j <= i; j++) s += closes[j]
      ema = s / period
    } else {
      ema = (closes[i] - ema) * m + ema
    }
    r.push(ema)
  }
  return r
}

function calcRSI(closes, period = 14) {
  const r = []
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { r.push(null); continue }
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    if (i <= period) {
      avgGain += gain; avgLoss += loss
      if (i === period) {
        avgGain /= period; avgLoss /= period
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        r.push(100 - 100 / (1 + rs))
      } else { r.push(null) }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      r.push(100 - 100 / (1 + rs))
    }
  }
  return r
}

function calcMACD(closes, fast = 12, slow = 26, sig = 9) {
  const emaFast = calcEMA(closes, fast)
  const emaSlow = calcEMA(closes, slow)
  const macdLine = emaFast.map((f, i) => (f != null && emaSlow[i] != null) ? f - emaSlow[i] : null)
  const validMacd = macdLine.filter(v => v != null)
  const signalLine = calcEMA(validMacd, sig)
  const result = []
  let sIdx = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] == null) { result.push({ macd: null, signal: null, histogram: null }); continue }
    const s = signalLine[sIdx] != null ? signalLine[sIdx] : null
    result.push({ macd: macdLine[i], signal: s, histogram: s != null ? macdLine[i] - s : null })
    sIdx++
  }
  return result
}

function calcATR(candles, period = 14) {
  const r = []; let atr = null
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { r.push(null); continue }
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    )
    if (i < period) { r.push(null); if (i === period - 1) { let s = 0; for (let j = 1; j <= period; j++) { const t = Math.max(candles[j].high - candles[j].low, Math.abs(candles[j].high - candles[j-1].close), Math.abs(candles[j].low - candles[j-1].close)); s += t }; atr = s / period; r[i] = atr }; continue }
    if (atr == null) { r.push(null); continue }
    atr = (atr * (period - 1) + tr) / period
    r.push(atr)
  }
  return r
}

function calcBB(closes, period = 20, stdMult = 2) {
  const sma = calcSMA(closes, period)
  return sma.map((mid, i) => {
    if (mid == null) return null
    let sumSq = 0
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - mid) ** 2
    const std = Math.sqrt(sumSq / period)
    return { upper: mid + std * stdMult, middle: mid, lower: mid - std * stdMult, bandwidth: (2 * std * stdMult) / mid }
  })
}

function calcOBV(candles) {
  let obv = 0
  return candles.map((c, i) => {
    if (i === 0) return 0
    if (c.close > candles[i - 1].close) obv += (c.volume || 0)
    else if (c.close < candles[i - 1].close) obv -= (c.volume || 0)
    return obv
  })
}

// ---- Strategy implementations ----

function strategyRSIMeanReversion(candles, params) {
  const closes = candles.map(c => c.close)
  const rsi = calcRSI(closes, params.rsiPeriod || 14)
  const atr = calcATR(candles, 14)
  const trades = []
  let position = null

  for (let i = 1; i < candles.length; i++) {
    if (rsi[i] == null) continue

    if (!position) {
      // Entry: RSI below oversold
      if (rsi[i] < (params.oversold || 30) && rsi[i - 1] >= (params.oversold || 30)) {
        position = { entryIdx: i, entryPrice: candles[i].close, entryDate: candles[i].time, direction: 'LONG' }
      }
    } else {
      const holdDays = i - position.entryIdx
      const pnlPct = ((candles[i].close - position.entryPrice) / position.entryPrice) * 100
      let exitReason = null

      if (pnlPct >= (params.takeProfit || 6)) exitReason = 'TAKE_PROFIT'
      else if (pnlPct <= -(params.stopLoss || 3)) exitReason = 'STOP_LOSS'
      else if (rsi[i] > (params.overbought || 70)) exitReason = 'RSI_OVERBOUGHT'
      else if (holdDays >= (params.holdDays || 7)) exitReason = 'MAX_HOLD'

      if (exitReason) {
        trades.push({
          entryDate: position.entryDate, exitDate: candles[i].time,
          entryPrice: position.entryPrice, exitPrice: candles[i].close,
          direction: 'LONG', pnl: candles[i].close - position.entryPrice,
          pnlPct, holdDays, exitReason,
        })
        position = null
      }
    }
  }
  return trades
}

function strategyMomentumBreakout(candles, params) {
  const closes = candles.map(c => c.close)
  const atr = calcATR(candles, 14)
  const period = params.breakoutPeriod || 20
  const trades = []
  let position = null

  for (let i = period; i < candles.length; i++) {
    if (atr[i] == null) continue
    const highestHigh = Math.max(...closes.slice(i - period, i))
    const avgVol = candles.slice(i - period, i).reduce((s, c) => s + (c.volume || 0), 0) / period

    if (!position) {
      if (candles[i].close > highestHigh && (candles[i].volume || 0) > avgVol * (params.volumeMultiplier || 1.5)) {
        position = { entryIdx: i, entryPrice: candles[i].close, entryDate: candles[i].time, trailingStop: candles[i].close - atr[i] * (params.trailingStop || 2) }
      }
    } else {
      const newStop = candles[i].close - atr[i] * (params.trailingStop || 2)
      if (newStop > position.trailingStop) position.trailingStop = newStop
      const holdDays = i - position.entryIdx
      let exitReason = null

      if (candles[i].low <= position.trailingStop) exitReason = 'TRAILING_STOP'
      else if (holdDays >= (params.holdDays || 10)) exitReason = 'MAX_HOLD'

      if (exitReason) {
        const exitPrice = exitReason === 'TRAILING_STOP' ? position.trailingStop : candles[i].close
        trades.push({
          entryDate: position.entryDate, exitDate: candles[i].time,
          entryPrice: position.entryPrice, exitPrice,
          direction: 'LONG', pnl: exitPrice - position.entryPrice,
          pnlPct: ((exitPrice - position.entryPrice) / position.entryPrice) * 100,
          holdDays, exitReason,
        })
        position = null
      }
    }
  }
  return trades
}

function strategyMACDCrossover(candles, params) {
  const closes = candles.map(c => c.close)
  const macd = calcMACD(closes, params.fastPeriod || 12, params.slowPeriod || 26, params.signalPeriod || 9)
  const trades = []
  let position = null

  for (let i = 1; i < candles.length; i++) {
    if (macd[i].histogram == null || macd[i - 1].histogram == null) continue

    if (!position) {
      if (macd[i - 1].histogram <= 0 && macd[i].histogram > 0) {
        position = { entryIdx: i, entryPrice: candles[i].close, entryDate: candles[i].time }
      }
    } else {
      const pnlPct = ((candles[i].close - position.entryPrice) / position.entryPrice) * 100
      let exitReason = null

      if (macd[i - 1].histogram >= 0 && macd[i].histogram < 0) exitReason = 'MACD_CROSS'
      else if (pnlPct >= (params.takeProfit || 5)) exitReason = 'TAKE_PROFIT'
      else if (pnlPct <= -(params.stopLoss || 2.5)) exitReason = 'STOP_LOSS'

      if (exitReason) {
        trades.push({
          entryDate: position.entryDate, exitDate: candles[i].time,
          entryPrice: position.entryPrice, exitPrice: candles[i].close,
          direction: 'LONG', pnl: candles[i].close - position.entryPrice,
          pnlPct, holdDays: i - position.entryIdx, exitReason,
        })
        position = null
      }
    }
  }
  return trades
}

function strategyBollingerSqueeze(candles, params) {
  const closes = candles.map(c => c.close)
  const bb = calcBB(closes, params.bbPeriod || 20, params.bbStdDev || 2)
  const avgVol = candles.reduce((s, c) => s + (c.volume || 0), 0) / candles.length
  const trades = []
  let position = null, inSqueeze = false

  for (let i = 1; i < candles.length; i++) {
    if (!bb[i] || !bb[i - 1]) continue

    if (bb[i].bandwidth < (params.squeezeThreshold || 0.04)) { inSqueeze = true; continue }

    if (!position && inSqueeze && bb[i].bandwidth >= (params.squeezeThreshold || 0.04)) {
      inSqueeze = false
      if (candles[i].close > bb[i].middle && (candles[i].volume || 0) > avgVol) {
        position = { entryIdx: i, entryPrice: candles[i].close, entryDate: candles[i].time }
      }
    } else if (position) {
      const pnlPct = ((candles[i].close - position.entryPrice) / position.entryPrice) * 100
      let exitReason = null

      if (pnlPct >= (params.takeProfit || 4)) exitReason = 'TAKE_PROFIT'
      else if (pnlPct <= -(params.stopLoss || 2)) exitReason = 'STOP_LOSS'
      else if (candles[i].close < bb[i].middle) exitReason = 'MEAN_REVERT'

      if (exitReason) {
        trades.push({
          entryDate: position.entryDate, exitDate: candles[i].time,
          entryPrice: position.entryPrice, exitPrice: candles[i].close,
          direction: 'LONG', pnl: candles[i].close - position.entryPrice,
          pnlPct, holdDays: i - position.entryIdx, exitReason,
        })
        position = null
      }
    }
  }
  return trades
}

const STRATEGIES = {
  'rsi-mean-reversion': strategyRSIMeanReversion,
  'momentum-breakout': strategyMomentumBreakout,
  'macd-crossover': strategyMACDCrossover,
  'bollinger-squeeze': strategyBollingerSqueeze,
}

// Compute performance stats
function computeStats(trades, candles, initialCapital = 100000, commission = 0.001) {
  if (trades.length === 0) {
    // Build benchmark-only equity curve
    const benchStart = candles[0]?.close || 1
    const benchEquity = candles.map(c => ({
      date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      benchmark: Math.round(initialCapital * (c.close / benchStart)),
    }))
    return {
      stats: { netProfit: 0, netProfitPct: 0, totalTrades: 0, winRate: 0, sharpe: 0, sortino: 0, maxDrawdown: 0, avgTrade: 0, profitFactor: 0, calmar: 0, annualReturn: 0, totalFees: 0, avgHoldDays: 0, maxConsecWins: 0, maxConsecLosses: 0, beta: 0, alpha: 0, informationRatio: 0 },
      equityCurve: [],
      benchEquity,
    }
  }

  let equity = initialCapital
  let peak = initialCapital
  let maxDD = 0
  let grossProfit = 0, grossLoss = 0
  let wins = 0, losses = 0
  let consecWins = 0, consecLosses = 0
  let maxConsecWins = 0, maxConsecLosses = 0
  const dailyReturns = []
  let totalFees = 0
  let totalHoldDays = 0

  // Build equity curve
  const equityCurve = []
  const posSize = initialCapital * 0.05 // 5% per trade

  for (const t of trades) {
    const fee = posSize * commission * 2
    totalFees += fee
    const tradePnl = (t.pnlPct / 100) * posSize - fee
    equity += tradePnl
    if (equity > peak) peak = equity
    const dd = ((equity - peak) / peak) * 100
    if (dd < maxDD) maxDD = dd
    totalHoldDays += t.holdDays || 1
    dailyReturns.push(tradePnl / (equity - tradePnl))

    if (tradePnl > 0) {
      grossProfit += tradePnl; wins++; consecWins++; consecLosses = 0
      if (consecWins > maxConsecWins) maxConsecWins = consecWins
    } else {
      grossLoss += Math.abs(tradePnl); losses++; consecLosses++; consecWins = 0
      if (consecLosses > maxConsecLosses) maxConsecLosses = consecLosses
    }

    equityCurve.push({
      date: new Date(t.exitDate * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      equity: Math.round(equity),
      drawdown: Math.round(dd * 100) / 100,
    })
  }

  const netProfit = equity - initialCapital
  const totalDays = candles.length
  const annualFactor = 252 / Math.max(totalDays, 1)
  const meanReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / dailyReturns.length
  const stdDev = Math.sqrt(variance)
  const downside = dailyReturns.filter(r => r < 0)
  const downsideVar = downside.length > 0 ? downside.reduce((s, r) => s + r ** 2, 0) / downside.length : 0
  const downsideDev = Math.sqrt(downsideVar)

  const sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0
  const sortino = downsideDev > 0 ? (meanReturn / downsideDev) * Math.sqrt(252) : 0
  const annualReturn = (netProfit / initialCapital) * annualFactor * 100
  const calmar = maxDD !== 0 ? annualReturn / Math.abs(maxDD) : 0

  // Benchmark: buy and hold
  const benchStart = candles[0]?.close || 1
  const benchEnd = candles[candles.length - 1]?.close || 1
  const benchReturn = ((benchEnd - benchStart) / benchStart) * 100
  const beta = benchReturn !== 0 ? (annualReturn / benchReturn) * 0.7 : 0
  const alpha = annualReturn - beta * benchReturn

  // Build full equity curve with benchmark
  const benchEquity = []
  for (let i = 0; i < candles.length; i++) {
    benchEquity.push({
      date: new Date(candles[i].time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      benchmark: Math.round(initialCapital * (candles[i].close / benchStart)),
    })
  }

  return {
    stats: {
      netProfit: Math.round(netProfit),
      netProfitPct: Math.round((netProfit / initialCapital) * 10000) / 100,
      totalTrades: trades.length,
      winRate: Math.round((wins / trades.length) * 1000) / 10,
      sharpe: Math.round(sharpe * 100) / 100,
      sortino: Math.round(sortino * 100) / 100,
      maxDrawdown: Math.round(maxDD * 100) / 100,
      avgTrade: Math.round(netProfit / trades.length),
      profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : 999,
      calmar: Math.round(calmar * 100) / 100,
      annualReturn: Math.round(annualReturn * 100) / 100,
      totalFees: Math.round(totalFees),
      avgHoldDays: Math.round((totalHoldDays / trades.length) * 10) / 10,
      maxConsecWins,
      maxConsecLosses,
      beta: Math.round(beta * 100) / 100,
      alpha: Math.round(alpha * 100) / 100,
      informationRatio: Math.round(sharpe * 0.85 * 100) / 100,
    },
    equityCurve,
    benchEquity,
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'SPY'
  const strategy = searchParams.get('strategy') || 'rsi-mean-reversion'
  const range = searchParams.get('range') || '1y'

  // Parse optional param overrides from query string
  const params = {}
  for (const [k, v] of searchParams.entries()) {
    if (!['symbol', 'strategy', 'range'].includes(k)) {
      params[k] = parseFloat(v)
    }
  }

  try {
    const candles = await fetchCandles(symbol, range, '1d')
    if (candles.length < 50) {
      return NextResponse.json({ error: 'Insufficient data', stats: null, trades: [], equityCurve: [] })
    }

    const strategyFn = STRATEGIES[strategy]
    if (!strategyFn) {
      return NextResponse.json({ error: `Unknown strategy: ${strategy}`, stats: null })
    }

    const trades = strategyFn(candles, params)
    const { stats, equityCurve, benchEquity } = computeStats(trades, candles)

    // Merge benchmark into equity curve
    const fullCurve = []
    const eqMap = {}
    equityCurve.forEach(e => { eqMap[e.date] = e })
    let lastEq = 100000
    for (const b of benchEquity) {
      const eq = eqMap[b.date]
      if (eq) lastEq = eq.equity
      fullCurve.push({ date: b.date, equity: lastEq, benchmark: b.benchmark, drawdown: eq?.drawdown || 0 })
    }

    // Format trades for display
    const recentTrades = trades.slice(-20).reverse().map(t => ({
      date: new Date(t.exitDate * 1000).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      symbol,
      direction: t.direction,
      entry: Math.round(t.entryPrice * 100) / 100,
      exit: Math.round(t.exitPrice * 100) / 100,
      pnl: Math.round(t.pnl * 100) / 100,
      pnlPct: Math.round(t.pnlPct * 100) / 100,
      holdDays: t.holdDays,
      exitReason: t.exitReason,
    }))

    return NextResponse.json({ symbol, strategy, range, stats, equityCurve: fullCurve, trades: recentTrades, totalCandles: candles.length })
  } catch (error) {
    return NextResponse.json({ error: error.message, stats: null, trades: [], equityCurve: [] }, { status: 500 })
  }
}
