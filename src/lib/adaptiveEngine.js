// adaptiveEngine.js — Adaptive learning engine for Noctis
// Learns from past signal outcomes and self-corrects strategy weights,
// confidence thresholds, and factor importance in real time.
// Pure JavaScript — runs in Vercel Edge Runtime, no external dependencies.

// ============ CONSTANTS ============

const STORAGE_KEY = 'noctis_adaptive_engine';
const MAX_SIGNALS = 500;
const LEARNING_MODE_THRESHOLD = 20;
const ROLLING_WINDOWS = [20, 50, 100];
const ANNUALIZATION_FACTOR = Math.sqrt(252);

const STRATEGIES = ['momentum', 'meanReversion', 'breakout'];
const REGIMES = ['trending-bull', 'trending-bear', 'mean-reverting', 'volatile-transition'];
const TIMEFRAMES = ['dayTrade', 'swing', 'position'];
const CONFIDENCE_BUCKETS = ['50-60', '60-70', '70-80', '80+'];
const ASSET_CLASSES = ['equity', 'forex', 'crypto', 'futures'];
const QUALITY_GRADES = ['A', 'B', 'C', 'D'];

const DEFAULT_WEIGHTS = {
  'trending-bull':        { momentum: 0.50, meanReversion: 0.20, breakout: 0.30 },
  'trending-bear':        { momentum: 0.45, meanReversion: 0.30, breakout: 0.25 },
  'mean-reverting':       { momentum: 0.25, meanReversion: 0.55, breakout: 0.20 },
  'volatile-transition':  { momentum: 0.30, meanReversion: 0.35, breakout: 0.35 },
};

const DEFAULT_FACTOR_WEIGHTS = {
  rsi: 0.15,
  adx: 0.15,
  hurst: 0.10,
  alphaComposite: 0.20,
  ensembleScore: 0.20,
  sentiment: 0.10,
  regimeConfidence: 0.10,
};

// ============ STATE ============

/** @type {{ signals: Array, metrics: Object, corrections: Array, anomalies: Array, adaptiveWeights: Object, factorWeights: Object, minimumConfidence: number }} */
let state = null;

// ============ HELPERS: MATH ============

/**
 * Calculate arithmetic mean of an array.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Calculate population standard deviation.
 * @param {number[]} arr
 * @returns {number}
 */
function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Annualized Sharpe Ratio.
 * @param {number[]} returns - array of per-trade returns (decimal, e.g. 0.02 = 2%)
 * @returns {number}
 */
function sharpeRatio(returns) {
  if (!returns || returns.length < 2) return 0;
  const sd = stddev(returns);
  if (sd === 0) return 0;
  return (mean(returns) / sd) * ANNUALIZATION_FACTOR;
}

/**
 * Profit Factor: gross wins / |gross losses|.
 * @param {number[]} returns
 * @returns {number}
 */
function profitFactor(returns) {
  if (!returns || returns.length === 0) return 0;
  const wins = returns.filter(r => r > 0).reduce((s, v) => s + v, 0);
  const losses = Math.abs(returns.filter(r => r < 0).reduce((s, v) => s + v, 0));
  if (losses === 0) return wins > 0 ? Infinity : 0;
  return wins / losses;
}

/**
 * Maximum drawdown over a sequence of returns.
 * Builds an equity curve from the returns and finds the max peak-to-trough decline.
 * @param {number[]} returns - per-trade returns (decimal)
 * @returns {number} - drawdown as a positive decimal (e.g. 0.12 = 12% drawdown)
 */
function maxDrawdown(returns) {
  if (!returns || returns.length === 0) return 0;
  let equity = 1;
  let peak = 1;
  let maxDD = 0;
  for (const r of returns) {
    equity *= (1 + r);
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

/**
 * Kelly Fraction: (winRate * avgWin - lossRate * avgLoss) / avgWin
 * @param {number} winRate
 * @param {number} avgWin - positive decimal
 * @param {number} avgLoss - positive decimal (magnitude)
 * @returns {number}
 */
function kellyFraction(winRate, avgWin, avgLoss) {
  if (avgWin === 0) return 0;
  const lossRate = 1 - winRate;
  return (winRate * avgWin - lossRate * avgLoss) / avgWin;
}

/**
 * Expected value per trade.
 * @param {number} winRate
 * @param {number} avgWin - positive
 * @param {number} avgLoss - positive (magnitude)
 * @returns {number}
 */
function expectedValue(winRate, avgWin, avgLoss) {
  return winRate * avgWin - (1 - winRate) * avgLoss;
}

/**
 * Generate a short unique id.
 * @returns {string}
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============ HELPERS: BUCKET / CLASSIFICATION ============

/**
 * Map a confidence value (0-100) to a bucket key.
 * @param {number} confidence
 * @returns {string}
 */
function confidenceBucket(confidence) {
  if (confidence >= 80) return '80+';
  if (confidence >= 70) return '70-80';
  if (confidence >= 60) return '60-70';
  return '50-60';
}

/**
 * Classify hold duration (hours) into a timeframe bucket.
 * @param {number} hours
 * @returns {string}
 */
function timeframeBucket(hours) {
  if (hours <= 8) return 'dayTrade';
  if (hours <= 120) return 'swing'; // up to ~5 days
  return 'position';
}

/**
 * Determine asset class from ticker string.
 * Heuristic: pairs like EUR/USD -> forex, BTC/ETH -> crypto, /ES -> futures, else equity.
 * @param {string} ticker
 * @returns {string}
 */
function classifyAsset(ticker) {
  if (!ticker) return 'equity';
  const t = ticker.toUpperCase();
  const forexPairs = [
    'EUR', 'USD', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF',
  ];
  if (t.includes('/')) {
    const [base] = t.split('/');
    if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK'].includes(base)) return 'crypto';
    if (forexPairs.includes(base)) return 'forex';
  }
  if (t.startsWith('/') || t.startsWith('MES') || t.startsWith('MNQ') || t.startsWith('ES') || t.startsWith('NQ')) return 'futures';
  if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].some(c => t.startsWith(c))) return 'crypto';
  return 'equity';
}

// ============ METRICS CALCULATION ============

/**
 * Build a performance metrics object from a list of resolved signals.
 * @param {Array} signals - resolved signals (outcome !== 'OPEN')
 * @returns {{ winRate: number, avgReturn: number, sharpeRatio: number, maxDrawdown: number, profitFactor: number, kellyFraction: number, expectedValue: number, tradeCount: number }}
 */
function computeMetrics(signals) {
  const empty = {
    winRate: 0, avgReturn: 0, sharpeRatio: 0,
    maxDrawdown: 0, profitFactor: 0, kellyFraction: 0,
    expectedValue: 0, tradeCount: 0,
  };
  if (!signals || signals.length === 0) return empty;

  const returns = signals.map(s => s.actualReturn || 0);
  const wins = returns.filter(r => r > 0);
  const losses = returns.filter(r => r < 0);
  const wr = wins.length / returns.length;
  const avgWin = wins.length > 0 ? mean(wins) : 0;
  const avgLoss = losses.length > 0 ? Math.abs(mean(losses)) : 0;

  return {
    winRate: wr,
    avgReturn: mean(returns),
    sharpeRatio: sharpeRatio(returns),
    maxDrawdown: maxDrawdown(returns),
    profitFactor: profitFactor(returns),
    kellyFraction: kellyFraction(wr, avgWin, avgLoss),
    expectedValue: expectedValue(wr, avgWin, avgLoss),
    tradeCount: returns.length,
  };
}

/**
 * Compute rolling-window metrics for a set of resolved signals.
 * Returns { last20: metrics, last50: metrics, last100: metrics, allTime: metrics }.
 * @param {Array} signals
 * @returns {Object}
 */
function computeRollingMetrics(signals) {
  const sorted = [...signals].sort((a, b) => (b.resolvedAt || b.timestamp) - (a.resolvedAt || a.timestamp));
  return {
    last20: computeMetrics(sorted.slice(0, 20)),
    last50: computeMetrics(sorted.slice(0, 50)),
    last100: computeMetrics(sorted.slice(0, 100)),
    allTime: computeMetrics(sorted),
  };
}

/**
 * Group signals by a key extractor and compute metrics per group.
 * @param {Array} signals
 * @param {function} keyFn - extracts a grouping key from a signal
 * @returns {Object<string, Object>}
 */
function metricsByGroup(signals, keyFn) {
  const groups = {};
  for (const s of signals) {
    const key = keyFn(s);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  const result = {};
  for (const [key, list] of Object.entries(groups)) {
    result[key] = computeRollingMetrics(list);
  }
  return result;
}

// ============ PERSISTENCE ============

/**
 * Attempt to load state from localStorage.
 * @returns {Object|null}
 */
function loadFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persist current state to localStorage.
 */
function saveToStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail — may be over quota or in SSR
  }
}

// ============ INITIALIZATION ============

/**
 * Create a blank engine state.
 * @returns {Object}
 */
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
  };
}

/**
 * Initialise the adaptive engine. Loads persisted state from localStorage
 * or creates a fresh state if none exists.
 * @returns {{ signalCount: number, isLearningMode: boolean }}
 */
export function initAdaptiveEngine() {
  const loaded = loadFromStorage();
  if (loaded && Array.isArray(loaded.signals)) {
    state = loaded;
    // Ensure all required keys exist (forward-compat)
    if (!state.corrections) state.corrections = [];
    if (!state.anomalies) state.anomalies = [];
    if (!state.adaptiveWeights) state.adaptiveWeights = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
    if (!state.factorWeights) state.factorWeights = { ...DEFAULT_FACTOR_WEIGHTS };
    if (!state.minimumConfidence) state.minimumConfidence = 50;
  } else {
    state = freshState();
  }
  saveToStorage();
  return {
    signalCount: state.signals.length,
    isLearningMode: resolvedSignals().length < LEARNING_MODE_THRESHOLD,
  };
}

/**
 * Get all resolved (non-OPEN) signals.
 * @returns {Array}
 */
function resolvedSignals() {
  if (!state) return [];
  return state.signals.filter(s => s.outcome && s.outcome !== 'OPEN');
}

/**
 * Ensure the engine is initialised before use.
 */
function ensureInit() {
  if (!state) initAdaptiveEngine();
}

// ============ RECORD SIGNAL OUTCOME ============

/**
 * Record a resolved (or new) signal outcome into the performance database.
 *
 * @param {Object} signal - Signal object with at minimum: ticker, direction, strategy, confidence, regime.
 *   Optional enrichment fields: entryPrice, targetPrice, stopPrice, factors { rsiAtEntry, adxAtEntry, ... }
 * @param {Object} outcome - Resolution details.
 * @param {'TARGET_HIT'|'STOP_HIT'|'EXPIRED'|'OPEN'} outcome.result
 * @param {number} outcome.actualReturn - Realised return as a decimal (e.g. 0.03 = +3%).
 * @param {number} [outcome.holdDuration] - Duration in hours.
 * @param {number} [outcome.resolvedAt] - Epoch ms when outcome was determined.
 * @returns {{ id: string, totalSignals: number }}
 */
export function recordSignalOutcome(signal, outcome) {
  ensureInit();

  if (!signal || !outcome) {
    throw new Error('recordSignalOutcome requires both a signal object and an outcome object');
  }

  // Check if this signal already exists (by id) and update it
  let existing = null;
  if (signal.id) {
    existing = state.signals.find(s => s.id === signal.id);
  }

  if (existing) {
    existing.outcome = outcome.result || outcome.outcome || 'OPEN';
    existing.actualReturn = outcome.actualReturn ?? existing.actualReturn ?? 0;
    existing.holdDuration = outcome.holdDuration ?? existing.holdDuration ?? 0;
    existing.resolvedAt = outcome.resolvedAt || Date.now();
    saveToStorage();
    return { id: existing.id, totalSignals: state.signals.length };
  }

  // New signal entry
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
  };

  state.signals.push(entry);

  // FIFO eviction when over capacity
  if (state.signals.length > MAX_SIGNALS) {
    state.signals = state.signals.slice(state.signals.length - MAX_SIGNALS);
  }

  saveToStorage();
  return { id: entry.id, totalSignals: state.signals.length };
}

// ============ ADAPTIVE WEIGHTS ============

/**
 * Recalculate adaptive strategy weights based on historical performance.
 * In learning mode (< 20 resolved signals) returns default weights.
 */
function recalculateAdaptiveWeights() {
  const resolved = resolvedSignals();
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    state.adaptiveWeights = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
    return;
  }

  for (const regime of REGIMES) {
    const regimeSignals = resolved.filter(s => s.regime === regime);
    if (regimeSignals.length < 5) {
      // Not enough data for this regime, keep defaults
      state.adaptiveWeights[regime] = { ...DEFAULT_WEIGHTS[regime] };
      continue;
    }

    const stratPerf = {};
    for (const strat of STRATEGIES) {
      const stratSignals = regimeSignals.filter(s => normaliseStrategy(s.strategy) === strat);
      if (stratSignals.length < 3) {
        stratPerf[strat] = { winRate: 0.5, ev: 0, count: 0 };
      } else {
        const returns = stratSignals.map(s => s.actualReturn || 0);
        const wins = returns.filter(r => r > 0);
        const losses = returns.filter(r => r < 0);
        const wr = wins.length / returns.length;
        const avgW = wins.length > 0 ? mean(wins) : 0;
        const avgL = losses.length > 0 ? Math.abs(mean(losses)) : 0;
        stratPerf[strat] = {
          winRate: wr,
          ev: expectedValue(wr, avgW, avgL),
          count: stratSignals.length,
        };
      }
    }

    // Weight by expected value, floored at 0.05 per strategy
    const evs = STRATEGIES.map(s => Math.max(stratPerf[s].ev, 0.001));
    const total = evs.reduce((a, b) => a + b, 0);
    const raw = {};
    STRATEGIES.forEach((s, i) => {
      raw[s] = evs[i] / total;
    });

    // Blend: 60% data-driven, 40% default (dampen swings)
    const blended = {};
    const base = DEFAULT_WEIGHTS[regime];
    for (const strat of STRATEGIES) {
      blended[strat] = Math.max(0.05, raw[strat] * 0.6 + (base[strat] || 0.33) * 0.4);
    }

    // Re-normalise to sum to 1
    const bTotal = STRATEGIES.reduce((s, k) => s + blended[k], 0);
    for (const strat of STRATEGIES) {
      blended[strat] = blended[strat] / bTotal;
    }

    state.adaptiveWeights[regime] = blended;
  }
}

/**
 * Normalise strategy names to canonical form.
 * @param {string} strat
 * @returns {string}
 */
function normaliseStrategy(strat) {
  if (!strat) return 'momentum';
  const s = strat.toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('meanrev') || s.includes('reversion')) return 'meanReversion';
  if (s.includes('breakout')) return 'breakout';
  return 'momentum';
}

/**
 * Get current adaptive weights for a regime and optionally a specific strategy.
 * Returns the full weight map for the regime, or a single weight if strategy is provided.
 *
 * @param {string} regime - e.g. 'trending-bull'
 * @param {string} [strategy] - optional specific strategy
 * @returns {Object|number}
 */
export function getAdaptiveWeights(regime, strategy) {
  ensureInit();
  const weights = state.adaptiveWeights[regime] || state.adaptiveWeights['volatile-transition'] || DEFAULT_WEIGHTS['volatile-transition'];
  if (strategy) {
    return weights[normaliseStrategy(strategy)] ?? 0.33;
  }
  return { ...weights };
}

// ============ SIGNAL QUALITY SCORER ============

/**
 * Score a proposed signal's quality before emission.
 * Returns a quality grade (A-D) and the expected value.
 *
 * Grade thresholds (on expected value per trade):
 *   A: EV >= 1.5%   (strong positive edge)
 *   B: EV >= 0.5%   (moderate edge)
 *   C: EV >= 0%     (break-even or marginal)
 *   D: EV < 0%      (negative expectancy — suppress)
 *
 * @param {Object} signal - Proposed signal with: strategy, regime, confidence, ticker
 * @returns {{ grade: string, expectedValue: number, winRate: number, avgWin: number, avgLoss: number, recommendation: string, pass: boolean }}
 */
export function scoreSignalQuality(signal) {
  ensureInit();

  const defaults = {
    grade: 'C',
    expectedValue: 0,
    winRate: 0.5,
    avgWin: 0,
    avgLoss: 0,
    recommendation: 'LEARNING_MODE',
    pass: true,
  };

  const resolved = resolvedSignals();
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    // In learning mode — pass everything but mark it
    return defaults;
  }

  const strat = normaliseStrategy(signal.strategy);
  const regime = signal.regime || 'volatile-transition';
  const confidence = signal.confidence ?? 50;

  // Find historical signals matching this strategy + regime
  let pool = resolved.filter(s => normaliseStrategy(s.strategy) === strat && s.regime === regime);

  // If insufficient data for this exact combo, widen to strategy-only
  if (pool.length < 10) {
    pool = resolved.filter(s => normaliseStrategy(s.strategy) === strat);
  }

  // Still insufficient — widen to all resolved
  if (pool.length < 10) {
    pool = resolved;
  }

  const returns = pool.map(s => s.actualReturn || 0);
  const wins = returns.filter(r => r > 0);
  const losses = returns.filter(r => r < 0);
  const wr = wins.length / returns.length;
  const avgW = wins.length > 0 ? mean(wins) : 0;
  const avgL = losses.length > 0 ? Math.abs(mean(losses)) : 0;
  const ev = expectedValue(wr, avgW, avgL);

  // Confidence penalty: if this signal's confidence is below the minimum productive threshold, penalise
  const confBucket = confidenceBucket(confidence);
  const bucketSignals = resolved.filter(s => confidenceBucket(s.confidence) === confBucket);
  let confMultiplier = 1.0;
  if (bucketSignals.length >= 5) {
    const bucketReturns = bucketSignals.map(s => s.actualReturn || 0);
    const bucketAvg = mean(bucketReturns);
    if (bucketAvg < 0) {
      confMultiplier = 0.5; // heavily penalise historically losing confidence range
    }
  }

  const adjustedEV = ev * confMultiplier;

  let grade, recommendation;
  if (adjustedEV >= 0.015) {
    grade = 'A';
    recommendation = 'STRONG_SIGNAL';
  } else if (adjustedEV >= 0.005) {
    grade = 'B';
    recommendation = 'MODERATE_SIGNAL';
  } else if (adjustedEV >= 0) {
    grade = 'C';
    recommendation = 'MARGINAL_SIGNAL';
  } else {
    grade = 'D';
    recommendation = 'SUPPRESS';
  }

  const pass = adjustedEV >= 0 && confidence >= state.minimumConfidence;

  return {
    grade,
    expectedValue: adjustedEV,
    winRate: wr,
    avgWin: avgW,
    avgLoss: avgL,
    recommendation,
    pass,
  };
}

// ============ FACTOR WEIGHT RECALCULATION ============

/**
 * Recalculate factor importance weights based on correlation with positive outcomes.
 * Uses a simple rank-correlation heuristic: for each factor, compare its average value
 * in winning trades vs losing trades. Factors that discriminate better get more weight.
 */
function recalculateFactorWeights() {
  const resolved = resolvedSignals();
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    state.factorWeights = { ...DEFAULT_FACTOR_WEIGHTS };
    return;
  }

  const factorKeys = ['rsiAtEntry', 'adxAtEntry', 'hurstAtEntry', 'alphaComposite', 'ensembleScore', 'sentimentScore', 'regimeConfidence'];
  const canonicalKeys = ['rsi', 'adx', 'hurst', 'alphaComposite', 'ensembleScore', 'sentiment', 'regimeConfidence'];

  const discriminationScores = {};

  for (let i = 0; i < factorKeys.length; i++) {
    const fk = factorKeys[i];
    const ck = canonicalKeys[i];

    const withFactor = resolved.filter(s => s.factors && s.factors[fk] != null);
    if (withFactor.length < 10) {
      discriminationScores[ck] = 1.0; // neutral if not enough data
      continue;
    }

    const winVals = withFactor.filter(s => (s.actualReturn || 0) > 0).map(s => s.factors[fk]);
    const lossVals = withFactor.filter(s => (s.actualReturn || 0) <= 0).map(s => s.factors[fk]);

    if (winVals.length === 0 || lossVals.length === 0) {
      discriminationScores[ck] = 1.0;
      continue;
    }

    // Discrimination = |mean(winVals) - mean(lossVals)| / pooled stddev
    const winMean = mean(winVals);
    const lossMean = mean(lossVals);
    const pooledStd = (stddev(winVals) + stddev(lossVals)) / 2 || 1;
    const d = Math.abs(winMean - lossMean) / pooledStd;

    discriminationScores[ck] = Math.max(0.1, d);
  }

  // Normalise to sum to 1
  const total = Object.values(discriminationScores).reduce((a, b) => a + b, 0);
  for (const key of canonicalKeys) {
    state.factorWeights[key] = (discriminationScores[key] || 1) / total;
  }
}

// ============ MINIMUM CONFIDENCE RECALCULATION ============

/**
 * Find the break-even confidence threshold: the lowest confidence bucket
 * where average return is positive. Set the minimum one bucket below that
 * to allow some exploration.
 */
function recalculateMinimumConfidence() {
  const resolved = resolvedSignals();
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    state.minimumConfidence = 50;
    return;
  }

  const bucketThresholds = [50, 60, 70, 80];
  let breakEvenBucket = 50;

  for (const threshold of bucketThresholds) {
    const bucket = resolved.filter(s => s.confidence >= threshold);
    if (bucket.length >= 5) {
      const avg = mean(bucket.map(s => s.actualReturn || 0));
      if (avg > 0) {
        breakEvenBucket = threshold;
        break;
      }
    }
  }

  // Set minimum to 5 points below break-even for some exploration headroom
  state.minimumConfidence = Math.max(50, breakEvenBucket - 5);
}

// ============ ANOMALY DETECTION ============

/**
 * Scan signal history for anomalies. Returns an array of anomaly objects.
 * @returns {Array<{ type: string, severity: string, message: string, detectedAt: number, data: Object }>}
 */
function detectAnomalies() {
  const resolved = resolvedSignals();
  const anomalies = [];
  const now = Date.now();

  if (resolved.length < 10) return anomalies;

  // Sort most recent first
  const recent = [...resolved].sort((a, b) => (b.resolvedAt || b.timestamp) - (a.resolvedAt || a.timestamp));

  // 1. Win rate below 45% over last 20
  const last20 = recent.slice(0, 20);
  if (last20.length >= 20) {
    const wr = last20.filter(s => (s.actualReturn || 0) > 0).length / last20.length;
    if (wr < 0.45) {
      anomalies.push({
        type: 'LOW_WIN_RATE',
        severity: wr < 0.35 ? 'critical' : 'warning',
        message: `Win rate over last 20 signals is ${(wr * 100).toFixed(1)}% (below 45% threshold)`,
        detectedAt: now,
        data: { winRate: wr, sampleSize: 20 },
      });
    }
  }

  // 2. Average return negative over last 20
  if (last20.length >= 10) {
    const avgRet = mean(last20.map(s => s.actualReturn || 0));
    if (avgRet < 0) {
      anomalies.push({
        type: 'NEGATIVE_AVG_RETURN',
        severity: avgRet < -0.01 ? 'critical' : 'warning',
        message: `Average return over last ${last20.length} signals is ${(avgRet * 100).toFixed(2)}%`,
        detectedAt: now,
        data: { avgReturn: avgRet, sampleSize: last20.length },
      });
    }
  }

  // 3. Strategy with 5+ consecutive losses
  for (const strat of STRATEGIES) {
    const stratSignals = recent.filter(s => normaliseStrategy(s.strategy) === strat);
    let consecutive = 0;
    for (const s of stratSignals) {
      if ((s.actualReturn || 0) <= 0) {
        consecutive++;
      } else {
        break;
      }
    }
    if (consecutive >= 5) {
      anomalies.push({
        type: 'CONSECUTIVE_LOSSES',
        severity: consecutive >= 8 ? 'critical' : 'warning',
        message: `Strategy "${strat}" has ${consecutive} consecutive losses`,
        detectedAt: now,
        data: { strategy: strat, consecutiveLosses: consecutive },
      });
    }
  }

  // 4. Regime detector mismatch
  //    If regime was bullish but actual return was strongly negative (>2% loss),
  //    flag as a potential regime detection error.
  const recentResolved = recent.slice(0, 10);
  for (const s of recentResolved) {
    if (s.regime === 'trending-bull' && (s.actualReturn || 0) < -0.02) {
      anomalies.push({
        type: 'REGIME_MISMATCH',
        severity: 'warning',
        message: `Signal ${s.id} detected "trending-bull" but saw ${(s.actualReturn * 100).toFixed(1)}% loss — possible regime error`,
        detectedAt: now,
        data: { signalId: s.id, regime: s.regime, actualReturn: s.actualReturn },
      });
    }
    if (s.regime === 'trending-bear' && (s.actualReturn || 0) > 0.02 && s.direction === 'short') {
      anomalies.push({
        type: 'REGIME_MISMATCH',
        severity: 'info',
        message: `Signal ${s.id} detected "trending-bear" but short gained ${(s.actualReturn * 100).toFixed(1)}% — potential regime misread`,
        detectedAt: now,
        data: { signalId: s.id, regime: s.regime, actualReturn: s.actualReturn },
      });
    }
  }

  return anomalies;
}

// ============ CORRECTION GENERATION ============

/**
 * Generate correction factors based on current vs default weights.
 * Each correction describes a specific adjustment and its rationale.
 * @returns {Array<{ type: string, description: string, from: *, to: *, magnitude: number, generatedAt: number }>}
 */
function generateCorrections() {
  const corrections = [];
  const now = Date.now();

  // Strategy weight corrections
  for (const regime of REGIMES) {
    const current = state.adaptiveWeights[regime];
    const base = DEFAULT_WEIGHTS[regime];
    if (!current || !base) continue;

    for (const strat of STRATEGIES) {
      const diff = (current[strat] || 0) - (base[strat] || 0);
      if (Math.abs(diff) > 0.05) {
        corrections.push({
          type: 'STRATEGY_WEIGHT',
          description: `${strat} weight in ${regime}: ${(base[strat] * 100).toFixed(0)}% -> ${(current[strat] * 100).toFixed(0)}%`,
          from: base[strat],
          to: current[strat],
          magnitude: Math.abs(diff),
          generatedAt: now,
        });
      }
    }
  }

  // Confidence threshold correction
  if (state.minimumConfidence !== 50) {
    corrections.push({
      type: 'CONFIDENCE_THRESHOLD',
      description: `Minimum confidence raised from 50 to ${state.minimumConfidence}`,
      from: 50,
      to: state.minimumConfidence,
      magnitude: state.minimumConfidence - 50,
      generatedAt: now,
    });
  }

  // Factor weight corrections
  for (const key of Object.keys(DEFAULT_FACTOR_WEIGHTS)) {
    const current = state.factorWeights[key] ?? DEFAULT_FACTOR_WEIGHTS[key];
    const base = DEFAULT_FACTOR_WEIGHTS[key];
    const diff = Math.abs(current - base);
    if (diff > 0.03) {
      corrections.push({
        type: 'FACTOR_WEIGHT',
        description: `Factor "${key}" weight: ${(base * 100).toFixed(1)}% -> ${(current * 100).toFixed(1)}%`,
        from: base,
        to: current,
        magnitude: diff,
        generatedAt: now,
      });
    }
  }

  return corrections;
}

// ============ PERFORMANCE AUDIT ============

/**
 * Run a full performance audit: recalculate all metrics, adaptive weights,
 * factor importance, minimum confidence, anomalies, and corrections.
 * Should be called during post-market review.
 *
 * @returns {{ metrics: Object, anomalies: Array, corrections: Array, isLearningMode: boolean }}
 */
export function runPerformanceAudit() {
  ensureInit();

  const resolved = resolvedSignals();
  const isLearningMode = resolved.length < LEARNING_MODE_THRESHOLD;

  // Recalculate overall metrics with rolling windows
  state.metrics.overall = computeRollingMetrics(resolved);

  // Grouped metrics
  state.metrics.byStrategy = metricsByGroup(resolved, s => normaliseStrategy(s.strategy));
  state.metrics.byRegime = metricsByGroup(resolved, s => s.regime);
  state.metrics.byTimeframe = metricsByGroup(resolved, s => timeframeBucket(s.holdDuration || 0));
  state.metrics.byConfidenceBucket = metricsByGroup(resolved, s => confidenceBucket(s.confidence));
  state.metrics.byAssetClass = metricsByGroup(resolved, s => classifyAsset(s.ticker));

  // Adaptive recalculations
  recalculateAdaptiveWeights();
  recalculateFactorWeights();
  recalculateMinimumConfidence();

  // Detect anomalies
  state.anomalies = detectAnomalies();

  // Generate corrections
  state.corrections = generateCorrections();

  state.lastAuditAt = Date.now();
  saveToStorage();

  return {
    metrics: state.metrics,
    anomalies: state.anomalies,
    corrections: state.corrections,
    isLearningMode,
  };
}

// ============ REPORTING ============

/**
 * Get a dashboard-ready performance report.
 * @returns {Object}
 */
export function getPerformanceReport() {
  ensureInit();

  const resolved = resolvedSignals();
  const open = state.signals.filter(s => s.outcome === 'OPEN' || !s.outcome);

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
    adaptiveWeights: state.adaptiveWeights,
    factorWeights: state.factorWeights,
    minimumConfidence: state.minimumConfidence,
    anomalies: state.anomalies,
    corrections: state.corrections,
  };
}

/**
 * Get the current list of active corrections.
 * @returns {Array}
 */
export function getCorrections() {
  ensureInit();
  return [...state.corrections];
}

/**
 * Get the current list of anomaly alerts.
 * @returns {Array}
 */
export function getAnomalies() {
  ensureInit();
  return [...state.anomalies];
}

// ============ STRATEGY RECOMMENDATION ============

/**
 * Given the current regime and timeframe, recommend the best strategy
 * based on historical performance data.
 *
 * @param {string} regime - Current market regime
 * @param {string} timeframe - 'dayTrade' | 'swing' | 'position'
 * @returns {{ strategy: string, confidence: number, expectedValue: number, reason: string, alternatives: Array }}
 */
export function getStrategyRecommendation(regime, timeframe) {
  ensureInit();

  const resolved = resolvedSignals();
  const isLearning = resolved.length < LEARNING_MODE_THRESHOLD;

  // Default recommendation based on static weights
  if (isLearning) {
    const weights = DEFAULT_WEIGHTS[regime] || DEFAULT_WEIGHTS['volatile-transition'];
    const best = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];
    return {
      strategy: best[0],
      confidence: 50,
      expectedValue: 0,
      reason: `Learning mode (${resolved.length}/${LEARNING_MODE_THRESHOLD} signals). Using default weights for ${regime}.`,
      alternatives: Object.entries(weights)
        .sort((a, b) => b[1] - a[1])
        .slice(1)
        .map(([s, w]) => ({ strategy: s, weight: w })),
    };
  }

  // Filter signals by regime and timeframe
  let pool = resolved.filter(s => s.regime === regime);
  if (timeframe) {
    const tfPool = pool.filter(s => timeframeBucket(s.holdDuration || 0) === timeframe);
    if (tfPool.length >= 10) pool = tfPool;
  }

  // If too few signals for this regime, broaden
  if (pool.length < 10) pool = resolved;

  // Evaluate each strategy
  const stratEvals = [];
  for (const strat of STRATEGIES) {
    const stratPool = pool.filter(s => normaliseStrategy(s.strategy) === strat);
    if (stratPool.length < 3) {
      stratEvals.push({ strategy: strat, ev: 0, winRate: 0.5, count: 0 });
      continue;
    }
    const returns = stratPool.map(s => s.actualReturn || 0);
    const wins = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0);
    const wr = wins.length / returns.length;
    const avgW = wins.length > 0 ? mean(wins) : 0;
    const avgL = losses.length > 0 ? Math.abs(mean(losses)) : 0;
    stratEvals.push({
      strategy: strat,
      ev: expectedValue(wr, avgW, avgL),
      winRate: wr,
      count: stratPool.length,
    });
  }

  stratEvals.sort((a, b) => b.ev - a.ev);
  const best = stratEvals[0];

  return {
    strategy: best.strategy,
    confidence: Math.min(95, 50 + best.count + best.winRate * 30),
    expectedValue: best.ev,
    reason: `${best.strategy} has the highest EV (${(best.ev * 100).toFixed(2)}%) with ${(best.winRate * 100).toFixed(0)}% win rate over ${best.count} signals in ${regime}${timeframe ? ' / ' + timeframe : ''}.`,
    alternatives: stratEvals.slice(1).map(e => ({
      strategy: e.strategy,
      expectedValue: e.ev,
      winRate: e.winRate,
      count: e.count,
    })),
  };
}

// ============ UTILITY EXPORTS ============

/**
 * Reset the engine to a blank state. Clears localStorage.
 * @returns {void}
 */
export function resetAdaptiveEngine() {
  state = freshState();
  saveToStorage();
}

/**
 * Export raw signal history (for backup or external analysis).
 * @returns {Array}
 */
export function exportSignals() {
  ensureInit();
  return [...state.signals];
}

/**
 * Import signals from an external source (e.g. restore from backup).
 * Merges by id, avoiding duplicates.
 * @param {Array} signals
 * @returns {{ imported: number, duplicates: number }}
 */
export function importSignals(signals) {
  ensureInit();
  if (!Array.isArray(signals)) return { imported: 0, duplicates: 0 };

  const existingIds = new Set(state.signals.map(s => s.id));
  let imported = 0;
  let duplicates = 0;

  for (const s of signals) {
    if (existingIds.has(s.id)) {
      duplicates++;
      continue;
    }
    state.signals.push(s);
    existingIds.add(s.id);
    imported++;
  }

  // FIFO trim
  if (state.signals.length > MAX_SIGNALS) {
    state.signals = state.signals.slice(state.signals.length - MAX_SIGNALS);
  }

  saveToStorage();
  return { imported, duplicates };
}

/**
 * Get the current factor weights (for display or use in signal generation).
 * @returns {Object}
 */
export function getFactorWeights() {
  ensureInit();
  return { ...state.factorWeights };
}

/**
 * Check if the engine is in learning mode.
 * @returns {boolean}
 */
export function isLearningMode() {
  ensureInit();
  return resolvedSignals().length < LEARNING_MODE_THRESHOLD;
}
