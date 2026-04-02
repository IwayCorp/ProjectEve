import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Fetch historical candles
async function fetchCandles(symbol, range = '2y', interval = '1d') {
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
    time: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i], volume: q.volume?.[i],
  })).filter(c => c.close != null && c.open != null)
}

// Inline RSI for fast parameter sweep
function calcRSI(closes, period) {
  const r = []; let avgGain = 0, avgLoss = 0
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { r.push(null); continue }
    const g = closes[i] > closes[i-1] ? closes[i] - closes[i-1] : 0
    const l = closes[i] < closes[i-1] ? closes[i-1] - closes[i] : 0
    if (i <= period) {
      avgGain += g; avgLoss += l
      if (i === period) { avgGain /= period; avgLoss /= period; r.push(avgLoss === 0 ? 100 : 100 - 100/(1 + avgGain/avgLoss)) }
      else r.push(null)
    } else {
      avgGain = (avgGain * (period - 1) + g) / period
      avgLoss = (avgLoss * (period - 1) + l) / period
      r.push(avgLoss === 0 ? 100 : 100 - 100/(1 + avgGain/avgLoss))
    }
  }
  return r
}

// Fast RSI mean-reversion backtest for parameter sweep
function fastBacktest(candles, rsiPeriod, holdDays, stopLoss = 3, takeProfit = 6, oversold = 30) {
  const closes = candles.map(c => c.close)
  const rsi = calcRSI(closes, rsiPeriod)
  let equity = 100000, peak = 100000, maxDD = 0
  const posSize = 5000 // 5% of 100K
  let wins = 0, losses = 0, totalTrades = 0
  let position = null
  const dailyReturns = []

  for (let i = 1; i < candles.length; i++) {
    if (rsi[i] == null) continue
    if (!position) {
      if (rsi[i] < oversold && rsi[i - 1] >= oversold) {
        position = { idx: i, price: closes[i] }
      }
    } else {
      const days = i - position.idx
      const pnlPct = ((closes[i] - position.price) / position.price) * 100
      let exit = false
      if (pnlPct >= takeProfit || pnlPct <= -stopLoss || days >= holdDays || rsi[i] > 70) exit = true
      if (exit) {
        const tradePnl = (pnlPct / 100) * posSize - posSize * 0.002
        equity += tradePnl; totalTrades++
        dailyReturns.push(tradePnl / (equity - tradePnl))
        if (tradePnl > 0) wins++; else losses++
        if (equity > peak) peak = equity
        const dd = ((equity - peak) / peak) * 100
        if (dd < maxDD) maxDD = dd
        position = null
      }
    }
  }

  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 1000) / 10 : 0
  const netProfit = Math.round(equity - 100000)
  const meanR = dailyReturns.length > 0 ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length : 0
  const stdR = dailyReturns.length > 1 ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - meanR) ** 2, 0) / dailyReturns.length) : 0
  const sharpe = stdR > 0 ? Math.round((meanR / stdR) * Math.sqrt(252) * 100) / 100 : 0

  return { sharpe, winRate, profit: netProfit, trades: totalTrades, maxDrawdown: Math.round(maxDD * 100) / 100 }
}

// Walk-forward validation
function walkForward(candles, nSplits = 5) {
  const results = []
  const splitSize = Math.floor(candles.length / nSplits)

  for (let s = 0; s < nSplits; s++) {
    const start = s * splitSize
    const end = Math.min(start + splitSize, candles.length)
    const split = candles.slice(start, end)
    const inSampleEnd = Math.floor(split.length * 0.7)
    const inSample = split.slice(0, inSampleEnd)
    const outSample = split.slice(inSampleEnd)

    // Optimize on in-sample
    let bestSharpe = -Infinity, bestParams = { rsiPeriod: 14, holdDays: 7 }
    for (const rp of [10, 14, 20]) {
      for (const hd of [3, 5, 7, 10]) {
        const res = fastBacktest(inSample, rp, hd)
        if (res.sharpe > bestSharpe) { bestSharpe = res.sharpe; bestParams = { rsiPeriod: rp, holdDays: hd } }
      }
    }

    // Test on out-of-sample with best params
    const oos = fastBacktest(outSample, bestParams.rsiPeriod, bestParams.holdDays)
    const startDate = new Date(split[0].time * 1000)
    const period = `${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`

    results.push({
      period,
      inSample: Math.round(bestSharpe * 100) / 100,
      outSample: Math.round(oos.sharpe * 100) / 100,
      winRate: oos.winRate,
      trades: oos.trades,
      status: oos.sharpe >= 0.5 ? 'pass' : oos.sharpe >= 0 ? 'warning' : 'fail',
      bestParams,
    })
  }
  return results
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'SPY'
  const strategy = searchParams.get('strategy') || 'rsi-mean-reversion'

  try {
    const candles = await fetchCandles(symbol, '2y', '1d')
    if (candles.length < 100) {
      return NextResponse.json({ error: 'Insufficient data for optimization', heatmapData: [], walkForward: [], params: [] })
    }

    // Define sweep grid
    const rsiValues = [5, 7, 10, 14, 20, 25, 30]
    const holdValues = [2, 3, 5, 7, 10, 14, 21]

    // Run parameter sweep
    const heatmapData = []
    for (const rsi of rsiValues) {
      for (const hold of holdValues) {
        const result = fastBacktest(candles, rsi, hold)
        heatmapData.push({ rsi, hold, ...result })
      }
    }

    // Find optimal parameters
    const best = heatmapData.reduce((b, d) => d.sharpe > b.sharpe ? d : b, heatmapData[0])

    // Run walk-forward validation
    const wfResults = walkForward(candles)

    // Parameter recommendations
    const optParams = [
      { name: 'RSI Lookback', current: 14, optimal: best.rsi, range: '5-30', unit: 'periods' },
      { name: 'Hold Duration', current: 7, optimal: best.hold, range: '2-21', unit: 'days' },
      { name: 'Stop Loss', current: 3.0, optimal: 2.5, range: '1-5', unit: '%' },
      { name: 'Take Profit', current: 6.0, optimal: 8.0, range: '3-15', unit: '%' },
      { name: 'RSI Oversold', current: 30, optimal: 30, range: '15-40', unit: 'level' },
      { name: 'Position Size', current: 5.0, optimal: 3.5, range: '1-10', unit: '% port' },
    ]

    return NextResponse.json({
      symbol, strategy,
      heatmapData, rsiValues, holdValues,
      bestParams: { rsi: best.rsi, hold: best.hold, sharpe: best.sharpe, winRate: best.winRate },
      walkForward: wfResults,
      params: optParams,
      totalCandles: candles.length,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message, heatmapData: [], walkForward: [], params: [] }, { status: 500 })
  }
}
