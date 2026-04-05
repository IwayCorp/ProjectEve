// ============================================================================
// NOCTIS — TRADE HISTORY STORE
// Persists expired signals as "executed" trades, tracks outcomes over time
// ============================================================================

const STORAGE_KEY = 'noctis-trade-history'

/**
 * Load all cataloged trades from localStorage
 * @returns {Array} Array of trade history records
 */
export function loadTradeHistory() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Save trade history array to localStorage
 */
export function saveTradeHistory(trades) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades))
  } catch (e) {
    console.error('Failed to save trade history:', e)
  }
}

/**
 * Catalog an expired signal as an executed trade
 * Assumes entry at the midpoint of the entry zone
 */
export function catalogSignal(signal, direction, currentPrice) {
  const history = loadTradeHistory()

  // Don't duplicate — check if this signal ID is already cataloged
  if (history.some(t => t.signalId === signal.id)) return history

  const midEntry = (signal.entryLow + signal.entryHigh) / 2

  const record = {
    signalId: signal.id,
    ticker: signal.ticker,
    name: signal.name,
    asset: signal.asset || 'equity',
    strategy: signal.strategy,
    direction,
    entryPrice: midEntry,
    entryLow: signal.entryLow,
    entryHigh: signal.entryHigh,
    target: signal.target,
    stopLoss: signal.stopLoss,
    rsi: signal.rsi,
    confidence: signal.confidence,
    risk: signal.risk,
    timeframe: signal.timeframe,
    thesis: signal.thesis,
    catalyst: signal.catalyst,

    // Tracking fields
    catalogedAt: new Date().toISOString(),
    entryBy: signal.entryBy,
    expiresAt: signal.expiresAt,
    priceAtCatalog: currentPrice || null,
    outcome: null,         // 'TARGET_HIT' | 'STOP_HIT' | 'OPEN' | 'EXPIRED_FLAT'
    outcomePrice: null,
    outcomeAt: null,
    peakPnl: null,         // Best P/L % seen
    troughPnl: null,       // Worst P/L % seen
    lastCheckedPrice: currentPrice || null,
    lastCheckedAt: new Date().toISOString(),
  }

  history.unshift(record)  // newest first

  // Keep max 200 trades
  if (history.length > 200) history.length = 200

  saveTradeHistory(history)
  return history
}

/**
 * Update trade outcomes based on current quotes
 * Checks if target or stop has been hit
 */
export function updateTradeOutcomes(quotes) {
  const history = loadTradeHistory()
  if (history.length === 0) return history

  const tickerMap = {
    'USDJPY': 'JPY=X', 'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDCHF': 'CHF=X',
    'AUDUSD': 'AUDUSD=X', 'USDMXN': 'MXN=X', 'EURGBP': 'EURGBP=X', 'NZDUSD': 'NZDUSD=X',
  }

  let changed = false

  for (const trade of history) {
    // Skip trades that already have a final outcome
    if (trade.outcome === 'TARGET_HIT' || trade.outcome === 'STOP_HIT') continue

    const sym = tickerMap[trade.ticker] || trade.ticker
    const quote = quotes[sym]
    if (!quote?.regularMarketPrice) continue

    const price = quote.regularMarketPrice
    trade.lastCheckedPrice = price
    trade.lastCheckedAt = new Date().toISOString()

    // Calculate current P/L %
    const pnl = trade.direction === 'long'
      ? ((price - trade.entryPrice) / trade.entryPrice) * 100
      : ((trade.entryPrice - price) / trade.entryPrice) * 100

    // Track peak/trough
    if (trade.peakPnl === null || pnl > trade.peakPnl) trade.peakPnl = pnl
    if (trade.troughPnl === null || pnl < trade.troughPnl) trade.troughPnl = pnl

    // Check target hit
    if (trade.direction === 'long' && price >= trade.target) {
      trade.outcome = 'TARGET_HIT'
      trade.outcomePrice = price
      trade.outcomeAt = new Date().toISOString()
      changed = true
    } else if (trade.direction === 'short' && price <= trade.target) {
      trade.outcome = 'TARGET_HIT'
      trade.outcomePrice = price
      trade.outcomeAt = new Date().toISOString()
      changed = true
    }
    // Check stop hit
    else if (trade.direction === 'long' && price <= trade.stopLoss) {
      trade.outcome = 'STOP_HIT'
      trade.outcomePrice = price
      trade.outcomeAt = new Date().toISOString()
      changed = true
    } else if (trade.direction === 'short' && price >= trade.stopLoss) {
      trade.outcome = 'STOP_HIT'
      trade.outcomePrice = price
      trade.outcomeAt = new Date().toISOString()
      changed = true
    } else {
      trade.outcome = 'OPEN'
      changed = true
    }
  }

  if (changed) saveTradeHistory(history)
  return history
}

/**
 * Calculate aggregate stats from trade history
 */
export function calcHistoryStats(history) {
  const resolved = history.filter(t => t.outcome === 'TARGET_HIT' || t.outcome === 'STOP_HIT')
  const open = history.filter(t => t.outcome === 'OPEN' || t.outcome === null)
  const wins = resolved.filter(t => t.outcome === 'TARGET_HIT')
  const losses = resolved.filter(t => t.outcome === 'STOP_HIT')

  const winRate = resolved.length > 0 ? (wins.length / resolved.length) * 100 : 0

  // Calculate total P/L for resolved trades
  let totalPnl = 0
  for (const t of resolved) {
    const exitPrice = t.outcomePrice || t.lastCheckedPrice || t.entryPrice
    const pnl = t.direction === 'long'
      ? ((exitPrice - t.entryPrice) / t.entryPrice) * 100
      : ((t.entryPrice - exitPrice) / t.entryPrice) * 100
    totalPnl += pnl
  }

  // Average P/L per resolved trade
  const avgPnl = resolved.length > 0 ? totalPnl / resolved.length : 0

  // Streak tracking
  let currentStreak = 0
  let streakType = null
  for (const t of resolved) {
    const isWin = t.outcome === 'TARGET_HIT'
    if (streakType === null) {
      streakType = isWin ? 'win' : 'loss'
      currentStreak = 1
    } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
      currentStreak++
    } else {
      break
    }
  }

  return {
    total: history.length,
    resolved: resolved.length,
    open: open.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    avgPnl,
    currentStreak,
    streakType,
  }
}

/**
 * Clear all trade history
 */
export function clearTradeHistory() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
