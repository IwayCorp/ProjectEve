// adaptiveEngine.js — Per-Asset-Class Adaptive Learning Engine for Noctis
// Each asset class (equity, forex, crypto, commodity, macro) gets its own
// independent learning model with separate signal history, strategy weights,
// factor weights, confidence thresholds, anomalies, and corrections.
// Pure JavaScript — runs in Vercel Edge Runtime, no external dependencies.

// ============ CONSTANTS ============

const STORAGE_KEY = 'noctis_adaptive_engine_v2';
const LEGACY_STORAGE_KEY = 'noctis_adaptive_engine';
const MAX_SIGNALS_PER_CLASS = 300;
const LEARNING_MODE_THRESHOLD = 12; // per-class threshold (lower since data is split)
const ROLLING_WINDOWS = [20, 50, 100];
const ANNUALIZATION_FACTOR = Math.sqrt(252);

const STRATEGIES = ['momentum', 'meanReversion', 'breakout', 'macro'];
const REGIMES = ['trending-bull', 'trending-bear', 'mean-reverting', 'volatile-transition'];
const TIMEFRAMES = ['dayTrade', 'swing', 'position'];
const CONFIDENCE_BUCKETS = ['50-60', '60-70', '70-80', '80+'];
const ASSET_CLASSES = ['equity', 'forex', 'crypto', 'commodity', 'macro'];
const QUALITY_GRADES = ['A', 'B', 'C', 'D'];

// Per-class default weights — each asset class has different optimal strategy mixes
const DEFAULT_WEIGHTS_BY_CLASS = {
  equity: {
    'trending-bull':        { momentum: 0.50, meanReversion: 0.20, breakout: 0.30, macro: 0.00 },
    'trending-bear':        { momentum: 0.45, meanReversion: 0.30, breakout: 0.20, macro: 0.05 },
    'mean-reverting':       { momentum: 0.20, meanReversion: 0.55, breakout: 0.20, macro: 0.05 },
    'volatile-transition':  { momentum: 0.25, meanReversion: 0.30, breakout: 0.30, macro: 0.15 },
  },
  forex: {
    'trending-bull':        { momentum: 0.40, meanReversion: 0.15, breakout: 0.25, macro: 0.20 },
    'trending-bear':        { momentum: 0.40, meanReversion: 0.15, breakout: 0.25, macro: 0.20 },
    'mean-reverting':       { momentum: 0.15, meanReversion: 0.50, breakout: 0.15, macro: 0.20 },
    'volatile-transition':  { momentum: 0.20, meanReversion: 0.20, breakout: 0.30, macro: 0.30 },
  },
  crypto: {
    'trending-bull':        { momentum: 0.55, meanReversion: 0.10, breakout: 0.30, macro: 0.05 },
    'trending-bear':        { momentum: 0.40, meanReversion: 0.25, breakout: 0.25, macro: 0.10 },
    'mean-reverting':       { momentum: 0.20, meanReversion: 0.50, breakout: 0.25, macro: 0.05 },
    'volatile-transition':  { momentum: 0.30, meanReversion: 0.20, breakout: 0.35, macro: 0.15 },
  },
  commodity: {
    'trending-bull':        { momentum: 0.45, meanReversion: 0.15, breakout: 0.25, macro: 0.15 },
    'trending-bear':        { momentum: 0.40, meanReversion: 0.20, breakout: 0.20, macro: 0.20 },
    'mean-reverting':       { momentum: 0.15, meanReversion: 0.50, breakout: 0.15, macro: 0.20 },
    'volatile-transition':  { momentum: 0.20, meanReversion: 0.20, breakout: 0.25, macro: 0.35 },
  },
  macro: {
    'trending-bull':        { momentum: 0.30, meanReversion: 0.10, breakout: 0.15, macro: 0.45 },
    'trending-bear':        { momentum: 0.25, meanReversion: 0.15, breakout: 0.15, macro: 0.45 },
    'mean-reverting':       { momentum: 0.10, meanReversion: 0.30, breakout: 0.10, macro: 0.50 },
    'volatile-transition':  { momentum: 0.15, meanReversion: 0.15, breakout: 0.20, macro: 0.50 },
  },
};

// Per-class default factor weights — different factors matter for different asset classes
const DEFAULT_FACTOR_WEIGHTS_BY_CLASS = {
  equity: { rsi: 0.14, adx: 0.16, hurst: 0.10, alphaComposite: 0.22, ensembleScore: 0.20, sentiment: 0.10, regimeConfidence: 0.08 },
  forex:  { rsi: 0.12, adx: 0.14, hurst: 0.08, alphaComposite: 0.15, ensembleScore: 0.15, sentiment: 0.06, regimeConfidence: 0.30 },
  crypto: { rsi: 0.18, adx: 0.14, hurst: 0.12, alphaComposite: 0.18, ensembleScore: 0.18, sentiment: 0.12, regimeConfidence: 0.08 },
  commodity: { rsi: 0.12, adx: 0.15, hurst: 0.10, alphaComposite: 0.18, ensembleScore: 0.15, sentiment: 0.08, regimeConfidence: 0.22 },
  macro:  { rsi: 0.08, adx: 0.10, hurst: 0.08, alphaComposite: 0.12, ensembleScore: 0.12, sentiment: 0.10, regimeConfidence: 0.40 },
};

// Backward-compat: legacy DEFAULT_WEIGHTS (equity defaults)
const DEFAULT_WEIGHTS = DEFAULT_WEIGHTS_BY_CLASS.equity;
const DEFAULT_FACTOR_WEIGHTS = DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity;

// ============ STATE ============

/**
 * @type {{
 *   assetModels: Object<string, { signals, metrics, corrections, anomalies, adaptiveWeights, factorWeights, minimumConfidence, lastAuditAt }>,
 *   version: number
 * }}
 */
let state = null;

// ============ HELPERS: MATH ============

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function sharpeRatio(returns) {
  if (!returns || returns.length < 2) return 0;
  const sd = stddev(returns);
  if (sd === 0) return 0;
  return (mean(returns) / sd) * ANNUALIZATION_FACTOR;
}

function profitFactor(returns) {
  if (!returns || returns.length === 0) return 0;
  const wins = returns.filter(r => r > 0).reduce((s, v) => s + v, 0);
  const losses = Math.abs(returns.filter(r => r < 0).reduce((s, v) => s + v, 0));
  if (losses === 0) return wins > 0 ? Infinity : 0;
  return wins / losses;
}

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

function kellyFraction(winRate, avgWin, avgLoss) {
  if (avgWin === 0) return 0;
  const lossRate = 1 - winRate;
  return (winRate * avgWin - lossRate * avgLoss) / avgWin;
}

function expectedValue(winRate, avgWin, avgLoss) {
  return winRate * avgWin - (1 - winRate) * avgLoss;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============ HELPERS: BUCKET / CLASSIFICATION ============

function confidenceBucket(confidence) {
  if (confidence >= 80) return '80+';
  if (confidence >= 70) return '70-80';
  if (confidence >= 60) return '60-70';
  return '50-60';
}

function timeframeBucket(hours) {
  if (hours <= 8) return 'dayTrade';
  if (hours <= 120) return 'swing';
  return 'position';
}

/**
 * Determine asset class from ticker string or explicit asset type.
 * Enhanced to detect commodities and macro signals.
 */
export function classifyAsset(ticker, assetType) {
  // If explicitly provided, normalize it
  if (assetType) {
    const at = assetType.toLowerCase();
    if (at === 'forex') return 'forex';
    if (at === 'crypto') return 'crypto';
    if (at === 'commodity' || at === 'commodities') return 'commodity';
    if (at === 'macro') return 'macro';
    if (at === 'futures') return 'commodity'; // futures → commodity class
    if (at === 'equity') return 'equity';
  }

  if (!ticker) return 'equity';
  const t = ticker.toUpperCase();

  // Forex detection
  const forexPairs = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];
  if (t.includes('=X') || t.includes('/')) {
    const parts = t.replace('=X', '').split('/');
    if (forexPairs.some(p => t.includes(p)) && !t.startsWith('BTC')) return 'forex';
  }
  if (['USDJPY', 'EURUSD', 'GBPUSD', 'USDCHF', 'AUDUSD', 'USDMXN', 'EURGBP', 'NZDUSD'].includes(t)) return 'forex';
  if (['JPY=X', 'EURUSD=X', 'GBPUSD=X', 'CHF=X', 'AUDUSD=X', 'MXN=X', 'EURGBP=X', 'NZDUSD=X', 'DX-Y.NYB'].includes(t)) return 'forex';

  // Crypto detection
  if (['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD', 'ADA-USD', 'DOT-USD', 'AVAX-USD', 'MATIC-USD', 'LINK-USD'].includes(t)) return 'crypto';
  if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].some(c => t.startsWith(c) && t.includes('-'))) return 'crypto';

  // Commodity / Futures detection
  if (['GC=F', 'CL=F', 'SI=F', 'NG=F', 'HG=F', 'PL=F', 'ZC=F', 'ZW=F', 'ZS=F'].includes(t)) return 'commodity';
  if (t.endsWith('=F')) return 'commodity';
  if (['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'CORN', 'WEAT', 'SOYB'].includes(t)) return 'commodity';
  if (t.startsWith('/') || t.startsWith('MES') || t.startsWith('MNQ') || t.startsWith('ES=') || t.startsWith('NQ=')) return 'commodity';

  // Macro signals
  if (['TLT', 'IEF', 'SHY', 'TIP', 'UUP', 'FXI', 'EEM', 'EFA', 'VWO', 'HYG', 'LQD', 'JNK', 'AGG'].includes(t)) return 'macro';

  return 'equity';
}

// ============ METRICS CALCULATION ============

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

function computeRollingMetrics(signals) {
  const sorted = [...signals].sort((a, b) => (b.resolvedAt || b.timestamp) - (a.resolvedAt || a.timestamp));
  return {
    last20: computeMetrics(sorted.slice(0, 20)),
    last50: computeMetrics(sorted.slice(0, 50)),
    last100: computeMetrics(sorted.slice(0, 100)),
    allTime: computeMetrics(sorted),
  };
}

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

function loadFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    return null;
  } catch {
    return null;
  }
}

/**
 * Migrate legacy single-model state to per-asset-class state.
 * Distributes existing signals to their respective asset classes.
 */
function migrateLegacyState() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const legacy = JSON.parse(raw);
    if (!legacy || !Array.isArray(legacy.signals)) return null;

    // Distribute legacy signals by asset class
    const newState = { assetModels: {}, version: 2 };
    for (const ac of ASSET_CLASSES) {
      newState.assetModels[ac] = freshModel(ac);
    }

    for (const signal of legacy.signals) {
      const ac = classifyAsset(signal.ticker);
      if (newState.assetModels[ac]) {
        newState.assetModels[ac].signals.push(signal);
      }
    }

    // Trim each class
    for (const ac of ASSET_CLASSES) {
      const model = newState.assetModels[ac];
      if (model.signals.length > MAX_SIGNALS_PER_CLASS) {
        model.signals = model.signals.slice(model.signals.length - MAX_SIGNALS_PER_CLASS);
      }
    }

    return newState;
  } catch {
    return null;
  }
}

function saveToStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail — may be over quota or in SSR
  }
}

// ============ PER-CLASS MODEL ============

/**
 * Create a blank model for a single asset class.
 */
function freshModel(assetClass) {
  const defaultWeights = DEFAULT_WEIGHTS_BY_CLASS[assetClass] || DEFAULT_WEIGHTS_BY_CLASS.equity;
  const defaultFactors = DEFAULT_FACTOR_WEIGHTS_BY_CLASS[assetClass] || DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity;
  return {
    assetClass,
    signals: [],
    metrics: {
      overall: computeMetrics([]),
      byStrategy: {},
      byRegime: {},
      byTimeframe: {},
      byConfidenceBucket: {},
    },
    corrections: [],
    anomalies: [],
    adaptiveWeights: JSON.parse(JSON.stringify(defaultWeights)),
    factorWeights: { ...defaultFactors },
    minimumConfidence: 50,
    lastAuditAt: null,
  };
}

function freshState() {
  const s = { assetModels: {}, version: 2 };
  for (const ac of ASSET_CLASSES) {
    s.assetModels[ac] = freshModel(ac);
  }
  return s;
}

/**
 * Get the model for a specific asset class, creating it if needed.
 */
function getModel(assetClass) {
  if (!state) initAdaptiveEngine();
  const ac = assetClass || 'equity';
  if (!state.assetModels[ac]) {
    state.assetModels[ac] = freshModel(ac);
  }
  return state.assetModels[ac];
}

/**
 * Get all signals across all asset classes.
 */
function allSignals() {
  if (!state) return [];
  let all = [];
  for (const ac of ASSET_CLASSES) {
    if (state.assetModels[ac]) {
      all = all.concat(state.assetModels[ac].signals);
    }
  }
  return all;
}

/**
 * Get resolved signals for a model (or all models if no model provided).
 */
function resolvedSignalsForModel(model) {
  const signals = model ? model.signals : allSignals();
  return signals.filter(s => s.outcome && s.outcome !== 'OPEN');
}

// ============ INITIALIZATION ============

/**
 * Initialise the adaptive engine. Loads persisted per-class state from localStorage,
 * migrates legacy single-model state, or creates fresh state.
 * @returns {{ signalCount: number, isLearningMode: boolean, assetClasses: Object }}
 */
export function initAdaptiveEngine() {
  // Try loading v2 state
  const loaded = loadFromStorage();
  if (loaded && loaded.version === 2 && loaded.assetModels) {
    state = loaded;
    // Ensure all asset classes exist
    for (const ac of ASSET_CLASSES) {
      if (!state.assetModels[ac]) {
        state.assetModels[ac] = freshModel(ac);
      }
      const m = state.assetModels[ac];
      if (!m.corrections) m.corrections = [];
      if (!m.anomalies) m.anomalies = [];
      if (!m.adaptiveWeights) m.adaptiveWeights = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS_BY_CLASS[ac] || DEFAULT_WEIGHTS_BY_CLASS.equity));
      if (!m.factorWeights) m.factorWeights = { ...(DEFAULT_FACTOR_WEIGHTS_BY_CLASS[ac] || DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity) };
      if (!m.minimumConfidence) m.minimumConfidence = 50;
    }
  } else {
    // Try migrating legacy state
    const migrated = migrateLegacyState();
    if (migrated) {
      state = migrated;
    } else {
      state = freshState();
    }
  }
  saveToStorage();

  // Build per-class summary
  const assetClasses = {};
  let totalSignals = 0;
  let globalLearning = true;
  for (const ac of ASSET_CLASSES) {
    const m = state.assetModels[ac];
    const resolved = resolvedSignalsForModel(m);
    const learning = resolved.length < LEARNING_MODE_THRESHOLD;
    assetClasses[ac] = {
      signalCount: m.signals.length,
      resolvedCount: resolved.length,
      isLearningMode: learning,
      learningProgress: Math.min(1, resolved.length / LEARNING_MODE_THRESHOLD),
    };
    totalSignals += m.signals.length;
    if (!learning) globalLearning = false;
  }

  return {
    signalCount: totalSignals,
    isLearningMode: globalLearning,
    assetClasses,
  };
}

function ensureInit() {
  if (!state) initAdaptiveEngine();
}

// Backward-compat helpers
function resolvedSignals() {
  ensureInit();
  return resolvedSignalsForModel(null);
}

// ============ RECORD SIGNAL OUTCOME ============

/**
 * Record a resolved (or new) signal outcome into the appropriate asset class model.
 *
 * @param {Object} signal - Signal object with at minimum: ticker, direction, strategy, confidence, regime.
 * @param {Object} outcome - Resolution details.
 * @returns {{ id: string, totalSignals: number, assetClass: string }}
 */
export function recordSignalOutcome(signal, outcome) {
  ensureInit();

  if (!signal || !outcome) {
    throw new Error('recordSignalOutcome requires both a signal object and an outcome object');
  }

  const assetClass = classifyAsset(signal.ticker, signal.asset || signal.assetType);
  const model = getModel(assetClass);

  // Check if this signal already exists (by id) and update it
  let existing = null;
  if (signal.id) {
    existing = model.signals.find(s => s.id === signal.id);
    // Also check other models in case asset classification changed
    if (!existing) {
      for (const ac of ASSET_CLASSES) {
        if (ac === assetClass) continue;
        const otherModel = state.assetModels[ac];
        if (otherModel) {
          existing = otherModel.signals.find(s => s.id === signal.id);
          if (existing) break;
        }
      }
    }
  }

  if (existing) {
    existing.outcome = outcome.result || outcome.outcome || 'OPEN';
    existing.actualReturn = outcome.actualReturn ?? existing.actualReturn ?? 0;
    existing.holdDuration = outcome.holdDuration ?? existing.holdDuration ?? 0;
    existing.resolvedAt = outcome.resolvedAt || Date.now();
    saveToStorage();
    return { id: existing.id, totalSignals: model.signals.length, assetClass };
  }

  // New signal entry
  const entry = {
    id: signal.id || uid(),
    ticker: signal.ticker || 'UNKNOWN',
    direction: signal.direction || 'long',
    strategy: signal.strategy || 'momentum',
    confidence: signal.confidence ?? 50,
    regime: signal.regime || 'volatile-transition',
    assetClass,
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

  model.signals.push(entry);

  // FIFO eviction when over capacity
  if (model.signals.length > MAX_SIGNALS_PER_CLASS) {
    model.signals = model.signals.slice(model.signals.length - MAX_SIGNALS_PER_CLASS);
  }

  saveToStorage();
  return { id: entry.id, totalSignals: model.signals.length, assetClass };
}

// ============ NORMALISE STRATEGY ============

function normaliseStrategy(strat) {
  if (!strat) return 'momentum';
  const s = strat.toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('meanrev') || s.includes('reversion')) return 'meanReversion';
  if (s.includes('breakout')) return 'breakout';
  if (s.includes('macro') || s.includes('relative')) return 'macro';
  return 'momentum';
}

// ============ ADAPTIVE WEIGHTS (PER CLASS) ============

function recalculateAdaptiveWeightsForModel(model) {
  const ac = model.assetClass || 'equity';
  const defaultWeights = DEFAULT_WEIGHTS_BY_CLASS[ac] || DEFAULT_WEIGHTS_BY_CLASS.equity;
  const resolved = resolvedSignalsForModel(model);

  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    model.adaptiveWeights = JSON.parse(JSON.stringify(defaultWeights));
    return;
  }

  for (const regime of REGIMES) {
    const regimeSignals = resolved.filter(s => s.regime === regime);
    if (regimeSignals.length < 5) {
      model.adaptiveWeights[regime] = { ...(defaultWeights[regime] || {}) };
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
        stratPerf[strat] = { winRate: wr, ev: expectedValue(wr, avgW, avgL), count: stratSignals.length };
      }
    }

    const evs = STRATEGIES.map(s => Math.max(stratPerf[s].ev, 0.001));
    const total = evs.reduce((a, b) => a + b, 0);
    const raw = {};
    STRATEGIES.forEach((s, i) => { raw[s] = evs[i] / total; });

    // Blend: 60% data-driven, 40% default
    const blended = {};
    const base = defaultWeights[regime] || {};
    for (const strat of STRATEGIES) {
      blended[strat] = Math.max(0.03, (raw[strat] || 0) * 0.6 + (base[strat] || 0.25) * 0.4);
    }

    const bTotal = STRATEGIES.reduce((s, k) => s + (blended[k] || 0), 0);
    for (const strat of STRATEGIES) {
      blended[strat] = (blended[strat] || 0) / bTotal;
    }

    model.adaptiveWeights[regime] = blended;
  }
}

/**
 * Get adaptive weights for a regime, optionally scoped to an asset class.
 * @param {string} regime
 * @param {string} [strategy]
 * @param {string} [assetClass]
 * @returns {Object|number}
 */
export function getAdaptiveWeights(regime, strategy, assetClass) {
  ensureInit();
  const ac = assetClass || 'equity';
  const model = getModel(ac);
  const weights = model.adaptiveWeights[regime] || model.adaptiveWeights['volatile-transition'] || DEFAULT_WEIGHTS_BY_CLASS[ac]?.['volatile-transition'] || DEFAULT_WEIGHTS.equity?.['volatile-transition'];
  if (strategy) {
    return weights?.[normaliseStrategy(strategy)] ?? 0.25;
  }
  return { ...(weights || {}) };
}

// ============ SIGNAL QUALITY SCORER (PER CLASS) ============

/**
 * Score a proposed signal's quality using the appropriate asset-class model.
 * @param {Object} signal - { strategy, regime, confidence, ticker, asset }
 * @returns {{ grade, expectedValue, winRate, avgWin, avgLoss, recommendation, pass, assetClass }}
 */
export function scoreSignalQuality(signal) {
  ensureInit();

  const assetClass = classifyAsset(signal.ticker, signal.asset || signal.assetType);
  const model = getModel(assetClass);

  const defaults = {
    grade: 'C',
    expectedValue: 0,
    winRate: 0.5,
    avgWin: 0,
    avgLoss: 0,
    recommendation: 'LEARNING_MODE',
    pass: true,
    assetClass,
    adjustedConfidence: signal.confidence ?? 50,
  };

  const resolved = resolvedSignalsForModel(model);
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    return defaults;
  }

  const strat = normaliseStrategy(signal.strategy);
  const regime = signal.regime || 'volatile-transition';
  const confidence = signal.confidence ?? 50;

  // Find historical signals matching this strategy + regime in THIS asset class
  let pool = resolved.filter(s => normaliseStrategy(s.strategy) === strat && s.regime === regime);

  // Widen to strategy-only within this class
  if (pool.length < 8) {
    pool = resolved.filter(s => normaliseStrategy(s.strategy) === strat);
  }

  // Widen to all resolved in this class
  if (pool.length < 8) {
    pool = resolved;
  }

  // If STILL not enough data in this class, cross-reference the global pool
  if (pool.length < 5) {
    const globalResolved = resolvedSignals();
    pool = globalResolved.filter(s => normaliseStrategy(s.strategy) === strat);
    if (pool.length < 5) pool = globalResolved;
  }

  const returns = pool.map(s => s.actualReturn || 0);
  const wins = returns.filter(r => r > 0);
  const losses = returns.filter(r => r < 0);
  const wr = wins.length / returns.length;
  const avgW = wins.length > 0 ? mean(wins) : 0;
  const avgL = losses.length > 0 ? Math.abs(mean(losses)) : 0;
  const ev = expectedValue(wr, avgW, avgL);

  // Confidence penalty from per-class history
  const confBucket = confidenceBucket(confidence);
  const bucketSignals = resolved.filter(s => confidenceBucket(s.confidence) === confBucket);
  let confMultiplier = 1.0;
  if (bucketSignals.length >= 5) {
    const bucketReturns = bucketSignals.map(s => s.actualReturn || 0);
    const bucketAvg = mean(bucketReturns);
    if (bucketAvg < 0) confMultiplier = 0.5;
  }

  const adjustedEV = ev * confMultiplier;
  const adjustedConfidence = Math.max(25, Math.min(95, confidence * (1 + adjustedEV * 5)));

  let grade, recommendation;
  if (adjustedEV >= 0.015) { grade = 'A'; recommendation = 'STRONG_SIGNAL'; }
  else if (adjustedEV >= 0.005) { grade = 'B'; recommendation = 'MODERATE_SIGNAL'; }
  else if (adjustedEV >= 0) { grade = 'C'; recommendation = 'MARGINAL_SIGNAL'; }
  else { grade = 'D'; recommendation = 'SUPPRESS'; }

  const pass = adjustedEV >= 0 && confidence >= model.minimumConfidence;

  return {
    grade,
    expectedValue: adjustedEV,
    adjustedConfidence,
    winRate: wr,
    avgWin: avgW,
    avgLoss: avgL,
    recommendation,
    pass,
    assetClass,
  };
}

// ============ FACTOR WEIGHT RECALCULATION (PER CLASS) ============

function recalculateFactorWeightsForModel(model) {
  const ac = model.assetClass || 'equity';
  const defaults = DEFAULT_FACTOR_WEIGHTS_BY_CLASS[ac] || DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity;
  const resolved = resolvedSignalsForModel(model);

  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    model.factorWeights = { ...defaults };
    return;
  }

  const factorKeys = ['rsiAtEntry', 'adxAtEntry', 'hurstAtEntry', 'alphaComposite', 'ensembleScore', 'sentimentScore', 'regimeConfidence'];
  const canonicalKeys = ['rsi', 'adx', 'hurst', 'alphaComposite', 'ensembleScore', 'sentiment', 'regimeConfidence'];

  const discriminationScores = {};

  for (let i = 0; i < factorKeys.length; i++) {
    const fk = factorKeys[i];
    const ck = canonicalKeys[i];
    const withFactor = resolved.filter(s => s.factors && s.factors[fk] != null);
    if (withFactor.length < 8) {
      discriminationScores[ck] = 1.0;
      continue;
    }
    const winVals = withFactor.filter(s => (s.actualReturn || 0) > 0).map(s => s.factors[fk]);
    const lossVals = withFactor.filter(s => (s.actualReturn || 0) <= 0).map(s => s.factors[fk]);
    if (winVals.length === 0 || lossVals.length === 0) {
      discriminationScores[ck] = 1.0;
      continue;
    }
    const winMean = mean(winVals);
    const lossMean = mean(lossVals);
    const pooledStd = (stddev(winVals) + stddev(lossVals)) / 2 || 1;
    discriminationScores[ck] = Math.max(0.1, Math.abs(winMean - lossMean) / pooledStd);
  }

  const total = Object.values(discriminationScores).reduce((a, b) => a + b, 0);
  for (const key of canonicalKeys) {
    model.factorWeights[key] = (discriminationScores[key] || 1) / total;
  }
}

// ============ MINIMUM CONFIDENCE RECALCULATION (PER CLASS) ============

function recalculateMinimumConfidenceForModel(model) {
  const resolved = resolvedSignalsForModel(model);
  if (resolved.length < LEARNING_MODE_THRESHOLD) {
    model.minimumConfidence = 50;
    return;
  }

  const bucketThresholds = [50, 60, 70, 80];
  let breakEvenBucket = 50;
  for (const threshold of bucketThresholds) {
    const bucket = resolved.filter(s => s.confidence >= threshold);
    if (bucket.length >= 5) {
      const avg = mean(bucket.map(s => s.actualReturn || 0));
      if (avg > 0) { breakEvenBucket = threshold; break; }
    }
  }
  model.minimumConfidence = Math.max(50, breakEvenBucket - 5);
}

// ============ ANOMALY DETECTION (PER CLASS) ============

function detectAnomaliesForModel(model) {
  const resolved = resolvedSignalsForModel(model);
  const anomalies = [];
  const now = Date.now();
  const label = (model.assetClass || 'unknown').toUpperCase();

  if (resolved.length < 8) return anomalies;

  const recent = [...resolved].sort((a, b) => (b.resolvedAt || b.timestamp) - (a.resolvedAt || a.timestamp));
  const last20 = recent.slice(0, 20);

  // 1. Win rate below 45%
  if (last20.length >= 12) {
    const wr = last20.filter(s => (s.actualReturn || 0) > 0).length / last20.length;
    if (wr < 0.45) {
      anomalies.push({
        type: 'LOW_WIN_RATE',
        severity: wr < 0.35 ? 'critical' : 'warning',
        message: `[${label}] Win rate over last ${last20.length} signals is ${(wr * 100).toFixed(1)}%`,
        detectedAt: now,
        data: { winRate: wr, sampleSize: last20.length, assetClass: model.assetClass },
      });
    }
  }

  // 2. Average return negative
  if (last20.length >= 8) {
    const avgRet = mean(last20.map(s => s.actualReturn || 0));
    if (avgRet < 0) {
      anomalies.push({
        type: 'NEGATIVE_AVG_RETURN',
        severity: avgRet < -0.01 ? 'critical' : 'warning',
        message: `[${label}] Average return over last ${last20.length} signals is ${(avgRet * 100).toFixed(2)}%`,
        detectedAt: now,
        data: { avgReturn: avgRet, sampleSize: last20.length, assetClass: model.assetClass },
      });
    }
  }

  // 3. Strategy with consecutive losses
  for (const strat of STRATEGIES) {
    const stratSignals = recent.filter(s => normaliseStrategy(s.strategy) === strat);
    let consecutive = 0;
    for (const s of stratSignals) {
      if ((s.actualReturn || 0) <= 0) consecutive++;
      else break;
    }
    if (consecutive >= 4) {
      anomalies.push({
        type: 'CONSECUTIVE_LOSSES',
        severity: consecutive >= 7 ? 'critical' : 'warning',
        message: `[${label}] Strategy "${strat}" has ${consecutive} consecutive losses`,
        detectedAt: now,
        data: { strategy: strat, consecutiveLosses: consecutive, assetClass: model.assetClass },
      });
    }
  }

  // 4. Regime mismatch
  const recentResolved = recent.slice(0, 8);
  for (const s of recentResolved) {
    if (s.regime === 'trending-bull' && (s.actualReturn || 0) < -0.02) {
      anomalies.push({
        type: 'REGIME_MISMATCH',
        severity: 'warning',
        message: `[${label}] Signal ${s.id} was "trending-bull" but saw ${(s.actualReturn * 100).toFixed(1)}% loss`,
        detectedAt: now,
        data: { signalId: s.id, regime: s.regime, actualReturn: s.actualReturn, assetClass: model.assetClass },
      });
    }
  }

  // 5. Cross-class divergence: this class performing very differently from global average
  const globalResolved = resolvedSignals();
  if (globalResolved.length >= 20 && resolved.length >= 8) {
    const globalAvg = mean(globalResolved.slice(-20).map(s => s.actualReturn || 0));
    const classAvg = mean(resolved.slice(-Math.min(20, resolved.length)).map(s => s.actualReturn || 0));
    const divergence = classAvg - globalAvg;
    if (Math.abs(divergence) > 0.02) {
      anomalies.push({
        type: 'CLASS_DIVERGENCE',
        severity: divergence < -0.02 ? 'warning' : 'info',
        message: `[${label}] ${divergence > 0 ? 'Outperforming' : 'Underperforming'} global average by ${(divergence * 100).toFixed(2)}%`,
        detectedAt: now,
        data: { classAvg, globalAvg, divergence, assetClass: model.assetClass },
      });
    }
  }

  return anomalies;
}

// ============ CORRECTION GENERATION (PER CLASS) ============

function generateCorrectionsForModel(model) {
  const corrections = [];
  const now = Date.now();
  const ac = model.assetClass || 'equity';
  const defaultWeights = DEFAULT_WEIGHTS_BY_CLASS[ac] || DEFAULT_WEIGHTS_BY_CLASS.equity;
  const defaultFactors = DEFAULT_FACTOR_WEIGHTS_BY_CLASS[ac] || DEFAULT_FACTOR_WEIGHTS_BY_CLASS.equity;
  const label = ac.toUpperCase();

  for (const regime of REGIMES) {
    const current = model.adaptiveWeights[regime];
    const base = defaultWeights[regime];
    if (!current || !base) continue;
    for (const strat of STRATEGIES) {
      const diff = (current[strat] || 0) - (base[strat] || 0);
      if (Math.abs(diff) > 0.05) {
        corrections.push({
          type: 'STRATEGY_WEIGHT',
          description: `[${label}] ${strat} weight in ${regime}: ${((base[strat] || 0) * 100).toFixed(0)}% → ${((current[strat] || 0) * 100).toFixed(0)}%`,
          from: base[strat] || 0,
          to: current[strat] || 0,
          magnitude: Math.abs(diff),
          generatedAt: now,
          assetClass: ac,
        });
      }
    }
  }

  if (model.minimumConfidence !== 50) {
    corrections.push({
      type: 'CONFIDENCE_THRESHOLD',
      description: `[${label}] Minimum confidence: 50 → ${model.minimumConfidence}`,
      from: 50,
      to: model.minimumConfidence,
      magnitude: model.minimumConfidence - 50,
      generatedAt: now,
      assetClass: ac,
    });
  }

  for (const key of Object.keys(defaultFactors)) {
    const current = model.factorWeights[key] ?? defaultFactors[key];
    const base = defaultFactors[key];
    if (Math.abs(current - base) > 0.03) {
      corrections.push({
        type: 'FACTOR_WEIGHT',
        description: `[${label}] Factor "${key}": ${(base * 100).toFixed(1)}% → ${(current * 100).toFixed(1)}%`,
        from: base,
        to: current,
        magnitude: Math.abs(current - base),
        generatedAt: now,
        assetClass: ac,
      });
    }
  }

  return corrections;
}

// ============ PERFORMANCE AUDIT ============

/**
 * Run a full performance audit across all asset classes (or a single class).
 * @param {string} [assetClass] - If provided, audit only this class. Otherwise audit all.
 * @returns {{ metrics, anomalies, corrections, isLearningMode, perClass }}
 */
export function runPerformanceAudit(assetClass) {
  ensureInit();

  const classesToAudit = assetClass ? [assetClass] : ASSET_CLASSES;
  const perClass = {};
  let allAnomalies = [];
  let allCorrections = [];

  for (const ac of classesToAudit) {
    const model = getModel(ac);
    const resolved = resolvedSignalsForModel(model);
    const isLearning = resolved.length < LEARNING_MODE_THRESHOLD;

    model.metrics.overall = computeRollingMetrics(resolved);
    model.metrics.byStrategy = metricsByGroup(resolved, s => normaliseStrategy(s.strategy));
    model.metrics.byRegime = metricsByGroup(resolved, s => s.regime);
    model.metrics.byTimeframe = metricsByGroup(resolved, s => timeframeBucket(s.holdDuration || 0));
    model.metrics.byConfidenceBucket = metricsByGroup(resolved, s => confidenceBucket(s.confidence));

    recalculateAdaptiveWeightsForModel(model);
    recalculateFactorWeightsForModel(model);
    recalculateMinimumConfidenceForModel(model);

    model.anomalies = detectAnomaliesForModel(model);
    model.corrections = generateCorrectionsForModel(model);
    model.lastAuditAt = Date.now();

    perClass[ac] = {
      metrics: model.metrics,
      anomalies: model.anomalies,
      corrections: model.corrections,
      isLearningMode: isLearning,
      signalCount: model.signals.length,
      resolvedCount: resolved.length,
      adaptiveWeights: model.adaptiveWeights,
      factorWeights: model.factorWeights,
      minimumConfidence: model.minimumConfidence,
    };

    allAnomalies = allAnomalies.concat(model.anomalies);
    allCorrections = allCorrections.concat(model.corrections);
  }

  saveToStorage();

  // Aggregate metrics across all classes
  const globalResolved = resolvedSignals();
  const globalMetrics = {
    overall: computeRollingMetrics(globalResolved),
    byStrategy: metricsByGroup(globalResolved, s => normaliseStrategy(s.strategy)),
    byRegime: metricsByGroup(globalResolved, s => s.regime),
    byAssetClass: metricsByGroup(globalResolved, s => classifyAsset(s.ticker, s.assetClass)),
  };

  return {
    metrics: globalMetrics,
    anomalies: allAnomalies,
    corrections: allCorrections,
    isLearningMode: globalResolved.length < LEARNING_MODE_THRESHOLD,
    perClass,
  };
}

// ============ REPORTING ============

/**
 * Get a dashboard-ready performance report.
 * @param {string} [assetClass] - If provided, report for this class only.
 * @returns {Object}
 */
export function getPerformanceReport(assetClass) {
  ensureInit();

  if (assetClass) {
    const model = getModel(assetClass);
    const resolved = resolvedSignalsForModel(model);
    const open = model.signals.filter(s => s.outcome === 'OPEN' || !s.outcome);
    return {
      summary: {
        totalSignals: model.signals.length,
        resolvedSignals: resolved.length,
        openSignals: open.length,
        isLearningMode: resolved.length < LEARNING_MODE_THRESHOLD,
        learningProgress: Math.min(1, resolved.length / LEARNING_MODE_THRESHOLD),
        lastAuditAt: model.lastAuditAt,
        assetClass,
      },
      metrics: model.metrics,
      adaptiveWeights: model.adaptiveWeights,
      factorWeights: model.factorWeights,
      minimumConfidence: model.minimumConfidence,
      anomalies: model.anomalies,
      corrections: model.corrections,
    };
  }

  // Global report with per-class breakdown
  const allSigs = allSignals();
  const globalResolved = resolvedSignals();
  const open = allSigs.filter(s => s.outcome === 'OPEN' || !s.outcome);

  const perClass = {};
  for (const ac of ASSET_CLASSES) {
    const m = getModel(ac);
    const r = resolvedSignalsForModel(m);
    perClass[ac] = {
      signalCount: m.signals.length,
      resolvedCount: r.length,
      isLearningMode: r.length < LEARNING_MODE_THRESHOLD,
      learningProgress: Math.min(1, r.length / LEARNING_MODE_THRESHOLD),
      winRate: r.length > 0 ? r.filter(s => (s.actualReturn || 0) > 0).length / r.length : 0,
      avgReturn: r.length > 0 ? mean(r.map(s => s.actualReturn || 0)) : 0,
      anomalyCount: (m.anomalies || []).length,
      correctionCount: (m.corrections || []).length,
      adaptiveWeights: m.adaptiveWeights,
      factorWeights: m.factorWeights,
      minimumConfidence: m.minimumConfidence,
    };
  }

  // Collect all anomalies/corrections
  let allAnomalies = [];
  let allCorrections = [];
  for (const ac of ASSET_CLASSES) {
    const m = getModel(ac);
    allAnomalies = allAnomalies.concat(m.anomalies || []);
    allCorrections = allCorrections.concat(m.corrections || []);
  }

  return {
    summary: {
      totalSignals: allSigs.length,
      resolvedSignals: globalResolved.length,
      openSignals: open.length,
      isLearningMode: globalResolved.length < LEARNING_MODE_THRESHOLD,
      learningProgress: Math.min(1, globalResolved.length / LEARNING_MODE_THRESHOLD),
      lastAuditAt: Math.max(...ASSET_CLASSES.map(ac => getModel(ac).lastAuditAt || 0)),
    },
    metrics: {
      overall: computeRollingMetrics(globalResolved),
      byStrategy: metricsByGroup(globalResolved, s => normaliseStrategy(s.strategy)),
      byRegime: metricsByGroup(globalResolved, s => s.regime),
      byTimeframe: metricsByGroup(globalResolved, s => timeframeBucket(s.holdDuration || 0)),
      byConfidenceBucket: metricsByGroup(globalResolved, s => confidenceBucket(s.confidence)),
      byAssetClass: metricsByGroup(globalResolved, s => classifyAsset(s.ticker, s.assetClass)),
    },
    perClass,
    // Backward-compat: aggregate weights from equity model as default
    adaptiveWeights: getModel('equity').adaptiveWeights,
    factorWeights: getModel('equity').factorWeights,
    minimumConfidence: getModel('equity').minimumConfidence,
    anomalies: allAnomalies,
    corrections: allCorrections,
  };
}

export function getCorrections(assetClass) {
  ensureInit();
  if (assetClass) return [...(getModel(assetClass).corrections || [])];
  let all = [];
  for (const ac of ASSET_CLASSES) all = all.concat(getModel(ac).corrections || []);
  return all;
}

export function getAnomalies(assetClass) {
  ensureInit();
  if (assetClass) return [...(getModel(assetClass).anomalies || [])];
  let all = [];
  for (const ac of ASSET_CLASSES) all = all.concat(getModel(ac).anomalies || []);
  return all;
}

// ============ STRATEGY RECOMMENDATION ============

/**
 * Recommend the best strategy for a regime/timeframe, using per-class learning.
 * @param {string} regime
 * @param {string} [timeframe]
 * @param {string} [assetClass]
 * @returns {Object}
 */
export function getStrategyRecommendation(regime, timeframe, assetClass) {
  ensureInit();

  const ac = assetClass || 'equity';
  const model = getModel(ac);
  const resolved = resolvedSignalsForModel(model);
  const isLearning = resolved.length < LEARNING_MODE_THRESHOLD;
  const defaultWeights = DEFAULT_WEIGHTS_BY_CLASS[ac] || DEFAULT_WEIGHTS_BY_CLASS.equity;

  if (isLearning) {
    const weights = defaultWeights[regime] || defaultWeights['volatile-transition'];
    const best = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];
    return {
      strategy: best[0],
      confidence: 50,
      expectedValue: 0,
      reason: `[${ac.toUpperCase()}] Learning mode (${resolved.length}/${LEARNING_MODE_THRESHOLD} signals). Using default weights for ${regime}.`,
      alternatives: Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(1).map(([s, w]) => ({ strategy: s, weight: w })),
      assetClass: ac,
    };
  }

  let pool = resolved.filter(s => s.regime === regime);
  if (timeframe) {
    const tfPool = pool.filter(s => timeframeBucket(s.holdDuration || 0) === timeframe);
    if (tfPool.length >= 8) pool = tfPool;
  }
  if (pool.length < 8) pool = resolved;

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
    stratEvals.push({ strategy: strat, ev: expectedValue(wr, avgW, avgL), winRate: wr, count: stratPool.length });
  }

  stratEvals.sort((a, b) => b.ev - a.ev);
  const best = stratEvals[0];

  return {
    strategy: best.strategy,
    confidence: Math.min(95, 50 + best.count + best.winRate * 30),
    expectedValue: best.ev,
    reason: `[${ac.toUpperCase()}] ${best.strategy} has highest EV (${(best.ev * 100).toFixed(2)}%) with ${(best.winRate * 100).toFixed(0)}% win rate over ${best.count} signals in ${regime}${timeframe ? ' / ' + timeframe : ''}.`,
    alternatives: stratEvals.slice(1).map(e => ({ strategy: e.strategy, expectedValue: e.ev, winRate: e.winRate, count: e.count })),
    assetClass: ac,
  };
}

// ============ UTILITY EXPORTS ============

export function resetAdaptiveEngine(assetClass) {
  ensureInit();
  if (assetClass) {
    state.assetModels[assetClass] = freshModel(assetClass);
  } else {
    state = freshState();
  }
  saveToStorage();
}

export function exportSignals(assetClass) {
  ensureInit();
  if (assetClass) return [...getModel(assetClass).signals];
  return [...allSignals()];
}

export function importSignals(signals, assetClass) {
  ensureInit();
  if (!Array.isArray(signals)) return { imported: 0, duplicates: 0 };

  let imported = 0;
  let duplicates = 0;

  for (const s of signals) {
    const ac = assetClass || classifyAsset(s.ticker, s.assetClass);
    const model = getModel(ac);
    const existingIds = new Set(model.signals.map(sig => sig.id));

    if (existingIds.has(s.id)) {
      duplicates++;
      continue;
    }

    s.assetClass = ac;
    model.signals.push(s);
    imported++;

    if (model.signals.length > MAX_SIGNALS_PER_CLASS) {
      model.signals = model.signals.slice(model.signals.length - MAX_SIGNALS_PER_CLASS);
    }
  }

  saveToStorage();
  return { imported, duplicates };
}

export function getFactorWeights(assetClass) {
  ensureInit();
  const model = getModel(assetClass || 'equity');
  return { ...model.factorWeights };
}

export function isLearningMode(assetClass) {
  ensureInit();
  if (assetClass) {
    return resolvedSignalsForModel(getModel(assetClass)).length < LEARNING_MODE_THRESHOLD;
  }
  return resolvedSignals().length < LEARNING_MODE_THRESHOLD;
}

/**
 * Get the list of supported asset classes.
 * @returns {string[]}
 */
export function getAssetClasses() {
  return [...ASSET_CLASSES];
}

/**
 * Get per-class learning status summary.
 * @returns {Object}
 */
export function getClassStatus() {
  ensureInit();
  const result = {};
  for (const ac of ASSET_CLASSES) {
    const m = getModel(ac);
    const resolved = resolvedSignalsForModel(m);
    result[ac] = {
      signalCount: m.signals.length,
      resolvedCount: resolved.length,
      isLearningMode: resolved.length < LEARNING_MODE_THRESHOLD,
      learningProgress: Math.min(1, resolved.length / LEARNING_MODE_THRESHOLD),
      lastAuditAt: m.lastAuditAt,
      anomalyCount: (m.anomalies || []).length,
      minimumConfidence: m.minimumConfidence,
    };
  }
  return result;
}
