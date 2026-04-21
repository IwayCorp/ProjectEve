// positionSizer.js — Dynamic position sizing for Edge Runtime
// Pure JavaScript, no external dependencies

// ============ HELPER FUNCTIONS ============

function computeKelly(winRate, avgWinLoss, atrPercentile, regime) {
  // Kelly Criterion: f* = (p * b - q) / b
  // p = win rate, q = loss rate (1-p), b = avg win/loss ratio
  if (winRate <= 0 || winRate >= 1) return 0.25;
  const q = 1 - winRate;
  const b = avgWinLoss;
  const rawKelly = (winRate * b - q) / b;

  // Dynamic fractional Kelly: scale between 0.15-0.35 based on volatility regime
  // High ATR percentile = high vol = lower Kelly fraction (more conservative)
  // kelly_base * (1 - atr_pctile/100 * 0.4)
  const atrPct = typeof atrPercentile === 'number' ? Math.max(0, Math.min(100, atrPercentile)) : 50;
  const volScaleFactor = 1 - (atrPct / 100) * 0.4; // Range: 0.6 (high vol) to 1.0 (low vol)

  // Regime-based Kelly ceiling
  let kellyCeiling = 0.35;
  if (regime === 'volatile-transition') kellyCeiling = 0.20;
  else if (regime === 'mean-reverting') kellyCeiling = 0.28;
  else if (regime === 'trending-bear') kellyCeiling = 0.30;
  // trending-bull keeps 0.35

  const dynamicKelly = rawKelly * 0.5 * volScaleFactor; // Half-Kelly * vol adjustment
  return Math.max(0.15, Math.min(kellyCeiling, dynamicKelly));
}

function getVolatilityScalar(volatilityRegime, atrPercentile) {
  // Continuous volatility scaling instead of fixed tiers
  // Base on ATR percentile for smoother adjustment
  if (typeof atrPercentile === 'number') {
    // Linear interpolation: pctile 0 → 1.25, pctile 50 → 1.0, pctile 100 → 0.60
    if (atrPercentile <= 50) {
      return 1.0 + (50 - atrPercentile) / 50 * 0.25; // 1.0 to 1.25
    } else {
      return 1.0 - (atrPercentile - 50) / 50 * 0.40; // 1.0 to 0.60
    }
  }
  // Fallback to categorical
  const scalars = {
    'low': 1.2,
    'normal': 1.0,
    'high': 0.7
  };
  return scalars[volatilityRegime] || 1.0;
}

function getRegimeScalar(regime) {
  // Adjust size based on market regime
  const scalars = {
    'trending-bull': 1.15,
    'trending-bear': 1.05,
    'mean-reverting': 0.85,
    'volatile-transition': 0.55
  };
  return scalars[regime] || 1.0;
}

function confidenceScalar(confidence) {
  // Non-linear: penalize low confidence more aggressively
  // Below 50: steep dropoff; above 70: near full sizing
  const normalized = Math.max(0, Math.min(100, confidence)) / 100;
  if (normalized < 0.5) return 0.2 + normalized * 0.6; // 0.2 to 0.5
  if (normalized < 0.7) return 0.5 + (normalized - 0.5) * 1.5; // 0.5 to 0.8
  return 0.8 + (normalized - 0.7) * 0.67; // 0.8 to 1.0
}

// ============ STOP LOSS ENGINE ============

export function computeAdaptiveStop(params) {
  // Dynamic stop distance based on lifecycle progress and volatility
  const {
    direction,           // 'long' or 'short'
    entryPrice,
    currentPrice,
    atr,
    atrPercentile = 50,
    hoursHeld = 0,
    lifecycleHours = 96, // 4-day default
    regime = 'unknown'
  } = params;

  if (!entryPrice || !currentPrice || !atr || atr <= 0) {
    return { stopDistance: atr || 0, stopPrice: 0, tightened: false };
  }

  const lifecycleProgress = Math.min(1, hoursHeld / lifecycleHours);

  // Base stop: 1.5 ATR, adjusted by vol percentile
  const volMult = atrPercentile > 75 ? 1.25 : atrPercentile < 25 ? 0.85 : 1.0;
  let baseStopATR = 1.5 * volMult;

  // Trailing stop tightening in last 25% of lifecycle
  // Rationale: as expiry nears, tighten to lock profits or cut losses faster
  // Tighten from 1.5 ATR → 0.8 ATR over the last 25% of the hold period
  let tightened = false;
  if (lifecycleProgress > 0.75) {
    const tightenProgress = (lifecycleProgress - 0.75) / 0.25; // 0 to 1 over last 25%
    baseStopATR = baseStopATR * (1 - tightenProgress * 0.47); // 1.5 → ~0.8 ATR
    tightened = true;
  }

  // Regime adjustment: wider in volatile transitions, tighter in strong trends
  if (regime === 'volatile-transition') baseStopATR *= 1.15;
  else if (regime === 'trending-bull' || regime === 'trending-bear') baseStopATR *= 0.90;

  const stopDistance = atr * baseStopATR;

  // Trailing: only move stop in favorable direction
  let stopPrice;
  if (direction === 'long') {
    stopPrice = currentPrice - stopDistance;
    // Never move stop below entry - atr * 2 (catastrophic protection)
    stopPrice = Math.max(stopPrice, entryPrice - atr * 2);
  } else {
    stopPrice = currentPrice + stopDistance;
    stopPrice = Math.min(stopPrice, entryPrice + atr * 2);
  }

  return {
    stopDistance: Math.round(stopDistance * 10000) / 10000,
    stopPrice: Math.round(stopPrice * 10000) / 10000,
    stopATRMultiple: Math.round(baseStopATR * 100) / 100,
    lifecycleProgress: Math.round(lifecycleProgress * 100),
    tightened
  };
}

// ============ POSITION SIZING ENGINE ============

export function computePositionSize(params) {
  // Defaults
  const price = params.price;
  const atr = params.atr;
  const confidence = params.confidence || 50;
  const regime = params.regime || {};
  const portfolioValue = params.portfolioValue || 100000;
  const maxRiskPct = (params.maxRiskPct || 2) / 100;
  const maxPositionPct = (params.maxPositionPct || 10) / 100;
  const winRate = params.winRate || 0.55;
  const avgWinLoss = params.avgWinLoss || 1.5;
  const volatilityRegime = params.volatilityRegime || 'normal';
  const atrPercentile = params.atrPercentile || 50;

  // Validate inputs
  if (!price || price <= 0 || !atr || atr <= 0) {
    return {
      recommendedSize: 0,
      dollarAmount: 0,
      riskPerTrade: 0,
      kellyFraction: 0,
      atrStopDistance: 0,
      methods: { kelly: 0, atrBased: 0, volAdjusted: 0, confidenceScaled: 0 },
      positionPctOfPortfolio: 0,
      maxLoss: 0,
      riskRewardRatio: 0,
      sizing: 'neutral'
    };
  }

  const currentRegime = regime.currentRegime || 'unknown';

  // ===== METHOD 1: Dynamic Kelly Criterion =====
  const kellyFrac = computeKelly(winRate, avgWinLoss, atrPercentile, currentRegime);
  const riskPerTradeKelly = portfolioValue * kellyFrac * maxRiskPct;
  const sizeKelly = riskPerTradeKelly / atr;

  // ===== METHOD 2: ATR-Based (Turtle Trading) =====
  const riskPerTradeATR = portfolioValue * maxRiskPct;
  const sizeATR = riskPerTradeATR / atr;

  // ===== METHOD 3: Volatility-Adjusted (continuous) =====
  const volScalar = getVolatilityScalar(volatilityRegime, atrPercentile);
  const sizeVolAdjusted = sizeATR * volScalar;

  // ===== METHOD 4: Confidence-Scaled (non-linear) =====
  const confScalar = confidenceScalar(confidence);
  const sizeConfScaled = sizeATR * confScalar;

  // ===== REGIME ADJUSTMENT =====
  const regimeScalar = getRegimeScalar(currentRegime);
  const baseSize = sizeATR * regimeScalar;

  // ===== APPLY ALL ADJUSTMENTS =====
  const methodSizes = {
    kelly: sizeKelly,
    atrBased: sizeATR,
    volAdjusted: sizeVolAdjusted,
    confidenceScaled: sizeConfScaled
  };

  // Weighted recommendation: Kelly gets more influence in known regimes
  const kellyWeight = currentRegime !== 'unknown' ? 0.30 : 0.20;
  const atrWeight = 0.25;
  const volWeight = 0.25;
  const confWeight = 1 - kellyWeight - atrWeight - volWeight;

  const recommendedSize = (
    sizeKelly * kellyWeight +
    sizeATR * atrWeight +
    sizeVolAdjusted * volWeight +
    sizeConfScaled * confWeight
  ) * regimeScalar;

  // ===== APPLY POSITION LIMITS =====
  const maxPositionSize = (portfolioValue / price) * maxPositionPct;
  const finalSize = Math.min(recommendedSize, maxPositionSize);
  const dollarAmount = finalSize * price;

  // ===== RISK METRICS =====
  const atrStopDistance = atr;
  const maxLoss = finalSize * atrStopDistance;
  const riskPerTrade = Math.min(maxLoss, riskPerTradeATR);
  const positionPctOfPortfolio = (dollarAmount / portfolioValue) * 100;

  // Risk-reward ratio: assume 2:1 target (profit = 2x risk)
  const targetProfit = riskPerTrade * 2;
  const riskRewardRatio = targetProfit > 0 ? targetProfit / riskPerTrade : 2.0;

  // ===== SIZING CLASSIFICATION =====
  let sizing = 'normal';
  if (finalSize > maxPositionSize * 0.8) sizing = 'aggressive';
  if (finalSize < maxPositionSize * 0.4) sizing = 'conservative';

  // ===== REGIME GATE SOFTENING =====
  // Instead of blocking shorts in bull or longs in bear (handled in signal gen),
  // provide a confidence penalty indicator for the caller
  let regimeConfidencePenalty = 0;
  if (params.direction && regime.trend) {
    const fighting = (regime.trend === 'bullish' && params.direction === 'short') ||
                     (regime.trend === 'bearish' && params.direction === 'long');
    if (fighting) {
      regimeConfidencePenalty = currentRegime === 'volatile-transition' ? 20 : 12;
    }
  }

  return {
    recommendedSize: Math.floor(finalSize),
    dollarAmount: Math.round(dollarAmount),
    riskPerTrade: Math.round(riskPerTrade),
    kellyFraction: Math.round(kellyFrac * 100) / 100,
    atrStopDistance: Math.round(atrStopDistance * 10000) / 10000,
    methods: {
      kelly: Math.floor(sizeKelly),
      atrBased: Math.floor(sizeATR),
      volAdjusted: Math.floor(sizeVolAdjusted),
      confidenceScaled: Math.floor(sizeConfScaled)
    },
    positionPctOfPortfolio: Math.round(positionPctOfPortfolio * 10) / 10,
    maxLoss: Math.round(maxLoss),
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    sizing,
    regimeConfidencePenalty,
    dynamicKellyRange: '0.15-0.35',
    atrPercentileUsed: atrPercentile,
    volScalar: Math.round(volScalar * 100) / 100
  };
}
