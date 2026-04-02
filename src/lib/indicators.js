/**
 * Technical Indicators Library
 * Production-grade quantitative analysis for forex/crypto trading
 *
 * Candle format: { time, open, high, low, close, volume }
 */

/**
 * Simple Moving Average
 * @param {number[]} closes - Array of closing prices
 * @param {number} period - SMA period
 * @returns {Array<{index: number, value: number|null}>}
 */
export function SMA(closes, period) {
  const result = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push({ index: i, value: null });
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      result.push({ index: i, value: sum / period });
    }
  }

  return result;
}

/**
 * Exponential Moving Average
 * Uses standard exponential smoothing with multiplier = 2 / (period + 1)
 * @param {number[]} closes - Array of closing prices
 * @param {number} period - EMA period
 * @returns {Array<{index: number, value: number|null}>}
 */
export function EMA(closes, period) {
  const result = [];
  const multiplier = 2 / (period + 1);
  let ema = null;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      ema = closes[0];
      result.push({ index: i, value: null });
    } else if (i < period) {
      // SMA for first period values
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += closes[j];
      }
      ema = sum / (i + 1);
      result.push({ index: i, value: null });
    } else if (i === period) {
      // Start with SMA at period point
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[j];
      }
      ema = sum / period;
      result.push({ index: i, value: ema });
    } else {
      ema = closes[i] * multiplier + ema * (1 - multiplier);
      result.push({ index: i, value: ema });
    }
  }

  return result;
}

/**
 * Relative Strength Index (Wilder's smoothing method)
 * @param {number[]} closes - Array of closing prices
 * @param {number} period - RSI period (default 14)
 * @returns {Array<{index: number, value: number|null}>}
 */
export function RSI(closes, period = 14) {
  const result = [];
  const changes = [];

  // Calculate price changes
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Initialize with null values before period
  for (let i = 0; i <= period; i++) {
    result.push({ index: i, value: null });
  }

  // Calculate average gains and losses using Wilder's method
  let avgGain = 0;
  let avgLoss = 0;

  // First average: simple average of gains/losses over period
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }
  avgGain /= period;
  avgLoss /= period;

  // Calculate RS and RSI
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  result[period].value = rsi;

  // Wilder's smoothing for subsequent values
  for (let i = period + 1; i < closes.length; i++) {
    const change = changes[i - 1];
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    result.push({ index: i, value: rsi });
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * @param {number[]} closes - Array of closing prices
 * @param {number} fast - Fast EMA period (default 12)
 * @param {number} slow - Slow EMA period (default 26)
 * @param {number} signal - Signal line EMA period (default 9)
 * @returns {Array<{index: number, macd: number|null, signal: number|null, histogram: number|null}>}
 */
export function MACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = EMA(closes, fast);
  const emaSlow = EMA(closes, slow);

  // Calculate MACD line
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i].value !== null && emaSlow[i].value !== null) {
      macdLine.push(emaFast[i].value - emaSlow[i].value);
    } else {
      macdLine.push(null);
    }
  }

  // Calculate signal line (EMA of MACD)
  const signalLine = EMA(
    macdLine.map((v, i) => (v !== null ? v : closes[i])),
    signal
  );

  // Build result
  const result = [];
  for (let i = 0; i < closes.length; i++) {
    const macdVal = macdLine[i];
    const signalVal = signalLine[i].value;

    result.push({
      index: i,
      macd: macdVal,
      signal: signalVal,
      histogram: macdVal !== null && signalVal !== null ? macdVal - signalVal : null
    });
  }

  return result;
}

/**
 * Bollinger Bands (moving average ± std dev)
 * Uses population standard deviation
 * @param {number[]} closes - Array of closing prices
 * @param {number} period - MA period (default 20)
 * @param {number} stdDev - Standard deviation multiplier (default 2)
 * @returns {Array<{index: number, upper: number|null, middle: number|null, lower: number|null, bandwidth: number|null, percentB: number|null}>}
 */
export function BollingerBands(closes, period = 20, stdDev = 2) {
  const result = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push({
        index: i,
        upper: null,
        middle: null,
        lower: null,
        bandwidth: null,
        percentB: null
      });
    } else {
      // Calculate SMA
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      const sma = sum / period;

      // Calculate standard deviation (population)
      let sumSquaredDiff = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = closes[j] - sma;
        sumSquaredDiff += diff * diff;
      }
      const stdDevValue = Math.sqrt(sumSquaredDiff / period);

      const upper = sma + stdDev * stdDevValue;
      const lower = sma - stdDev * stdDevValue;
      const bandwidth = upper - lower;

      // %B = (close - lower) / (upper - lower)
      const percentB = bandwidth !== 0 ? (closes[i] - lower) / bandwidth : 0.5;

      result.push({
        index: i,
        upper,
        middle: sma,
        lower,
        bandwidth,
        percentB
      });
    }
  }

  return result;
}

/**
 * Average True Range
 * Measures volatility using high-low range with gap consideration
 * @param {Array<{high: number, low: number, close: number}>} candles - OHLC candles
 * @param {number} period - ATR period (default 14)
 * @returns {Array<{index: number, value: number|null}>}
 */
export function ATR(candles, period = 14) {
  const result = [];
  const trueRanges = [];

  // Calculate true range
  for (let i = 0; i < candles.length; i++) {
    let tr;

    if (i === 0) {
      tr = candles[i].high - candles[i].low;
    } else {
      const hl = candles[i].high - candles[i].low;
      const hc = Math.abs(candles[i].high - candles[i - 1].close);
      const lc = Math.abs(candles[i].low - candles[i - 1].close);
      tr = Math.max(hl, hc, lc);
    }

    trueRanges.push(tr);
  }

  // Initialize with nulls
  for (let i = 0; i < period - 1; i++) {
    result.push({ index: i, value: null });
  }

  // Calculate ATR using Wilder's smoothing
  let atr = 0;

  // First ATR: simple average
  for (let i = 0; i < period; i++) {
    atr += trueRanges[i];
  }
  atr /= period;
  result.push({ index: period - 1, value: atr });

  // Subsequent ATR: Wilder's smoothing
  for (let i = period; i < candles.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result.push({ index: i, value: atr });
  }

  return result;
}

/**
 * Support and Resistance Levels
 * Uses pivot points and price clustering based on ATR distance
 * @param {Array<{high: number, low: number, close: number}>} candles - OHLC candles
 * @param {number} lookback - Lookback period for clustering (default 60)
 * @returns {Object} {support: number[], resistance: number[], pivotPoints: {pp, r1, r2, s1, s2}}
 */
export function findSupportResistance(candles, lookback = 60) {
  if (candles.length === 0) {
    return { support: [], resistance: [], pivotPoints: null };
  }

  const start = Math.max(0, candles.length - lookback);
  const period = Math.min(14, Math.floor(lookback / 4));
  const atrData = ATR(candles, period);
  const currentATR = atrData[atrData.length - 1]?.value || 1;

  // Collect recent highs and lows for clustering
  const prices = [];
  for (let i = start; i < candles.length; i++) {
    prices.push(candles[i].high);
    prices.push(candles[i].low);
  }

  // Cluster prices within ATR distance
  const clusters = [];
  const used = new Set();
  const clusterDistance = currentATR * 0.5;

  for (let i = 0; i < prices.length; i++) {
    if (used.has(i)) continue;

    const cluster = [prices[i]];
    used.add(i);

    for (let j = i + 1; j < prices.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(prices[j] - prices[i]) <= clusterDistance) {
        cluster.push(prices[j]);
        used.add(j);
      }
    }

    if (cluster.length >= 2) {
      const avg = cluster.reduce((a, b) => a + b) / cluster.length;
      clusters.push({ level: avg, strength: cluster.length });
    }
  }

  // Sort by level
  clusters.sort((a, b) => a.level - b.level);

  // Separate support and resistance
  const lastClose = candles[candles.length - 1].close;
  const support = clusters
    .filter(c => c.level < lastClose)
    .sort((a, b) => b.level - a.level)
    .slice(0, 3)
    .map(c => c.level);

  const resistance = clusters
    .filter(c => c.level > lastClose)
    .sort((a, b) => a.level - b.level)
    .slice(0, 3)
    .map(c => c.level);

  // Calculate pivot points (standard method)
  const h = candles[candles.length - 1].high;
  const l = candles[candles.length - 1].low;
  const c = candles[candles.length - 1].close;
  const pp = (h + l + c) / 3;
  const r1 = 2 * pp - l;
  const r2 = pp + (h - l);
  const s1 = 2 * pp - h;
  const s2 = pp - (h - l);

  return {
    support,
    resistance,
    pivotPoints: { pp, r1, r2, s1, s2 }
  };
}

/**
 * Volume Weighted Average Price
 * @param {Array<{close: number, volume: number}>} candles - OHLC candles with volume
 * @returns {Array<{index: number, value: number}>}
 */
export function VWAP(candles) {
  const result = [];
  let cumVolume = 0;
  let cumPriceVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    cumVolume += candles[i].volume;
    cumPriceVolume += candles[i].close * candles[i].volume;

    const vwap = cumVolume > 0 ? cumPriceVolume / cumVolume : candles[i].close;
    result.push({ index: i, value: vwap });
  }

  return result;
}

/**
 * Stochastic Oscillator
 * @param {Array<{high: number, low: number, close: number}>} candles - OHLC candles
 * @param {number} kPeriod - K period (default 14)
 * @param {number} dPeriod - D (signal) period (default 3)
 * @returns {Array<{index: number, k: number|null, d: number|null}>}
 */
export function Stochastic(candles, kPeriod = 14, dPeriod = 3) {
  const result = [];
  const kValues = [];

  // Calculate K values
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(null);
      result.push({ index: i, k: null, d: null });
    } else {
      let high = candles[i].high;
      let low = candles[i].low;

      for (let j = i - kPeriod + 1; j < i; j++) {
        high = Math.max(high, candles[j].high);
        low = Math.min(low, candles[j].low);
      }

      const k = high === low ? 50 : ((candles[i].close - low) / (high - low)) * 100;
      kValues.push(k);
    }
  }

  // Calculate D values (SMA of K)
  for (let i = 0; i < kValues.length; i++) {
    let d = null;

    if (i >= kPeriod + dPeriod - 2 && kValues[i] !== null) {
      let sum = 0;
      let count = 0;
      for (let j = i - dPeriod + 1; j <= i; j++) {
        if (kValues[j] !== null) {
          sum += kValues[j];
          count++;
        }
      }
      d = count > 0 ? sum / count : null;
    }

    if (result[i]) {
      result[i].k = kValues[i];
      result[i].d = d;
    }
  }

  return result;
}

/**
 * On-Balance Volume
 * Cumulative volume indicator combining price and volume
 * @param {Array<{close: number, volume: number}>} candles - OHLC candles
 * @returns {Array<{index: number, value: number}>}
 */
export function OBV(candles) {
  const result = [];
  let obv = 0;

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      obv = candles[i].volume;
    } else {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) {
        obv += candles[i].volume;
      } else if (change < 0) {
        obv -= candles[i].volume;
      }
    }

    result.push({ index: i, value: obv });
  }

  return result;
}

/**
 * Calculate all common moving averages
 * Returns the LAST value of each
 * @param {number[]} closes - Array of closing prices
 * @returns {Object} {ma20, ma50, ma200, ema12, ema26}
 */
export function MovingAverages(closes) {
  const sma20 = SMA(closes, 20);
  const sma50 = SMA(closes, 50);
  const sma200 = SMA(closes, Math.min(200, closes.length));
  const ema12 = EMA(closes, 12);
  const ema26 = EMA(closes, 26);

  const getLastValue = (arr) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].value !== null) return arr[i].value;
    }
    return null;
  };

  return {
    ma20: getLastValue(sma20),
    ma50: getLastValue(sma50),
    ma200: getLastValue(sma200),
    ema12: getLastValue(ema12),
    ema26: getLastValue(ema26)
  };
}

/**
 * Trend Strength based on MA alignment
 * @param {number[]} closes - Array of closing prices
 * @returns {Object} {trend: 'bullish'|'bearish'|'neutral', strength: 0-100}
 */
export function trendStrength(closes) {
  const mas = MovingAverages(closes);
  const currentPrice = closes[closes.length - 1];

  if (!mas.ma20 || !mas.ma50 || !mas.ma200) {
    return { trend: 'neutral', strength: 50 };
  }

  // Determine trend
  let bullishPoints = 0;
  let bearishPoints = 0;

  // Price above MAs
  if (currentPrice > mas.ma20) bullishPoints += 2;
  else bearishPoints += 2;

  if (currentPrice > mas.ma50) bullishPoints += 2;
  else bearishPoints += 2;

  if (currentPrice > mas.ma200) bullishPoints += 2;
  else bearishPoints += 2;

  // MA alignment (faster above slower)
  if (mas.ma20 > mas.ma50) bullishPoints += 1.5;
  else bearishPoints += 1.5;

  if (mas.ma50 > mas.ma200) bullishPoints += 1.5;
  else bearishPoints += 1.5;

  // Determine trend
  let trend = 'neutral';
  if (bullishPoints > bearishPoints + 2) trend = 'bullish';
  else if (bearishPoints > bullishPoints + 2) trend = 'bearish';

  // Calculate strength (0-100)
  const strength = Math.min(100, Math.abs(bullishPoints - bearishPoints) * 10);

  return { trend, strength };
}

/**
 * Complete technical snapshot
 * Comprehensive single-call analysis combining all indicators
 * @param {Array<{time, open, high, low, close, volume}>} candles - Full OHLC candles
 * @returns {Object} Complete technical analysis snapshot
 */
export function technicalSnapshot(candles) {
  if (candles.length < 200) {
    return {
      error: 'Insufficient data (need 200+ candles)',
      rsi: null,
      macd: null,
      bollingerBands: null,
      atr: null,
      vwap: null,
      movingAverages: null,
      supportResistance: null,
      stochastic: null,
      trend: null,
      obv: null
    };
  }

  const closes = candles.map(c => c.close);

  // Calculate all indicators
  const rsiData = RSI(closes);
  const macdData = MACD(closes);
  const bbData = BollingerBands(closes);
  const atrData = ATR(candles);
  const vwapData = VWAP(candles);
  const stochData = Stochastic(candles);
  const obvData = OBV(candles);

  // Extract last valid values
  const getLastValue = (arr) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].value !== null) return arr[i].value;
    }
    return null;
  };

  const getLastObject = (arr, keys) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      const obj = {};
      let hasValue = false;
      for (const key of keys) {
        obj[key] = arr[i][key];
        if (arr[i][key] !== null) hasValue = true;
      }
      if (hasValue) return obj;
    }
    return null;
  };

  const rsi = getLastValue(rsiData);
  const macdLast = getLastObject(macdData, ['macd', 'signal', 'histogram']);
  const bbLast = getLastObject(bbData, ['upper', 'middle', 'lower', 'percentB']);
  const atr = getLastValue(atrData);
  const vwap = getLastValue(vwapData);
  const mas = MovingAverages(closes);
  const sr = findSupportResistance(candles);
  const stochLast = getLastObject(stochData, ['k', 'd']);
  const trend = trendStrength(closes);
  const obv = getLastValue(obvData);

  return {
    rsi,
    macd: macdLast ? {
      macd: macdLast.macd,
      signal: macdLast.signal,
      histogram: macdLast.histogram
    } : null,
    bollingerBands: bbLast ? {
      upper: bbLast.upper,
      middle: bbLast.middle,
      lower: bbLast.lower,
      percentB: bbLast.percentB
    } : null,
    atr,
    vwap,
    movingAverages: mas,
    supportResistance: sr,
    stochastic: stochLast ? {
      k: stochLast.k,
      d: stochLast.d
    } : null,
    trend,
    obv
  };
}
