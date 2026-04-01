// Trade ideas data — updated from our analysis
export const TRADE_IDEAS = {
  long: [
    {
      ticker: 'MSFT',
      name: 'Microsoft Corp',
      entryLow: 380,
      entryHigh: 390,
      target: 420,
      stopLoss: 365,
      rsi: 12.4,
      risk: 'HIGH',
      thesis: 'Extreme RSI oversold (12.4), 35% off highs. 15.5% earnings growth intact. Mean-reversion setup.',
      catalyst: 'Apr 29 earnings, AI product cycle',
    },
    {
      ticker: 'AAPL',
      name: 'Apple Inc',
      entryLow: 195,
      entryHigh: 200,
      target: 215,
      stopLoss: 188,
      rsi: 32.1,
      risk: 'MEDIUM',
      thesis: 'RSI 32 with WWDC catalyst ahead. Consumer sentiment divergence from actual retail sales.',
      catalyst: 'WWDC, iPhone cycle',
    },
    {
      ticker: 'RTX',
      name: 'RTX Corp',
      entryLow: 138,
      entryHigh: 143,
      target: 155,
      stopLoss: 132,
      rsi: 58.0,
      risk: 'MEDIUM',
      thesis: 'Defense supplemental tailwind ($45B). Patriot/THAAD demand. Less binary than pure energy.',
      catalyst: 'Defense spending bill, Iran ops',
    },
    {
      ticker: 'XOM',
      name: 'Exxon Mobil',
      entryLow: 135,
      entryHigh: 140,
      target: 150,
      stopLoss: 128,
      rsi: 68.0,
      risk: 'HIGH',
      thesis: 'Energy rotation leader. Record 5M boe/d production. Oil above $110 supports earnings.',
      catalyst: 'Apr 6 Iran deadline (binary!)',
    },
    {
      ticker: 'CAT',
      name: 'Caterpillar',
      entryLow: 405,
      entryHigh: 415,
      target: 440,
      stopLoss: 390,
      rsi: 55.0,
      risk: 'MEDIUM',
      thesis: 'AI data center buildout demand + infrastructure spending. Industrials rotation beneficiary.',
      catalyst: 'Infrastructure bills, AI capex',
    },
  ],
  short: [
    {
      ticker: 'XLF',
      name: 'Financial Select SPDR',
      entryLow: 42.5,
      entryHigh: 43.5,
      target: 39,
      stopLoss: 45,
      rsi: 35.0,
      risk: 'MEDIUM',
      thesis: 'Rising yields compressing NIM. Financials down 6% YTD, trend continuation likely.',
      catalyst: 'Yield curve dynamics',
    },
    {
      ticker: 'TSLA',
      name: 'Tesla Inc',
      entryLow: 242,
      entryHigh: 250,
      target: 220,
      stopLoss: 260,
      rsi: 38.0,
      risk: 'HIGH',
      thesis: 'Consumer discretionary weakness. High beta, vulnerable to risk-off. EV demand softening.',
      catalyst: 'Consumer sentiment, tariff risk',
    },
  ],
}

export const RISK_EVENTS = [
  { date: 'Apr 6', event: 'Trump Iran Deadline', impact: 'Oil, Equities, VIX, Gold', volatility: 'EXTREME', action: 'Size positions at 50% max' },
  { date: 'Apr 10', event: 'US CPI Release', impact: 'Treasuries, USD, Equities', volatility: 'HIGH', action: 'Reduce duration exposure' },
  { date: 'Apr 16', event: 'Fed Beige Book', impact: 'Treasuries, USD', volatility: 'MEDIUM', action: 'Monitor for growth signals' },
  { date: 'Apr 28', event: 'BoJ Policy Meeting', impact: 'JGB, JPY, Carry Trades', volatility: 'HIGH', action: 'Watch USD/JPY 155 level' },
  { date: 'Apr 29', event: 'MSFT Earnings', impact: 'Tech sector, Nasdaq', volatility: 'HIGH', action: 'Position before or after, not during' },
  { date: 'Apr 30', event: 'Fed Rate Decision', impact: 'All risk assets', volatility: 'EXTREME', action: 'Flatten risk into meeting' },
]

export const SCENARIOS = [
  {
    name: 'Ceasefire / Withdrawal',
    probability: 35,
    impacts: { oil: '-20-30%', spx: '+5-8%', vix: '-40%', energy: '-15-20%', tech: '+8-12%', defense: '-5-8%', gold: '-3-5%' },
    bestPosition: 'Long Tech, Short Energy',
  },
  {
    name: 'Status Quo / Stalemate',
    probability: 40,
    impacts: { oil: '±5%', spx: '±2%', vix: 'Flat', energy: '±3%', tech: '±2%', defense: '+2-3%', gold: '+1-2%' },
    bestPosition: 'Hold current mix',
  },
  {
    name: 'Escalation / Hormuz Close',
    probability: 25,
    impacts: { oil: '+30-50%', spx: '-10-15%', vix: '+50-80%', energy: '+20-30%', tech: '-15-20%', defense: '+10-15%', gold: '+8-12%' },
    bestPosition: 'Long Energy/Gold/Defense',
  },
]

// Helper to compute R:R ratio
export function calcRR(entry, target, stop, direction = 'long') {
  if (direction === 'long') {
    const risk = entry - stop
    const reward = target - entry
    return risk > 0 ? (reward / risk).toFixed(1) : '--'
  }
  const risk = stop - entry
  const reward = entry - target
  return risk > 0 ? (reward / risk).toFixed(1) : '--'
}

// Check if current price is in entry zone
export function isInEntryZone(price, low, high) {
  return price >= low && price <= high
}

// Check if price hit target or stop
export function checkAlerts(price, target, stop, direction = 'long') {
  if (direction === 'long') {
    if (price >= target) return 'TARGET_HIT'
    if (price <= stop) return 'STOP_HIT'
  } else {
    if (price <= target) return 'TARGET_HIT'
    if (price >= stop) return 'STOP_HIT'
  }
  return null
}
