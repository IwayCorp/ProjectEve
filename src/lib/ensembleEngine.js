// ensembleEngine.js — Ensemble strategy weighting system for Edge Runtime
// Pure JavaScript, no external dependencies

// ============ ENSEMBLE WEIGHTING LOGIC ============

function getRegimeWeights(regime) {
  const regimeWeights = {
    'trending-bull': { momentum: 0.50, breakout: 0.30, meanReversion: 0.20 },
    'trending-bear': { momentum: 0.45, breakout: 0.25, meanReversion: 0.30 },
    'mean-reverting': { meanReversion: 0.55, momentum: 0.25, breakout: 0.20 },
    'volatile-transition': { momentum: 0.30, meanReversion: 0.35, breakout: 0.35 }
  };

  return regimeWeights[regime] || { momentum: 0.33, breakout: 0.33, meanReversion: 0.34 };
}

function applySharpeAdjustment(weights, alphaFactors) {
  // Boost strategies with high alpha/confidence signals
  // alphaFactors = { alpha_momentum, alpha_meanReversion, alpha_trend, confidence_momentum, ... }

  if (!alphaFactors) return weights;

  const adjusted = { ...weights };

  // Momentum boost
  if (alphaFactors.alpha_momentum > 0.5) {
    adjusted.momentum = Math.min(adjusted.momentum * 1.15, 0.70);
  } else if (alphaFactors.alpha_momentum < 0.3) {
    adjusted.momentum = Math.max(adjusted.momentum * 0.85, 0.10);
  }

  // Mean reversion boost
  if (alphaFactors.alpha_meanReversion > 0.5) {
    adjusted.meanReversion = Math.min(adjusted.meanReversion * 1.15, 0.70);
  } else if (alphaFactors.alpha_meanReversion < 0.3) {
    adjusted.meanReversion = Math.max(adjusted.meanReversion * 0.85, 0.10);
  }

  // Trend/breakout boost
  if (alphaFactors.alpha_trend > 0.5) {
    adjusted.breakout = Math.min(adjusted.breakout * 1.15, 0.70);
  } else if (alphaFactors.alpha_trend < 0.3) {
    adjusted.breakout = Math.max(adjusted.breakout * 0.85, 0.10);
  }

  // Re-normalize
  const sum = Object.values(adjusted).reduce((a, b) => a + b, 0);
  for (const strategy in adjusted) {
    adjusted[strategy] = adjusted[strategy] / sum;
  }

  return adjusted;
}

function detectConflict(strategyScores) {
  // Conflict: momentum says long (score > 0) but meanReversion says short (score < 0)
  const momentumSignal = strategyScores.momentum?.score || 0;
  const mrSignal = strategyScores.meanReversion?.score || 0;
  const boSignal = strategyScores.breakout?.score || 0;

  const conflictPairs = [];
  let severity = 0;

  // Momentum vs Mean Reversion conflict
  if (momentumSignal > 30 && mrSignal < -30) {
    conflictPairs.push('momentum vs mean-reversion');
    severity = Math.max(severity, 40);
  }
  if (momentumSignal < -30 && mrSignal > 30) {
    conflictPairs.push('momentum vs mean-reversion');
    severity = Math.max(severity, 40);
  }

  // Breakout vs Mean Reversion conflict
  if (boSignal > 30 && mrSignal < -30) {
    conflictPairs.push('breakout vs mean-reversion');
    severity = Math.max(severity, 30);
  }

  return {
    detected: conflictPairs.length > 0,
    pairs: conflictPairs,
    severity
  };
}

export function computeEnsemble(strategyScores, regime, alphaFactors = {}) {
  // Validate inputs
  if (!strategyScores || !regime) {
    return {
      direction: 'neutral',
      confidence: 0,
      weights: { momentum: 0.33, meanReversion: 0.33, breakout: 0.34 },
      conflictDetected: false,
      conflictSeverity: 0,
      dominantStrategy: 'none',
      ensembleScore: 0,
      adjustments: ['insufficient data']
    };
  }

  // Step 1: Get regime-based base weights
  const baseWeights = getRegimeWeights(regime.currentRegime);

  // Step 2: Apply Sharpe / alpha-based adjustments
  const adjustedWeights = applySharpeAdjustment(baseWeights, alphaFactors);

  // Step 3: Extract strategy scores and confidences
  const momentumScore = strategyScores.momentum?.score || 0;
  const momentumConf = (strategyScores.momentum?.confidence || 50) / 100;

  const mrScore = strategyScores.meanReversion?.score || 0;
  const mrConf = (strategyScores.meanReversion?.confidence || 50) / 100;

  const boScore = strategyScores.breakout?.score || 0;
  const boConf = (strategyScores.breakout?.confidence || 50) / 100;

  // Step 4: Detect conflicts
  const conflict = detectConflict(strategyScores);

  // Step 5: Compute weighted ensemble score
  // Score normalized to [-100, +100]
  const weightedMomentum = (momentumScore / 100) * adjustedWeights.momentum;
  const weightedMR = (mrScore / 100) * adjustedWeights.meanReversion;
  const weightedBO = (boScore / 100) * adjustedWeights.breakout;

  let ensembleScore = (weightedMomentum + weightedMR + weightedBO) * 100;
  ensembleScore = Math.max(-100, Math.min(100, ensembleScore));

  // Step 6: Determine direction
  let direction = 'neutral';
  if (ensembleScore > 20) direction = 'long';
  if (ensembleScore < -20) direction = 'short';

  // Step 7: Compute confidence
  // Based on: signal strength, strategy agreement, regime confidence
  const signalStrength = Math.abs(ensembleScore) / 100;
  const regimeConfidence = regime.confidence / 100;
  const avgStrategyConf = (momentumConf + mrConf + boConf) / 3;

  let confidence = signalStrength * 0.5 + regimeConfidence * 0.3 + avgStrategyConf * 0.2;
  confidence = Math.round(confidence * 100);

  // Reduce confidence if conflict detected
  if (conflict.detected) {
    confidence = Math.max(10, confidence - conflict.severity);
  }

  // Step 8: Identify dominant strategy
  const scores = {
    momentum: momentumScore * adjustedWeights.momentum,
    meanReversion: mrScore * adjustedWeights.meanReversion,
    breakout: boScore * adjustedWeights.breakout
  };
  const dominantStrategy = Object.entries(scores).reduce((a, b) =>
    Math.abs(b[1]) > Math.abs(a[1]) ? b : a
  )[0];

  // Step 9: Build adjustments log
  const adjustments = [];
  if (conflict.detected) {
    adjustments.push(`conflict detected: ${conflict.pairs.join(', ')}`);
  }
  if (regime.currentRegime === 'volatile-transition') {
    adjustments.push('volatile regime: reduced position sizing');
  }
  if (confidence < 40) {
    adjustments.push('low confidence: consider smaller position');
  }
  if (Math.abs(ensembleScore) < 20) {
    adjustments.push('weak signal: wait for clearer setup');
  }

  return {
    direction,
    confidence,
    weights: {
      momentum: Math.round(adjustedWeights.momentum * 100) / 100,
      meanReversion: Math.round(adjustedWeights.meanReversion * 100) / 100,
      breakout: Math.round(adjustedWeights.breakout * 100) / 100
    },
    conflictDetected: conflict.detected,
    conflictSeverity: conflict.severity,
    dominantStrategy,
    ensembleScore: Math.round(ensembleScore),
    adjustments
  };
}
