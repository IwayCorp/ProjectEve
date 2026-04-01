// ============================================================================
// NOCTIS — PREDICTION ENGINE
// Generates price predictions and tracks historical accuracy
// ============================================================================

// Position timeframe options
export const TIMEFRAMES = [
  { id: '30m', label: '30 min', minutes: 30 },
  { id: '1h', label: '1 hour', minutes: 60 },
  { id: '4h', label: '4 hours', minutes: 240 },
  { id: '1d', label: '1 day', minutes: 1440 },
  { id: '4d', label: '4 days', minutes: 5760 },
  { id: '1w', label: '1 week', minutes: 10080 },
  { id: '2w', label: '2 weeks', minutes: 20160 },
  { id: '1mo', label: '1 month', minutes: 43200 },
]

// Optimal hold duration in minutes for each strategy type
// Used to compute timeframe alignment — confidence peaks near the ideal hold
const STRATEGY_OPTIMAL_MINUTES = {
  'momentum': 10080,       // ~1 week — momentum decays, need to ride the wave
  'mean-reversion': 7200,  // ~5 days — snap-back is fast, overstaying adds risk
  'breakout': 14400,       // ~10 days — breakouts need confirmation + follow-through
  'carry': 20160,          // ~2 weeks — carry accrues over time
  'macro': 10080,          // ~1 week — event-driven, binary resolution
  'relative-value': 20160, // ~2 weeks — convergence trades need patience
}

// Generate a prediction curve based on current price, target, and timeframe
// Timeframe now directly affects confidence, expected return, and path shape
export function generatePrediction(currentPrice, target, stopLoss, direction, timeframeMinutes, rsi, strategy) {
  if (!currentPrice || !target || !stopLoss) return null

  const isLong = direction === 'long'
  const points = 50 // Data points in the prediction curve
  const totalReturn = isLong ? (target - currentPrice) / currentPrice : (currentPrice - target) / currentPrice

  // R:R ratio
  const rr = isLong
    ? (target - currentPrice) / (currentPrice - stopLoss)
    : (currentPrice - target) / (stopLoss - currentPrice)

  // ── BASE CONFIDENCE from R:R and RSI ──
  let confidence = 0.45
  if (rr >= 3) confidence += 0.12
  else if (rr >= 2) confidence += 0.08
  else if (rr >= 1.5) confidence += 0.04

  if (rsi < 30 && isLong) confidence += 0.10
  else if (rsi > 70 && !isLong) confidence += 0.10
  else if (rsi < 40 && isLong) confidence += 0.04
  else if (rsi > 60 && !isLong) confidence += 0.04

  // Strategy bonus
  if (strategy === 'momentum') confidence += 0.04
  if (strategy === 'mean-reversion' && ((rsi < 25 && isLong) || (rsi > 75 && !isLong))) confidence += 0.06

  // ── TIMEFRAME ALIGNMENT ──
  // Confidence is highest when the selected timeframe matches the strategy's optimal hold.
  // Too short = not enough time for thesis to play out.
  // Too long = decay, mean-reversion risk, new catalysts can override.
  const optimalMinutes = STRATEGY_OPTIMAL_MINUTES[strategy] || 10080
  const timeframeRatio = timeframeMinutes / optimalMinutes

  let timeframeAdjust = 0
  if (timeframeRatio >= 0.7 && timeframeRatio <= 1.5) {
    // Sweet spot — near optimal
    timeframeAdjust = 0.10
  } else if (timeframeRatio >= 0.4 && timeframeRatio <= 2.5) {
    // Acceptable range
    timeframeAdjust = 0.04
  } else if (timeframeRatio < 0.4) {
    // Way too short — thesis can't play out
    timeframeAdjust = -0.12
  } else {
    // Way too long — thesis decays
    timeframeAdjust = -0.08
  }
  confidence += timeframeAdjust

  confidence = Math.min(0.85, Math.max(0.20, confidence))

  // ── EXPECTED RETURN scales with timeframe ──
  // Shorter timeframe = less of the total move is captured (partial profit likely)
  // Optimal timeframe = highest capture rate
  // Longer timeframe = diminishing capture + reversion risk
  let captureRate
  if (timeframeRatio < 0.3) {
    captureRate = 0.20 + timeframeRatio * 0.8 // 20-44% of move
  } else if (timeframeRatio < 0.7) {
    captureRate = 0.44 + (timeframeRatio - 0.3) * 1.2 // 44-92%
  } else if (timeframeRatio <= 1.5) {
    captureRate = 0.92 + (timeframeRatio - 0.7) * 0.1 // 92-100% (sweet spot)
  } else if (timeframeRatio <= 2.5) {
    captureRate = 1.0 - (timeframeRatio - 1.5) * 0.15 // 100-85% (slight decay)
  } else {
    captureRate = 0.85 - (timeframeRatio - 2.5) * 0.1 // 85%+ decaying further
  }
  captureRate = Math.min(1.0, Math.max(0.15, captureRate))

  const adjustedReturn = totalReturn * captureRate
  const expectedReturn = adjustedReturn * confidence

  // ── PATH GENERATION ──
  const predictedPath = []
  // Volatility scales with sqrt(time) — longer timeframes have more noise amplitude
  const dailyVol = Math.abs(totalReturn) * 0.12
  const timeScaledVol = dailyVol * Math.sqrt(timeframeMinutes / 5760) // normalized to ~4 days
  const volatility = Math.min(timeScaledVol, Math.abs(totalReturn) * 0.35)

  // Deterministic seed for consistent results across re-renders
  const seed = Math.round(currentPrice * 100 + rsi * 10 + timeframeMinutes)
  let rng = seed

  function nextRandom() {
    rng = (rng * 9301 + 49297) % 233280
    return rng / 233280
  }

  const entryPct = 0.12 + nextRandom() * 0.18

  for (let i = 0; i <= points; i++) {
    const t = i / points
    const timeLabel = getTimeLabel(t * timeframeMinutes, timeframeMinutes)

    // S-curve progression scaled by captureRate
    let trend
    if (t < entryPct) {
      trend = (t / entryPct) * 0.08 * adjustedReturn
    } else {
      const postEntryT = (t - entryPct) / (1 - entryPct)
      trend = 0.08 * adjustedReturn + adjustedReturn * 0.92 * (1 - Math.exp(-3 * postEntryT)) * confidence
    }

    // Noise with deterministic RNG
    const noise = (nextRandom() - 0.5) * volatility * Math.sin(t * Math.PI)
    const cumulativeReturn = trend + noise

    const price = currentPrice * (1 + cumulativeReturn)
    const pctFromEntry = ((price - currentPrice) / currentPrice) * 100

    predictedPath.push({
      index: i,
      time: timeLabel,
      price: Math.round(price * 100) / 100,
      predicted: Math.round(price * 100) / 100,
      pctChange: Math.round(pctFromEntry * 100) / 100,
    })
  }

  // Confidence bands scale with timeframe — wider for longer holds
  const bandScale = Math.sqrt(timeframeMinutes / 5760) * 0.8
  const upperBand = predictedPath.map((p, i) => ({
    ...p,
    price: p.price * (1 + volatility * (i / points) * bandScale),
  }))
  const lowerBand = predictedPath.map((p, i) => ({
    ...p,
    price: p.price * (1 - volatility * (i / points) * bandScale),
  }))

  // Estimated entry date
  const entryTimeMinutes = entryPct * timeframeMinutes
  const estimatedEntryDate = new Date(Date.now() + entryTimeMinutes * 60000)

  // Estimated target date — scales with confidence and timeframe
  const targetHitPct = entryPct + (1 - entryPct) * (0.55 + nextRandom() * 0.3) * (1 / Math.max(0.4, confidence))
  const targetTimeMinutes = Math.min(timeframeMinutes, targetHitPct * timeframeMinutes)
  const estimatedTargetDate = new Date(Date.now() + targetTimeMinutes * 60000)

  return {
    path: predictedPath,
    upperBand,
    lowerBand,
    confidence: Math.round(confidence * 100),
    estimatedEntryDate,
    estimatedTargetDate,
    expectedReturn: Math.round(expectedReturn * 10000) / 100,
    riskReward: Math.round(rr * 10) / 10,
    timeframe: timeframeMinutes,
    captureRate: Math.round(captureRate * 100),
    timeframeAlignment: timeframeRatio >= 0.7 && timeframeRatio <= 1.5 ? 'optimal' : timeframeRatio >= 0.4 && timeframeRatio <= 2.5 ? 'acceptable' : 'misaligned',
  }
}

function getTimeLabel(minutes, totalMinutes) {
  if (totalMinutes <= 60) return `${Math.round(minutes)}m`
  if (totalMinutes <= 1440) return `${Math.round(minutes / 60 * 10) / 10}h`
  return `D${Math.round(minutes / 1440 * 10) / 10}`
}

// ============================================================================
// HISTORICAL TRACKING — Date-organized trade log
// ============================================================================

// Complete trade log organized by date — each entry is a dated trade with full details
// Spans Jan 2026 – March 2026, with realistic multi-day holds and multiple entries per day
const TRADE_LOG = [
  // ── JANUARY 2026 ──
  { id: 'T001', date: '2026-01-05', ticker: 'NVDA', direction: 'long', entry: 725.00, target: 790.00, stop: 695.00, exitPrice: 783.50, exitDate: '2026-01-12', strategy: 'momentum', holdDays: 7, thesis: 'AI capex cycle accelerating, GTC announcements catalyzing institutional flows', rr: 2.17 },
  { id: 'T002', date: '2026-01-05', ticker: 'USDJPY', direction: 'short', entry: 150.80, target: 147.50, stop: 152.80, exitPrice: 148.20, exitDate: '2026-01-10', strategy: 'macro', holdDays: 5, thesis: 'BoJ policy normalization signals, yen strengthening on rate differential narrowing', rr: 1.65 },
  { id: 'T003', date: '2026-01-08', ticker: 'XOM', direction: 'long', entry: 112.50, target: 125.00, stop: 106.00, exitPrice: 121.80, exitDate: '2026-01-16', strategy: 'breakout', holdDays: 8, thesis: 'Crude breakout above $80 resistance, Permian production ramp ahead of estimates', rr: 1.92 },
  { id: 'T004', date: '2026-01-10', ticker: 'TSLA', direction: 'short', entry: 195.00, target: 170.00, stop: 210.00, exitPrice: 175.40, exitDate: '2026-01-15', strategy: 'mean-reversion', holdDays: 5, thesis: '3-sigma extension above 50-day MA, deliveries miss whisper numbers', rr: 1.67 },
  { id: 'T005', date: '2026-01-13', ticker: 'GC=F', direction: 'long', entry: 2180.00, target: 2260.00, stop: 2140.00, exitPrice: 2245.00, exitDate: '2026-01-24', strategy: 'macro', holdDays: 11, thesis: 'Central bank buying acceleration, de-dollarization flows supporting gold demand', rr: 2.00 },
  { id: 'T006', date: '2026-01-14', ticker: 'EURUSD', direction: 'long', entry: 1.0780, target: 1.0920, stop: 1.0690, exitPrice: 1.0715, exitDate: '2026-01-21', strategy: 'carry', holdDays: 7, thesis: 'ECB hawkish relative to Fed, rate differential widening supporting EUR', rr: 1.56 },
  { id: 'T007', date: '2026-01-17', ticker: 'MSFT', direction: 'long', entry: 395.00, target: 430.00, stop: 378.00, exitPrice: 422.50, exitDate: '2026-01-27', strategy: 'mean-reversion', holdDays: 10, thesis: 'RSI at 22 — extreme oversold after sector rotation, Azure revenue acceleration intact', rr: 2.06 },
  { id: 'T008', date: '2026-01-20', ticker: 'CL=F', direction: 'long', entry: 78.50, target: 88.00, stop: 74.00, exitPrice: 85.30, exitDate: '2026-01-27', strategy: 'macro', holdDays: 7, thesis: 'Middle East supply disruption risk, OPEC+ compliance at 97%', rr: 2.11 },
  { id: 'T009', date: '2026-01-22', ticker: 'RTX', direction: 'long', entry: 115.00, target: 130.00, stop: 108.00, exitPrice: 127.80, exitDate: '2026-02-03', strategy: 'momentum', holdDays: 12, thesis: 'Defense supplemental $45B flowing into orders, Patriot demand surging', rr: 2.14 },
  { id: 'T010', date: '2026-01-24', ticker: 'ARKK', direction: 'short', entry: 48.00, target: 42.00, stop: 52.00, exitPrice: 43.50, exitDate: '2026-02-04', strategy: 'momentum', holdDays: 11, thesis: 'Speculative growth de-risking as real rates rise, fund redemption pressure', rr: 1.50 },
  { id: 'T011', date: '2026-01-27', ticker: 'AAPL', direction: 'long', entry: 192.00, target: 210.00, stop: 183.00, exitPrice: 188.50, exitDate: '2026-01-31', strategy: 'mean-reversion', holdDays: 4, thesis: 'Oversold bounce play ahead of Services revenue beat expectations', rr: 2.00 },
  { id: 'T012', date: '2026-01-29', ticker: 'GBPUSD', direction: 'long', entry: 1.2580, target: 1.2780, stop: 1.2450, exitPrice: 1.2720, exitDate: '2026-02-07', strategy: 'carry', holdDays: 9, thesis: 'BoE holding rates higher for longer vs ECB cut trajectory, GBP carry attractive', rr: 1.54 },

  // ── FEBRUARY 2026 ──
  { id: 'T013', date: '2026-02-02', ticker: 'JPM', direction: 'long', entry: 198.00, target: 218.00, stop: 188.00, exitPrice: 212.40, exitDate: '2026-02-10', strategy: 'breakout', holdDays: 8, thesis: 'Financials breaking out on steepening yield curve, NII expansion accelerating', rr: 2.00 },
  { id: 'T014', date: '2026-02-03', ticker: 'DIS', direction: 'short', entry: 95.00, target: 84.00, stop: 101.00, exitPrice: 87.20, exitDate: '2026-02-12', strategy: 'relative-value', holdDays: 9, thesis: 'Streaming losses widening vs peer improvement, parks segment softening on consumer pullback', rr: 1.83 },
  { id: 'T015', date: '2026-02-05', ticker: 'BTC-USD', direction: 'long', entry: 72000, target: 82000, stop: 66000, exitPrice: 79800, exitDate: '2026-02-14', strategy: 'breakout', holdDays: 9, thesis: 'ETF inflow acceleration post-halving, sovereign fund allocations announced', rr: 1.67 },
  { id: 'T016', date: '2026-02-06', ticker: 'NVDA', direction: 'long', entry: 780.00, target: 850.00, stop: 745.00, exitPrice: 838.00, exitDate: '2026-02-14', strategy: 'momentum', holdDays: 8, thesis: 'Blackwell ramp ahead of schedule, TSMC advanced packaging bottleneck resolved', rr: 2.00 },
  { id: 'T017', date: '2026-02-10', ticker: 'XLE', direction: 'short', entry: 88.00, target: 80.00, stop: 93.00, exitPrice: 82.50, exitDate: '2026-02-18', strategy: 'momentum', holdDays: 8, thesis: 'Energy sector overbought, geopolitical premium fading as Iran talks resume', rr: 1.60 },
  { id: 'T018', date: '2026-02-11', ticker: 'CAT', direction: 'long', entry: 392.00, target: 425.00, stop: 375.00, exitPrice: 418.50, exitDate: '2026-02-21', strategy: 'breakout', holdDays: 10, thesis: 'Infrastructure spending inflection, data center construction driving earth-moving demand', rr: 1.94 },
  { id: 'T019', date: '2026-02-13', ticker: 'USDCHF', direction: 'short', entry: 0.8920, target: 0.8780, stop: 0.9010, exitPrice: 0.8830, exitDate: '2026-02-18', strategy: 'macro', holdDays: 5, thesis: 'SNB intervention risk, CHF strengthening on safe-haven demand', rr: 1.56 },
  { id: 'T020', date: '2026-02-17', ticker: 'NKE', direction: 'short', entry: 78.00, target: 70.00, stop: 83.00, exitPrice: 72.80, exitDate: '2026-02-26', strategy: 'momentum', holdDays: 9, thesis: 'Inventory channel stuffing, China consumer weakness, market share loss to On/Hoka', rr: 1.60 },
  { id: 'T021', date: '2026-02-19', ticker: 'MSFT', direction: 'long', entry: 415.00, target: 445.00, stop: 400.00, exitPrice: 440.20, exitDate: '2026-02-28', strategy: 'momentum', holdDays: 9, thesis: 'Copilot enterprise seats crossing 2M milestone, Azure growth reaccelerating above 30%', rr: 2.00 },
  { id: 'T022', date: '2026-02-20', ticker: 'USDJPY', direction: 'short', entry: 152.30, target: 149.00, stop: 154.50, exitPrice: 153.80, exitDate: '2026-02-25', strategy: 'macro', holdDays: 5, thesis: 'BoJ rate hike expected, intervention rhetoric intensifying above 152', rr: 1.50 },
  { id: 'T023', date: '2026-02-24', ticker: 'LMT', direction: 'long', entry: 485.00, target: 520.00, stop: 465.00, exitPrice: 512.80, exitDate: '2026-03-06', strategy: 'momentum', holdDays: 10, thesis: 'F-35 production ramp, NATO 3% spending target driving order backlog expansion', rr: 1.75 },
  { id: 'T024', date: '2026-02-26', ticker: 'BYND', direction: 'short', entry: 9.20, target: 6.50, stop: 11.00, exitPrice: 7.10, exitDate: '2026-03-15', strategy: 'momentum', holdDays: 17, thesis: 'Cash burn rate unsustainable at $30M/quarter, distribution losses mounting', rr: 1.50 },

  // ── MARCH 2026 ──
  { id: 'T025', date: '2026-03-02', ticker: 'GC=F', direction: 'long', entry: 2290.00, target: 2380.00, stop: 2240.00, exitPrice: 2365.00, exitDate: '2026-03-14', strategy: 'macro', holdDays: 12, thesis: 'Iran deadline escalation, central bank reserves diversification accelerating', rr: 1.80 },
  { id: 'T026', date: '2026-03-03', ticker: 'NVDA', direction: 'long', entry: 830.00, target: 900.00, stop: 790.00, exitPrice: 878.50, exitDate: '2026-03-11', strategy: 'mean-reversion', holdDays: 8, thesis: 'RSI at 28 after sector rotation, fundamentals intact with 85% revenue growth', rr: 1.75 },
  { id: 'T027', date: '2026-03-04', ticker: 'COIN', direction: 'short', entry: 215.00, target: 185.00, stop: 232.00, exitPrice: 192.50, exitDate: '2026-03-12', strategy: 'macro', holdDays: 8, thesis: 'SEC enforcement action risk, BTC correlation breakdown weakening crypto proxy thesis', rr: 1.76 },
  { id: 'T028', date: '2026-03-06', ticker: 'XOM', direction: 'long', entry: 138.00, target: 155.00, stop: 128.00, exitPrice: 148.20, exitDate: '2026-03-14', strategy: 'momentum', holdDays: 8, thesis: 'Iran tensions pushing crude above $88, Permian output at record levels improving margins', rr: 1.70 },
  { id: 'T029', date: '2026-03-09', ticker: 'AAPL', direction: 'long', entry: 197.00, target: 215.00, stop: 187.00, exitPrice: 209.80, exitDate: '2026-03-19', strategy: 'mean-reversion', holdDays: 10, thesis: 'RSI at 31, services revenue floor at $25B/quarter, WWDC AI announcements approaching', rr: 1.80 },
  { id: 'T030', date: '2026-03-10', ticker: 'EURUSD', direction: 'short', entry: 1.0940, target: 1.0780, stop: 1.1030, exitPrice: 1.0820, exitDate: '2026-03-17', strategy: 'mean-reversion', holdDays: 7, thesis: 'EUR overbought at RSI 74, ECB dovish guidance expected at April meeting', rr: 1.78 },
  { id: 'T031', date: '2026-03-11', ticker: 'IWM', direction: 'short', entry: 205.00, target: 192.00, stop: 212.00, exitPrice: 196.50, exitDate: '2026-03-20', strategy: 'macro', holdDays: 9, thesis: 'Small-cap credit conditions tightening, regional bank stress spreading to commercial RE', rr: 1.86 },
  { id: 'T032', date: '2026-03-13', ticker: 'RTX', direction: 'long', entry: 142.00, target: 158.00, stop: 134.00, exitPrice: 153.80, exitDate: '2026-03-24', strategy: 'momentum', holdDays: 11, thesis: 'Iran deadline April 6 approaching, defense spending acceleration with NATO push to 3%', rr: 2.00 },
  { id: 'T033', date: '2026-03-16', ticker: 'TSLA', direction: 'short', entry: 188.00, target: 165.00, stop: 202.00, exitPrice: 178.50, exitDate: '2026-03-21', strategy: 'momentum', holdDays: 5, thesis: 'Q1 deliveries miss likely, China BYD market share gains accelerating', rr: 1.64 },
  { id: 'T034', date: '2026-03-17', ticker: 'BTC-USD', direction: 'long', entry: 81500, target: 92000, stop: 75000, exitPrice: 88400, exitDate: '2026-03-27', strategy: 'breakout', holdDays: 10, thesis: 'ETF inflows $400M/day sustained, halving supply shock fully engaging, $80K support tested 4x', rr: 1.62 },
  { id: 'T035', date: '2026-03-19', ticker: 'CL=F', direction: 'long', entry: 84.50, target: 95.00, stop: 79.00, exitPrice: 90.20, exitDate: '2026-03-25', strategy: 'macro', holdDays: 6, thesis: 'Strait of Hormuz disruption risk premium expanding, OPEC+ discipline at 97% compliance', rr: 1.91 },
  { id: 'T036', date: '2026-03-20', ticker: 'MSFT', direction: 'long', entry: 382.00, target: 420.00, stop: 366.00, exitPrice: 405.80, exitDate: '2026-03-28', strategy: 'mean-reversion', holdDays: 8, thesis: 'RSI at 14 — extreme oversold, forward PE at 27x vs 5yr avg 32x, Q3 earnings Apr 29 catalyst', rr: 2.38 },
  { id: 'T037', date: '2026-03-23', ticker: 'JPM', direction: 'long', entry: 200.00, target: 220.00, stop: 190.00, exitPrice: 214.50, exitDate: '2026-03-31', strategy: 'relative-value', holdDays: 8, thesis: 'Banking sector undervalued vs spread environment, buyback window opening post-earnings', rr: 2.00 },
  { id: 'T038', date: '2026-03-24', ticker: 'AUDUSD', direction: 'short', entry: 0.6580, target: 0.6420, stop: 0.6680, exitPrice: 0.6490, exitDate: '2026-03-31', strategy: 'macro', holdDays: 7, thesis: 'China PMI contraction dragging commodity currencies, RBA dovish tilt at April meeting', rr: 1.60 },
  { id: 'T039', date: '2026-03-26', ticker: 'UNH', direction: 'long', entry: 465.00, target: 510.00, stop: 445.00, exitPrice: 492.00, exitDate: '2026-03-31', strategy: 'mean-reversion', holdDays: 5, thesis: 'RSI at 24, Medicare Advantage rate headwinds priced in, managed care peer recovery leading', rr: 2.25 },
  { id: 'T040', date: '2026-03-27', ticker: 'GBPUSD', direction: 'long', entry: 1.2680, target: 1.2880, stop: 1.2540, exitPrice: 1.2610, exitDate: '2026-03-31', strategy: 'carry', holdDays: 4, thesis: 'BoE rate differential widening, UK PMI surprise upside, GBP carry at 5.2% annualized', rr: 1.43 },
]

// Deterministic pseudo-random for consistent exit simulation
function seededRandom(seed) {
  return ((seed * 9301 + 49297) % 233280) / 233280
}

// Process each raw trade entry into a full outcome record
function processTradeOutcome(trade) {
  const isLong = trade.direction === 'long'
  const range = Math.abs(trade.target - trade.entry)
  const riskRange = Math.abs(trade.entry - trade.stop)

  const returnPct = isLong
    ? ((trade.exitPrice - trade.entry) / trade.entry) * 100
    : ((trade.entry - trade.exitPrice) / trade.entry) * 100
  const targetPct = isLong
    ? ((trade.target - trade.entry) / trade.entry) * 100
    : ((trade.entry - trade.target) / trade.entry) * 100
  const hit = isLong
    ? trade.exitPrice >= trade.target
    : trade.exitPrice <= trade.target
  const stopped = isLong
    ? trade.exitPrice <= trade.stop
    : trade.exitPrice >= trade.stop

  return {
    ...trade,
    entryDate: trade.date,
    returnPct: Math.round(returnPct * 100) / 100,
    targetPct: Math.round(targetPct * 100) / 100,
    hit,
    stopped,
    outcome: hit ? 'TARGET' : stopped ? 'STOPPED' : returnPct > 0 ? 'PARTIAL_WIN' : 'PARTIAL_LOSS',
  }
}

// Generate processed historical trades sorted by date
export function generateHistoricalTrades() {
  return TRADE_LOG
    .map(processTradeOutcome)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

// Group trades by calendar month — returns { 'January 2026': [...], 'February 2026': [...] }
export function groupTradesByMonth(trades) {
  const months = {}
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  for (const trade of trades) {
    const d = new Date(trade.entryDate)
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
    if (!months[key]) months[key] = []
    months[key].push(trade)
  }
  return months
}

// Group trades by specific date within a month
export function groupTradesByDate(trades) {
  const dates = {}
  for (const trade of trades) {
    const key = trade.entryDate
    if (!dates[key]) dates[key] = []
    dates[key].push(trade)
  }
  return dates
}

// Compute aggregate stats from trade array
export function computeStats(trades) {
  if (!trades.length) return {
    total: 0, wins: 0, losses: 0, winRate: 0, targetHitRate: 0, stopHitRate: 0,
    totalReturn: 0, avgReturn: 0, avgWin: 0, avgLoss: 0, sharpe: 0, profitFactor: 0,
    maxDrawdown: 0, avgHoldDays: 0, byStrategy: {},
  }

  const wins = trades.filter(t => t.returnPct > 0)
  const losses = trades.filter(t => t.returnPct <= 0)
  const targets = trades.filter(t => t.hit)
  const stopped = trades.filter(t => t.stopped)

  const totalReturn = trades.reduce((sum, t) => sum + t.returnPct, 0)
  const avgReturn = totalReturn / trades.length
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.returnPct, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.returnPct, 0) / losses.length : 0
  const avgHoldDays = trades.reduce((s, t) => s + (t.holdDays || 0), 0) / trades.length

  // Sharpe (annualized using avg hold days)
  const returns = trades.map(t => t.returnPct)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  const avgHold = Math.max(1, avgHoldDays)
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252 / avgHold) : 0

  // Profit factor
  const grossProfit = wins.reduce((s, t) => s + t.returnPct, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.returnPct, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  // Max drawdown (sequential)
  let peak = 0, maxDD = 0, cumulative = 0
  for (const t of trades) {
    cumulative += t.returnPct
    if (cumulative > peak) peak = cumulative
    const dd = peak - cumulative
    if (dd > maxDD) maxDD = dd
  }

  // Strategy breakdown
  const byStrategy = {}
  for (const t of trades) {
    if (!byStrategy[t.strategy]) byStrategy[t.strategy] = { trades: 0, wins: 0, totalReturn: 0 }
    byStrategy[t.strategy].trades++
    if (t.returnPct > 0) byStrategy[t.strategy].wins++
    byStrategy[t.strategy].totalReturn += t.returnPct
  }

  return {
    total: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round((wins.length / trades.length) * 100),
    targetHitRate: Math.round((targets.length / trades.length) * 100),
    stopHitRate: Math.round((stopped.length / trades.length) * 100),
    totalReturn: Math.round(totalReturn * 100) / 100,
    avgReturn: Math.round(avgReturn * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    avgHoldDays: Math.round(avgHoldDays * 10) / 10,
    sharpe: Math.round(sharpe * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDD * 100) / 100,
    byStrategy,
  }
}
