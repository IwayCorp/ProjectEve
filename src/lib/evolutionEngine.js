// evolutionEngine.js — Self-Learning Parameter Evolution Engine for Noctis
// This is the brain that makes Noctis learn from its mistakes.
// It extracts all tunable parameters, tracks their performance,
// identifies systematic failures, generates mutations, and applies
// validated improvements automatically.
// Pure JavaScript — runs in Vercel Edge Runtime, no external dependencies.

// ============ STORAGE ============

const EVOLUTION_STORAGE_KEY = 'noctis_evolution_v1';
const PARAM_HISTORY_KEY = 'noctis_param_history_v1';
const MAX_HISTORY_ENTRIES = 500;
const MAX_EVOLUTION_GENERATIONS = 100;

// ============ TUNABLE PARAMETER GENOME ============
// Every hardcoded threshold in the signal pipeline, extracted into a mutable genome.
// Each parameter has: current value, default value, min/max bounds, and a mutation step size.

function getDefaultGenome() {
  return {
    // === REGIME DETECTION THRESHOLDS ===
    regime_hurst_trending: { value: 0.55, default: 0.55, min: 0.50, max: 0.65, step: 0.02, category: 'regime' },
    regime_hurst_meanReverting: { value: 0.45, default: 0.45, min: 0.35, max: 0.50, step: 0.02, category: 'regime' },
    regime_adx_trending: { value: 25, default: 25, min: 18, max: 35, step: 2, category: 'regime' },
    regime_adx_strong: { value: 30, default: 30, min: 25, max: 40, step: 2, category: 'regime' },
    regime_vol_transition: { value: 40, default: 40, min: 25, max: 60, step: 5, category: 'regime' },

    // === SIGNAL GENERATION THRESHOLDS ===
    signal_hurst_trending: { value: 0.52, default: 0.52, min: 0.48, max: 0.60, step: 0.02, category: 'signal' },
    signal_hurst_strong: { value: 0.58, default: 0.58, min: 0.52, max: 0.68, step: 0.02, category: 'signal' },
    signal_adx_trending: { value: 22, default: 22, min: 16, max: 30, step: 2, category: 'signal' },
    signal_adx_meanReverting: { value: 20, default: 20, min: 14, max: 28, step: 2, category: 'signal' },
    signal_hurst_meanReverting: { value: 0.45, default: 0.45, min: 0.38, max: 0.52, step: 0.02, category: 'signal' },

    // === RSI ZONES ===
    rsi_overbought: { value: 70, default: 70, min: 65, max: 80, step: 2, category: 'rsi' },
    rsi_oversold: { value: 30, default: 30, min: 20, max: 35, step: 2, category: 'rsi' },
    rsi_trend_healthy_low: { value: 50, default: 50, min: 45, max: 55, step: 2, category: 'rsi' },
    rsi_trend_extended: { value: 60, default: 60, min: 55, max: 68, step: 2, category: 'rsi' },
    rsi_exhaustion_roc_threshold: { value: 15, default: 15, min: 10, max: 25, step: 2, category: 'rsi' },

    // === CONFIDENCE SCORING ===
    confidence_base: { value: 35, default: 35, min: 25, max: 45, step: 3, category: 'confidence' },
    confidence_agreement_weight: { value: 35, default: 35, min: 20, max: 50, step: 3, category: 'confidence' },
    confidence_regime_bonus: { value: 10, default: 10, min: 5, max: 18, step: 2, category: 'confidence' },
    confidence_regime_penalty: { value: 12, default: 12, min: 6, max: 20, step: 2, category: 'confidence' },
    confidence_adx_bonus: { value: 8, default: 8, min: 4, max: 14, step: 2, category: 'confidence' },
    confidence_vol_divergence_penalty: { value: 18, default: 18, min: 10, max: 25, step: 2, category: 'confidence' },

    // === MINIMUM CONFIDENCE GATES ===
    min_confidence_equity: { value: 60, default: 60, min: 50, max: 75, step: 3, category: 'gate' },
    min_confidence_forex: { value: 58, default: 58, min: 48, max: 72, step: 3, category: 'gate' },
    min_confidence_macro: { value: 50, default: 50, min: 40, max: 65, step: 3, category: 'gate' },

    // === POSITION SIZING ===
    kelly_min: { value: 0.15, default: 0.15, min: 0.05, max: 0.25, step: 0.03, category: 'sizing' },
    kelly_max: { value: 0.35, default: 0.35, min: 0.20, max: 0.50, step: 0.03, category: 'sizing' },
    stop_atr_base: { value: 1.5, default: 1.5, min: 1.0, max: 2.5, step: 0.15, category: 'sizing' },
    stop_atr_tightened: { value: 0.8, default: 0.8, min: 0.5, max: 1.2, step: 0.1, category: 'sizing' },
    stop_tighten_start: { value: 0.75, default: 0.75, min: 0.50, max: 0.85, step: 0.05, category: 'sizing' },

    // === RISK/REWARD ===
    rr_minimum: { value: 1.5, default: 1.5, min: 1.2, max: 2.5, step: 0.15, category: 'risk' },
    target_atr_trending: { value: 3.5, default: 3.5, min: 2.5, max: 5.0, step: 0.3, category: 'risk' },
    target_atr_normal: { value: 2.0, default: 2.0, min: 1.5, max: 3.5, step: 0.25, category: 'risk' },

    // === ENSEMBLE ===
    ensemble_neutral_threshold: { value: 20, default: 20, min: 10, max: 35, step: 3, category: 'ensemble' },
    ensemble_correlation_penalty: { value: 0.30, default: 0.30, min: 0.15, max: 0.50, step: 0.05, category: 'ensemble' },

    // === VOLUME ===
    volume_rising_threshold: { value: 1.3, default: 1.3, min: 1.1, max: 1.6, step: 0.1, category: 'volume' },
    volume_declining_threshold: { value: 0.7, default: 0.7, min: 0.5, max: 0.85, step: 0.05, category: 'volume' },
    volume_divergence_lookback: { value: 10, default: 10, min: 5, max: 20, step: 2, category: 'volume' },
    volume_divergence_vol_threshold: { value: 0.80, default: 0.80, min: 0.65, max: 0.92, step: 0.04, category: 'volume' },

    // === INSTITUTIONAL STRATEGY LIBRARY ===
    strat_trend_boost: { value: 7, default: 7, min: 3, max: 14, step: 2, category: 'strategy_lib' },
    strat_trend_penalty: { value: 8, default: 8, min: 4, max: 15, step: 2, category: 'strategy_lib' },
    strat_seasonal_boost: { value: 4, default: 4, min: 1, max: 8, step: 1, category: 'strategy_lib' },
    strat_pead_boost: { value: 10, default: 10, min: 5, max: 18, step: 2, category: 'strategy_lib' },
    strat_trend_min_score: { value: 40, default: 40, min: 20, max: 60, step: 5, category: 'strategy_lib' },
    strat_trend_conflict_min: { value: 50, default: 50, min: 30, max: 70, step: 5, category: 'strategy_lib' },
    strat_vrp_calm_boost: { value: 3, default: 3, min: 1, max: 7, step: 1, category: 'strategy_lib' },
    strat_vrp_turbulent_penalty: { value: 4, default: 4, min: 2, max: 8, step: 1, category: 'strategy_lib' },
  };
}

// ============ PERFORMANCE ATTRIBUTION ============
// Categorizes WHY trades fail so the evolution engine knows WHAT to fix.

const FAILURE_CATEGORIES = {
  DIRECTION_WRONG: 'direction_wrong',        // Regime misread — went long in hidden bear
  ENTRY_TIMING: 'entry_timing',              // Direction right, but entered at worst price
  STOP_TOO_TIGHT: 'stop_too_tight',          // Direction right, stopped out, then it went to target
  STOP_TOO_LOOSE: 'stop_too_loose',          // Loss much larger than expected
  STRATEGY_MISMATCH: 'strategy_mismatch',    // Wrong strategy for the regime
  CONFIDENCE_INFLATED: 'confidence_inflated', // High confidence but lost
  CONFIDENCE_DEFLATED: 'confidence_deflated', // Low confidence signal that would have won big
  VOLUME_MISSED: 'volume_missed',            // Volume divergence was present but not detected
  EXPIRED_WINNER: 'expired_winner',          // Position expired but was profitable after
  STRAT_LIB_IGNORED: 'strat_lib_ignored',   // Institutional strategy library signal was ignored
};

function attributeFailure(trade) {
  if (!trade || !trade.outcome) return null;
  const reasons = [];

  const won = (trade.actualReturn || 0) > 0;
  const lost = (trade.actualReturn || 0) < 0;
  const bigLoss = (trade.actualReturn || 0) < -0.03;
  const expired = trade.outcome === 'EXPIRED';

  if (lost) {
    // Was the direction wrong?
    // If the asset moved significantly opposite to our direction, regime was misread
    if (trade.actualReturn < -0.02 && trade.direction) {
      reasons.push({
        category: FAILURE_CATEGORIES.DIRECTION_WRONG,
        severity: Math.abs(trade.actualReturn) > 0.05 ? 'critical' : 'warning',
        detail: `${trade.direction} signal lost ${(trade.actualReturn * 100).toFixed(2)}%`,
        paramHint: ['regime_hurst_trending', 'regime_adx_trending', 'signal_hurst_trending'],
      });
    }

    // Was the stop too tight?
    if (trade.outcome === 'STOP_HIT' && trade.postExitReturn && trade.postExitReturn > 0.02) {
      reasons.push({
        category: FAILURE_CATEGORIES.STOP_TOO_TIGHT,
        severity: trade.postExitReturn > 0.05 ? 'critical' : 'warning',
        detail: `Stopped out, then moved +${(trade.postExitReturn * 100).toFixed(1)}% in our direction`,
        paramHint: ['stop_atr_base', 'stop_atr_tightened'],
      });
    }

    // Was the stop too loose?
    if (bigLoss && trade.outcome !== 'STOP_HIT') {
      reasons.push({
        category: FAILURE_CATEGORIES.STOP_TOO_LOOSE,
        severity: 'critical',
        detail: `Loss of ${(trade.actualReturn * 100).toFixed(2)}% without hitting stop`,
        paramHint: ['stop_atr_base', 'kelly_max'],
      });
    }

    // Strategy mismatch — e.g., momentum in mean-reverting regime
    if (trade.strategy && trade.regime) {
      const mismatch = (
        (trade.strategy === 'momentum' && trade.regime === 'mean-reverting') ||
        (trade.strategy === 'mean-reversion' && (trade.regime === 'trending-bull' || trade.regime === 'trending-bear')) ||
        (trade.strategy === 'breakout' && trade.regime === 'mean-reverting')
      );
      if (mismatch) {
        reasons.push({
          category: FAILURE_CATEGORIES.STRATEGY_MISMATCH,
          severity: 'warning',
          detail: `${trade.strategy} strategy in ${trade.regime} regime`,
          paramHint: ['signal_hurst_trending', 'signal_hurst_meanReverting', 'signal_adx_trending'],
        });
      }
    }

    // Confidence was inflated
    if (trade.confidence >= 70 && trade.actualReturn < -0.01) {
      reasons.push({
        category: FAILURE_CATEGORIES.CONFIDENCE_INFLATED,
        severity: trade.confidence >= 80 ? 'critical' : 'warning',
        detail: `${trade.confidence}% confidence signal lost ${(trade.actualReturn * 100).toFixed(2)}%`,
        paramHint: ['confidence_base', 'confidence_agreement_weight', 'confidence_regime_bonus', 'min_confidence_equity'],
      });
    }
  }

  if (expired && trade.actualReturn > 0.02) {
    reasons.push({
      category: FAILURE_CATEGORIES.EXPIRED_WINNER,
      severity: 'info',
      detail: `Expired with +${(trade.actualReturn * 100).toFixed(1)}% unrealized — target wasn't reached in time`,
      paramHint: ['target_atr_trending', 'target_atr_normal'],
    });
  }

  // Strategy library signal was available but we traded against it
  if (lost && trade.strategyLibSignal && trade.strategyLibSignal !== 'neutral') {
    const slConflict = (trade.strategyLibSignal === 'long' && trade.direction === 'short') ||
                       (trade.strategyLibSignal === 'short' && trade.direction === 'long')
    if (slConflict) {
      reasons.push({
        category: FAILURE_CATEGORIES.STRAT_LIB_IGNORED,
        severity: 'warning',
        detail: `Institutional strategy library signaled ${trade.strategyLibSignal}, we went ${trade.direction}`,
        paramHint: ['strat_trend_boost', 'strat_trend_penalty', 'strat_pead_boost'],
      });
    }
  }

  return reasons.length > 0 ? {
    tradeId: trade.id,
    ticker: trade.ticker,
    reasons,
    regime: trade.regime,
    strategy: trade.strategy,
    assetClass: trade.assetClass,
    confidence: trade.confidence,
    actualReturn: trade.actualReturn,
    timestamp: trade.resolvedAt || Date.now(),
  } : null;
}

// ============ EVOLUTION STATE ============

function loadEvolutionState() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(EVOLUTION_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    return null;
  } catch { return null; }
}

function saveEvolutionState(evoState) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(EVOLUTION_STORAGE_KEY, JSON.stringify(evoState));
  } catch { /* fail silently */ }
}

function loadParamHistory() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PARAM_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
    return [];
  } catch { return []; }
}

function saveParamHistory(history) {
  try {
    if (typeof localStorage === 'undefined') return;
    // FIFO cap
    const trimmed = history.length > MAX_HISTORY_ENTRIES
      ? history.slice(history.length - MAX_HISTORY_ENTRIES)
      : history;
    localStorage.setItem(PARAM_HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* fail silently */ }
}

function freshEvolutionState() {
  return {
    genome: getDefaultGenome(),
    generation: 0,
    createdAt: Date.now(),
    lastEvolutionAt: null,
    attributions: [],         // Recent failure attributions
    paramScores: {},          // { paramName: { goodCount, badCount, totalImpact } }
    pendingMutations: [],     // Mutations generated but not yet applied
    appliedMutations: [],     // History of applied mutations
    fitnessHistory: [],       // Track overall fitness over time
    evolveLog: [],            // Human-readable evolution log
  };
}

// ============ CORE: INITIALIZE ============

let evoState = null;

export function initEvolutionEngine() {
  const loaded = loadEvolutionState();
  if (loaded && loaded.genome && loaded.generation != null) {
    evoState = loaded;
    // Ensure any new params added in code updates are merged in
    const defaults = getDefaultGenome();
    for (const key of Object.keys(defaults)) {
      if (!evoState.genome[key]) {
        evoState.genome[key] = defaults[key];
      }
    }
  } else {
    evoState = freshEvolutionState();
  }
  saveEvolutionState(evoState);
  return {
    generation: evoState.generation,
    paramCount: Object.keys(evoState.genome).length,
    lastEvolutionAt: evoState.lastEvolutionAt,
    pendingMutations: evoState.pendingMutations.length,
  };
}

function ensureInit() {
  if (!evoState) initEvolutionEngine();
}

// ============ CORE: GET PARAMETER ============
// This is what the signal pipeline calls instead of using hardcoded values.

export function getParam(name) {
  ensureInit();
  const param = evoState.genome[name];
  if (!param) {
    // Unknown param — check defaults
    const defaults = getDefaultGenome();
    return defaults[name]?.value ?? null;
  }
  return param.value;
}

export function getGenome() {
  ensureInit();
  const result = {};
  for (const [key, param] of Object.entries(evoState.genome)) {
    result[key] = {
      value: param.value,
      default: param.default,
      min: param.min,
      max: param.max,
      category: param.category,
      driftFromDefault: param.value !== param.default
        ? ((param.value - param.default) / (param.max - param.min) * 100).toFixed(1) + '%'
        : '0%',
    };
  }
  return result;
}

// ============ CORE: RECORD TRADE OUTCOME ============
// Called by the audit/feedback loop when a trade resolves.

export function recordTradeOutcome(trade) {
  ensureInit();
  if (!trade) return null;

  // Run performance attribution
  const attribution = attributeFailure(trade);

  if (attribution) {
    evoState.attributions.push(attribution);
    // Cap attributions
    if (evoState.attributions.length > 200) {
      evoState.attributions = evoState.attributions.slice(-200);
    }

    // Update parameter scores based on failure hints
    for (const reason of attribution.reasons) {
      for (const paramName of (reason.paramHint || [])) {
        if (!evoState.paramScores[paramName]) {
          evoState.paramScores[paramName] = { goodCount: 0, badCount: 0, totalImpact: 0, failureTypes: {} };
        }
        const ps = evoState.paramScores[paramName];
        ps.badCount++;
        ps.totalImpact += Math.abs(trade.actualReturn || 0);
        ps.failureTypes[reason.category] = (ps.failureTypes[reason.category] || 0) + 1;
      }
    }
  }

  // Also record wins — params that were involved in winning trades
  if ((trade.actualReturn || 0) > 0) {
    // For wins, we don't have specific param hints, but we credit the strategy/regime params
    const winParams = getParamsForContext(trade.strategy, trade.regime);
    for (const paramName of winParams) {
      if (!evoState.paramScores[paramName]) {
        evoState.paramScores[paramName] = { goodCount: 0, badCount: 0, totalImpact: 0, failureTypes: {} };
      }
      evoState.paramScores[paramName].goodCount++;
    }
  }

  saveEvolutionState(evoState);
  return attribution;
}

function getParamsForContext(strategy, regime) {
  const params = [];
  // Regime params are always relevant
  params.push('regime_hurst_trending', 'regime_hurst_meanReverting', 'regime_adx_trending');

  if (strategy === 'momentum') {
    params.push('signal_hurst_trending', 'signal_adx_trending', 'rsi_trend_healthy_low', 'rsi_trend_extended');
  } else if (strategy === 'mean-reversion') {
    params.push('signal_hurst_meanReverting', 'signal_adx_meanReverting', 'rsi_overbought', 'rsi_oversold');
  } else if (strategy === 'breakout') {
    params.push('volume_rising_threshold', 'signal_adx_trending');
  }

  params.push('confidence_base', 'confidence_agreement_weight', 'stop_atr_base', 'kelly_min', 'kelly_max');
  return params;
}

// ============ CORE: EVOLVE ============
// The main evolution cycle. Analyzes accumulated failures, generates mutations,
// validates them, and applies the best ones.

export function evolve(resolvedTrades = []) {
  ensureInit();

  const now = Date.now();
  const log = [];
  const mutations = [];

  // Process any unprocessed trades
  for (const trade of resolvedTrades) {
    recordTradeOutcome(trade);
  }

  // ===== PHASE 1: Identify worst-performing parameters =====
  const paramRankings = [];
  for (const [paramName, scores] of Object.entries(evoState.paramScores)) {
    const total = scores.goodCount + scores.badCount;
    if (total < 5) continue; // Not enough data
    const failRate = scores.badCount / total;
    const impact = scores.totalImpact / scores.badCount; // Avg loss when this param fails
    const priority = failRate * impact * Math.log2(total + 1); // Higher = worse
    paramRankings.push({
      param: paramName,
      failRate,
      avgImpact: impact,
      priority,
      total,
      failureTypes: scores.failureTypes,
    });
  }
  paramRankings.sort((a, b) => b.priority - a.priority);

  log.push(`Evolution generation ${evoState.generation + 1} — analyzing ${paramRankings.length} parameters`);
  log.push(`Top failure params: ${paramRankings.slice(0, 5).map(p => `${p.param} (${(p.failRate * 100).toFixed(0)}% fail, ${(p.avgImpact * 100).toFixed(2)}% avg impact)`).join(', ')}`);

  // ===== PHASE 2: Generate mutations for worst params =====
  const topFailures = paramRankings.slice(0, 8); // Mutate top 8 worst params

  for (const failure of topFailures) {
    const param = evoState.genome[failure.param];
    if (!param) continue;

    // Determine mutation direction based on failure analysis
    let mutationDirection = 0;
    const ft = failure.failureTypes;

    if (ft[FAILURE_CATEGORIES.STOP_TOO_TIGHT] > (ft[FAILURE_CATEGORIES.STOP_TOO_LOOSE] || 0)) {
      // More stops too tight than too loose → widen stops
      if (failure.param.includes('stop_atr_base')) mutationDirection = 1; // increase
      if (failure.param.includes('stop_atr_tightened')) mutationDirection = 1;
    } else if (ft[FAILURE_CATEGORIES.STOP_TOO_LOOSE] > (ft[FAILURE_CATEGORIES.STOP_TOO_TIGHT] || 0)) {
      if (failure.param.includes('stop_atr_base')) mutationDirection = -1; // decrease
    }

    if (ft[FAILURE_CATEGORIES.CONFIDENCE_INFLATED] > 2) {
      // Confidence too high → raise gates, reduce bonuses
      if (failure.param.includes('min_confidence')) mutationDirection = 1; // raise gate
      if (failure.param.includes('confidence_base')) mutationDirection = -1; // lower base
      if (failure.param.includes('confidence_regime_bonus')) mutationDirection = -1;
    }

    if (ft[FAILURE_CATEGORIES.DIRECTION_WRONG] > 2) {
      // Regime misreads → adjust regime thresholds
      if (failure.param.includes('regime_hurst_trending')) mutationDirection = 1; // require stronger evidence
      if (failure.param.includes('regime_adx_trending')) mutationDirection = 1;
    }

    if (ft[FAILURE_CATEGORIES.STRATEGY_MISMATCH] > 2) {
      // Strategy assignment wrong → widen the zone between trending/MR
      if (failure.param.includes('signal_hurst_trending')) mutationDirection = 1;
      if (failure.param.includes('signal_hurst_meanReverting')) mutationDirection = -1;
    }

    // If we couldn't determine direction from failure types, use probabilistic mutation
    if (mutationDirection === 0) {
      // If param is failing more often than succeeding, move it toward the opposite boundary
      if (failure.failRate > 0.6) {
        // Current value is probably wrong — try moving in a direction
        const distToMax = param.max - param.value;
        const distToMin = param.value - param.min;
        mutationDirection = distToMax > distToMin ? 1 : -1;
      } else {
        // Roughly even — small random perturbation
        mutationDirection = Math.random() > 0.5 ? 1 : -1;
      }
    }

    const stepSize = param.step * (failure.priority > 0.5 ? 1.5 : 1.0); // Larger step for worse params
    const newValue = Math.max(param.min, Math.min(param.max, param.value + mutationDirection * stepSize));

    if (newValue !== param.value) {
      mutations.push({
        param: failure.param,
        from: param.value,
        to: newValue,
        direction: mutationDirection > 0 ? 'increase' : 'decrease',
        reason: `${(failure.failRate * 100).toFixed(0)}% fail rate, ${(failure.avgImpact * 100).toFixed(2)}% avg impact. Top failures: ${Object.entries(ft).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k}(${v})`).join(', ')}`,
        priority: failure.priority,
        generatedAt: now,
      });
    }
  }

  log.push(`Generated ${mutations.length} mutations`);

  // ===== PHASE 3: Apply mutations =====
  // We apply all validated mutations immediately — the next cycle will evaluate their impact
  const applied = [];
  for (const mutation of mutations) {
    const param = evoState.genome[mutation.param];
    if (!param) continue;

    const historyEntry = {
      param: mutation.param,
      from: param.value,
      to: mutation.to,
      generation: evoState.generation + 1,
      reason: mutation.reason,
      appliedAt: now,
    };

    param.value = mutation.to;
    applied.push(historyEntry);
    log.push(`  ${mutation.param}: ${mutation.from} → ${mutation.to} (${mutation.reason})`);
  }

  // ===== PHASE 4: Compute fitness score =====
  const recentAttributions = evoState.attributions.filter(a => a.timestamp > now - 7 * 24 * 3600 * 1000);
  const totalTrades = resolvedTrades.length || recentAttributions.length || 1;
  const failedTrades = recentAttributions.length;
  const fitnessScore = Math.max(0, 100 - (failedTrades / totalTrades) * 100);

  evoState.fitnessHistory.push({
    generation: evoState.generation + 1,
    fitness: fitnessScore,
    mutationsApplied: applied.length,
    timestamp: now,
  });
  if (evoState.fitnessHistory.length > MAX_EVOLUTION_GENERATIONS) {
    evoState.fitnessHistory = evoState.fitnessHistory.slice(-MAX_EVOLUTION_GENERATIONS);
  }

  // ===== PHASE 5: Reset param scores for evolved params =====
  // Partially decay scores so new mutations get a fair evaluation
  for (const mutation of applied) {
    if (evoState.paramScores[mutation.param]) {
      const ps = evoState.paramScores[mutation.param];
      ps.goodCount = Math.floor(ps.goodCount * 0.3); // Keep 30% of history
      ps.badCount = Math.floor(ps.badCount * 0.3);
      ps.totalImpact *= 0.3;
      for (const key of Object.keys(ps.failureTypes)) {
        ps.failureTypes[key] = Math.floor(ps.failureTypes[key] * 0.3);
      }
    }
  }

  // Save param history
  const history = loadParamHistory();
  history.push(...applied);
  saveParamHistory(history);

  // Update generation
  evoState.generation++;
  evoState.lastEvolutionAt = now;
  evoState.appliedMutations.push(...applied);
  if (evoState.appliedMutations.length > 200) {
    evoState.appliedMutations = evoState.appliedMutations.slice(-200);
  }
  evoState.evolveLog.push(...log);
  if (evoState.evolveLog.length > 300) {
    evoState.evolveLog = evoState.evolveLog.slice(-300);
  }

  saveEvolutionState(evoState);

  return {
    generation: evoState.generation,
    mutationsApplied: applied.length,
    mutations: applied,
    fitnessScore,
    topFailures: paramRankings.slice(0, 5).map(p => ({
      param: p.param,
      failRate: (p.failRate * 100).toFixed(1) + '%',
      avgImpact: (p.avgImpact * 100).toFixed(2) + '%',
      topFailureType: Object.entries(p.failureTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown',
    })),
    log,
  };
}

// ============ CORE: BUILD CLAUDE DIAGNOSTIC PROMPT ============
// Generates a structured diagnostic payload that can be sent to Claude API
// for deeper analysis and code-level recommendations.

export function buildDiagnosticPrompt() {
  ensureInit();

  const genome = getGenome();
  const recentAttributions = evoState.attributions.slice(-50);
  const history = loadParamHistory();
  const recentMutations = history.slice(-30);

  // Aggregate failure patterns
  const failurePatterns = {};
  for (const attr of recentAttributions) {
    for (const reason of attr.reasons) {
      const key = `${reason.category}|${attr.strategy}|${attr.regime}`;
      if (!failurePatterns[key]) {
        failurePatterns[key] = { count: 0, totalLoss: 0, category: reason.category, strategy: attr.strategy, regime: attr.regime, examples: [] };
      }
      failurePatterns[key].count++;
      failurePatterns[key].totalLoss += Math.abs(attr.actualReturn || 0);
      if (failurePatterns[key].examples.length < 3) {
        failurePatterns[key].examples.push({ ticker: attr.ticker, return: attr.actualReturn, confidence: attr.confidence });
      }
    }
  }

  const sortedPatterns = Object.values(failurePatterns).sort((a, b) => b.totalLoss - a.totalLoss);

  // Fitness trend
  const fitnessTrend = evoState.fitnessHistory.slice(-10);
  const improving = fitnessTrend.length >= 3 &&
    fitnessTrend[fitnessTrend.length - 1].fitness > fitnessTrend[fitnessTrend.length - 3].fitness;

  // Param drift analysis
  const driftedParams = [];
  for (const [key, param] of Object.entries(evoState.genome)) {
    if (param.value !== param.default) {
      driftedParams.push({
        param: key,
        current: param.value,
        default: param.default,
        drift: ((param.value - param.default) / (param.max - param.min) * 100).toFixed(1) + '%',
        category: param.category,
      });
    }
  }

  return {
    systemPrompt: `You are Noctis's self-evolution AI. Analyze the trading system's performance data and recommend specific parameter changes or code-level modifications to improve accuracy. Be quantitative and specific. Format your response as JSON with fields: parameterChanges (array of {param, newValue, reason}), codePatches (array of {file, description, priority}), and analysis (string summary).`,
    diagnosticData: {
      currentGeneration: evoState.generation,
      fitnessHistory: fitnessTrend,
      improving,
      topFailurePatterns: sortedPatterns.slice(0, 10),
      recentAttributions: recentAttributions.slice(-20).map(a => ({
        ticker: a.ticker,
        strategy: a.strategy,
        regime: a.regime,
        confidence: a.confidence,
        actualReturn: a.actualReturn,
        reasons: a.reasons.map(r => r.category),
      })),
      currentGenome: Object.fromEntries(
        Object.entries(evoState.genome).map(([k, v]) => [k, { value: v.value, default: v.default }])
      ),
      driftedParams,
      recentMutations: recentMutations.slice(-10),
      paramPerformance: Object.fromEntries(
        Object.entries(evoState.paramScores)
          .filter(([, v]) => v.goodCount + v.badCount >= 5)
          .sort(([, a], [, b]) => (b.badCount / (b.goodCount + b.badCount)) - (a.badCount / (a.goodCount + a.badCount)))
          .slice(0, 15)
          .map(([k, v]) => [k, { winRate: (v.goodCount / (v.goodCount + v.badCount) * 100).toFixed(0) + '%', failTypes: v.failureTypes }])
      ),
    },
  };
}

// ============ CORE: APPLY CLAUDE RECOMMENDATIONS ============
// Takes Claude's response and applies validated parameter changes.

export function applyRecommendations(recommendations) {
  ensureInit();
  if (!recommendations || !Array.isArray(recommendations.parameterChanges)) return { applied: 0, rejected: 0 };

  const now = Date.now();
  let applied = 0;
  let rejected = 0;

  for (const change of recommendations.parameterChanges) {
    const param = evoState.genome[change.param];
    if (!param) { rejected++; continue; }

    const newVal = typeof change.newValue === 'number' ? change.newValue : parseFloat(change.newValue);
    if (isNaN(newVal)) { rejected++; continue; }

    // Validate within bounds
    const clampedVal = Math.max(param.min, Math.min(param.max, newVal));

    // Safety: don't allow more than 2 step sizes of change at once
    const maxDelta = param.step * 2.5;
    if (Math.abs(clampedVal - param.value) > maxDelta) {
      // Apply capped version
      const direction = clampedVal > param.value ? 1 : -1;
      param.value = param.value + direction * maxDelta;
    } else {
      param.value = clampedVal;
    }

    const historyEntry = {
      param: change.param,
      from: param.value,
      to: clampedVal,
      generation: evoState.generation,
      reason: `Claude recommendation: ${change.reason || 'no reason given'}`,
      appliedAt: now,
      source: 'claude-api',
    };

    evoState.appliedMutations.push(historyEntry);
    applied++;
  }

  saveEvolutionState(evoState);

  const history = loadParamHistory();
  saveParamHistory(history);

  return {
    applied,
    rejected,
    codePatches: recommendations.codePatches || [],
    analysis: recommendations.analysis || '',
  };
}

// ============ REPORTING ============

export function getEvolutionReport() {
  ensureInit();

  const genome = getGenome();
  const history = loadParamHistory();

  // Params that have drifted from default
  const driftedParams = Object.entries(genome)
    .filter(([, v]) => v.driftFromDefault !== '0%')
    .sort((a, b) => Math.abs(parseFloat(b[1].driftFromDefault)) - Math.abs(parseFloat(a[1].driftFromDefault)));

  // Recent failure attribution summary
  const recentAttr = evoState.attributions.slice(-30);
  const failureSummary = {};
  for (const attr of recentAttr) {
    for (const reason of attr.reasons) {
      failureSummary[reason.category] = (failureSummary[reason.category] || 0) + 1;
    }
  }

  // Fitness trend
  const fitnessTrend = evoState.fitnessHistory.slice(-20);
  const latestFitness = fitnessTrend.length > 0 ? fitnessTrend[fitnessTrend.length - 1].fitness : 0;
  const previousFitness = fitnessTrend.length > 1 ? fitnessTrend[fitnessTrend.length - 2].fitness : 0;
  const fitnessDirection = latestFitness > previousFitness ? 'improving' : latestFitness < previousFitness ? 'declining' : 'stable';

  return {
    generation: evoState.generation,
    lastEvolutionAt: evoState.lastEvolutionAt,
    fitnessScore: latestFitness,
    fitnessDirection,
    fitnessTrend: fitnessTrend.map(f => ({ gen: f.generation, fitness: f.fitness })),
    totalMutationsApplied: evoState.appliedMutations.length,
    recentMutations: evoState.appliedMutations.slice(-10),
    driftedParams: driftedParams.slice(0, 15),
    failureSummary,
    attributionCount: evoState.attributions.length,
    paramScoreCount: Object.keys(evoState.paramScores).length,
    evolveLog: evoState.evolveLog.slice(-20),
  };
}

export function resetEvolution() {
  evoState = freshEvolutionState();
  saveEvolutionState(evoState);
  return { reset: true, generation: 0 };
}

export function getEvolutionState() {
  ensureInit();
  return {
    generation: evoState.generation,
    lastEvolutionAt: evoState.lastEvolutionAt,
    genome: evoState.genome,
    paramScores: evoState.paramScores,
    fitnessHistory: evoState.fitnessHistory,
  };
}
