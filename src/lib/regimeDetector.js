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
  if (candles.length < period) return null;
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return sma(tr, period);
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const deltas = [];
  for (let i = 1; i < closes.length; i++) {
    deltas.push(closes[i] - closes[i - 1]);
  }
  const gains = deltas.map(d => Math.max(d, 0));
  const losses = deltas.map(d => Math.max(-d, 0));
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return avgGain > 0 ? 100 : 0;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
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

function hurst(closes, lag = 20) {
  if (closes.length < lag * 2) return 0.5;

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const lags = [lag];
  const tau = [];

  for (const L of lags) {
    if (returns.length < L) continue;
    let sum = 0;
    for (let i = L; i < returns.length; i++) {
      const meanRet = returns.slice(i - L, i).reduce((a, b) => a + b, 0) / L;
      const devSum = returns.slice(i - L, i).reduce((a, b) => a + (b - meanRet), 0);
      sum += devSum * devSum;
    }
    const variance = sum / (returns.length - L);
    tau.push(Math.sqrt(variance * L));
  }

  // Hurst exponent approximation: log(tau) vs log(lag) slope
  const h = Math.log(tau[0]) / Math.log(lag);
  return Math.min(1, Math.max(0, h));
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
  const emissions = {
    'trending-bull': 0,
    'trending-bear': 0,
    'mean-reverting': 0,
    'volatile-transition': 0
  };

  // trending-bull: high ADX, positive MA alignment, RSI not overbought, low realized vol
  if (adxValue > 30 && maAlignment > 0 && rsiValue < 80 && realizedVol < 40) {
    emissions['trending-bull'] += 0.35;
  }

  // trending-bear: high ADX, negative MA alignment, RSI not oversold, low realized vol
  if (adxValue > 30 && maAlignment < 0 && rsiValue > 20 && realizedVol < 40) {
    emissions['trending-bear'] += 0.35;
  }

  // mean-reverting: low ADX, hurst near 0.5, RSI extreme (setup for reversal), volume neutral
  if (adxValue < 25 && Math.abs(hurstValue - 0.5) < 0.15 && (rsiZone === 'oversold' || rsiZone === 'overbought')) {
    emissions['mean-reverting'] += 0.40;
  }

  // volatile-transition: high realized vol, ADX declining, hurst > 0.6 or < 0.4, volume expanding
  if (realizedVol > 50 || (adxValue > 20 && adxValue < 40 && Math.abs(hurstValue - 0.5) > 0.2)) {
    emissions['volatile-transition'] += 0.30;
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

  return {
    currentRegime,
    confidence,
    regimeProbabilities: {
      trendingBull: regimeProbabilities['trending-bull'],
      trendingBear: regimeProbabilities['trending-bear'],
      meanReverting: regimeProbabilities['mean-reverting'],
      volatileTransition: regimeProbabilities['volatile-transition']
    },
    transitionRisk,
    regimeAge,
    recommendedStrategy,
    observations: {
      adx: Math.round(adxValue * 10) / 10,
      hurst: Math.round(hurstValue * 100) / 100,
      rsiZone,
      volTrend,
      maAlignment
    }
  };
}
