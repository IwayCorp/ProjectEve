export function computeAlphaFactors(candles, closes) {
  if (!closes || closes.length < 60) return null;

  // Helper: Simple Moving Average
  const sma = (arr, period) => {
    if (arr.length < period) return null;
    const sum = arr.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  };

  // Helper: Exponential Moving Average
  const ema = (arr, period) => {
    if (arr.length < period) return null;
    let result = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const multiplier = 2 / (period + 1);
    for (let i = period; i < arr.length; i++) {
      result = arr[i] * multiplier + result * (1 - multiplier);
    }
    return result;
  };

  // Helper: Standard Deviation
  const stdev = (arr, period = arr.length) => {
    if (arr.length < period) return 0;
    const slice = arr.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    return Math.sqrt(variance);
  };

  // Helper: Correlation
  const correlation = (arr1, arr2) => {
    if (arr1.length < 2 || arr1.length !== arr2.length) return 0;
    const n = arr1.length;
    const mean1 = arr1.reduce((a, b) => a + b, 0) / n;
    const mean2 = arr2.reduce((a, b) => a + b, 0) / n;
    let numerator = 0, denom1 = 0, denom2 = 0;
    for (let i = 0; i < n; i++) {
      const d1 = arr1[i] - mean1, d2 = arr2[i] - mean2;
      numerator += d1 * d2;
      denom1 += d1 * d1;
      denom2 += d2 * d2;
    }
    return denom1 === 0 || denom2 === 0 ? 0 : numerator / Math.sqrt(denom1 * denom2);
  };

  // Helper: RSI
  const rsi = (prices, period) => {
    if (prices.length < period + 1) return null;
    let avgGain = 0, avgLoss = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) avgGain += change;
      else avgLoss -= change;
    }
    avgGain /= period;
    avgLoss /= period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // Helper: ATR
  const atr = (candles, period) => {
    if (candles.length < period) return null;
    let trSum = 0;
    const slice = candles.slice(-period);
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const prevClose = i === 0 ? (candles[candles.length - period - 1]?.close || c.close) : slice[i - 1].close;
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - prevClose),
        Math.abs(c.low - prevClose)
      );
      trSum += tr;
    }
    return trSum / period;
  };

  const lastCandle = candles[candles.length - 1];
  const lastClose = closes[closes.length - 1];
  const prevClose = closes.length > 1 ? closes[closes.length - 2] : lastClose;

  // ============ MOMENTUM FACTORS ============
  const momentum = {};

  // Rate of Change
  momentum.mom_roc5 = closes.length > 5 ? ((lastClose - closes[closes.length - 6]) / closes[closes.length - 6]) * 100 : null;
  momentum.mom_roc10 = closes.length > 10 ? ((lastClose - closes[closes.length - 11]) / closes[closes.length - 11]) * 100 : null;
  momentum.mom_roc20 = closes.length > 20 ? ((lastClose - closes[closes.length - 21]) / closes[closes.length - 21]) * 100 : null;

  // RSI variants
  momentum.mom_rsi6 = rsi(closes, 6);
  momentum.mom_rsi14 = rsi(closes, 14);
  momentum.mom_rsi28 = rsi(closes, 28);

  // Stochastic %K
  if (closes.length >= 14) {
    const lowSlice = candles.slice(-14);
    const highSlice = candles.slice(-14);
    const low14 = Math.min(...lowSlice.map(c => c.low));
    const high14 = Math.max(...highSlice.map(c => c.high));
    momentum.mom_stoch = high14 === low14 ? 50 : ((lastClose - low14) / (high14 - low14)) * 100;
  } else {
    momentum.mom_stoch = null;
  }

  // Williams %R
  if (closes.length >= 14) {
    const lowSlice = candles.slice(-14);
    const highSlice = candles.slice(-14);
    const low14 = Math.min(...lowSlice.map(c => c.low));
    const high14 = Math.max(...highSlice.map(c => c.high));
    momentum.mom_williamsR = high14 === low14 ? -50 : (((high14 - lastClose) / (high14 - low14)) * 100) - 100;
  } else {
    momentum.mom_williamsR = null;
  }

  // True Strength Index (25,13)
  if (closes.length >= 50) {
    const deltas = [];
    for (let i = 1; i < closes.length; i++) {
      deltas.push(closes[i] - closes[i - 1]);
    }
    const ema25 = ema(deltas, 25);
    const ema25Abs = ema(deltas.map(d => Math.abs(d)), 25);
    const ema13 = closes.length > 50 ? ema(deltas.slice(-25).map(d => Math.abs(d)), 13) : null;
    momentum.mom_tsi = ema25 && ema25Abs && ema13 && ema25Abs !== 0 ? (100 * ema25 / ema25Abs) : null;
  } else {
    momentum.mom_tsi = null;
  }

  // Chande Momentum Oscillator
  if (closes.length >= 15) {
    let upSum = 0, downSum = 0;
    const slice = closes.slice(-14);
    for (let i = 1; i < slice.length; i++) {
      const change = slice[i] - slice[i - 1];
      if (change > 0) upSum += change;
      else downSum -= change;
    }
    const total = upSum + downSum;
    momentum.mom_cmo = total > 0 ? ((upSum - downSum) / total) * 100 : 0;
  } else {
    momentum.mom_cmo = null;
  }

  // ============ MEAN REVERSION FACTORS ============
  const meanReversion = {};

  // Bollinger Band %B
  if (closes.length >= 20) {
    const ma20 = sma(closes, 20);
    const std20 = stdev(closes, 20);
    const upperBand = ma20 + (std20 * 2);
    const lowerBand = ma20 - (std20 * 2);
    meanReversion.mr_bbPctB = std20 > 0 ? (lastClose - lowerBand) / (upperBand - lowerBand) : 0.5;
  } else {
    meanReversion.mr_bbPctB = null;
  }

  // Z-scores
  if (closes.length >= 20) {
    const ma20 = sma(closes, 20);
    const std20 = stdev(closes, 20);
    meanReversion.mr_zscore20 = std20 > 0 ? (lastClose - ma20) / std20 : 0;
  } else {
    meanReversion.mr_zscore20 = null;
  }

  if (closes.length >= 60) {
    const ma60 = sma(closes, 60);
    const std60 = stdev(closes, 60);
    meanReversion.mr_zscore60 = std60 > 0 ? (lastClose - ma60) / std60 : 0;
  } else {
    meanReversion.mr_zscore60 = null;
  }

  // Distance from VWAP (approximation)
  if (closes.length >= 20 && candles.length >= 20) {
    let vwapNum = 0, vwapDen = 0;
    for (let i = Math.max(0, candles.length - 20); i < candles.length; i++) {
      const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
      vwapNum += tp * candles[i].volume;
      vwapDen += candles[i].volume;
    }
    const vwap = vwapDen > 0 ? vwapNum / vwapDen : lastClose;
    meanReversion.mr_distFromVWAP = ((lastClose - vwap) / vwap) * 100;
  } else {
    meanReversion.mr_distFromVWAP = null;
  }

  // RSI Divergence (price higher but RSI lower = bearish, vice versa)
  if (closes.length >= 30) {
    const rsi14 = rsi(closes, 14);
    const rsi14Prev = rsi(closes.slice(0, -1), 14);
    const priceMom = lastClose > prevClose ? 1 : lastClose < prevClose ? -1 : 0;
    const rsiMom = rsi14 && rsi14Prev ? (rsi14 > rsi14Prev ? 1 : rsi14 < rsi14Prev ? -1 : 0) : 0;
    meanReversion.mr_rsiDivergence = priceMom !== rsiMom && priceMom !== 0 ? priceMom * -1 : 0;
  } else {
    meanReversion.mr_rsiDivergence = null;
  }

  // Composite Mean Reversion Score
  const mrComps = [meanReversion.mr_bbPctB, meanReversion.mr_zscore20, meanReversion.mr_zscore60];
  if (mrComps.some(x => x !== null)) {
    let mrScore = 0;
    if (meanReversion.mr_bbPctB !== null) mrScore += (meanReversion.mr_bbPctB - 0.5) * 100;
    if (meanReversion.mr_zscore20 !== null) mrScore += Math.min(Math.max(meanReversion.mr_zscore20 * 20, -100), 100) * 0.5;
    meanReversion.mr_meanRevScore = Math.min(Math.max(mrScore / 2, -100), 100);
  } else {
    meanReversion.mr_meanRevScore = null;
  }

  // ============ VOLATILITY FACTORS ============
  const volatility = {};

  const atr14 = atr(candles, 14);
  volatility.vol_atrPct = atr14 ? (atr14 / lastClose) * 100 : null;

  // Historical Volatility (log returns, annualized)
  if (closes.length >= 20) {
    const returns20 = [];
    for (let i = Math.max(1, closes.length - 20); i < closes.length; i++) {
      returns20.push(Math.log(closes[i] / closes[i - 1]));
    }
    const hvol20 = stdev(returns20);
    volatility.vol_hvol20 = hvol20 * Math.sqrt(252) * 100;
  } else {
    volatility.vol_hvol20 = null;
  }

  if (closes.length >= 60) {
    const returns60 = [];
    for (let i = Math.max(1, closes.length - 60); i < closes.length; i++) {
      returns60.push(Math.log(closes[i] / closes[i - 1]));
    }
    const hvol60 = stdev(returns60);
    volatility.vol_hvol60 = hvol60 * Math.sqrt(252) * 100;
  } else {
    volatility.vol_hvol60 = null;
  }

  // Vol Ratio
  volatility.vol_volRatio = volatility.vol_hvol20 && volatility.vol_hvol60 && volatility.vol_hvol60 > 0
    ? volatility.vol_hvol20 / volatility.vol_hvol60
    : null;

  // Range Expansion
  if (closes.length >= 10 && candles.length >= 10) {
    const todayRange = lastCandle.high - lastCandle.low;
    const avgRange10 = candles.slice(-10).reduce((sum, c) => sum + (c.high - c.low), 0) / 10;
    volatility.vol_rangeExpansion = avgRange10 > 0 ? (todayRange / avgRange10 - 1) * 100 : 0;
  } else {
    volatility.vol_rangeExpansion = null;
  }

  // Garman-Klass Volatility
  if (candles.length >= 1) {
    const c = lastCandle;
    const hl = Math.log(c.high / c.low);
    const co = Math.log(c.close / c.open);
    const gkVol = Math.sqrt(0.5 * hl * hl - (2 * Math.log(2) - 1) * co * co);
    volatility.vol_gkVol = gkVol * 100;
  } else {
    volatility.vol_gkVol = null;
  }

  // Parkinson Volatility
  if (candles.length >= 1) {
    const c = lastCandle;
    const pk = Math.log(c.high / c.low) / (4 * Math.log(2));
    volatility.vol_parkinson = pk * 100;
  } else {
    volatility.vol_parkinson = null;
  }

  // ============ VOLUME FACTORS ============
  const volumeFactors = {};

  // On-Balance Volume (OBV) - rate of change
  if (closes.length >= 2 && candles.length >= 2) {
    let obv = 0;
    for (let i = Math.max(0, candles.length - 20); i < candles.length; i++) {
      const sign = closes[i] > closes[i - 1] ? 1 : closes[i] < closes[i - 1] ? -1 : 0;
      obv += sign * candles[i].volume;
    }
    const obvPrev = obv - (lastClose > prevClose ? 1 : lastClose < prevClose ? -1 : 0) * lastCandle.volume;
    volumeFactors.vf_obv = obvPrev !== 0 ? ((obv - obvPrev) / Math.abs(obvPrev)) * 100 : 0;
  } else {
    volumeFactors.vf_obv = null;
  }

  // Accumulation/Distribution Line
  if (closes.length >= 2 && candles.length >= 2) {
    let adl = 0;
    const slice = candles.slice(-20);
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const clv = (c.close - c.low) - (c.high - c.close);
      const range = c.high - c.low;
      const clf = range > 0 ? clv / range : 0;
      adl += clf * c.volume;
    }
    const adlPrev = adl - ((lastClose - lastCandle.low) - (lastCandle.high - lastClose)) / (lastCandle.high - lastCandle.low) * lastCandle.volume;
    volumeFactors.vf_adLine = adlPrev !== 0 ? ((adl - adlPrev) / Math.abs(adlPrev)) * 100 : 0;
  } else {
    volumeFactors.vf_adLine = null;
  }

  // Money Flow Index (14-period)
  if (closes.length >= 14 && candles.length >= 14) {
    let positiveFlow = 0, negativeFlow = 0;
    const slice = candles.slice(-14);
    const closesSlice = closes.slice(-14);
    for (let i = 0; i < slice.length; i++) {
      const tp = (slice[i].high + slice[i].low + closesSlice[i]) / 3;
      const mf = tp * slice[i].volume;
      if (i === 0 || closesSlice[i] > closesSlice[i - 1]) positiveFlow += mf;
      else if (closesSlice[i] < closesSlice[i - 1]) negativeFlow += mf;
    }
    const mr = negativeFlow > 0 ? positiveFlow / negativeFlow : positiveFlow > 0 ? 100 : 0;
    volumeFactors.vf_mfi14 = 100 - (100 / (1 + mr));
  } else {
    volumeFactors.vf_mfi14 = null;
  }

  // Volume Price Trend
  if (closes.length >= 2) {
    const pc = ((lastClose - prevClose) / prevClose) * 100;
    const vptChange = (pc / 100) * lastCandle.volume;
    const vptPrev = closes.length > 21 ? ((closes[closes.length - 2] - closes[closes.length - 21]) / closes[closes.length - 21]) * candles[candles.length - 2].volume : vptChange;
    volumeFactors.vf_vpt = vptPrev !== 0 ? ((vptChange - vptPrev) / Math.abs(vptPrev)) * 100 : 0;
  } else {
    volumeFactors.vf_vpt = null;
  }

  // Force Index (13-period EMA)
  if (closes.length >= 14 && candles.length >= 14) {
    const rawForce = [];
    for (let i = Math.max(1, candles.length - 13); i < candles.length; i++) {
      const change = closes[i] - closes[i - 1];
      rawForce.push(change * candles[i].volume);
    }
    const forceEma = ema(rawForce, 13);
    volumeFactors.vf_forceIndex = forceEma ? Math.min(Math.max(forceEma / 1000000, -100), 100) : null;
  } else {
    volumeFactors.vf_forceIndex = null;
  }

  // Volume Momentum
  if (closes.length >= 20 && candles.length >= 20) {
    const vol5 = candles.slice(-5).reduce((s, c) => s + c.volume, 0) / 5;
    const vol20 = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
    volumeFactors.vf_volMomentum = vol20 > 0 ? (vol5 / vol20 - 1) * 100 : 0;
  } else {
    volumeFactors.vf_volMomentum = null;
  }

  // Price-Volume Correlation (20-day)
  if (closes.length >= 20 && candles.length >= 20) {
    const priceSlice = closes.slice(-20);
    const volSlice = candles.slice(-20).map(c => c.volume);
    volumeFactors.vf_priceVolCorr = correlation(priceSlice, volSlice) * 100;
  } else {
    volumeFactors.vf_priceVolCorr = null;
  }

  // ============ TREND FACTORS ============
  const trend = {};

  // ADX (Simplified)
  if (closes.length >= 15 && candles.length >= 15) {
    const dmPlus = [], dmMinus = [];
    for (let i = candles.length - 14; i < candles.length; i++) {
      const up = candles[i].high - candles[i - 1].high;
      const down = candles[i - 1].low - candles[i].low;
      dmPlus.push(up > down && up > 0 ? up : 0);
      dmMinus.push(down > up && down > 0 ? down : 0);
    }
    const trSlice = candles.slice(-14);
    let trSum = 0;
    for (let i = 1; i < trSlice.length; i++) {
      const tr = Math.max(
        trSlice[i].high - trSlice[i].low,
        Math.abs(trSlice[i].high - trSlice[i - 1].close),
        Math.abs(trSlice[i].low - trSlice[i - 1].close)
      );
      trSum += tr;
    }
    const atr = trSum / 14;
    const diPlus = (dmPlus.reduce((a, b) => a + b, 0) / atr) * 100;
    const diMinus = (dmMinus.reduce((a, b) => a + b, 0) / atr) * 100;
    const di = Math.abs(diPlus - diMinus) / (diPlus + diMinus);
    trend.tr_adx = Math.min((di * 100), 100);
  } else {
    trend.tr_adx = null;
  }

  // Trend Strength (composite)
  if (trend.tr_adx !== null && closes.length >= 20) {
    const ma20 = sma(closes, 20);
    const ma50 = closes.length >= 50 ? sma(closes, 50) : ma20;
    const maAlignment = lastClose > ma20 && ma20 > ma50 ? 1 : lastClose < ma20 && ma20 < ma50 ? -1 : 0;
    const returns20 = [];
    for (let i = Math.max(1, closes.length - 20); i < closes.length; i++) {
      returns20.push(closes[i] - closes[i - 1]);
    }
    const hurst = returns20.filter(r => r > 0).length / returns20.length - 0.5;
    trend.tr_trendStrength = (trend.tr_adx * 0.6 + Math.abs(hurst) * 30 + maAlignment * 20);
  } else {
    trend.tr_trendStrength = null;
  }

  // SuperTrend
  if (atr14 !== null) {
    const hl2 = (lastCandle.high + lastCandle.low) / 2;
    const basicUpperBand = hl2 + atr14 * 3;
    const basicLowerBand = hl2 - atr14 * 3;
    const superTrendValue = lastClose > basicUpperBand ? basicUpperBand : lastClose < basicLowerBand ? basicLowerBand : hl2;
    trend.tr_superTrend = ((lastClose - superTrendValue) / superTrendValue) * 100;
  } else {
    trend.tr_superTrend = null;
  }

  // Ichimoku Cloud (simplified: Tenkan-Kijun)
  if (closes.length >= 26 && candles.length >= 26) {
    const high9 = Math.max(...candles.slice(-9).map(c => c.high));
    const low9 = Math.min(...candles.slice(-9).map(c => c.low));
    const tenkan = (high9 + low9) / 2;
    const high26 = Math.max(...candles.slice(-26).map(c => c.high));
    const low26 = Math.min(...candles.slice(-26).map(c => c.low));
    const kijun = (high26 + low26) / 2;
    const senkou = (tenkan + kijun) / 2;
    trend.tr_ichimokuCloud = ((lastClose - senkou) / senkou) * 100;
  } else {
    trend.tr_ichimokuCloud = null;
  }

  // Aroon Oscillator
  if (closes.length >= 26 && candles.length >= 26) {
    const highIdx = candles.slice(-25).reduce((maxI, c, i, arr) => c.high > arr[maxI].high ? i : maxI, 0);
    const lowIdx = candles.slice(-25).reduce((minI, c, i, arr) => c.low < arr[minI].low ? i : minI, 0);
    const aroonUp = ((25 - highIdx) / 25) * 100;
    const aroonDn = ((25 - lowIdx) / 25) * 100;
    trend.tr_aroon = aroonUp - aroonDn;
  } else {
    trend.tr_aroon = null;
  }

  // Detrended Price Oscillator
  if (closes.length >= 22) {
    const ma20 = sma(closes, 20);
    const dpo = lastClose - ma20;
    trend.tr_dpo = ma20 ? (dpo / ma20) * 100 : 0;
  } else {
    trend.tr_dpo = null;
  }

  // ============ PATTERN FACTORS ============
  const patterns = {};

  // Inside Bar
  patterns.pat_insideBar = candles.length >= 2 &&
    lastCandle.high < candles[candles.length - 2].high &&
    lastCandle.low > candles[candles.length - 2].low ? 1 : 0;

  // Engulfing
  if (candles.length >= 2) {
    const prev = candles[candles.length - 2];
    const bullishEngulf = lastCandle.close > lastCandle.open && lastCandle.open < prev.close && lastCandle.close > prev.open;
    const bearishEngulf = lastCandle.close < lastCandle.open && lastCandle.open > prev.close && lastCandle.close < prev.open;
    patterns.pat_engulfing = bullishEngulf ? 1 : bearishEngulf ? -1 : 0;
  } else {
    patterns.pat_engulfing = 0;
  }

  // Hammer
  const bodySize = Math.abs(lastCandle.close - lastCandle.open);
  const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
  const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  if (bodySize > 0) {
    const hammered = lowerWick > bodySize * 2 && upperWick < bodySize;
    const hangman = upperWick > bodySize * 2 && lowerWick < bodySize;
    patterns.pat_hammer = hammered ? 1 : hangman ? -1 : 0;
  } else {
    patterns.pat_hammer = 0;
  }

  // Gap %
  patterns.pat_gapPct = prevClose > 0 ? ((lastCandle.open - prevClose) / prevClose) * 100 : 0;

  // Body to Wick Ratio
  patterns.pat_bodyToWick = bodySize > 0 ? bodySize / (lastCandle.high - lastCandle.low) : 0;

  // Higher Highs
  if (candles.length >= 5) {
    let hhCount = 0;
    const slice = candles.slice(-5);
    for (let i = 1; i < slice.length; i++) {
      if (slice[i].high > slice[i - 1].high) hhCount++;
      else break;
    }
    patterns.pat_higherHighs = hhCount;
  } else {
    patterns.pat_higherHighs = 0;
  }

  // Lower Lows
  if (candles.length >= 5) {
    let llCount = 0;
    const slice = candles.slice(-5);
    for (let i = 1; i < slice.length; i++) {
      if (slice[i].low < slice[i - 1].low) llCount++;
      else break;
    }
    patterns.pat_lowerLows = llCount;
  } else {
    patterns.pat_lowerLows = 0;
  }

  // ============ COMPOSITE ALPHA SCORES ============
  const composite = {};

  // Momentum Composite
  const momComps = [
    momentum.mom_roc5, momentum.mom_roc10, momentum.mom_roc20,
    momentum.mom_rsi14, momentum.mom_stoch, momentum.mom_williamsR, momentum.mom_tsi, momentum.mom_cmo
  ];
  if (momComps.some(x => x !== null)) {
    let momScore = 0;
    let momCount = 0;
    if (momentum.mom_roc20 !== null) { momScore += Math.min(Math.max(momentum.mom_roc20 / 2, -100), 100); momCount++; }
    if (momentum.mom_rsi14 !== null) { momScore += (momentum.mom_rsi14 - 50) * 2; momCount++; }
    if (momentum.mom_stoch !== null) { momScore += (momentum.mom_stoch - 50) / 2.5; momCount++; }
    if (momentum.mom_cmo !== null) { momScore += momentum.mom_cmo; momCount++; }
    composite.alpha_momentum = momCount > 0 ? Math.min(Math.max(momScore / momCount, -100), 100) : 0;
  } else {
    composite.alpha_momentum = null;
  }

  // Mean Reversion Composite
  const mrCompsScore = [
    meanReversion.mr_bbPctB !== null ? (meanReversion.mr_bbPctB - 0.5) * 100 : null,
    meanReversion.mr_zscore20,
    meanReversion.mr_meanRevScore
  ];
  if (mrCompsScore.some(x => x !== null)) {
    composite.alpha_meanReversion = meanReversion.mr_meanRevScore || 0;
  } else {
    composite.alpha_meanReversion = null;
  }

  // Volatility Regime Score
  if (volatility.vol_hvol20 !== null) {
    const lowVol = 10, normalVol = 20, highVol = 40;
    const normalized = (volatility.vol_hvol20 - lowVol) / (highVol - lowVol);
    composite.alpha_volatility = Math.min(Math.max(normalized * 100, 0), 100);
  } else {
    composite.alpha_volatility = null;
  }

  // Volume Conviction Score
  if (volumeFactors.vf_mfi14 !== null || volumeFactors.vf_volMomentum !== null) {
    let volScore = 0;
    let volCount = 0;
    if (volumeFactors.vf_mfi14 !== null) { volScore += (volumeFactors.vf_mfi14 - 50) * 2; volCount++; }
    if (volumeFactors.vf_volMomentum !== null) { volScore += Math.min(Math.max(volumeFactors.vf_volMomentum / 2, -100), 100); volCount++; }
    composite.alpha_volume = volCount > 0 ? Math.min(Math.max(volScore / volCount, -100), 100) : 0;
  } else {
    composite.alpha_volume = null;
  }

  // Trend Composite
  if (trend.tr_adx !== null && trend.tr_trendStrength !== null) {
    const trendScore = (trend.tr_adx / 100) * 50 + (trend.tr_trendStrength / 50) * 50;
    composite.alpha_trend = Math.min(Math.max(trendScore, -100), 100);
  } else if (trend.tr_adx !== null) {
    composite.alpha_trend = Math.min(Math.max((trend.tr_adx / 100) * 100, -100), 100);
  } else {
    composite.alpha_trend = null;
  }

  // Master Alpha Score
  const allComposites = [
    composite.alpha_momentum,
    composite.alpha_meanReversion,
    composite.alpha_volume,
    composite.alpha_trend
  ];
  if (allComposites.some(x => x !== null)) {
    let masterScore = 0;
    let masterCount = 0;
    if (composite.alpha_momentum !== null) { masterScore += composite.alpha_momentum * 0.3; masterCount++; }
    if (composite.alpha_meanReversion !== null) { masterScore += composite.alpha_meanReversion * 0.2; masterCount++; }
    if (composite.alpha_volume !== null) { masterScore += composite.alpha_volume * 0.2; masterCount++; }
    if (composite.alpha_trend !== null) { masterScore += composite.alpha_trend * 0.3; masterCount++; }
    composite.alpha_composite = masterCount > 0 ? Math.min(Math.max(masterScore, -100), 100) : 0;
  } else {
    composite.alpha_composite = null;
  }

  return {
    momentum,
    meanReversion,
    volatility,
    volume: volumeFactors,
    trend,
    patterns,
    composite
  };
}
