// regimeDetector.js — Hidden Markov Model-inspired regime detection for Edge Runtime
// Pure JavaScript, no external dependencies

// ============ HELPER FUNCTIONS ============

function sma(values, period) {
  if (values.length < period) return null;
  const sum = values.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function stdev(values, period) {
  if (values.length < period) return null;
  const subset = values.slice(-period);
  const mean = subset.reduce((a, b) => a + b, 0) / period;
  const variance = subset.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  return Math.sqrt(variance);
}

function atr(candles, period = 14) {
  if (candles.length < period + 1) return null;
  // Wilder's smoothed ATR (not SMA)
  let atrVal = 0;
  for (let i = 1; i <= period; i++) {
    atrVal += Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
  }
  atrVal /= period;
  for (let i = period + 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    atrVal = (atrVal * (period - 1) + tr) / period;
  }
  return atrVal;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  // Wilder's smoothed RSI
  let avgGain = 0, avgLoss = 0, result = null;
  for (let i = 1; i < closes.length; i++) {
    const g = closes[i] > closes[i - 1] ? closes[i] - closes[i - 1] : 0;
    const l = closes[i] < closes[i - 1] ? closes[i - 1] - closes[i] : 0;
    if (i <= period) {
      avgGain += g; avgLoss += l;
      if (i === period) {
        avgGain /= period; avgLoss /= period;
        result = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    } else {
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;
      result = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return result;
}

function adx(candles, period = 14) {
  if (candles.length < period * 2) return null;

  const plusDM = [];
  const minusDM = [];
  const tr = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];

    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;

    plusDM.push(Math.max(upMove > 0 ? upMove : 0, 0));
    minusDM.push(Math.max(downMove > 0 ? downMove : 0, 0));

    const high_low = curr.high - curr.low;
    const high_close = Math.abs(curr.high - prev.close);
    const low_close = Math.abs(curr.low - prev.close);
    tr.push(Math.max(high_low, high_close, low_close));
  }

  const atrVal = sma(tr, period);
  const plusDI = (sma(plusDM, period) / atrVal) * 100;
  const minusDI = (sma(minusDM, period) / atrVal) * 100;
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

  return Math.max(0, Math.min(100, sma([dx], period) || dx));
}

function hurst(closes, maxWindow = 100) {
  // Proper R/S (Rescaled Range) multi-scale Hurst exponent
  // H > 0.55 = trending, H < 0.45 = mean-reverting, 0.45-0.55 = random walk
  const n = Math.min(closes.length, maxWindow);
  if (n < 20) return 0.5;

  const series = closes.slice(-n);
  const returns = [];
  for (let i = 1; i < series.length; i++) {
    returns.push(Math.log(series[i] / series[i - 1]));
  }

  const scales = [];
  const rsValues = [];

  for (let scale = 4; scale <= Math.floor(returns.length / 2); scale = Math.floor(scale * 1.5)) {
    const numBlocks = Math.floor(returns.length / scale);
    if (numBlocks < 1) continue;

    let rsSum = 0;
    let validBlocks = 0;

    for (let b = 0; b < numBlocks; b++) {
      const block = returns.slice(b * scale, (b + 1) * scale);
      const mean = block.reduce((a, v) => a + v, 0) / block.length;
      const std = Math.sqrt(block.reduce((a, v) => a + (v - mean) ** 2, 0) / block.length);
      if (std < 1e-10) continue;

      // Cumulative deviation from mean
      let cumDev = 0, maxCum = -Infinity, minCum = Infinity;
      for (const val of block) {
        cumDev += val - mean;
        maxCum = Math.max(maxCum, cumDev);
        minCum = Math.min(minCum, cumDev);
      }

      rsSum += (maxCum - minCum) / std;
      validBlocks++;
    }

    if (validBlocks > 0) {
      scales.push(Math.log(scale));
      rsValues.push(Math.log(rsSum / validBlocks));
    }
  }

  if (scales.length < 3) return 0.5;

  // Linear regression: log(R/S) = H * log(n) + c
  const nPts = scales.length;
  const sumX = scales.reduce((a, v) => a + v, 0);
  const sumY = rsValues.reduce((a, v) => a + v, 0);
  const sumXY = scales.reduce((a, v, i) => a + v * rsValues[i], 0);
  const sumX2 = scales.reduce((a, v) => a + v * v, 0);

  const H = (nPts * sumXY - sumX * sumY) / (nPts * sumX2 - sumX * sumX);
  return Math.max(0.01, Math.min(0.99, parseFloat(H.toFixed(3))));
}

function getRSIZone(rsiValue) {
  if (rsiValue < 30) return 'oversold';
  if (rsiValue > 70) return 'overbought';
  return 'neutral';
}

function getVolumeTrend(volumes) {
  if (volumes.length < 10) return 'unknown';
  const recentAvg = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const olderAvg = volumes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
  if (recentAvg > olderAvg * 1.1) return 'expanding';
  if (recentAvg < olderAvg * 0.9) return 'contracting';
  return 'neutral';
}

function getMaAlignmentScore(closes) {
  if (closes.length < 50) return 0;
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const current = closes[closes.length - 1];

  if (!sma20 || !sma50) return 0;

  // 100 if price > SMA20 > SMA50 (strong uptrend)
  // -100 if price < SMA20 < SMA50 (strong downtrend)
  // 0 if mixed
  const upAligned = current > sma20 && sma20 > sma50;
  const downAligned = current < sma20 && sma20 < sma50;

  if (upAligned) return 100;
  if (downAligned) return -100;
  return 0;
}

// ============ REGIME DETECTION ENGINE ============

export function detectRegime(candles, closes, marketRegime = {}) {
  // Compute observables
  const currentPrice = closes[closes.length - 1];
  const adxValue = adx(candles, 14) || 25;
  const hurstValue = hurst(closes, 20);
  const rsiValue = rsi(closes, 14) || 50;
  const rsiZone = getRSIZone(rsiValue);
  const volTrend = getVolumeTrend(candles.map(c => c.volume));
  const maAlignment = getMaAlignmentScore(closes);

  // VIX proxy: realized volatility from returns
  const returns = [];
  for (let i = 1; i < Math.min(21, closes.length); i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const realizedVol = returns.length > 0
    ? Math.sqrt(returns.reduce((a, b) => a + b * b, 0) / returns.length) * 100
    : 20; // default VIX ~20

  // Compute emission probabilities (observable likelihood per regime)
  // Calibrated thresholds: ADX 25 (not 30) for trend detection,
  // Hurst 0.55/0.45 boundaries (not 0.5 +/- 0.15), vol percentile-based
  const emissions = {
    'trending-bull': 0,
    'trending-bear': 0,
    'mean-reverting': 0,
    'volatile-transition': 0
  };

  // trending-bull: ADX shows directional movement, positive MA alignment, Hurst > 0.55 (persistent)
  if (adxValue > 25 && maAlignment > 0 && hurstValue > 0.55 && rsiValue < 80) {
    emissions['trending-bull'] += 0.30 + (adxValue > 35 ? 0.10 : 0) + (hurstValue > 0.65 ? 0.05 : 0);
  }
  // Weaker bull: price above MAs even without strong ADX
  if (maAlignment > 0 && hurstValue > 0.52 && rsiValue > 40 && rsiValue < 75) {
    emissions['trending-bull'] += 0.15;
  }

  // trending-bear: ADX shows directional movement, negative MA alignment, Hurst > 0.55 (persistent)
  if (adxValue > 25 && maAlignment < 0 && hurstValue > 0.55 && rsiValue > 20) {
    emissions['trending-bear'] += 0.30 + (adxValue > 35 ? 0.10 : 0) + (hurstValue > 0.65 ? 0.05 : 0);
  }
  if (maAlignment < 0 && hurstValue > 0.52 && rsiValue < 60 && rsiValue > 25) {
    emissions['trending-bear'] += 0.15;
  }

  // mean-reverting: Hurst < 0.45 (anti-persistent), low ADX, RSI extremes
  if (hurstValue < 0.45 && adxValue < 25) {
    emissions['mean-reverting'] += 0.30 + (hurstValue < 0.35 ? 0.10 : 0);
  }
  if (adxValue < 20 && (rsiZone === 'oversold' || rsiZone === 'overbought')) {
    emissions['mean-reverting'] += 0.15;
  }

  // volatile-transition: high realized vol OR Hurst crossing 0.5 boundary, ADX mid-range
  if (realizedVol > 40) {
    emissions['volatile-transition'] += 0.25 + (realizedVol > 60 ? 0.15 : 0);
  }
  if (hurstValue > 0.45 && hurstValue < 0.55 && adxValue > 15 && adxValue < 35) {
    emissions['volatile-transition'] += 0.15; // random walk zone
  }

  // Normalize emissions
  const emissionSum = Object.values(emissions).reduce((a, b) => a + b, 0);
  for (const regime in emissions) {
    emissions[regime] = emissionSum > 0 ? emissions[regime] / emissionSum : 0.25;
  }

  // Hardcoded transition probability matrix
  const transitions = {
    'trending-bull': { 'trending-bull': 0.70, 'mean-reverting': 0.15, 'volatile-transition': 0.10, 'trending-bear': 0.05 },
    'trending-bear': { 'trending-bear': 0.65, 'mean-reverting': 0.15, 'volatile-transition': 0.15, 'trending-bull': 0.05 },
    'mean-reverting': { 'mean-reverting': 0.60, 'trending-bull': 0.15, 'trending-bear': 0.10, 'volatile-transition': 0.15 },
    'volatile-transition': { 'trending-bull': 0.25, 'trending-bear': 0.25, 'mean-reverting': 0.30, 'volatile-transition': 0.20 }
  };

  // Prior: assume we start or continue in recent regime (use marketRegime.currentRegime if available)
  const priorRegime = marketRegime?.currentRegime || 'mean-reverting';

  // Viterbi-style: compute posterior for each regime
  const posteriors = {};
  let maxPosterior = 0;
  let currentRegime = priorRegime;

  for (const regime in emissions) {
    const transition = transitions[priorRegime][regime] || 0.25;
    posteriors[regime] = transition * emissions[regime];
    if (posteriors[regime] > maxPosterior) {
      maxPosterior = posteriors[regime];
      currentRegime = regime;
    }
  }

  // Normalize posteriors to probabilities
  const posteriorSum = Object.values(posteriors).reduce((a, b) => a + b, 0);
  const regimeProbabilities = {};
  for (const regime in posteriors) {
    regimeProbabilities[regime] = posteriorSum > 0 ? Math.round((posteriors[regime] / posteriorSum) * 100) : 25;
  }

  // Confidence: how strong is the winning regime?
  const confidence = Math.round((maxPosterior / posteriorSum) * 100);

  // Transition risk: sum of transition probabilities away from current regime
  const transitionRisk = Math.round(
    (1 - transitions[currentRegime][currentRegime]) * 100
  );

  // Recommend strategy based on regime
  let recommendedStrategy = 'mean-reversion';
  if (currentRegime === 'trending-bull') recommendedStrategy = 'momentum';
  if (currentRegime === 'trending-bear') recommendedStrategy = 'momentum';
  if (currentRegime === 'volatile-transition') recommendedStrategy = 'defensive';

  // Regime age: track how long we've been in this regime (simplified: use marketRegime.regimeAge if available)
  const regimeAge = marketRegime?.regimeAge || 0;

  // ================================================================
  // LEADING REGIME INDICATORS — detect regime shifts 1-2 bars earlier
  // The HMM lags by 2-3 bars; these forward-looking signals compensate.
  // Blended regime = 30% leading + 70% lagging (HMM)
  // ================================================================
  const leadingIndicators = computeLeadingIndicators(candles, closes, realizedVol);

  // Blend leading signal with lagging HMM regime
  let blendedRegime = currentRegime;
  let blendedConfidence = confidence;

  if (leadingIndicators.signalStrength > 0.4) {
    // Leading indicator is strong enough to influence the regime call
    const leadWeight = 0.3;
    const lagWeight = 0.7;

    // If leading indicator suggests a different regime, blend toward it
    if (leadingIndicators.suggestedRegime !== currentRegime) {
      // Reduce confidence in current regime when leading disagrees
      blendedConfidence = Math.round(confidence * lagWeight + leadingIndicators.confidence * leadWeight);

      // If leading signal is very strong and HMM confidence is weak, shift regime
      if (leadingIndicators.signalStrength > 0.6 && confidence < 50) {
        blendedRegime = leadingIndicators.suggestedRegime;
      }
    } else {
      // Leading confirms lagging — boost confidence
      blendedConfidence = Math.min(95, Math.round(confidence * lagWeight + leadingIndicators.confidence * leadWeight + 10));
    }
  }

  return {
    currentRegime: blendedRegime,
    confidence: blendedConfidence,
    regimeProbabilities: {
      trendingBull: regimeProbabilities['trending-bull'],
      trendingBear: regimeProbabilities['trending-bear'],
      meanReverting: regimeProbabilities['mean-reverting'],
      volatileTransition: regimeProbabilities['volatile-transition']
    },
    transitionRisk,
    regimeAge,
    recommendedStrategy,
    leadingIndicators,
    observations: {
      adx: Math.round(adxValue * 10) / 10,
      hurst: Math.round(hurstValue * 100) / 100,
      rsiZone,
      volTrend,
      maAlignment
    }
  };
}

// ============ LEADING REGIME INDICATORS ============
// Uses VIX rate-of-change, sector rotation proxy, and credit spread proxy
// to detect regime shifts 1-2 bars before the HMM catches up.

function computeLeadingIndicators(candles, closes, realizedVol) {
  const result = {
    vixMomentum: 0,
    sectorRotation: 0,
    creditProxy: 0,
    composite: 0,
    signalStrength: 0,
    suggestedRegime: 'mean-reverting',
    confidence: 50,
    details: {}
  };

  if (!candles || candles.length < 30) return result;

  // --- 1. VIX Rate-of-Change Proxy ---
  // Use realized volatility change as a VIX proxy (actual VIX not available in edge)
  // Rising vol = risk-off transition, falling vol = risk-on continuation
  const recentReturns = [];
  const priorReturns = [];
  for (let i = Math.max(1, closes.length - 5); i < closes.length; i++) {
    recentReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  for (let i = Math.max(1, closes.length - 15); i < closes.length - 5; i++) {
    priorReturns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const recentVolatility = recentReturns.length > 0
    ? Math.sqrt(recentReturns.reduce((a, b) => a + b * b, 0) / recentReturns.length) * 100
    : realizedVol;
  const priorVolatility = priorReturns.length > 0
    ? Math.sqrt(priorReturns.reduce((a, b) => a + b * b, 0) / priorReturns.length) * 100
    : realizedVol;

  const volRoC = priorVolatility > 0 ? (recentVolatility - priorVolatility) / priorVolatility : 0;
  result.vixMomentum = Math.max(-1, Math.min(1, volRoC * 2)); // normalized -1 to 1
  result.details.recentVol = Math.round(recentVolatility * 100) / 100;
  result.details.priorVol = Math.round(priorVolatility * 100) / 100;
  result.details.volRoC = Math.round(volRoC * 1000) / 1000;

  // --- 2. Sector Rotation Proxy (cyclicals vs defensives) ---
  // Without separate sector data, use high-beta behavior: if recent returns
  // are more extreme than prior (higher kurtosis), risk appetite is shifting
  const recentAbsReturns = recentReturns.map(Math.abs);
  const priorAbsReturns = priorReturns.map(Math.abs);
  const recentAvgMove = recentAbsReturns.length > 0 ? recentAbsReturns.reduce((a, b) => a + b, 0) / recentAbsReturns.length : 0;
  const priorAvgMove = priorAbsReturns.length > 0 ? priorAbsReturns.reduce((a, b) => a + b, 0) / priorAbsReturns.length : 0;
  const moveRatio = priorAvgMove > 0 ? recentAvgMove / priorAvgMove : 1;

  // Also check directional skew: are recent returns skewed negative? (risk-off rotation)
  const recentMean = recentReturns.length > 0 ? recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length : 0;
  result.sectorRotation = recentMean > 0.005 ? 0.5 : recentMean < -0.005 ? -0.5 : 0;
  if (moveRatio > 1.5) result.sectorRotation -= 0.3; // increased dispersion = rotation
  result.sectorRotation = Math.max(-1, Math.min(1, result.sectorRotation));
  result.details.moveRatio = Math.round(moveRatio * 100) / 100;

  // --- 3. Credit Spread Proxy (HYG/TLT behavior) ---
  // Without HYG/TLT data directly, infer from price behavior:
  // Sharp drops with expanding volume = credit stress (risk-off)
  // Steady gains with normal volume = credit easing (risk-on)
  const last5 = candles.slice(-5);
  const last5Return = closes.length >= 6 ? (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6] : 0;
  const last5AvgVol = last5.reduce((a, c) => a + (c.volume || 0), 0) / 5;
  const prior5AvgVol = candles.length >= 10 ? candles.slice(-10, -5).reduce((a, c) => a + (c.volume || 0), 0) / 5 : last5AvgVol;
  const volExpansion = prior5AvgVol > 0 ? last5AvgVol / prior5AvgVol : 1;

  if (last5Return < -0.02 && volExpansion > 1.3) {
    result.creditProxy = -0.8; // credit stress signal
  } else if (last5Return > 0.01 && volExpansion < 1.1) {
    result.creditProxy = 0.5; // credit easing
  } else if (last5Return < -0.01) {
    result.creditProxy = -0.3;
  } else {
    result.creditProxy = 0.1;
  }
  result.details.last5Return = Math.round(last5Return * 10000) / 10000;
  result.details.volExpansion = Math.round(volExpansion * 100) / 100;

  // --- COMPOSITE LEADING SCORE ---
  // Weighted blend: VIX momentum 40%, sector rotation 30%, credit proxy 30%
  result.composite = result.vixMomentum * 0.4 + result.sectorRotation * 0.3 + result.creditProxy * 0.3;
  result.composite = Math.max(-1, Math.min(1, result.composite));
  result.signalStrength = Math.abs(result.composite);

  // Map composite to suggested regime
  if (result.composite > 0.3) {
    result.suggestedRegime = 'trending-bull';
    result.confidence = Math.round(50 + result.composite * 40);
  } else if (result.composite < -0.3) {
    // Distinguish between trending-bear and volatile-transition
    if (result.vixMomentum > 0.5) {
      result.suggestedRegime = 'volatile-transition'; // vol spike = transition
      result.confidence = Math.round(50 + Math.abs(result.composite) * 30);
    } else {
      result.suggestedRegime = 'trending-bear';
      result.confidence = Math.round(50 + Math.abs(result.composite) * 35);
    }
  } else {
    result.suggestedRegime = 'mean-reverting';
    result.confidence = 45;
  }

  return result;
}
