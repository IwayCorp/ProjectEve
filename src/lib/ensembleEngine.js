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

export function computeEnsemble(strategyScores, regime, alphaFactors = {}, performanceData = null) {
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
  let adjustedWeights = applySharpeAdjustment(baseWeights, alphaFactors);

  // Step 2b: Apply track record weighting if performanceData is provided
  // performanceData format: { momentum: { winRate: 0.7 }, meanReversion: { winRate: 0.4 }, breakout: { winRate: 0.55 } }
  if (performanceData && typeof performanceData === 'object') {
    const trackRecordAdjusted = { ...adjustedWeights };
    const trackAdjustments = [];

    for (const strat of ['momentum', 'meanReversion', 'breakout']) {
      const perf = performanceData[strat];
      if (perf && typeof perf.winRate === 'number') {
        if (perf.winRate >= 0.6) {
          // High win rate in current regime: boost weight by 15%
          const boost = trackRecordAdjusted[strat] * 0.15;
          trackRecordAdjusted[strat] = Math.min(trackRecordAdjusted[strat] + boost, 0.75);
          trackAdjustments.push(`${strat} boosted +15% (${(perf.winRate * 100).toFixed(0)}% win rate)`);
        } else if (perf.winRate < 0.45) {
          // Low win rate in current regime: reduce weight by 20%
          const reduction = trackRecordAdjusted[strat] * 0.20;
          trackRecordAdjusted[strat] = Math.max(trackRecordAdjusted[strat] - reduction, 0.05);
          trackAdjustments.push(`${strat} reduced -20% (${(perf.winRate * 100).toFixed(0)}% win rate)`);
        }
      }
    }

    // Re-normalize to sum to 1
    const trSum = Object.values(trackRecordAdjusted).reduce((a, b) => a + b, 0);
    if (trSum > 0) {
      for (const strat in trackRecordAdjusted) {
        trackRecordAdjusted[strat] = trackRecordAdjusted[strat] / trSum;
      }
    }

    adjustedWeights = trackRecordAdjusted;
    // Store adjustments for logging (attached later)
    adjustedWeights._trackAdjustments = trackAdjustments;
  }

  // Step 3: Extract strategy scores and confidences
  const momentumScore = strategyScores.momentum?.score || 0;
  const momentumConf = (strategyScores.momentum?.confidence || 50) / 100;

  const mrScore = strategyScores.meanReversion?.score || 0;
  const mrConf = (strategyScores.meanReversion?.confidence || 50) / 100;

  const boScore = strategyScores.breakout?.score || 0;
  const boConf = (strategyScores.breakout?.confidence || 50) / 100;

  // Step 4: Detect conflicts
  const conflict = detectConflict(strategyScores);

  // Step 5: Apply cross-strategy correlation penalty
  // Momentum and breakout are highly correlated (~0.7) in trending markets.
  // When both fire in the same direction, the portfolio thinks it has diversification
  // but it doesn't. Penalize overlapping directional weight.
  const momSign = Math.sign(momentumScore);
  const boSign = Math.sign(boScore);
  const momBoSameDir = momSign !== 0 && momSign === boSign;

  if (momBoSameDir) {
    // Both agree on direction: cap their combined weight contribution
    // Effective correlation penalty: reduce the smaller signal's weight by 30%
    const momAbs = Math.abs(momentumScore);
    const boAbs = Math.abs(boScore);
    if (momAbs >= boAbs) {
      adjustedWeights.breakout = adjustedWeights.breakout * 0.70;
    } else {
      adjustedWeights.momentum = adjustedWeights.momentum * 0.70;
    }
    // Re-normalize
    const penaltySum = adjustedWeights.momentum + adjustedWeights.meanReversion + adjustedWeights.breakout;
    if (penaltySum > 0) {
      adjustedWeights.momentum /= penaltySum;
      adjustedWeights.meanReversion /= penaltySum;
      adjustedWeights.breakout /= penaltySum;
    }
  }

  // Compute weighted ensemble score (correlation-adjusted)
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
  // Track record adjustments
  if (adjustedWeights._trackAdjustments && adjustedWeights._trackAdjustments.length > 0) {
    adjustments.push(...adjustedWeights._trackAdjustments);
  }

  // Clean internal tracking property before returning
  delete adjustedWeights._trackAdjustments;

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
