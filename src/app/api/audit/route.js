export const runtime = 'edge'

// ============ CONSTANTS ============

const MAX_SIGNALS = 500
const LEARNING_MODE_THRESHOLD = 20
const ANNUALIZATION_FACTOR = Math.sqrt(252)

const STRATEGIES = ['momentum', 'meanReversion', 'breakout']
const REGIMES = ['trending-bull', 'trending-bear', 'mean-reverting', 'volatile-transition']

const DEFAULT_WEIGHTS = {
  'trending-bull':       { momentum: 0.50, meanReversion: 0.20, breakout: 0.30 },
  'trending-bear':       { momentum: 0.45, meanReversion: 0.30, breakout: 0.25 },
  'mean-reverting':      { momentum: 0.25, meanReversion: 0.55, breakout: 0.20 },
  'volatile-transition': { momentum: 0.30, meanReversion: 0.35, breakout: 0.35 },
}

const DEFAULT_FACTOR_WEIGHTS = {
  rsi: 0.15, adx: 0.15, hurst: 0.10,
  alphaComposite: 0.20, ensembleScore: 0.20,
  sentiment: 0.10, regimeConfidence: 0.10,
}

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// ============ IN-MEMORY STATE (persists across requests on same edge instance) ============

let state = null

// ============ MATH HELPERS ============

function mean(arr) {
  if (!arr || arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function stddev(arr) {
  if (!arr || arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

function sharpeRatio(returns) {
  if (!returns || returns.length < 2) return 0
  const sd = stddev(returns)
  if (sd === 0) return 0
  return (mean(returns) / sd) * ANNUALIZATION_FACTOR
}

function profitFactor(returns) {
  if (!returns || returns.length === 0) return 0
  const wins = returns.filter(r => r > 0).reduce((s, v) => s + v, 0)
  const losses = Math.abs(returns.filter(r => r < 0).reduce((s, v) => s + v, 0))
  if (losses === 0) return wins > 0 ? Infinity : 0
  return wins / losses
}

function maxDrawdown(returns) {
  if (!returns || returns.length === 0) return 0
  let equity = 1, peak = 1, maxDD = 0
  for (const r of returns) {
    equity *= (1 + r)
    if (equity > peak) peak = equity
    const dd = (peak - equity) / peak
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

function kellyFraction(winRate, avgWin, avgLoss) {
  if (avgWin === 0) return 0
  return (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin
}

function expectedValue(winRate, avgWin, avgLoss) {
  return winRate * avgWin - (1 - winRate) * avgLoss
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ============ CLASSIFICATION HELPERS ============

function confidenceBucket(confidence) {
  if (confidence >= 80) return '80+'
  if (confidence >= 70) return '70-80'
  if (confidence >= 60) return '60-70'
  return '50-60'
}

function timeframeBucket(hours) {
  if (hours <= 8) return 'dayTrade'
  if (hours <= 120) return 'swing'
  return 'position'
}

function normaliseStrategy(strat) {
  if (!strat) return 'momentum'
  const s = strat.toLowerCase().replace(/[^a-z]/g, '')
  if (s.includes('meanrev') || s.includes('reversion')) return 'meanReversion'
  if (s.includes('breakout')) return 'breakout'
  return 'momentum'
}

function classifyAsset(ticker) {
  if (!ticker) return 'equity'
  const t = ticker.toUpperCase()
  const forexPairs = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']
  if (t.includes('/')) {
    const [base] = t.split('/')
    if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK'].includes(base)) return 'crypto'
    if (forexPairs.includes(base)) return 'forex'
  }
  if (t.startsWith('/') || t.startsWith('MES') || t.startsWith('MNQ') || t.startsWith('ES') || t.startsWith('NQ')) return 'futures'
  if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].some(c => t.startsWith(c))) return 'crypto'
  return 'equity'
}

// ============ METRICS ============

function computeMetrics(signals) {
  const empty = {
    winRate: 0, avgReturn: 0, sharpeRatio: 0,
    maxDrawdown: 0, profitFactor: 0, kellyFraction: 0,
    expectedValue: 0, tradeCount: 0,
  }
  if (!signals || signals.length === 0) return empty
  const returns = signals.map(s => s.actualReturn || 0)
  const wins = returns.filter(r => r > 0)
  const losses = returns.filter(r => r < 0)
  const wr = wins.length / returns.length
  const avgWin = wins.length > 0 ? mean(wins) : 0
  const avgLoss = losses.length > 0 ? Math.abs(mean(losses)) : 0
  return {
    winRate: wr,
    avgReturn: mean(returns),
    sharpeRatio: sharpeRatio(returns),
    maxDrawdown: maxDrawdown(returns),
    profitFactor: profitFactor(returns),
    kellyFraction: kellyFraction(wr, avgWin, avgLoss),
    expectedValue: expectedValue(wr, avgWin, avgLoss),
    tradeCount: returns.length,
  }
}

function computeRollingMetrics(signals) {
  const sorted = [...signals].sort((a, b) => (b.resolvedAt || b.timestamp) - (a.resolvedAt || a.timestamp))
  return {
    last20: computeMetrics(sorted.slice(0, 20)),
    last50: computeMetrics(sorted.slice(0, 50)),
    last100: computeMetrics(sorted.slice(0, 100)),
    allTime: computeMetrics(sorted),
  }
}

function metricsByGroup(signals, keyFn) {
  const groups = {}
  for (const s of signals) {
    const key = keyFn(s)
    if (!key) continue
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  const result = {}
  for (const [key, list] of Object.entries(groups)) {
    result[key] = computeRollingMetrics(list)
  }
  return result
}

// ============ STATE MANAGEMENT ============

function freshState() {
  return {
    signals: [],
    metrics: {
      overall: computeMetrics([]),
      byStrategy: {},
      byRegime: {},
      byTimeframe: {},
      byConfidenceBucket: {},
      byAssetClass: {},
    },
    corrections: [],
    anomalies: [],
    adaptiveWeights: JSON.parse(JSON.stringify(DEFAULT_WEIGHTS)),
    factorWeights: { ...DEFAULT_FACTOR_WEIGHTS },
    minimumConfidence: 50,
    lastAuditAt: null,
    briefs: { preMarket: null, midday: null, postClose: null },
  }
}

function ensureInit() {
  if (!state) state = freshState()
}

function resolvedSignals() {
  if (!state) return []
  return state.signals.filter(s => s.outcome && s.outcome !== 'OPEN')
}

// ============ ADAPTIVE RECALCULATIONS ============

function recalculateAdaptiveWeights() {
  const resolved = resolvedSignals()
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    state.adaptiveWeights = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS))
    return
  }
  for (const regime of REGIMES) {
    const regimeSignals = resolved.filter(s => s.regime === regime)
    if (regimeSignals.length < 5) {
      state.adaptiveWeights[regime] = { ...DEFAULT_WEIGHTS[regime] }
      continue
    }
    const stratPerf = {}
    for (const strat of STRATEGIES) {
      const stratSignals = regimeSignals.filter(s => normaliseStrategy(s.strategy) === strat)
      if (stratSignals.length < 3) {
        stratPerf[strat] = { winRate: 0.5, ev: 0, count: 0 }
      } else {
        const returns = stratSignals.map(s => s.actualReturn || 0)
        const wins = returns.filter(r => r > 0)
        const losses = returns.filter(r => r < 0)
        const wr = wins.length / returns.length
        const avgW = wins.length > 0 ? mean(wins) : 0
        const avgL = losses.length > 0 ? Math.abs(mean(losses)) : 0
        stratPerf[strat] = { winRate: wr, ev: expectedValue(wr, avgW, avgL), count: stratSignals.length }
      }
    }
    const evs = STRATEGIES.map(s => Math.max(stratPerf[s].ev, 0.001))
    const total = evs.reduce((a, b) => a + b, 0)
    const raw = {}
    STRATEGIES.forEach((s, i) => { raw[s] = evs[i] / total })
    const blended = {}
    const base = DEFAULT_WEIGHTS[regime]
    for (const strat of STRATEGIES) {
      blended[strat] = Math.max(0.05, raw[strat] * 0.6 + (base[strat] || 0.33) * 0.4)
    }
    const bTotal = STRATEGIES.reduce((s, k) => s + blended[k], 0)
    for (const strat of STRATEGIES) blended[strat] = blended[strat] / bTotal
    state.adaptiveWeights[regime] = blended
  }
}

function recalculateFactorWeights() {
  const resolved = resolvedSignals()
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    state.factorWeights = { ...DEFAULT_FACTOR_WEIGHTS }
    return
  }
  const factorKeys = ['rsiAtEntry', 'adxAtEntry', 'hurstAtEntry', 'alphaComposite', 'ensembleScore', 'sentimentScore', 'regimeConfidence']
  const canonicalKeys = ['rsi', 'adx', 'hurst', 'alphaComposite', 'ensembleScore', 'sentiment', 'regimeConfidence']
  const scores = {}
  for (let i = 0; i < factorKeys.length; i++) {
    const fk = factorKeys[i], ck = canonicalKeys[i]
    const withFactor = resolved.filter(s => s.factors && s.factors[fk] != null)
    if (withFactor.length < 10) { scores[ck] = 1.0; continue }
    const winVals = withFactor.filter(s => (s.actualReturn || 0) > 0).map(s => s.factors[fk])
    const lossVals = withFactor.filter(s => (s.actualReturn || 0) <= 0).map(s => s.factors[fk])
    if (winVals.length === 0 || lossVals.length === 0) { scores[ck] = 1.0; continue }
    const pooledStd = (stddev(winVals) + stddev(lossVals)) / 2 || 1
    scores[ck] = Math.max(0.1, Math.abs(mean(winVals) - mean(lossVals)) / pooledStd)
  }
  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  for (const key of canonicalKeys) {
    state.factorWeights[key] = (scores[key] || 1) / total
  }
}

function recalculateMinimumConfidence() {
  const resolved = resolvedSignals()
  if (resolved.length < LEARNING_MODE_THRESHOLD) { state.minimumConfidence = 50; return }
  const thresholds = [50, 60, 70, 80]
  let breakEven = 50
  for (const t of thresholds) {
    const bucket = resolved.filter(s => s.confidence >= t)
    if (bucket.length >= 5 && mean(bucket.map(s => s.actualReturn || 0)) > 0) {
      breakEven = t
      break
    }
  }
  state.minimumConfidence = Math.max(50, breakEven - 5)
}

// ============ ANOMALY DETECTION ============

function detectAnomalies() {
  const resolved = resolvedSignals()
  const anomalies = []
  const now = Date.now()
  if (resolved.length < 10) return anomalies
  const recent = [...resolved].sort((a, b) => (b.resolvedAt || b.timestamp) - (a.resolvedAt || a.timestamp))
  const last20 = recent.slice(0, 20)
  if (last20.length >= 20) {
    const wr = last20.filter(s => (s.actualReturn || 0) > 0).length / last20.length
    if (wr < 0.45) {
      anomalies.push({
        type: 'LOW_WIN_RATE', severity: wr < 0.35 ? 'critical' : 'warning',
        message: `Win rate over last 20 signals is ${(wr * 100).toFixed(1)}% (below 45% threshold)`,
        detectedAt: now, data: { winRate: wr, sampleSize: 20 },
      })
    }
  }
  if (last20.length >= 10) {
    const avgRet = mean(last20.map(s => s.actualReturn || 0))
    if (avgRet < 0) {
      anomalies.push({
        type: 'NEGATIVE_AVG_RETURN', severity: avgRet < -0.01 ? 'critical' : 'warning',
        message: `Average return over last ${last20.length} signals is ${(avgRet * 100).toFixed(2)}%`,
        detectedAt: now, data: { avgReturn: avgRet, sampleSize: last20.length },
      })
    }
  }
  for (const strat of STRATEGIES) {
    const stratSignals = recent.filter(s => normaliseStrategy(s.strategy) === strat)
    let consecutive = 0
    for (const s of stratSignals) {
      if ((s.actualReturn || 0) <= 0) consecutive++; else break
    }
    if (consecutive >= 5) {
      anomalies.push({
        type: 'CONSECUTIVE_LOSSES', severity: consecutive >= 8 ? 'critical' : 'warning',
        message: `Strategy "${strat}" has ${consecutive} consecutive losses`,
        detectedAt: now, data: { strategy: strat, consecutiveLosses: consecutive },
      })
    }
  }
  const recentResolved = recent.slice(0, 10)
  for (const s of recentResolved) {
    if (s.regime === 'trending-bull' && (s.actualReturn || 0) < -0.02) {
      anomalies.push({
        type: 'REGIME_MISMATCH', severity: 'warning',
        message: `Signal ${s.id} detected "trending-bull" but saw ${(s.actualReturn * 100).toFixed(1)}% loss`,
        detectedAt: now, data: { signalId: s.id, regime: s.regime, actualReturn: s.actualReturn },
      })
    }
  }
  return anomalies
}

// ============ CORRECTION GENERATION ============

function generateCorrections() {
  const corrections = []
  const now = Date.now()
  for (const regime of REGIMES) {
    const current = state.adaptiveWeights[regime]
    const base = DEFAULT_WEIGHTS[regime]
    if (!current || !base) continue
    for (const strat of STRATEGIES) {
      const diff = (current[strat] || 0) - (base[strat] || 0)
      if (Math.abs(diff) > 0.05) {
        corrections.push({
          type: 'STRATEGY_WEIGHT',
          description: `${strat} weight in ${regime}: ${(base[strat] * 100).toFixed(0)}% -> ${(current[strat] * 100).toFixed(0)}%`,
          from: base[strat], to: current[strat], magnitude: Math.abs(diff), generatedAt: now,
        })
      }
    }
  }
  if (state.minimumConfidence !== 50) {
    corrections.push({
      type: 'CONFIDENCE_THRESHOLD',
      description: `Minimum confidence raised from 50 to ${state.minimumConfidence}`,
      from: 50, to: state.minimumConfidence, magnitude: state.minimumConfidence - 50, generatedAt: now,
    })
  }
  for (const key of Object.keys(DEFAULT_FACTOR_WEIGHTS)) {
    const current = state.factorWeights[key] ?? DEFAULT_FACTOR_WEIGHTS[key]
    const base = DEFAULT_FACTOR_WEIGHTS[key]
    if (Math.abs(current - base) > 0.03) {
      corrections.push({
        type: 'FACTOR_WEIGHT',
        description: `Factor "${key}" weight: ${(base * 100).toFixed(1)}% -> ${(current * 100).toFixed(1)}%`,
        from: base, to: current, magnitude: Math.abs(current - base), generatedAt: now,
      })
    }
  }
  return corrections
}

// ============ FULL AUDIT ============

function runFullAudit() {
  ensureInit()
  const resolved = resolvedSignals()
  const isLearningMode = resolved.length < LEARNING_MODE_THRESHOLD
  state.metrics.overall = computeRollingMetrics(resolved)
  state.metrics.byStrategy = metricsByGroup(resolved, s => normaliseStrategy(s.strategy))
  state.metrics.byRegime = metricsByGroup(resolved, s => s.regime)
  state.metrics.byTimeframe = metricsByGroup(resolved, s => timeframeBucket(s.holdDuration || 0))
  state.metrics.byConfidenceBucket = metricsByGroup(resolved, s => confidenceBucket(s.confidence))
  state.metrics.byAssetClass = metricsByGroup(resolved, s => classifyAsset(s.ticker))
  recalculateAdaptiveWeights()
  recalculateFactorWeights()
  recalculateMinimumConfidence()
  state.anomalies = detectAnomalies()
  state.corrections = generateCorrections()
  state.lastAuditAt = Date.now()
  return {
    metrics: state.metrics,
    anomalies: state.anomalies,
    corrections: state.corrections,
    isLearningMode,
  }
}

// ============ STRATEGY RECOMMENDATION ============

function getStrategyRecommendation(regime, timeframe) {
  ensureInit()
  const resolved = resolvedSignals()
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    const weights = DEFAULT_WEIGHTS[regime] || DEFAULT_WEIGHTS['volatile-transition']
    const best = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]
    return {
      strategy: best[0], confidence: 50, expectedValue: 0,
      reason: `Learning mode (${resolved.length}/${LEARNING_MODE_THRESHOLD} signals). Using default weights.`,
      alternatives: Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(1).map(([s, w]) => ({ strategy: s, weight: w })),
    }
  }
  let pool = resolved.filter(s => s.regime === regime)
  if (timeframe) {
    const tfPool = pool.filter(s => timeframeBucket(s.holdDuration || 0) === timeframe)
    if (tfPool.length >= 10) pool = tfPool
  }
  if (pool.length < 10) pool = resolved
  const evals = []
  for (const strat of STRATEGIES) {
    const sp = pool.filter(s => normaliseStrategy(s.strategy) === strat)
    if (sp.length < 3) { evals.push({ strategy: strat, ev: 0, winRate: 0.5, count: 0 }); continue }
    const returns = sp.map(s => s.actualReturn || 0)
    const wins = returns.filter(r => r > 0)
    const losses = returns.filter(r => r < 0)
    const wr = wins.length / returns.length
    evals.push({
      strategy: strat,
      ev: expectedValue(wr, wins.length > 0 ? mean(wins) : 0, losses.length > 0 ? Math.abs(mean(losses)) : 0),
      winRate: wr, count: sp.length,
    })
  }
  evals.sort((a, b) => b.ev - a.ev)
  const best = evals[0]
  return {
    strategy: best.strategy,
    confidence: Math.min(95, 50 + best.count + best.winRate * 30),
    expectedValue: best.ev,
    reason: `${best.strategy} has highest EV (${(best.ev * 100).toFixed(2)}%) with ${(best.winRate * 100).toFixed(0)}% win rate over ${best.count} signals.`,
    alternatives: evals.slice(1).map(e => ({ strategy: e.strategy, expectedValue: e.ev, winRate: e.winRate, count: e.count })),
  }
}

// ============ MARKET INTELLIGENCE BRIEF ============

function generateIntelligenceBrief() {
  ensureInit()
  const resolved = resolvedSignals()
  const isLearning = resolved.length < LEARNING_MODE_THRESHOLD
  const metrics = state.metrics?.overall?.allTime || computeMetrics([])
  const last20 = state.metrics?.overall?.last20 || computeMetrics([])

  const lines = []
  lines.push('=== NOCTIS MARKET INTELLIGENCE BRIEF ===')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Mode: ${isLearning ? 'LEARNING' : 'ACTIVE'} (${resolved.length} resolved signals)`)
  lines.push('')

  // Win rate and trend
  lines.push('--- Performance Summary ---')
  lines.push(`All-time win rate: ${(metrics.winRate * 100).toFixed(1)}% | Sharpe: ${metrics.sharpeRatio.toFixed(2)} | PF: ${metrics.profitFactor === Infinity ? 'INF' : metrics.profitFactor.toFixed(2)}`)
  lines.push(`Last 20 win rate: ${(last20.winRate * 100).toFixed(1)}% | Avg return: ${(last20.avgReturn * 100).toFixed(2)}%`)
  const trend = last20.winRate > metrics.winRate ? 'IMPROVING' : last20.winRate < metrics.winRate - 0.05 ? 'DETERIORATING' : 'STABLE'
  lines.push(`Trend: ${trend}`)
  lines.push('')

  // Best/worst strategies by regime
  lines.push('--- Strategy x Regime Matrix ---')
  const byStrat = state.metrics?.byStrategy || {}
  const byRegime = state.metrics?.byRegime || {}
  let bestCombo = { key: 'N/A', wr: 0 }
  let worstCombo = { key: 'N/A', wr: 1 }
  for (const strat of STRATEGIES) {
    for (const regime of REGIMES) {
      const pool = resolved.filter(s => normaliseStrategy(s.strategy) === strat && s.regime === regime)
      if (pool.length >= 3) {
        const wr = pool.filter(s => (s.actualReturn || 0) > 0).length / pool.length
        if (wr > bestCombo.wr) bestCombo = { key: `${strat}/${regime}`, wr, count: pool.length }
        if (wr < worstCombo.wr) worstCombo = { key: `${strat}/${regime}`, wr, count: pool.length }
      }
    }
  }
  lines.push(`Best combo: ${bestCombo.key} (${(bestCombo.wr * 100).toFixed(0)}% WR, n=${bestCombo.count || 0})`)
  lines.push(`Worst combo: ${worstCombo.key} (${(worstCombo.wr * 100).toFixed(0)}% WR, n=${worstCombo.count || 0})`)
  lines.push('')

  // Anomalies
  lines.push('--- Active Anomalies ---')
  if (state.anomalies.length === 0) {
    lines.push('No anomalies detected.')
  } else {
    for (const a of state.anomalies) {
      lines.push(`[${a.severity.toUpperCase()}] ${a.message}`)
    }
  }
  lines.push('')

  // Corrections
  lines.push('--- Adaptive Corrections ---')
  if (state.corrections.length === 0) {
    lines.push('No corrections active (using default weights).')
  } else {
    for (const c of state.corrections) {
      lines.push(`${c.type}: ${c.description}`)
    }
  }
  lines.push('')

  // Strategy recommendations
  lines.push('--- Strategy Recommendations ---')
  for (const regime of REGIMES) {
    const rec = getStrategyRecommendation(regime)
    lines.push(`${regime}: ${rec.strategy} (EV: ${(rec.expectedValue * 100).toFixed(2)}%, conf: ${rec.confidence.toFixed(0)})`)
  }
  lines.push('')

  // Benchmark comparison (SPY buy-and-hold placeholder)
  lines.push('--- Benchmark Comparison ---')
  if (resolved.length >= 5) {
    const cumReturn = resolved.reduce((acc, s) => acc * (1 + (s.actualReturn || 0)), 1) - 1
    lines.push(`Noctis cumulative return: ${(cumReturn * 100).toFixed(2)}%`)
    lines.push(`Max drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`)
    lines.push(`Kelly fraction: ${(metrics.kellyFraction * 100).toFixed(1)}%`)
  } else {
    lines.push('Insufficient data for benchmark comparison.')
  }

  return lines.join('\n')
}

// ============ YAHOO FINANCE DATA FETCHER ============

async function fetchYahooQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d&includePrePost=true`
    const res = await fetch(url, { headers: { 'User-Agent': YAHOO_UA } })
    if (!res.ok) return null
    const data = await res.json()
    const result = data.chart?.result?.[0]
    if (!result) return null
    const meta = result.meta || {}
    const quotes = result.indicators?.quote?.[0] || {}
    const closes = (quotes.close || []).filter(c => c != null)
    const prevClose = meta.chartPreviousClose || meta.previousClose || closes[closes.length - 2] || 0
    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1] || 0
    const change = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0
    return {
      symbol: meta.symbol || symbol,
      price: currentPrice,
      previousClose: prevClose,
      change: change,
      dayHigh: meta.regularMarketDayHigh || 0,
      dayLow: meta.regularMarketDayLow || 0,
      volume: meta.regularMarketVolume || 0,
    }
  } catch {
    return null
  }
}

async function fetchMarketSnapshot() {
  const symbols = {
    SPY: 'SPY', QQQ: 'QQQ', IWM: 'IWM',
    VIX: '^VIX', TNX: '^TNX', DXY: 'DX-Y.NYB',
    XLK: 'XLK', XLF: 'XLF', XLE: 'XLE',
    XLV: 'XLV', XLI: 'XLI', XLP: 'XLP',
    XLU: 'XLU', XLRE: 'XLRE', XLB: 'XLB',
    XLC: 'XLC', XLY: 'XLY',
  }
  const entries = Object.entries(symbols)
  const results = await Promise.allSettled(entries.map(([, sym]) => fetchYahooQuote(sym)))
  const snapshot = {}
  entries.forEach(([key], i) => {
    const r = results[i]
    snapshot[key] = r.status === 'fulfilled' && r.value ? r.value : { symbol: key, price: 0, change: 0, error: true }
  })
  return snapshot
}

// ============ DAILY BRIEF GENERATION ============

function getETHour() {
  // Calculate current ET hour
  const now = new Date()
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
  const etDate = new Date(etStr)
  return etDate.getHours()
}

function determineBriefType(requestedType) {
  if (requestedType && ['pre-market', 'midday', 'post-close'].includes(requestedType)) return requestedType
  const hour = getETHour()
  if (hour < 10) return 'pre-market'
  if (hour < 14) return 'midday'
  return 'post-close'
}

async function generateDailyBrief(briefType, snapshot) {
  ensureInit()
  const resolved = resolvedSignals()
  const isLearning = resolved.length < LEARNING_MODE_THRESHOLD
  const now = new Date()
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const spy = snapshot.SPY || {}
  const qqq = snapshot.QQQ || {}
  const iwm = snapshot.IWM || {}
  const vix = snapshot.VIX || {}
  const tnx = snapshot.TNX || {}
  const dxy = snapshot.DXY || {}

  const brief = {
    type: briefType,
    generatedAt: now.toISOString(),
    dateET: etStr,
    marketSnapshot: {
      SPY: { price: spy.price, change: spy.change, dayHigh: spy.dayHigh, dayLow: spy.dayLow },
      QQQ: { price: qqq.price, change: qqq.change, dayHigh: qqq.dayHigh, dayLow: qqq.dayLow },
      IWM: { price: iwm.price, change: iwm.change, dayHigh: iwm.dayHigh, dayLow: iwm.dayLow },
      VIX: { price: vix.price, change: vix.change },
      '10Y': { price: tnx.price, change: tnx.change },
      DXY: { price: dxy.price, change: dxy.change },
    },
    sectors: {},
    insights: [],
    actionItems: [],
    regime: null,
    mode: isLearning ? 'learning' : 'active',
  }

  // Sector performance
  const sectorSyms = ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLC', 'XLY']
  const sectorNames = { XLK: 'Technology', XLF: 'Financials', XLE: 'Energy', XLV: 'Healthcare', XLI: 'Industrials', XLP: 'Staples', XLU: 'Utilities', XLRE: 'Real Estate', XLB: 'Materials', XLC: 'Communications', XLY: 'Discretionary' }
  for (const sym of sectorSyms) {
    const d = snapshot[sym]
    if (d && !d.error) {
      brief.sectors[sectorNames[sym] || sym] = { change: d.change, price: d.price }
    }
  }

  // Determine current regime from VIX and market action
  const vixLevel = vix.price || 0
  const spyChange = spy.change || 0
  if (vixLevel > 25) {
    brief.regime = 'volatile-transition'
  } else if (spyChange > 0.5) {
    brief.regime = 'trending-bull'
  } else if (spyChange < -0.5) {
    brief.regime = 'trending-bear'
  } else {
    brief.regime = 'mean-reverting'
  }

  // Compute recommended strategy for current regime
  const rec = getStrategyRecommendation(brief.regime)

  // Brief-type-specific content
  if (briefType === 'pre-market') {
    brief.title = 'Pre-Market Intelligence Brief'

    // Overnight gap analysis
    const gapPct = spy.change || 0
    const gapDirection = gapPct > 0.3 ? 'gap up' : gapPct < -0.3 ? 'gap down' : 'flat open'
    brief.insights.push(`SPY ${gapDirection} ${Math.abs(gapPct).toFixed(2)}% from prior close`)

    if (vixLevel > 20) {
      brief.insights.push(`Elevated VIX at ${vixLevel.toFixed(1)} - expect wider ranges and choppy action`)
    } else {
      brief.insights.push(`VIX at ${vixLevel.toFixed(1)} - low volatility environment`)
    }

    // Regime check
    brief.insights.push(`Current regime: ${brief.regime.replace(/-/g, ' ')}`)
    brief.insights.push(`Recommended strategy: ${rec.strategy} (EV: ${(rec.expectedValue * 100).toFixed(2)}%)`)

    // Key levels
    if (spy.dayHigh && spy.dayLow) {
      brief.insights.push(`SPY range: ${spy.dayLow.toFixed(2)} - ${spy.dayHigh.toFixed(2)}`)
    }

    // DXY and yields
    if (tnx.price) brief.insights.push(`10Y yield: ${tnx.price.toFixed(3)}% (${tnx.change > 0 ? '+' : ''}${tnx.change.toFixed(2)}%)`)
    if (dxy.price) brief.insights.push(`Dollar index: ${dxy.price.toFixed(2)} (${dxy.change > 0 ? '+' : ''}${dxy.change.toFixed(2)}%)`)

    // Action items
    brief.actionItems.push(`Focus on ${rec.strategy} setups in ${brief.regime.replace(/-/g, ' ')} regime`)
    if (gapPct > 0.5) brief.actionItems.push('Large gap up - watch for gap fill reversion or continuation above prior high')
    if (gapPct < -0.5) brief.actionItems.push('Large gap down - watch for gap fill bounce or breakdown below prior low')
    if (vixLevel > 25) brief.actionItems.push('Reduce position sizes in elevated VIX environment')
    brief.actionItems.push(`Confidence threshold: ${state.minimumConfidence}% (only take signals above this)`)

  } else if (briefType === 'midday') {
    brief.title = 'Midday Session Recap'

    brief.insights.push(`SPY ${spyChange > 0 ? '+' : ''}${spyChange.toFixed(2)}% at midday (${spy.price.toFixed(2)})`)
    brief.insights.push(`QQQ ${(qqq.change || 0) > 0 ? '+' : ''}${(qqq.change || 0).toFixed(2)}% | IWM ${(iwm.change || 0) > 0 ? '+' : ''}${(iwm.change || 0).toFixed(2)}%`)

    // Intraday regime assessment
    brief.insights.push(`Intraday regime: ${brief.regime.replace(/-/g, ' ')}`)

    // Signals triggered today (look for signals from last 12 hours)
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000
    const todaySignals = state.signals.filter(s => s.timestamp > twelveHoursAgo)
    const todayResolved = todaySignals.filter(s => s.outcome && s.outcome !== 'OPEN')
    const todayOpen = todaySignals.filter(s => !s.outcome || s.outcome === 'OPEN')
    brief.insights.push(`Signals today: ${todaySignals.length} total (${todayResolved.length} resolved, ${todayOpen.length} open)`)

    if (todayResolved.length > 0) {
      const todayWR = todayResolved.filter(s => (s.actualReturn || 0) > 0).length / todayResolved.length
      const todayPnL = todayResolved.reduce((s, sig) => s + (sig.actualReturn || 0), 0)
      brief.insights.push(`Today's resolved: ${(todayWR * 100).toFixed(0)}% WR, ${(todayPnL * 100).toFixed(2)}% cumulative return`)
    }

    // Sector rotation
    const sortedSectors = Object.entries(brief.sectors).sort((a, b) => (b[1].change || 0) - (a[1].change || 0))
    if (sortedSectors.length > 0) {
      const best = sortedSectors[0]
      const worst = sortedSectors[sortedSectors.length - 1]
      brief.insights.push(`Leading: ${best[0]} (${best[1].change > 0 ? '+' : ''}${best[1].change.toFixed(2)}%) | Lagging: ${worst[0]} (${worst[1].change > 0 ? '+' : ''}${worst[1].change.toFixed(2)}%)`)
    }

    // Action items
    if (todayOpen.length > 0) brief.actionItems.push(`Monitor ${todayOpen.length} open positions`)
    brief.actionItems.push(`Current best strategy: ${rec.strategy} for ${brief.regime.replace(/-/g, ' ')}`)
    if (vixLevel > 20) brief.actionItems.push('Tighten stops in elevated volatility')

  } else {
    // post-close
    brief.title = 'Post-Close Audit & Outlook'

    brief.insights.push(`SPY closed ${spyChange > 0 ? '+' : ''}${spyChange.toFixed(2)}% at ${spy.price.toFixed(2)}`)
    brief.insights.push(`QQQ ${(qqq.change || 0) > 0 ? '+' : ''}${(qqq.change || 0).toFixed(2)}% | IWM ${(iwm.change || 0) > 0 ? '+' : ''}${(iwm.change || 0).toFixed(2)}%`)

    // Full day P/L attribution
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const daySignals = resolved.filter(s => (s.resolvedAt || s.timestamp) > oneDayAgo)
    if (daySignals.length > 0) {
      const dayPnL = daySignals.reduce((s, sig) => s + (sig.actualReturn || 0), 0)
      const dayWR = daySignals.filter(s => (s.actualReturn || 0) > 0).length / daySignals.length
      brief.insights.push(`Day P/L: ${(dayPnL * 100).toFixed(2)}% across ${daySignals.length} signals (${(dayWR * 100).toFixed(0)}% WR)`)

      // Strategy attribution
      const stratAttrib = {}
      for (const s of daySignals) {
        const strat = normaliseStrategy(s.strategy)
        if (!stratAttrib[strat]) stratAttrib[strat] = { pnl: 0, count: 0 }
        stratAttrib[strat].pnl += s.actualReturn || 0
        stratAttrib[strat].count++
      }
      for (const [strat, data] of Object.entries(stratAttrib)) {
        brief.insights.push(`  ${strat}: ${(data.pnl * 100).toFixed(2)}% (${data.count} signals)`)
      }
    } else {
      brief.insights.push('No signals resolved today.')
    }

    // Anomalies and corrections
    if (state.anomalies.length > 0) {
      brief.insights.push(`Active anomalies: ${state.anomalies.length}`)
      for (const a of state.anomalies.slice(0, 3)) {
        brief.insights.push(`  [${a.severity}] ${a.message}`)
      }
    }

    if (state.corrections.length > 0) {
      brief.insights.push(`Active corrections: ${state.corrections.length}`)
    }

    // Regime assessment and next-day outlook
    brief.insights.push(`Closing regime: ${brief.regime.replace(/-/g, ' ')}`)

    // Next-day outlook
    brief.actionItems.push(`Tomorrow's regime outlook: ${brief.regime.replace(/-/g, ' ')}`)
    brief.actionItems.push(`Recommended strategy: ${rec.strategy} (EV: ${(rec.expectedValue * 100).toFixed(2)}%)`)
    if (state.anomalies.some(a => a.severity === 'critical')) {
      brief.actionItems.push('CRITICAL ANOMALY ACTIVE - review before trading tomorrow')
    }
    brief.actionItems.push(`Confidence threshold for tomorrow: ${state.minimumConfidence}%`)

    // Learning mode status
    if (isLearning) {
      brief.actionItems.push(`Learning mode: ${resolved.length}/${LEARNING_MODE_THRESHOLD} signals to calibration`)
    }
  }

  // Store the brief
  if (!state.briefs) state.briefs = {}
  const briefKey = briefType === 'pre-market' ? 'preMarket' : briefType === 'midday' ? 'midday' : 'postClose'
  state.briefs[briefKey] = brief

  return brief
}

// ============ PERFORMANCE REPORT ============

function getPerformanceReport() {
  ensureInit()
  const resolved = resolvedSignals()
  const open = state.signals.filter(s => s.outcome === 'OPEN' || !s.outcome)

  // Build equity curve data
  const sorted = [...resolved].sort((a, b) => (a.resolvedAt || a.timestamp) - (b.resolvedAt || b.timestamp))
  let cumReturn = 1
  const equityCurve = sorted.map((s, i) => {
    cumReturn *= (1 + (s.actualReturn || 0))
    return {
      index: i + 1,
      date: s.resolvedAt || s.timestamp,
      equity: cumReturn,
      return: s.actualReturn || 0,
      ticker: s.ticker,
      strategy: s.strategy,
    }
  })

  // Factor attribution
  const factorAttribution = {}
  for (const [factor, weight] of Object.entries(state.factorWeights || {})) {
    factorAttribution[factor] = {
      weight,
      defaultWeight: DEFAULT_FACTOR_WEIGHTS[factor] || 0,
      change: weight - (DEFAULT_FACTOR_WEIGHTS[factor] || 0),
    }
  }

  // Strategy x regime matrix
  const strategyMatrix = {}
  for (const strat of STRATEGIES) {
    strategyMatrix[strat] = {}
    for (const regime of REGIMES) {
      const pool = resolved.filter(s => normaliseStrategy(s.strategy) === strat && s.regime === regime)
      if (pool.length > 0) {
        const wr = pool.filter(s => (s.actualReturn || 0) > 0).length / pool.length
        strategyMatrix[strat][regime] = { winRate: wr, count: pool.length, avgReturn: mean(pool.map(s => s.actualReturn || 0)) }
      } else {
        strategyMatrix[strat][regime] = { winRate: 0, count: 0, avgReturn: 0 }
      }
    }
  }

  return {
    summary: {
      totalSignals: state.signals.length,
      resolvedSignals: resolved.length,
      openSignals: open.length,
      isLearningMode: resolved.length < LEARNING_MODE_THRESHOLD,
      learningProgress: Math.min(1, resolved.length / LEARNING_MODE_THRESHOLD),
      lastAuditAt: state.lastAuditAt,
    },
    metrics: state.metrics,
    equityCurve,
    strategyMatrix,
    factorAttribution,
    adaptiveWeights: state.adaptiveWeights,
    factorWeights: state.factorWeights,
    minimumConfidence: state.minimumConfidence,
    anomalies: state.anomalies || [],
    corrections: state.corrections || [],
    briefs: state.briefs || {},
    intelligenceBrief: generateIntelligenceBrief(),
  }
}

// ============ RECORD SIGNAL ============

function recordSignal(signal, outcome) {
  ensureInit()
  if (!signal || !outcome) throw new Error('Both signal and outcome are required')

  let existing = null
  if (signal.id) {
    existing = state.signals.find(s => s.id === signal.id)
  }

  if (existing) {
    existing.outcome = outcome.result || outcome.outcome || 'OPEN'
    existing.actualReturn = outcome.actualReturn ?? existing.actualReturn ?? 0
    existing.holdDuration = outcome.holdDuration ?? existing.holdDuration ?? 0
    existing.resolvedAt = outcome.resolvedAt || Date.now()
    return { id: existing.id, totalSignals: state.signals.length }
  }

  const entry = {
    id: signal.id || uid(),
    ticker: signal.ticker || 'UNKNOWN',
    direction: signal.direction || 'long',
    strategy: signal.strategy || 'momentum',
    confidence: signal.confidence ?? 50,
    regime: signal.regime || 'volatile-transition',
    entryPrice: signal.entryPrice ?? null,
    targetPrice: signal.targetPrice ?? null,
    stopPrice: signal.stopPrice ?? null,
    outcome: outcome.result || outcome.outcome || 'OPEN',
    actualReturn: outcome.actualReturn ?? 0,
    holdDuration: outcome.holdDuration ?? 0,
    timestamp: signal.timestamp || Date.now(),
    resolvedAt: outcome.resolvedAt || (outcome.result !== 'OPEN' ? Date.now() : null),
    factors: signal.factors ? { ...signal.factors } : {},
  }

  state.signals.push(entry)
  if (state.signals.length > MAX_SIGNALS) {
    state.signals = state.signals.slice(state.signals.length - MAX_SIGNALS)
  }

  return { id: entry.id, totalSignals: state.signals.length }
}

// ============ ROUTE HANDLERS ============

export async function GET() {
  ensureInit()
  const report = getPerformanceReport()
  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function POST(request) {
  ensureInit()

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { action, signals: signalHistory, signal, outcome, briefType } = body

  try {
    switch (action) {
      case 'audit': {
        // If signal history provided, import it first
        if (Array.isArray(signalHistory) && signalHistory.length > 0) {
          const existingIds = new Set(state.signals.map(s => s.id))
          for (const s of signalHistory) {
            if (!existingIds.has(s.id)) {
              state.signals.push(s)
              existingIds.add(s.id)
            }
          }
          if (state.signals.length > MAX_SIGNALS) {
            state.signals = state.signals.slice(state.signals.length - MAX_SIGNALS)
          }
        }
        const auditResult = runFullAudit()
        const report = getPerformanceReport()
        return new Response(JSON.stringify({
          success: true,
          audit: auditResult,
          report,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        })
      }

      case 'record': {
        if (!signal) {
          return new Response(JSON.stringify({ error: 'Missing signal object' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const result = recordSignal(signal, outcome || { result: 'OPEN', actualReturn: 0 })
        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        })
      }

      case 'reset': {
        state = freshState()
        return new Response(JSON.stringify({ success: true, message: 'Engine reset to fresh state' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        })
      }

      case 'daily-brief': {
        const type = determineBriefType(briefType)
        const snapshot = await fetchMarketSnapshot()
        const brief = await generateDailyBrief(type, snapshot)
        return new Response(JSON.stringify({
          success: true,
          brief,
          snapshot,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
