export const runtime = 'edge'

// ============ CONSTANTS — synced with adaptiveEngine.js ============

const MAX_SIGNALS_PER_CLASS = 300
const MAX_SIGNALS_GLOBAL = 1500
const LEARNING_MODE_THRESHOLD = 12 // per-class (lower since data is split)
const ANNUALIZATION_FACTOR = Math.sqrt(252)

const STRATEGIES = ['momentum', 'meanReversion', 'breakout', 'macro']
const REGIMES = ['trending-bull', 'trending-bear', 'mean-reverting', 'volatile-transition']
const ASSET_CLASSES = ['equity', 'forex', 'crypto', 'commodity', 'macro']

// Per-class default strategy weights (mirrors adaptiveEngine DEFAULT_WEIGHTS_BY_CLASS)
const DEFAULT_WEIGHTS_BY_CLASS = {
  equity: {
    'trending-bull':       { momentum: 0.45, meanReversion: 0.15, breakout: 0.35, macro: 0.05 },
    'trending-bear':       { momentum: 0.40, meanReversion: 0.30, breakout: 0.20, macro: 0.10 },
    'mean-reverting':      { momentum: 0.20, meanReversion: 0.55, breakout: 0.15, macro: 0.10 },
    'volatile-transition': { momentum: 0.25, meanReversion: 0.30, breakout: 0.30, macro: 0.15 },
  },
  forex: {
    'trending-bull':       { momentum: 0.40, meanReversion: 0.15, breakout: 0.25, macro: 0.20 },
    'trending-bear':       { momentum: 0.40, meanReversion: 0.15, breakout: 0.25, macro: 0.20 },
    'mean-reverting':      { momentum: 0.15, meanReversion: 0.50, breakout: 0.15, macro: 0.20 },
    'volatile-transition': { momentum: 0.20, meanReversion: 0.25, breakout: 0.30, macro: 0.25 },
  },
  crypto: {
    'trending-bull':       { momentum: 0.55, meanReversion: 0.10, breakout: 0.30, macro: 0.05 },
    'trending-bear':       { momentum: 0.35, meanReversion: 0.30, breakout: 0.25, macro: 0.10 },
    'mean-reverting':      { momentum: 0.20, meanReversion: 0.50, breakout: 0.20, macro: 0.10 },
    'volatile-transition': { momentum: 0.25, meanReversion: 0.25, breakout: 0.35, macro: 0.15 },
  },
  commodity: {
    'trending-bull':       { momentum: 0.45, meanReversion: 0.15, breakout: 0.30, macro: 0.10 },
    'trending-bear':       { momentum: 0.40, meanReversion: 0.25, breakout: 0.20, macro: 0.15 },
    'mean-reverting':      { momentum: 0.20, meanReversion: 0.50, breakout: 0.15, macro: 0.15 },
    'volatile-transition': { momentum: 0.25, meanReversion: 0.25, breakout: 0.25, macro: 0.25 },
  },
  macro: {
    'trending-bull':       { momentum: 0.20, meanReversion: 0.10, breakout: 0.15, macro: 0.55 },
    'trending-bear':       { momentum: 0.20, meanReversion: 0.15, breakout: 0.10, macro: 0.55 },
    'mean-reverting':      { momentum: 0.10, meanReversion: 0.25, breakout: 0.10, macro: 0.55 },
    'volatile-transition': { momentum: 0.15, meanReversion: 0.15, breakout: 0.15, macro: 0.55 },
  },
}

// Per-class default factor weights
const DEFAULT_FACTOR_WEIGHTS_BY_CLASS = {
  equity:    { rsi: 0.15, adx: 0.15, hurst: 0.10, alphaComposite: 0.22, ensembleScore: 0.20, sentiment: 0.10, regimeConfidence: 0.08 },
  forex:     { rsi: 0.12, adx: 0.12, hurst: 0.08, alphaComposite: 0.12, ensembleScore: 0.14, sentiment: 0.12, regimeConfidence: 0.30 },
  crypto:    { rsi: 0.18, adx: 0.14, hurst: 0.12, alphaComposite: 0.16, ensembleScore: 0.18, sentiment: 0.14, regimeConfidence: 0.08 },
  commodity: { rsi: 0.14, adx: 0.16, hurst: 0.10, alphaComposite: 0.14, ensembleScore: 0.16, sentiment: 0.10, regimeConfidence: 0.20 },
  macro:     { rsi: 0.08, adx: 0.08, hurst: 0.06, alphaComposite: 0.10, ensembleScore: 0.12, sentiment: 0.16, regimeConfidence: 0.40 },
}

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// ============ PER-CLASS STATE ============

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

function calcSharpe(returns) {
  if (!returns || returns.length < 2) return 0
  const sd = stddev(returns)
  if (sd === 0) return 0
  return (mean(returns) / sd) * ANNUALIZATION_FACTOR
}

function calcProfitFactor(returns) {
  if (!returns || returns.length === 0) return 0
  const wins = returns.filter(r => r > 0).reduce((s, v) => s + v, 0)
  const losses = Math.abs(returns.filter(r => r < 0).reduce((s, v) => s + v, 0))
  if (losses === 0) return wins > 0 ? Infinity : 0
  return wins / losses
}

function calcMaxDrawdown(returns) {
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

function calcKelly(winRate, avgWin, avgLoss) {
  if (avgWin === 0) return 0
  return (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin
}

function calcEV(winRate, avgWin, avgLoss) {
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
  if (s.includes('macro') || s.includes('relative')) return 'macro'
  return 'momentum'
}

function classifyAsset(ticker, assetType) {
  // If explicitly provided, normalize
  if (assetType) {
    const at = assetType.toLowerCase()
    if (at === 'forex' || at === 'fx') return 'forex'
    if (at === 'crypto' || at === 'cryptocurrency') return 'crypto'
    if (at === 'commodity' || at === 'commodities') return 'commodity'
    if (at === 'macro') return 'macro'
    if (at === 'equity' || at === 'stock') return 'equity'
  }
  if (!ticker) return 'equity'
  const t = ticker.toUpperCase()

  // Commodity ETFs
  const commodityETFs = ['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'WEAT', 'CORN']
  if (commodityETFs.includes(t)) return 'commodity'

  // Macro instruments
  const macroETFs = ['TLT', 'TBT', 'IEF', 'SHY', 'AGG', 'BND', 'HYG', 'LQD', 'JNK', 'EMB', 'EEM', 'VWO', 'FXI', 'EWJ', 'UUP', 'UDN']
  if (macroETFs.includes(t)) return 'macro'

  // Forex pairs
  if (t.includes('=X') || t.includes('/')) {
    const forexPairs = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']
    const base = t.split(/[/=]/)[0]
    if (forexPairs.includes(base)) return 'forex'
  }

  // Crypto
  if (t.includes('-USD') || t.includes('-USDT')) return 'crypto'
  if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK'].some(c => t.startsWith(c))) return 'crypto'

  // Futures
  if (t.includes('=F') || t.startsWith('/') || /^(MES|MNQ|ES|NQ|CL|GC|SI|ZB|ZN|ZF)/i.test(t)) {
    // Commodity futures go to commodity
    if (/^(CL|GC|SI|HG|NG|ZC|ZW|ZS)/i.test(t)) return 'commodity'
    return 'equity' // index futures
  }

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
    sharpeRatio: calcSharpe(returns),
    maxDrawdown: calcMaxDrawdown(returns),
    profitFactor: calcProfitFactor(returns),
    kellyFraction: calcKelly(wr, avgWin, avgLoss),
    expectedValue: calcEV(wr, avgWin, avgLoss),
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

// ============ STATE MANAGEMENT (per-class) ============

function freshClassModel(ac) {
  return {
    assetClass: ac,
    signals: [],
    adaptiveWeights: JSON.parse(JSON.stringify(DEFAULT_WEIGHTS_BY_CLASS[ac] || DEFAULT_WEIGHTS_BY_CLASS.equity)),
    factorWeights: { ...(DEFAULT_FACTOR_WEIGHTS_BY_CLASS[ac] || DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity) },
    minimumConfidence: 50,
    anomalies: [],
    corrections: [],
    lastAuditAt: null,
  }
}

function freshState() {
  const assetModels = {}
  for (const ac of ASSET_CLASSES) {
    assetModels[ac] = freshClassModel(ac)
  }
  return {
    assetModels,
    metrics: {
      overall: computeMetrics([]),
      byStrategy: {},
      byRegime: {},
      byTimeframe: {},
      byConfidenceBucket: {},
      byAssetClass: {},
    },
    briefs: { preMarket: null, midday: null, postClose: null },
    lastAuditAt: null,
  }
}

function ensureInit() {
  if (!state) state = freshState()
  // Ensure all asset classes exist
  if (!state.assetModels) {
    const s = freshState()
    s.assetModels.equity.signals = state.signals || []
    state = s
  }
  for (const ac of ASSET_CLASSES) {
    if (!state.assetModels[ac]) state.assetModels[ac] = freshClassModel(ac)
  }
}

function getModel(ac) {
  return state.assetModels[ac] || state.assetModels.equity
}

function allSignals() {
  const all = []
  for (const ac of ASSET_CLASSES) {
    all.push(...(getModel(ac).signals || []))
  }
  return all
}

function allResolved() {
  return allSignals().filter(s => s.outcome && s.outcome !== 'OPEN')
}

function resolvedForModel(model) {
  return (model.signals || []).filter(s => s.outcome && s.outcome !== 'OPEN')
}

// ============ PER-CLASS ADAPTIVE RECALCULATIONS ============

function recalculateAdaptiveWeightsForModel(model) {
  const ac = model.assetClass || 'equity'
  const resolved = resolvedForModel(model)
  const defaults = DEFAULT_WEIGHTS_BY_CLASS[ac] || DEFAULT_WEIGHTS_BY_CLASS.equity

  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    model.adaptiveWeights = JSON.parse(JSON.stringify(defaults))
    return
  }

  for (const regime of REGIMES) {
    const regimeSignals = resolved.filter(s => s.regime === regime)
    if (regimeSignals.length < 5) {
      model.adaptiveWeights[regime] = { ...defaults[regime] }
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
        stratPerf[strat] = { winRate: wr, ev: calcEV(wr, avgW, avgL), count: stratSignals.length }
      }
    }
    const evs = STRATEGIES.map(s => Math.max(stratPerf[s].ev, 0.001))
    const total = evs.reduce((a, b) => a + b, 0)
    const raw = {}
    STRATEGIES.forEach((s, i) => { raw[s] = evs[i] / total })
    const blended = {}
    const base = defaults[regime]
    for (const strat of STRATEGIES) {
      blended[strat] = Math.max(0.05, raw[strat] * 0.6 + (base[strat] || 0.25) * 0.4)
    }
    const bTotal = STRATEGIES.reduce((s, k) => s + blended[k], 0)
    for (const strat of STRATEGIES) blended[strat] = blended[strat] / bTotal
    model.adaptiveWeights[regime] = blended
  }
}

function recalculateFactorWeightsForModel(model) {
  const ac = model.assetClass || 'equity'
  const resolved = resolvedForModel(model)
  const defaults = DEFAULT_FACTOR_WEIGHTS_BY_CLASS[ac] || DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity

  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    model.factorWeights = { ...defaults }
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
    model.factorWeights[key] = (scores[key] || 1) / total
  }
}

function recalculateMinConfForModel(model) {
  const resolved = resolvedForModel(model)
  if (resolved.length < LEARNING_MODE_THRESHOLD) { model.minimumConfidence = 50; return }
  const thresholds = [50, 60, 70, 80]
  let breakEven = 50
  for (const t of thresholds) {
    const bucket = resolved.filter(s => s.confidence >= t)
    if (bucket.length >= 5 && mean(bucket.map(s => s.actualReturn || 0)) > 0) {
      breakEven = t
      break
    }
  }
  model.minimumConfidence = Math.max(50, breakEven - 5)
}

// ============ PER-CLASS ANOMALY DETECTION ============

function detectAnomaliesForModel(model) {
  const resolved = resolvedForModel(model)
  const anomalies = []
  const now = Date.now()
  if (resolved.length < 10) return anomalies

  const recent = [...resolved].sort((a, b) => (b.resolvedAt || b.timestamp) - (a.resolvedAt || a.timestamp))
  const last20 = recent.slice(0, 20)

  if (last20.length >= 15) {
    const wr = last20.filter(s => (s.actualReturn || 0) > 0).length / last20.length
    if (wr < 0.45) {
      anomalies.push({
        type: 'LOW_WIN_RATE', severity: wr < 0.35 ? 'critical' : 'warning',
        message: `[${model.assetClass}] Win rate over last ${last20.length} signals is ${(wr * 100).toFixed(1)}%`,
        detectedAt: now, assetClass: model.assetClass,
      })
    }
  }

  if (last20.length >= 10) {
    const avgRet = mean(last20.map(s => s.actualReturn || 0))
    if (avgRet < 0) {
      anomalies.push({
        type: 'NEGATIVE_AVG_RETURN', severity: avgRet < -0.01 ? 'critical' : 'warning',
        message: `[${model.assetClass}] Avg return over last ${last20.length} signals is ${(avgRet * 100).toFixed(2)}%`,
        detectedAt: now, assetClass: model.assetClass,
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
        message: `[${model.assetClass}] Strategy "${strat}" has ${consecutive} consecutive losses`,
        detectedAt: now, assetClass: model.assetClass,
      })
    }
  }

  return anomalies
}

// ============ CROSS-CLASS ANOMALY DETECTION ============

function detectCrossClassAnomalies() {
  const anomalies = []
  const now = Date.now()
  const classWinRates = {}

  for (const ac of ASSET_CLASSES) {
    const resolved = resolvedForModel(getModel(ac))
    if (resolved.length >= 10) {
      const recent = [...resolved].sort((a, b) => (b.resolvedAt || b.timestamp) - (a.resolvedAt || a.timestamp)).slice(0, 20)
      classWinRates[ac] = recent.filter(s => (s.actualReturn || 0) > 0).length / recent.length
    }
  }

  const wrValues = Object.values(classWinRates)
  if (wrValues.length >= 2) {
    const globalWR = mean(wrValues)
    for (const [ac, wr] of Object.entries(classWinRates)) {
      const diff = wr - globalWR
      if (Math.abs(diff) > 0.15) {
        anomalies.push({
          type: 'CLASS_DIVERGENCE',
          severity: Math.abs(diff) > 0.25 ? 'critical' : 'warning',
          message: `${ac} win rate (${(wr * 100).toFixed(0)}%) ${diff > 0 ? 'outperforming' : 'underperforming'} global avg (${(globalWR * 100).toFixed(0)}%) by ${(Math.abs(diff) * 100).toFixed(0)}pp`,
          detectedAt: now, assetClass: ac,
        })
      }
    }
  }

  return anomalies
}

// ============ PER-CLASS CORRECTION GENERATION ============

function generateCorrectionsForModel(model) {
  const ac = model.assetClass || 'equity'
  const corrections = []
  const now = Date.now()
  const defaults = DEFAULT_WEIGHTS_BY_CLASS[ac] || DEFAULT_WEIGHTS_BY_CLASS.equity
  const defaultFactors = DEFAULT_FACTOR_WEIGHTS_BY_CLASS[ac] || DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity

  for (const regime of REGIMES) {
    const current = model.adaptiveWeights[regime]
    const base = defaults[regime]
    if (!current || !base) continue
    for (const strat of STRATEGIES) {
      const diff = (current[strat] || 0) - (base[strat] || 0)
      if (Math.abs(diff) > 0.05) {
        corrections.push({
          type: 'STRATEGY_WEIGHT',
          description: `[${ac}] ${strat} in ${regime}: ${(base[strat] * 100).toFixed(0)}% -> ${(current[strat] * 100).toFixed(0)}%`,
          from: base[strat], to: current[strat], magnitude: Math.abs(diff), generatedAt: now, assetClass: ac,
        })
      }
    }
  }

  if (model.minimumConfidence !== 50) {
    corrections.push({
      type: 'CONFIDENCE_THRESHOLD',
      description: `[${ac}] Minimum confidence raised from 50 to ${model.minimumConfidence}`,
      from: 50, to: model.minimumConfidence, magnitude: model.minimumConfidence - 50, generatedAt: now, assetClass: ac,
    })
  }

  for (const key of Object.keys(defaultFactors)) {
    const current = model.factorWeights[key] ?? defaultFactors[key]
    const base = defaultFactors[key]
    if (Math.abs(current - base) > 0.03) {
      corrections.push({
        type: 'FACTOR_WEIGHT',
        description: `[${ac}] Factor "${key}": ${(base * 100).toFixed(1)}% -> ${(current * 100).toFixed(1)}%`,
        from: base, to: current, magnitude: Math.abs(current - base), generatedAt: now, assetClass: ac,
      })
    }
  }

  return corrections
}

// ============ FULL AUDIT (per-class) ============

function runFullAudit() {
  ensureInit()
  const globalResolved = allResolved()
  const globalIsLearning = globalResolved.length < (LEARNING_MODE_THRESHOLD * ASSET_CLASSES.length)

  // Per-class audits
  const allAnomalies = []
  const allCorrections = []
  const perClassSummary = {}

  for (const ac of ASSET_CLASSES) {
    const model = getModel(ac)
    const resolved = resolvedForModel(model)
    const isLearning = resolved.length < LEARNING_MODE_THRESHOLD

    recalculateAdaptiveWeightsForModel(model)
    recalculateFactorWeightsForModel(model)
    recalculateMinConfForModel(model)
    model.anomalies = detectAnomaliesForModel(model)
    model.corrections = generateCorrectionsForModel(model)
    model.lastAuditAt = Date.now()

    allAnomalies.push(...model.anomalies)
    allCorrections.push(...model.corrections)

    perClassSummary[ac] = {
      signalCount: model.signals.length,
      resolvedCount: resolved.length,
      isLearningMode: isLearning,
      learningProgress: Math.min(1, resolved.length / LEARNING_MODE_THRESHOLD),
      winRate: resolved.length > 0 ? resolved.filter(s => (s.actualReturn || 0) > 0).length / resolved.length : 0,
      avgReturn: resolved.length > 0 ? mean(resolved.map(s => s.actualReturn || 0)) : 0,
      anomalyCount: model.anomalies.length,
      minimumConfidence: model.minimumConfidence,
    }
  }

  // Cross-class anomalies
  allAnomalies.push(...detectCrossClassAnomalies())

  // Global metrics
  state.metrics.overall = computeRollingMetrics(globalResolved)
  state.metrics.byStrategy = metricsByGroup(globalResolved, s => normaliseStrategy(s.strategy))
  state.metrics.byRegime = metricsByGroup(globalResolved, s => s.regime)
  state.metrics.byTimeframe = metricsByGroup(globalResolved, s => timeframeBucket(s.holdDuration || 0))
  state.metrics.byConfidenceBucket = metricsByGroup(globalResolved, s => confidenceBucket(s.confidence))
  state.metrics.byAssetClass = metricsByGroup(globalResolved, s => classifyAsset(s.ticker, s.assetType))
  state.lastAuditAt = Date.now()

  return {
    metrics: state.metrics,
    anomalies: allAnomalies,
    corrections: allCorrections,
    isLearningMode: globalIsLearning,
    perClass: perClassSummary,
  }
}

// ============ STRATEGY RECOMMENDATION (per-class) ============

function getStrategyRecommendation(regime, timeframe, assetClass) {
  ensureInit()
  const ac = assetClass || 'equity'
  const model = getModel(ac)
  const resolved = resolvedForModel(model)
  const defaults = DEFAULT_WEIGHTS_BY_CLASS[ac] || DEFAULT_WEIGHTS_BY_CLASS.equity

  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    const weights = defaults[regime] || defaults['volatile-transition']
    const best = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]
    return {
      strategy: best[0], confidence: 50, expectedValue: 0, assetClass: ac,
      reason: `[${ac}] Learning mode (${resolved.length}/${LEARNING_MODE_THRESHOLD}). Using default weights.`,
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
      ev: calcEV(wr, wins.length > 0 ? mean(wins) : 0, losses.length > 0 ? Math.abs(mean(losses)) : 0),
      winRate: wr, count: sp.length,
    })
  }
  evals.sort((a, b) => b.ev - a.ev)
  const best = evals[0]
  return {
    strategy: best.strategy,
    confidence: Math.min(95, 50 + best.count + best.winRate * 30),
    expectedValue: best.ev, assetClass: ac,
    reason: `[${ac}] ${best.strategy} has highest EV (${(best.ev * 100).toFixed(2)}%) with ${(best.winRate * 100).toFixed(0)}% WR over ${best.count} signals.`,
    alternatives: evals.slice(1).map(e => ({ strategy: e.strategy, expectedValue: e.ev, winRate: e.winRate, count: e.count })),
  }
}

// ============ INTELLIGENCE BRIEF (per-class aware) ============

function generateIntelligenceBrief() {
  ensureInit()
  const resolved = allResolved()
  const globalIsLearning = resolved.length < (LEARNING_MODE_THRESHOLD * ASSET_CLASSES.length)
  const metrics = state.metrics?.overall?.allTime || computeMetrics([])
  const last20 = state.metrics?.overall?.last20 || computeMetrics([])

  const lines = []
  lines.push('=== NOCTIS MARKET INTELLIGENCE BRIEF ===')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Mode: ${globalIsLearning ? 'LEARNING' : 'ACTIVE'} (${resolved.length} resolved signals across ${ASSET_CLASSES.length} classes)`)
  lines.push('')

  // Global performance
  lines.push('--- Global Performance ---')
  lines.push(`All-time win rate: ${(metrics.winRate * 100).toFixed(1)}% | Sharpe: ${metrics.sharpeRatio.toFixed(2)} | PF: ${metrics.profitFactor === Infinity ? 'INF' : metrics.profitFactor.toFixed(2)}`)
  lines.push(`Last 20 win rate: ${(last20.winRate * 100).toFixed(1)}% | Avg return: ${(last20.avgReturn * 100).toFixed(2)}%`)
  const trend = last20.winRate > metrics.winRate ? 'IMPROVING' : last20.winRate < metrics.winRate - 0.05 ? 'DETERIORATING' : 'STABLE'
  lines.push(`Trend: ${trend}`)
  lines.push('')

  // Per-class performance breakdown
  lines.push('--- Per-Class Performance ---')
  for (const ac of ASSET_CLASSES) {
    const model = getModel(ac)
    const classResolved = resolvedForModel(model)
    if (classResolved.length === 0) {
      lines.push(`${ac.toUpperCase()}: No data yet`)
      continue
    }
    const classMetrics = computeMetrics(classResolved)
    const isLearning = classResolved.length < LEARNING_MODE_THRESHOLD
    lines.push(`${ac.toUpperCase()}: ${(classMetrics.winRate * 100).toFixed(1)}% WR | ${classResolved.length} signals | Sharpe ${classMetrics.sharpeRatio.toFixed(2)} | ${isLearning ? 'LEARNING' : 'ACTIVE'}`)
  }
  lines.push('')

  // Best/worst combos (strategy x regime x class)
  lines.push('--- Strategy x Regime Matrix (Top Combos) ---')
  let bestCombo = { key: 'N/A', wr: 0 }
  let worstCombo = { key: 'N/A', wr: 1 }
  for (const ac of ASSET_CLASSES) {
    const classResolved = resolvedForModel(getModel(ac))
    for (const strat of STRATEGIES) {
      for (const regime of REGIMES) {
        const pool = classResolved.filter(s => normaliseStrategy(s.strategy) === strat && s.regime === regime)
        if (pool.length >= 3) {
          const wr = pool.filter(s => (s.actualReturn || 0) > 0).length / pool.length
          if (wr > bestCombo.wr) bestCombo = { key: `${ac}/${strat}/${regime}`, wr, count: pool.length }
          if (wr < worstCombo.wr) worstCombo = { key: `${ac}/${strat}/${regime}`, wr, count: pool.length }
        }
      }
    }
  }
  lines.push(`Best:  ${bestCombo.key} (${(bestCombo.wr * 100).toFixed(0)}% WR, n=${bestCombo.count || 0})`)
  lines.push(`Worst: ${worstCombo.key} (${(worstCombo.wr * 100).toFixed(0)}% WR, n=${worstCombo.count || 0})`)
  lines.push('')

  // Anomalies (all classes)
  const allAnomalies = []
  for (const ac of ASSET_CLASSES) allAnomalies.push(...(getModel(ac).anomalies || []))
  allAnomalies.push(...detectCrossClassAnomalies())
  lines.push('--- Active Anomalies ---')
  if (allAnomalies.length === 0) {
    lines.push('No anomalies detected.')
  } else {
    for (const a of allAnomalies.slice(0, 8)) {
      lines.push(`[${a.severity.toUpperCase()}] ${a.message}`)
    }
  }
  lines.push('')

  // Corrections summary
  let totalCorrections = 0
  for (const ac of ASSET_CLASSES) totalCorrections += (getModel(ac).corrections || []).length
  lines.push('--- Adaptive Corrections ---')
  lines.push(`${totalCorrections} active corrections across all classes.`)
  lines.push('')

  // Per-class strategy recommendations
  lines.push('--- Strategy Recommendations by Class ---')
  for (const ac of ASSET_CLASSES) {
    for (const regime of REGIMES) {
      const rec = getStrategyRecommendation(regime, null, ac)
      lines.push(`${ac}/${regime}: ${rec.strategy} (EV: ${(rec.expectedValue * 100).toFixed(2)}%)`)
    }
  }
  lines.push('')

  // Benchmark
  lines.push('--- Benchmark ---')
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
      change,
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
  const resolved = allResolved()
  const isLearning = resolved.length < (LEARNING_MODE_THRESHOLD * ASSET_CLASSES.length)
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
    perClass: {},
  }

  // Sector performance
  const sectorSyms = ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLC', 'XLY']
  const sectorNames = { XLK: 'Technology', XLF: 'Financials', XLE: 'Energy', XLV: 'Healthcare', XLI: 'Industrials', XLP: 'Staples', XLU: 'Utilities', XLRE: 'Real Estate', XLB: 'Materials', XLC: 'Communications', XLY: 'Discretionary' }
  for (const sym of sectorSyms) {
    const d = snapshot[sym]
    if (d && !d.error) brief.sectors[sectorNames[sym] || sym] = { change: d.change, price: d.price }
  }

  // Regime
  const vixLevel = vix.price || 0
  const spyChange = spy.change || 0
  if (vixLevel > 25) brief.regime = 'volatile-transition'
  else if (spyChange > 0.5) brief.regime = 'trending-bull'
  else if (spyChange < -0.5) brief.regime = 'trending-bear'
  else brief.regime = 'mean-reverting'

  // Per-class recommendations
  for (const ac of ASSET_CLASSES) {
    const rec = getStrategyRecommendation(brief.regime, null, ac)
    brief.perClass[ac] = { recommended: rec.strategy, ev: rec.expectedValue, confidence: rec.confidence }
  }

  // Best class for current regime
  const bestClass = Object.entries(brief.perClass).sort((a, b) => b[1].ev - a[1].ev)[0]

  if (briefType === 'pre-market') {
    brief.title = 'Pre-Market Intelligence Brief'
    const gapPct = spy.change || 0
    const gapDirection = gapPct > 0.3 ? 'gap up' : gapPct < -0.3 ? 'gap down' : 'flat open'
    brief.insights.push(`SPY ${gapDirection} ${Math.abs(gapPct).toFixed(2)}% from prior close`)
    if (vixLevel > 20) brief.insights.push(`Elevated VIX at ${vixLevel.toFixed(1)} - expect wider ranges`)
    else brief.insights.push(`VIX at ${vixLevel.toFixed(1)} - low volatility environment`)
    brief.insights.push(`Current regime: ${brief.regime.replace(/-/g, ' ')}`)
    brief.insights.push(`Best class today: ${bestClass[0]} via ${bestClass[1].recommended} (EV: ${(bestClass[1].ev * 100).toFixed(2)}%)`)
    if (spy.dayHigh && spy.dayLow) brief.insights.push(`SPY range: ${spy.dayLow.toFixed(2)} - ${spy.dayHigh.toFixed(2)}`)
    if (tnx.price) brief.insights.push(`10Y yield: ${tnx.price.toFixed(3)}% (${tnx.change > 0 ? '+' : ''}${tnx.change.toFixed(2)}%)`)
    if (dxy.price) brief.insights.push(`Dollar index: ${dxy.price.toFixed(2)} (${dxy.change > 0 ? '+' : ''}${dxy.change.toFixed(2)}%)`)
    brief.actionItems.push(`Focus on ${bestClass[0]} ${bestClass[1].recommended} setups`)
    if (gapPct > 0.5) brief.actionItems.push('Large gap up - watch for gap fill reversion')
    if (gapPct < -0.5) brief.actionItems.push('Large gap down - watch for gap fill bounce')
    if (vixLevel > 25) brief.actionItems.push('Reduce position sizes in elevated VIX')
    for (const ac of ASSET_CLASSES) {
      const m = getModel(ac)
      if (m.minimumConfidence > 50) brief.actionItems.push(`${ac} confidence threshold: ${m.minimumConfidence}%`)
    }

  } else if (briefType === 'midday') {
    brief.title = 'Midday Session Recap'
    brief.insights.push(`SPY ${spyChange > 0 ? '+' : ''}${spyChange.toFixed(2)}% at midday (${spy.price.toFixed(2)})`)
    brief.insights.push(`QQQ ${(qqq.change || 0) > 0 ? '+' : ''}${(qqq.change || 0).toFixed(2)}% | IWM ${(iwm.change || 0) > 0 ? '+' : ''}${(iwm.change || 0).toFixed(2)}%`)
    brief.insights.push(`Intraday regime: ${brief.regime.replace(/-/g, ' ')}`)
    // Today's signals across all classes
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000
    const todaySignals = allSignals().filter(s => s.timestamp > twelveHoursAgo)
    const todayResolved = todaySignals.filter(s => s.outcome && s.outcome !== 'OPEN')
    brief.insights.push(`Signals today: ${todaySignals.length} total (${todayResolved.length} resolved)`)
    if (todayResolved.length > 0) {
      const todayWR = todayResolved.filter(s => (s.actualReturn || 0) > 0).length / todayResolved.length
      brief.insights.push(`Today's resolved: ${(todayWR * 100).toFixed(0)}% WR`)
    }
    const sortedSectors = Object.entries(brief.sectors).sort((a, b) => (b[1].change || 0) - (a[1].change || 0))
    if (sortedSectors.length > 0) {
      brief.insights.push(`Leading: ${sortedSectors[0][0]} (${sortedSectors[0][1].change > 0 ? '+' : ''}${sortedSectors[0][1].change.toFixed(2)}%) | Lagging: ${sortedSectors[sortedSectors.length-1][0]} (${sortedSectors[sortedSectors.length-1][1].change > 0 ? '+' : ''}${sortedSectors[sortedSectors.length-1][1].change.toFixed(2)}%)`)
    }
    brief.actionItems.push(`Best class right now: ${bestClass[0]} via ${bestClass[1].recommended}`)
    if (vixLevel > 20) brief.actionItems.push('Tighten stops in elevated volatility')

  } else {
    brief.title = 'Post-Close Audit & Outlook'
    brief.insights.push(`SPY closed ${spyChange > 0 ? '+' : ''}${spyChange.toFixed(2)}% at ${spy.price.toFixed(2)}`)
    brief.insights.push(`QQQ ${(qqq.change || 0) > 0 ? '+' : ''}${(qqq.change || 0).toFixed(2)}% | IWM ${(iwm.change || 0) > 0 ? '+' : ''}${(iwm.change || 0).toFixed(2)}%`)
    // Day P/L across classes
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    for (const ac of ASSET_CLASSES) {
      const daySignals = resolvedForModel(getModel(ac)).filter(s => (s.resolvedAt || s.timestamp) > oneDayAgo)
      if (daySignals.length > 0) {
        const dayPnL = daySignals.reduce((s, sig) => s + (sig.actualReturn || 0), 0)
        brief.insights.push(`${ac}: ${(dayPnL * 100).toFixed(2)}% across ${daySignals.length} signals today`)
      }
    }
    // Anomalies
    let totalAnomalies = 0
    for (const ac of ASSET_CLASSES) totalAnomalies += (getModel(ac).anomalies || []).length
    if (totalAnomalies > 0) brief.insights.push(`Active anomalies: ${totalAnomalies}`)
    brief.insights.push(`Closing regime: ${brief.regime.replace(/-/g, ' ')}`)
    brief.actionItems.push(`Tomorrow's best class: ${bestClass[0]} via ${bestClass[1].recommended} (EV: ${(bestClass[1].ev * 100).toFixed(2)}%)`)
    for (const ac of ASSET_CLASSES) {
      if (getModel(ac).anomalies?.some(a => a.severity === 'critical')) {
        brief.actionItems.push(`CRITICAL: Review ${ac} anomalies before trading`)
      }
    }
  }

  // Store
  if (!state.briefs) state.briefs = {}
  const briefKey = briefType === 'pre-market' ? 'preMarket' : briefType === 'midday' ? 'midday' : 'postClose'
  state.briefs[briefKey] = brief

  return brief
}

// ============ PERFORMANCE REPORT ============

function getPerformanceReport() {
  ensureInit()
  const resolved = allResolved()
  const open = allSignals().filter(s => s.outcome === 'OPEN' || !s.outcome)

  // Global equity curve
  const sorted = [...resolved].sort((a, b) => (a.resolvedAt || a.timestamp) - (b.resolvedAt || b.timestamp))
  let cumReturn = 1
  const equityCurve = sorted.map((s, i) => {
    cumReturn *= (1 + (s.actualReturn || 0))
    return { index: i + 1, date: s.resolvedAt || s.timestamp, equity: cumReturn, return: s.actualReturn || 0, ticker: s.ticker, strategy: s.strategy }
  })

  // Per-class equity curves
  const perClassEquity = {}
  for (const ac of ASSET_CLASSES) {
    const classResolved = resolvedForModel(getModel(ac))
    const classSorted = [...classResolved].sort((a, b) => (a.resolvedAt || a.timestamp) - (b.resolvedAt || b.timestamp))
    let eq = 1
    perClassEquity[ac] = classSorted.map((s, i) => {
      eq *= (1 + (s.actualReturn || 0))
      return { index: i + 1, equity: eq, return: s.actualReturn || 0, ticker: s.ticker }
    })
  }

  // Factor attribution (use equity class as representative, or merged)
  const mergedFactorWeights = {}
  const factorKeys = Object.keys(DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity)
  for (const fk of factorKeys) {
    let sum = 0, count = 0
    for (const ac of ASSET_CLASSES) {
      const model = getModel(ac)
      if (resolvedForModel(model).length >= LEARNING_MODE_THRESHOLD) {
        sum += model.factorWeights[fk] || 0
        count++
      }
    }
    mergedFactorWeights[fk] = count > 0 ? sum / count : DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity[fk]
  }

  const factorAttribution = {}
  for (const [factor, weight] of Object.entries(mergedFactorWeights)) {
    factorAttribution[factor] = {
      weight,
      defaultWeight: DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity[factor] || 0,
      change: weight - (DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity[factor] || 0),
    }
  }

  // Strategy x regime matrix (global)
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

  // Per-class summary
  const perClassSummary = {}
  for (const ac of ASSET_CLASSES) {
    const model = getModel(ac)
    const classResolved = resolvedForModel(model)
    perClassSummary[ac] = {
      signalCount: model.signals.length,
      resolvedCount: classResolved.length,
      isLearningMode: classResolved.length < LEARNING_MODE_THRESHOLD,
      learningProgress: Math.min(1, classResolved.length / LEARNING_MODE_THRESHOLD),
      minimumConfidence: model.minimumConfidence,
      anomalyCount: (model.anomalies || []).length,
      metrics: classResolved.length > 0 ? computeMetrics(classResolved) : computeMetrics([]),
    }
  }

  // All anomalies + corrections
  const allAnomalies = []
  const allCorrections = []
  for (const ac of ASSET_CLASSES) {
    allAnomalies.push(...(getModel(ac).anomalies || []))
    allCorrections.push(...(getModel(ac).corrections || []))
  }
  allAnomalies.push(...detectCrossClassAnomalies())

  // Global minimum confidence (lowest across classes)
  const minConfs = ASSET_CLASSES.map(ac => getModel(ac).minimumConfidence)

  return {
    summary: {
      totalSignals: allSignals().length,
      resolvedSignals: resolved.length,
      openSignals: open.length,
      isLearningMode: resolved.length < (LEARNING_MODE_THRESHOLD * ASSET_CLASSES.length),
      learningProgress: Math.min(1, resolved.length / (LEARNING_MODE_THRESHOLD * ASSET_CLASSES.length)),
      lastAuditAt: state.lastAuditAt,
    },
    metrics: state.metrics,
    equityCurve,
    perClassEquity,
    strategyMatrix,
    factorAttribution,
    minimumConfidence: Math.max(...minConfs),
    anomalies: allAnomalies,
    corrections: allCorrections,
    briefs: state.briefs || {},
    intelligenceBrief: generateIntelligenceBrief(),
    perClass: perClassSummary,
  }
}

// ============ RECORD SIGNAL (routes to correct class) ============

function recordSignal(signal, outcome) {
  ensureInit()
  if (!signal || !outcome) throw new Error('Both signal and outcome are required')

  const ac = classifyAsset(signal.ticker, signal.assetType || signal.asset)
  const model = getModel(ac)

  // Check for existing
  let existing = null
  if (signal.id) {
    existing = model.signals.find(s => s.id === signal.id)
    // Check other classes too (in case asset was reclassified)
    if (!existing) {
      for (const otherAc of ASSET_CLASSES) {
        if (otherAc === ac) continue
        existing = getModel(otherAc).signals.find(s => s.id === signal.id)
        if (existing) break
      }
    }
  }

  if (existing) {
    existing.outcome = outcome.result || outcome.outcome || 'OPEN'
    existing.actualReturn = outcome.actualReturn ?? existing.actualReturn ?? 0
    existing.holdDuration = outcome.holdDuration ?? existing.holdDuration ?? 0
    existing.resolvedAt = outcome.resolvedAt || Date.now()
    return { id: existing.id, assetClass: ac, totalSignals: allSignals().length }
  }

  const entry = {
    id: signal.id || uid(),
    ticker: signal.ticker || 'UNKNOWN',
    direction: signal.direction || 'long',
    strategy: signal.strategy || 'momentum',
    confidence: signal.confidence ?? 50,
    regime: signal.regime || 'volatile-transition',
    assetClass: ac,
    assetType: signal.assetType || signal.asset || ac,
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

  model.signals.push(entry)
  if (model.signals.length > MAX_SIGNALS_PER_CLASS) {
    model.signals = model.signals.slice(model.signals.length - MAX_SIGNALS_PER_CLASS)
  }

  return { id: entry.id, assetClass: ac, totalSignals: allSignals().length }
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
        // Import signal history into per-class models
        if (Array.isArray(signalHistory) && signalHistory.length > 0) {
          const existingIds = new Set(allSignals().map(s => s.id))
          for (const s of signalHistory) {
            if (!existingIds.has(s.id)) {
              const ac = classifyAsset(s.ticker, s.assetType || s.asset)
              const model = getModel(ac)
              model.signals.push({ ...s, assetClass: ac })
              existingIds.add(s.id)
            }
          }
          // Cap per class
          for (const ac of ASSET_CLASSES) {
            const model = getModel(ac)
            if (model.signals.length > MAX_SIGNALS_PER_CLASS) {
              model.signals = model.signals.slice(model.signals.length - MAX_SIGNALS_PER_CLASS)
            }
          }
        }
        const auditResult = runFullAudit()
        const report = getPerformanceReport()
        return new Response(JSON.stringify({ success: true, audit: auditResult, report }), {
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
        return new Response(JSON.stringify({ success: true, brief, snapshot }), {
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
