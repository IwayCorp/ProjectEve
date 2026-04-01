// ============================================================================
// NOCTIS — PREDICTION ENGINE
// Generates price predictions and tracks historical accuracy
// ============================================================================

// Position timeframe options
export const TIMEFRAMES = [
  { id: '30m', label: '30 min', minutes: 30 },
  { id: '1h', label: '1 hour', minutes: 60 },
  { id: '4h', label: '4 hours', minutes: 240 },
  { id: '1d', label: '1 day', minutes: 1440 },
  { id: '4d', label: '4 days', minutes: 5760 },
  { id: '1w', label: '1 week', minutes: 10080 },
  { id: '2w', label: '2 weeks', minutes: 20160 },
  { id: '1mo', label: '1 month', minutes: 43200 },
]

// Generate a prediction curve based on current price, target, and timeframe
// Uses a probabilistic model with momentum/mean-reversion weights
export function generatePrediction(currentPrice, target, stopLoss, direction, timeframeMinutes, rsi, strategy) {
  if (!currentPrice || !target || !stopLoss) return null

  const isLong = direction === 'long'
  const points = 50 // Data points in the prediction curve
  const totalReturn = isLong ? (target - currentPrice) / currentPrice : (currentPrice - target) / currentPrice

  // Confidence based on R:R and RSI
  const rr = isLong
    ? (target - currentPrice) / (currentPrice - stopLoss)
    : (currentPrice - target) / (stopLoss - currentPrice)

  let confidence = 0.5 // base
  if (rr >= 3) confidence += 0.15
  else if (rr >= 2) confidence += 0.10
  if (rsi < 30 && isLong) confidence += 0.12
  else if (rsi > 70 && !isLong) confidence += 0.12

  // Strategy-specific adjustments
  if (strategy === 'momentum') confidence += 0.05
  if (strategy === 'mean-reversion' && ((rsi < 25 && isLong) || (rsi > 75 && !isLong))) confidence += 0.08

  confidence = Math.min(0.85, Math.max(0.35, confidence))

  // Generate prediction path with noise
  const predictedPath = []
  const volatility = Math.abs(totalReturn) * 0.15 // 15% of total move as daily noise
  let cumulativeReturn = 0

  // Estimate when entry zone is hit (in % of timeframe)
  const entryPct = 0.15 + Math.random() * 0.20

  for (let i = 0; i <= points; i++) {
    const t = i / points
    const timeLabel = getTimeLabel(t * timeframeMinutes, timeframeMinutes)

    // S-curve progression (accelerating then decelerating)
    let trend
    if (t < entryPct) {
      // Pre-entry: slight drift toward entry zone
      trend = (t / entryPct) * 0.1 * totalReturn
    } else {
      // Post-entry: move toward target
      const postEntryT = (t - entryPct) / (1 - entryPct)
      trend = 0.1 * totalReturn + totalReturn * 0.9 * (1 - Math.exp(-3 * postEntryT)) * confidence
    }

    // Add controlled noise
    const noise = (Math.random() - 0.5) * volatility * Math.sin(t * Math.PI)
    cumulativeReturn = trend + noise

    const price = currentPrice * (1 + cumulativeReturn)
    const pctFromEntry = ((price - currentPrice) / currentPrice) * 100

    predictedPath.push({
      index: i,
      time: timeLabel,
      price: Math.round(price * 100) / 100,
      predicted: Math.round(price * 100) / 100,
      pctChange: Math.round(pctFromEntry * 100) / 100,
    })
  }

  // Generate confidence bands (high/low)
  const upperBand = predictedPath.map((p, i) => ({
    ...p,
    price: p.price * (1 + volatility * (i / points) * 1.5),
  }))
  const lowerBand = predictedPath.map((p, i) => ({
    ...p,
    price: p.price * (1 - volatility * (i / points) * 1.5),
  }))

  // Estimated entry date (when price reaches entry zone)
  const entryTimeMinutes = entryPct * timeframeMinutes
  const estimatedEntryDate = new Date(Date.now() + entryTimeMinutes * 60000)

  // Estimated target date
  const targetHitPct = entryPct + (1 - entryPct) * (0.6 + Math.random() * 0.3) * (1 / confidence)
  const targetTimeMinutes = Math.min(timeframeMinutes, targetHitPct * timeframeMinutes)
  const estimatedTargetDate = new Date(Date.now() + targetTimeMinutes * 60000)

  return {
    path: predictedPath,
    upperBand,
    lowerBand,
    confidence: Math.round(confidence * 100),
    estimatedEntryDate,
    estimatedTargetDate,
    expectedReturn: Math.round(totalReturn * confidence * 10000) / 100,
    riskReward: Math.round(rr * 10) / 10,
    timeframe: timeframeMinutes,
  }
}

function getTimeLabel(minutes, totalMinutes) {
  if (totalMinutes <= 60) return `${Math.round(minutes)}m`
  if (totalMinutes <= 1440) return `${Math.round(minutes / 60 * 10) / 10}h`
  return `D${Math.round(minutes / 1440 * 10) / 10}`
}

// ============================================================================
// HISTORICAL TRACKING
// ============================================================================

// Generate mock historical trade data for demo
export function generateHistoricalTrades() {
  const outcomes = []
  const mockTrades = [
    { id: 'H1', ticker: 'NVDA', direction: 'long', entry: 750, target: 820, stop: 720, entryDate: '2026-03-01', exitDate: '2026-03-05', exitPrice: 815, strategy: 'momentum', thesis: 'AI infrastructure capex cycle acceleration with earnings beat catalyst' },
    { id: 'H2', ticker: 'XLE', direction: 'short', entry: 85, target: 78, stop: 89, entryDate: '2026-03-02', exitDate: '2026-03-06', exitPrice: 79.5, strategy: 'momentum', thesis: 'Energy sector overextended on geopolitical premium, mean-reversion setup' },
    { id: 'H3', ticker: 'EURUSD', direction: 'long', entry: 1.0820, target: 1.0950, stop: 1.0750, entryDate: '2026-03-03', exitDate: '2026-03-07', exitPrice: 1.0870, strategy: 'carry', thesis: 'ECB hawkish pivot creating EUR demand vs dovish Fed expectations' },
    { id: 'H4', ticker: 'GC=F', direction: 'long', entry: 2280, target: 2350, stop: 2240, entryDate: '2026-03-05', exitDate: '2026-03-09', exitPrice: 2365, strategy: 'macro', thesis: 'Safe-haven demand surge from Iran tensions, central bank buying acceleration' },
    { id: 'H5', ticker: 'TSLA', direction: 'short', entry: 180, target: 155, stop: 195, entryDate: '2026-03-07', exitDate: '2026-03-11', exitPrice: 162, strategy: 'mean-reversion', thesis: 'Price extended 3 sigma above mean, deliveries miss likely from China competition' },
    { id: 'H6', ticker: 'MSFT', direction: 'long', entry: 385, target: 420, stop: 368, entryDate: '2026-03-08', exitDate: '2026-03-12', exitPrice: 405, strategy: 'mean-reversion', thesis: 'RSI oversold at 18, historically mean-reverts within 5 trading days' },
    { id: 'H7', ticker: 'USDJPY', direction: 'short', entry: 151.50, target: 148.00, stop: 153.50, entryDate: '2026-03-10', exitDate: '2026-03-14', exitPrice: 153.20, strategy: 'macro', thesis: 'BoJ hawkish lean, intervention risk elevated at 152+ level' },
    { id: 'H8', ticker: 'RTX', direction: 'long', entry: 118, target: 132, stop: 112, entryDate: '2026-03-12', exitDate: '2026-03-16', exitPrice: 128, strategy: 'momentum', thesis: 'Defense spending acceleration, backlog growth above consensus' },
    { id: 'H9', ticker: 'XOM', direction: 'long', entry: 108, target: 120, stop: 102, entryDate: '2026-03-14', exitDate: '2026-03-18', exitPrice: 117, strategy: 'breakout', thesis: 'Oil price breakout above $82, upstream margins expanding' },
    { id: 'H10', ticker: 'DIS', direction: 'short', entry: 92, target: 82, stop: 98, entryDate: '2026-03-16', exitDate: '2026-03-20', exitPrice: 88, strategy: 'momentum', thesis: 'Streaming profitability not credible, parks segment slowing' },
    { id: 'H11', ticker: 'AAPL', direction: 'long', entry: 195, target: 215, stop: 185, entryDate: '2026-03-18', exitDate: '2026-03-22', exitPrice: 208, strategy: 'breakout', thesis: 'iPhone 17 pre-order data above street, services revenue re-acceleration' },
    { id: 'H12', ticker: 'CL=F', direction: 'long', entry: 80, target: 92, stop: 75, entryDate: '2026-03-20', exitDate: '2026-03-24', exitPrice: 85.50, strategy: 'macro', thesis: 'Iran tensions escalation, OPEC+ supply discipline maintaining' },
    { id: 'H13', ticker: 'BYND', direction: 'short', entry: 8.50, target: 5.50, stop: 10.50, entryDate: '2026-03-22', exitDate: '2026-03-26', exitPrice: 6.20, strategy: 'momentum', thesis: 'Cash burn unsustainable, market share erosion to legacy food companies' },
    { id: 'H14', ticker: 'JPM', direction: 'long', entry: 195, target: 215, stop: 185, entryDate: '2026-03-24', exitDate: '2026-03-28', exitPrice: 200, strategy: 'relative-value', thesis: 'Banking sector undervalued relative to spread environment, buyback support' },
    { id: 'H15', ticker: 'GBPUSD', direction: 'long', entry: 1.2650, target: 1.2850, stop: 1.2520, entryDate: '2026-03-26', exitDate: '2026-03-30', exitPrice: 1.2580, strategy: 'carry', thesis: 'BoE rate differential widening, UK economic data surprising upside' },
  ]

  return mockTrades.map(trade => {
    const isLong = trade.direction === 'long'
    const returnPct = isLong
      ? ((trade.exitPrice - trade.entry) / trade.entry) * 100
      : ((trade.entry - trade.exitPrice) / trade.entry) * 100
    const targetPct = isLong
      ? ((trade.target - trade.entry) / trade.entry) * 100
      : ((trade.entry - trade.target) / trade.entry) * 100
    const hit = isLong
      ? trade.exitPrice >= trade.target
      : trade.exitPrice <= trade.target
    const stopped = isLong
      ? trade.exitPrice <= trade.stop
      : trade.exitPrice >= trade.stop

    return {
      ...trade,
      returnPct: Math.round(returnPct * 100) / 100,
      targetPct: Math.round(targetPct * 100) / 100,
      hit,
      stopped,
      outcome: hit ? 'TARGET' : stopped ? 'STOPPED' : returnPct > 0 ? 'PARTIAL_WIN' : 'PARTIAL_LOSS',
    }
  })
}

// Compute aggregate stats from historical trades
export function computeStats(trades) {
  if (!trades.length) return {}

  const wins = trades.filter(t => t.returnPct > 0)
  const losses = trades.filter(t => t.returnPct <= 0)
  const targets = trades.filter(t => t.hit)
  const stopped = trades.filter(t => t.stopped)

  const totalReturn = trades.reduce((sum, t) => sum + t.returnPct, 0)
  const avgReturn = totalReturn / trades.length
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.returnPct, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.returnPct, 0) / losses.length : 0

  // Sharpe-like ratio (simplified)
  const returns = trades.map(t => t.returnPct)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252 / 4) : 0 // Annualized for 4-day trades

  // Profit factor
  const grossProfit = wins.reduce((s, t) => s + t.returnPct, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.returnPct, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  // Max drawdown (sequential)
  let peak = 0, maxDD = 0, cumulative = 0
  for (const t of trades) {
    cumulative += t.returnPct
    if (cumulative > peak) peak = cumulative
    const dd = peak - cumulative
    if (dd > maxDD) maxDD = dd
  }

  // Strategy breakdown
  const byStrategy = {}
  for (const t of trades) {
    if (!byStrategy[t.strategy]) byStrategy[t.strategy] = { trades: 0, wins: 0, totalReturn: 0 }
    byStrategy[t.strategy].trades++
    if (t.returnPct > 0) byStrategy[t.strategy].wins++
    byStrategy[t.strategy].totalReturn += t.returnPct
  }

  return {
    total: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round((wins.length / trades.length) * 100),
    targetHitRate: Math.round((targets.length / trades.length) * 100),
    stopHitRate: Math.round((stopped.length / trades.length) * 100),
    totalReturn: Math.round(totalReturn * 100) / 100,
    avgReturn: Math.round(avgReturn * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDD * 100) / 100,
    byStrategy,
  }
}
