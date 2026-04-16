// positionSizer.js — Dynamic position sizing for Edge Runtime
// Pure JavaScript, no external dependencies

// ============ HELPER FUNCTIONS ============

function computeKelly(winRate, avgWinLoss) {
  // Kelly Criterion: f* = (p * b - q) / b
  // p = win rate, q = loss rate (1-p), b = avg win/loss ratio
  if (winRate <= 0 || winRate >= 1) return 0.25; // Default if invalid
  const q = 1 - winRate;
  const b = avgWinLoss;
  const kelly = (winRate * b - q) / b;
  // Return half-Kelly for safety
  return Math.max(0, Math.min(0.30, kelly * 0.5));
}

function getVolatilityScalar(volatilityRegime) {
  // Reduce size in high vol, increase in low vol
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
    'trending-bull': 1.1,
    'trending-bear': 1.0,
    'mean-reverting': 0.9,
    'volatile-transition': 0.6
  };
  return scalars[regime] || 1.0;
}

function confidenceScalar(confidence) {
  // Scale position size by signal confidence (50% -> half, 100% -> full)
  return Math.max(0.3, confidence / 100);
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

  // ===== METHOD 1: Kelly Criterion =====
  const kellyFrac = computeKelly(winRate, avgWinLoss);
  const riskPerTradeKelly = portfolioValue * kellyFrac * maxRiskPct;
  const sizeKelly = riskPerTradeKelly / atr;

  // ===== METHOD 2: ATR-Based (Turtle Trading) =====
  const riskPerTradeATR = portfolioValue * maxRiskPct;
  const sizeATR = riskPerTradeATR / atr;

  // ===== METHOD 3: Volatility-Adjusted =====
  const volScalar = getVolatilityScalar(volatilityRegime);
  const sizeVolAdjusted = sizeATR * volScalar;

  // ===== METHOD 4: Confidence-Scaled =====
  const confScalar = confidenceScalar(confidence);
  const sizeConfScaled = sizeATR * confScalar;

  // ===== REGIME ADJUSTMENT =====
  const regimeScalar = getRegimeScalar(regime.currentRegime);
  const baseSize = sizeATR * regimeScalar;

  // ===== APPLY ALL ADJUSTMENTS =====
  // Weighted recommendation: average of methods with regime scalar
  const methodSizes = {
    kelly: sizeKelly,
    atrBased: sizeATR,
    volAdjusted: sizeVolAdjusted,
    confidenceScaled: sizeConfScaled
  };

  const recommendedSize = (sizeATR * 0.4 + sizeVolAdjusted * 0.3 + sizeConfScaled * 0.3) * regimeScalar;

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
    sizing
  };
}
