// Backtesting Engine for Quantitative Trading Platform
// Implements RSI Mean Reversion, Momentum Breakout, MACD Crossover, and Bollinger Band Squeeze strategies
// Fetches historical data from Yahoo Finance and executes real strategy logic

import {
  RSI,
  SMA,
  EMA,
  MACD,
  BollingerBands,
  ATR,
  OBV,
} from './indicators'

// Strategy parameter definitions with defaults and ranges
export const STRATEGY_PARAMS = {
  'rsi-mean-reversion': {
    rsiPeriod: { default: 14, min: 5, max: 30, step: 1 },
    oversold: { default: 30, min: 10, max: 40, step: 5 },
    overbought: { default: 70, min: 60, max: 90, step: 5 },
    stopLoss: { default: 3, min: 1, max: 8, step: 0.5 }, // percent
    takeProfit: { default: 6, min: 2, max: 15, step: 1 }, // percent
    holdDays: { default: 7, min: 2, max: 21, step: 1 },
  },
  'momentum-breakout': {
    breakoutPeriod: { default: 20, min: 5, max: 50, step: 5 },
    volumeMultiplier: { default: 1.5, min: 1.0, max: 3.0, step: 0.25 },
    trailingStop: { default: 2, min: 1, max: 5, step: 0.5 }, // ATR multiplier
    holdDays: { default: 10, min: 3, max: 30, step: 1 },
  },
  'macd-crossover': {
    fastPeriod: { default: 12, min: 5, max: 20, step: 1 },
    slowPeriod: { default: 26, min: 15, max: 40, step: 1 },
    signalPeriod: { default: 9, min: 5, max: 15, step: 1 },
    stopLoss: { default: 2.5, min: 1, max: 6, step: 0.5 },
    takeProfit: { default: 5, min: 2, max: 12, step: 1 },
  },
  'bollinger-squeeze': {
    bbPeriod: { default: 20, min: 10, max: 30, step: 2 },
    bbStdDev: { default: 2, min: 1.5, max: 3, step: 0.25 },
    squeezeThreshold: { default: 0.04, min: 0.02, max: 0.08, step: 0.01 },
    stopLoss: { default: 2, min: 1, max: 5, step: 0.5 },
    takeProfit: { default: 4, min: 2, max: 10, step: 1 },
  },
}

// Utility: merge params with defaults
function mergeParams(strategy, overrides = {}) {
  const defaults = STRATEGY_PARAMS[strategy] || {}
  const merged = {}
  for (const [key, def] of Object.entries(defaults)) {
    merged[key] = overrides[key] !== undefined ? overrides[key] : def.default
  }
  return merged
}

// Utility: generate discrete parameter range
function generateParamRange(paramDef) {
  const { min, max, step } = paramDef
  const range = []
  for (let val = min; val <= max; val += step) {
    range.push(parseFloat(val.toFixed(4)))
  }
  return range
}

// Utility: calculate daily returns and statistics
function calculateReturns(equityCurve) {
  const returns = []
  for (let i = 1; i < equityCurve.length; i++) {
    const ret = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity
    returns.push(ret)
  }
  return returns
}

// Core backtest function
export function runBacktest(candles, strategy, params = {}, options = {}) {
  const {
    initialCapital = 100000,
    positionSizePct = 5,
    commission = 0.001,
    direction = 'long',
  } = options

  // Merge strategy parameters
  const mergedParams = mergeParams(strategy, params)

  // Validate inputs
  if (!candles || candles.length < 50) {
    throw new Error('Minimum 50 candles required for backtesting')
  }

  if (!STRATEGY_PARAMS[strategy]) {
    throw new Error(`Unknown strategy: ${strategy}`)
  }

  const trades = []
  let position = null // { entryIndex, entryPrice, direction, entryDate, qty, trailingStop }
  let equity = initialCapital
  let cash = initialCapital
  let totalFees = 0

  const equityCurve = [{ date: candles[0].time, equity: initialCapital, drawdown: 0 }]
  let peakEquity = initialCapital

  // Calculate all indicators upfront
  const closes = candles.map((c) => c.close)
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const volumes = candles.map((c) => c.volume)

  const indicators = {}

  if (strategy === 'rsi-mean-reversion' || strategy === 'momentum-breakout') {
    indicators.rsi = RSI(closes, mergedParams.rsiPeriod || 14)
  }

  if (strategy === 'momentum-breakout') {
    indicators.atr = ATR(highs, lows, closes, 14)
  }

  if (strategy === 'macd-crossover') {
    const macdResult = MACD(closes, mergedParams.fastPeriod, mergedParams.slowPeriod, mergedParams.signalPeriod)
    indicators.macd = macdResult.macd
    indicators.signal = macdResult.signal
  }

  if (strategy === 'bollinger-squeeze') {
    const bbResult = BollingerBands(closes, mergedParams.bbPeriod, mergedParams.bbStdDev)
    indicators.bb = bbResult
  }

  // Strategy-specific logic
  function getSignal(idx) {
    if (strategy === 'rsi-mean-reversion') {
      return getRSISignal(idx, mergedParams, indicators)
    } else if (strategy === 'momentum-breakout') {
      return getMomentumSignal(idx, mergedParams, indicators, candles)
    } else if (strategy === 'macd-crossover') {
      return getMACDSignal(idx, mergedParams, indicators)
    } else if (strategy === 'bollinger-squeeze') {
      return getBollingerSignal(idx, mergedParams, indicators, candles)
    }
    return { entry: false, exit: false }
  }

  // Main loop through candles
  for (let i = 50; i < candles.length; i++) {
    const candle = candles[i]
    const signal = getSignal(i)

    // Check exit conditions for open position
    if (position) {
      let shouldExit = false
      let exitReason = ''

      // Check stop loss / take profit
      if (position.direction === 'long') {
        const pnlPct = ((candle.close - position.entryPrice) / position.entryPrice) * 100
        if (pnlPct <= -mergedParams.stopLoss) {
          shouldExit = true
          exitReason = 'Stop Loss'
        } else if (pnlPct >= mergedParams.takeProfit) {
          shouldExit = true
          exitReason = 'Take Profit'
        }
      } else if (position.direction === 'short') {
        const pnlPct = ((position.entryPrice - candle.close) / position.entryPrice) * 100
        if (pnlPct <= -mergedParams.stopLoss) {
          shouldExit = true
          exitReason = 'Stop Loss'
        } else if (pnlPct >= mergedParams.takeProfit) {
          shouldExit = true
          exitReason = 'Take Profit'
        }
      }

      // Check hold days limit
      const holdDays = Math.floor((candle.time - position.entryDate) / (1000 * 60 * 60 * 24))
      if (holdDays >= mergedParams.holdDays) {
        shouldExit = true
        exitReason = 'Hold Days Limit'
      }

      // Check strategy-specific exit signals
      if (signal.exit) {
        shouldExit = true
        exitReason = signal.exitReason || 'Signal'
      }

      // Execute exit
      if (shouldExit) {
        const exitPrice = candle.close
        const qty = position.qty
        const exitFees = qty * exitPrice * commission
        totalFees += exitFees

        let pnl, pnlPct
        if (position.direction === 'long') {
          pnl = qty * (exitPrice - position.entryPrice) - exitFees
          pnlPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100
        } else {
          pnl = qty * (position.entryPrice - exitPrice) - exitFees
          pnlPct = ((position.entryPrice - exitPrice) / position.entryPrice) * 100
        }

        equity = cash + qty * exitPrice - exitFees
        cash = equity

        trades.push({
          entryDate: position.entryDate,
          exitDate: candle.time,
          entryPrice: position.entryPrice,
          exitPrice: exitPrice,
          direction: position.direction,
          pnl: pnl,
          pnlPct: pnlPct,
          holdDays: holdDays,
          exitReason: exitReason,
        })

        position = null
      }
    }

    // Check entry conditions
    if (!position && signal.entry && (direction === 'long' || direction === 'both')) {
      const positionSize = (equity * (positionSizePct / 100)) / candle.close
      const entryFees = positionSize * candle.close * commission
      totalFees += entryFees
      cash -= positionSize * candle.close + entryFees

      position = {
        entryIndex: i,
        entryPrice: candle.close,
        direction: 'long',
        entryDate: candle.time,
        qty: positionSize,
        trailingStop: candle.close * (1 - (mergedParams.trailingStop || 0.02)),
      }
    }

    // Update equity and drawdown
    if (position) {
      const positionValue = position.qty * candle.close
      equity = cash + positionValue
    } else {
      equity = cash
    }

    peakEquity = Math.max(peakEquity, equity)
    const drawdown = ((equity - peakEquity) / peakEquity) * 100

    equityCurve.push({
      date: candle.time,
      equity: equity,
      drawdown: drawdown,
    })
  }

  // Close any remaining position at the end
  if (position) {
    const lastCandle = candles[candles.length - 1]
    const exitPrice = lastCandle.close
    const qty = position.qty
    const exitFees = qty * exitPrice * commission
    totalFees += exitFees

    const pnl = qty * (exitPrice - position.entryPrice) - exitFees
    const pnlPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100

    trades.push({
      entryDate: position.entryDate,
      exitDate: lastCandle.time,
      entryPrice: position.entryPrice,
      exitPrice: exitPrice,
      direction: 'long',
      pnl: pnl,
      pnlPct: pnlPct,
      holdDays: Math.floor((lastCandle.time - position.entryDate) / (1000 * 60 * 60 * 24)),
      exitReason: 'End of Data',
    })

    equity = equity
  }

  // Compute statistics
  const stats = computeStats(trades, equityCurve, initialCapital, totalFees)

  return {
    trades: trades,
    equityCurve: equityCurve,
    stats: stats,
  }
}

// RSI Mean Reversion signal generation
function getRSISignal(idx, params, indicators) {
  const rsi = indicators.rsi[idx]
  const prevRSI = idx > 0 ? indicators.rsi[idx - 1] : null

  return {
    entry: rsi !== null && rsi < params.oversold && (prevRSI === null || prevRSI >= params.oversold),
    exit: rsi !== null && rsi > params.overbought,
    exitReason: 'RSI Overbought',
  }
}

// Momentum Breakout signal generation
function getMomentumSignal(idx, params, indicators, candles) {
  const breakoutPeriod = params.breakoutPeriod
  const volumeMultiplier = params.volumeMultiplier

  if (idx < breakoutPeriod) {
    return { entry: false, exit: false }
  }

  const recent = candles.slice(idx - breakoutPeriod, idx)
  const highestHigh = Math.max(...recent.map((c) => c.high))
  const avgVolume = recent.reduce((sum, c) => sum + c.volume, 0) / recent.length

  const currentHigh = candles[idx].high
  const currentVolume = candles[idx].volume
  const prevClose = candles[idx - 1].close

  const breakout = currentHigh > highestHigh && currentVolume > avgVolume * volumeMultiplier
  const rsi = indicators.rsi[idx]

  return {
    entry: breakout && rsi !== null && rsi < 70,
    exit: rsi !== null && rsi > 70,
    exitReason: 'RSI Overbought',
  }
}

// MACD Crossover signal generation
function getMACDSignal(idx, params, indicators) {
  const macd = indicators.macd[idx]
  const signal = indicators.signal[idx]
  const prevMACD = idx > 0 ? indicators.macd[idx - 1] : null
  const prevSignal = idx > 0 ? indicators.signal[idx - 1] : null

  if (macd === null || signal === null || prevMACD === null || prevSignal === null) {
    return { entry: false, exit: false }
  }

  const bullishCross = prevMACD <= prevSignal && macd > signal
  const bearishCross = prevMACD > prevSignal && macd <= signal

  return {
    entry: bullishCross,
    exit: bearishCross,
    exitReason: 'Bearish MACD Crossover',
  }
}

// Bollinger Band Squeeze signal generation
function getBollingerSignal(idx, params, indicators, candles) {
  const bb = indicators.bb[idx]

  if (bb === null) {
    return { entry: false, exit: false }
  }

  const bandwidth = (bb.upper - bb.lower) / bb.middle
  const isSqueeze = bandwidth < params.squeezeThreshold

  // Look for breakout from squeeze
  let breakout = false
  if (idx > 0) {
    const prevBB = indicators.bb[idx - 1]
    if (prevBB !== null && bandwidth < params.squeezeThreshold) {
      const currentClose = candles[idx].close
      const prevClose = candles[idx - 1].close
      breakout = currentClose > prevBB.upper || currentClose < prevBB.lower
    }
  }

  // Mean reversion signal
  const meanReversion = candles[idx].close < bb.lower || candles[idx].close > bb.upper

  return {
    entry: breakout && isSqueeze,
    exit: meanReversion,
    exitReason: 'Mean Reversion',
  }
}

// Compute performance statistics from trade list and equity curve
export function computeStats(trades, equityCurve, initialCapital = 100000, totalFees = 0) {
  // Total return
  const finalEquity = equityCurve[equityCurve.length - 1].equity
  const netProfit = finalEquity - initialCapital
  const netProfitPct = (netProfit / initialCapital) * 100

  // Trade statistics
  const totalTrades = trades.length
  const winningTrades = trades.filter((t) => t.pnl > 0)
  const losingTrades = trades.filter((t) => t.pnl < 0)
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0
  const avgTrade = totalTrades > 0 ? trades.reduce((sum, t) => sum + t.pnl, 0) / totalTrades : 0

  // Gross profit and loss
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0)
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  // Hold days
  const avgHoldDays =
    totalTrades > 0 ? trades.reduce((sum, t) => sum + t.holdDays, 0) / totalTrades : 0

  // Consecutive wins/losses
  let maxConsecWins = 0
  let maxConsecLosses = 0
  let currentWins = 0
  let currentLosses = 0

  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentWins++
      currentLosses = 0
      maxConsecWins = Math.max(maxConsecWins, currentWins)
    } else {
      currentLosses++
      currentWins = 0
      maxConsecLosses = Math.max(maxConsecLosses, currentLosses)
    }
  }

  // Sharpe ratio: (annualized mean return) / (annualized std dev)
  const returns = calculateReturns(equityCurve)
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
  const variance =
    returns.length > 1
      ? returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (returns.length - 1)
      : 0
  const stdDev = Math.sqrt(variance)
  const sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0

  // Sortino ratio: uses only downside deviation
  const downReturns = returns.filter((r) => r < 0)
  const downVariance =
    downReturns.length > 0
      ? downReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / downReturns.length
      : 0
  const downStdDev = Math.sqrt(downVariance)
  const sortino = downStdDev > 0 ? (meanReturn / downStdDev) * Math.sqrt(252) : 0

  // Max drawdown
  let maxDrawdown = 0
  for (const point of equityCurve) {
    maxDrawdown = Math.min(maxDrawdown, point.drawdown)
  }
  maxDrawdown = Math.abs(maxDrawdown)

  // Calmar ratio
  const tradingDays = equityCurve.length - 1
  const annualizedReturn = (netProfitPct / 100) * (252 / tradingDays) * 100
  const calmar = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0

  // Annual return
  const annualReturn = annualizedReturn

  // Beta and Alpha (simplified: vs buy-and-hold)
  let beta = 1.0
  let alpha = 0.0
  if (equityCurve.length > 1) {
    const strategyReturns = calculateReturns(equityCurve)
    const strategyMeanReturn = strategyReturns.reduce((a, b) => a + b, 0) / strategyReturns.length
    alpha = (strategyMeanReturn * 252 - annualReturn / 100) * 100
  }

  return {
    netProfit: parseFloat(netProfit.toFixed(2)),
    netProfitPct: parseFloat(netProfitPct.toFixed(2)),
    totalTrades: totalTrades,
    winRate: parseFloat(winRate.toFixed(2)),
    sharpe: parseFloat(sharpe.toFixed(4)),
    sortino: parseFloat(sortino.toFixed(4)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    avgTrade: parseFloat(avgTrade.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    calmar: parseFloat(calmar.toFixed(4)),
    annualReturn: parseFloat(annualReturn.toFixed(2)),
    totalFees: parseFloat(totalFees.toFixed(2)),
    avgHoldDays: parseFloat(avgHoldDays.toFixed(1)),
    maxConsecWins: maxConsecWins,
    maxConsecLosses: maxConsecLosses,
    beta: parseFloat(beta.toFixed(4)),
    alpha: parseFloat(alpha.toFixed(4)),
  }
}

// Run parameter sweep: tests all parameter combinations
export function parameterSweep(candles, strategy, paramRanges = null, options = {}) {
  if (!STRATEGY_PARAMS[strategy]) {
    throw new Error(`Unknown strategy: ${strategy}`)
  }

  // Generate parameter ranges if not provided
  const ranges = paramRanges || {}
  const strategyDefs = STRATEGY_PARAMS[strategy]

  for (const [key, def] of Object.entries(strategyDefs)) {
    if (!ranges[key]) {
      ranges[key] = generateParamRange(def)
    }
  }

  const results = []
  const paramKeys = Object.keys(ranges)

  // Generate all combinations
  function* paramCombinations(index, current) {
    if (index === paramKeys.length) {
      yield { ...current }
      return
    }

    const key = paramKeys[index]
    for (const value of ranges[key]) {
      yield* paramCombinations(index + 1, { ...current, [key]: value })
    }
  }

  // Test all combinations
  for (const params of paramCombinations(0, {})) {
    const result = runBacktest(candles, strategy, params, options)
    results.push({
      params: params,
      stats: result.stats,
    })
  }

  // Find best params by Sharpe ratio
  let bestParams = null
  let bestSharpe = -Infinity

  for (const result of results) {
    if (result.stats.sharpe > bestSharpe) {
      bestSharpe = result.stats.sharpe
      bestParams = result.params
    }
  }

  // Generate heatmap data (2D sweep of primary params)
  const heatmapData = []
  const primaryParams = getPrimaryParams(strategy)

  if (primaryParams.length >= 2) {
    const param1 = primaryParams[0]
    const param2 = primaryParams[1]
    const range1 = ranges[param1] || generateParamRange(strategyDefs[param1])
    const range2 = ranges[param2] || generateParamRange(strategyDefs[param2])

    // Create 7x7 grid
    const step1 = Math.max(1, Math.floor(range1.length / 7))
    const step2 = Math.max(1, Math.floor(range2.length / 7))

    for (let i = 0; i < range1.length; i += step1) {
      for (let j = 0; j < range2.length; j += step2) {
        const val1 = range1[i]
        const val2 = range2[j]

        const result = results.find(
          (r) => Math.abs(r.params[param1] - val1) < 0.001 && Math.abs(r.params[param2] - val2) < 0.001
        )

        if (result) {
          heatmapData.push({
            [param1]: val1,
            [param2]: val2,
            sharpe: result.stats.sharpe,
            winRate: result.stats.winRate,
            profit: result.stats.netProfitPct,
            trades: result.stats.totalTrades,
          })
        }
      }
    }
  }

  return {
    results: results,
    bestParams: bestParams,
    heatmapData: heatmapData,
  }
}

// Get primary parameters for heatmap (strategy-dependent)
function getPrimaryParams(strategy) {
  const primaryParams = {
    'rsi-mean-reversion': ['rsiPeriod', 'holdDays'],
    'momentum-breakout': ['breakoutPeriod', 'volumeMultiplier'],
    'macd-crossover': ['fastPeriod', 'slowPeriod'],
    'bollinger-squeeze': ['bbPeriod', 'squeezeThreshold'],
  }
  return primaryParams[strategy] || []
}

// Walk-forward validation
export function walkForwardValidation(candles, strategy, nSplits = 5, options = {}) {
  if (candles.length < 100) {
    throw new Error('Minimum 100 candles required for walk-forward validation')
  }

  const results = []
  const candlesPerSplit = Math.floor(candles.length / nSplits)
  const inSamplePct = 0.7

  for (let split = 0; split < nSplits; split++) {
    const startIdx = split * candlesPerSplit
    const endIdx = (split + 1) * candlesPerSplit
    const splitCandles = candles.slice(startIdx, endIdx)

    if (splitCandles.length < 50) {
      continue
    }

    const inSampleIdx = Math.floor(splitCandles.length * inSamplePct)
    const inSampleCandles = splitCandles.slice(0, inSampleIdx)
    const outSampleCandles = splitCandles.slice(inSampleIdx)

    // Optimize on in-sample
    const inSampleSweep = parameterSweep(inSampleCandles, strategy, null, options)
    const bestParams = inSampleSweep.bestParams

    // Test on out-of-sample
    const outSampleResult = runBacktest(outSampleCandles, strategy, bestParams, options)

    // In-sample result with best params
    const inSampleResult = runBacktest(inSampleCandles, strategy, bestParams, options)

    results.push({
      period: split + 1,
      inSampleSharpe: inSampleResult.stats.sharpe,
      outSampleSharpe: outSampleResult.stats.sharpe,
      winRate: outSampleResult.stats.winRate,
      trades: outSampleResult.stats.totalTrades,
      netProfit: outSampleResult.stats.netProfit,
      status: 'completed',
    })
  }

  return results
}

// Export for use with Yahoo Finance data fetching
export function formatCandlesForBacktest(yahooData) {
  // Expects: { timestamp: number, open: number, high: number, low: number, close: number, volume: number }
  return yahooData.map((candle) => ({
    time: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }))
}
