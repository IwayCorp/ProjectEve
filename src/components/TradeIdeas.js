'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { calcRR, isInEntryZone, checkAlerts, getTradeUrgency, formatCountdown } from '@/lib/tradeIdeas'
import { formatPrice } from '@/lib/marketData'
import { catalogSignal, updateTradeOutcomes, loadTradeHistory, calcHistoryStats } from '@/lib/tradeHistory'
import TradePacket from './TradePacket'

const STRATEGIES = {
  'momentum': { icon: '⚡', name: 'Momentum' },
  'mean-reversion': { icon: '↩', name: 'Mean Reversion' },
  'breakout': { icon: '🔺', name: 'Breakout' },
  'carry': { icon: '💰', name: 'Carry' },
  'macro': { icon: '🌍', name: 'Macro' },
  'relative-value': { icon: '⚖', name: 'Relative Value' },
}

const URGENCY_CONFIG = {
  closing: { label: 'CLOSING', color: '#f87171', bg: 'rgba(248, 113, 113, 0.10)', border: 'rgba(248, 113, 113, 0.25)', pulse: true },
  urgent:  { label: 'URGENT', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.20)', pulse: true },
  active:  { label: 'ACTIVE', color: '#34d399', bg: 'rgba(52, 211, 153, 0.06)', border: 'rgba(52, 211, 153, 0.15)', pulse: false },
  expired: { label: 'EXPIRED', color: '#64748b', bg: 'rgba(100, 116, 139, 0.06)', border: 'rgba(100, 116, 139, 0.15)', pulse: false },
}

const TICKER_MAP = {
  'USDJPY': 'JPY=X', 'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDCHF': 'CHF=X',
  'AUDUSD': 'AUDUSD=X', 'USDMXN': 'MXN=X', 'EURGBP': 'EURGBP=X', 'NZDUSD': 'NZDUSD=X',
}

// Auto-refresh interval: regenerate signals every 20 minutes
const SIGNAL_REFRESH_INTERVAL = 20 * 60 * 1000

function TradeCard({ trade, quote, direction, onOpen }) {
  const price = quote?.regularMarketPrice
  const inZone = price ? isInEntryZone(price, trade.entryLow, trade.entryHigh) : false
  const midEntry = (trade.entryLow + trade.entryHigh) / 2
  const rr = calcRR(midEntry, trade.target, trade.stopLoss, direction)
  const isUp = quote?.regularMarketChangePercent >= 0
  const alert = price ? checkAlerts(price, trade.target, trade.stopLoss, direction) : null
  const fmtType = trade.asset === 'forex' ? 'forex' : 'stock'

  const urgency = getTradeUrgency(trade)
  const uc = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.active
  const countdown = formatCountdown(trade.entryBy)
  const expiresCountdown = formatCountdown(trade.expiresAt)
  const isExpired = urgency === 'expired'

  return (
    <div
      onClick={() => onOpen(trade, direction)}
      className={`nx-card p-4 cursor-pointer group transition-all duration-300 ${
        isExpired ? 'opacity-50' :
        alert === 'TARGET_HIT' ? 'glow-green border-nx-green/20' : alert === 'STOP_HIT' ? 'glow-red border-nx-red/20' : ''
      } hover:border-nx-accent/20`}
    >
      {/* Urgency + Expiration header bar */}
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-nx-border/30">
        <div className="flex items-center gap-2">
          <span
            className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${uc.pulse ? 'animate-pulse-gentle' : ''}`}
            style={{ background: uc.bg, color: uc.color, border: `1px solid ${uc.border}` }}
          >
            {uc.label}
          </span>
          {countdown && !isExpired && (
            <span className="text-2xs font-mono font-semibold" style={{ color: uc.color }}>
              Entry by: {countdown}
            </span>
          )}
          {isExpired && (
            <span className="text-2xs font-mono text-nx-text-hint">Cataloged as executed</span>
          )}
        </div>
        {expiresCountdown && !isExpired && (
          <span className="text-2xs text-nx-text-hint font-mono">
            Expires: {expiresCountdown}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-nx-text-strong group-hover:text-nx-accent transition-colors">{trade.ticker}</span>
            <span className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${direction === 'long' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
              {direction}
            </span>
            <span className={`text-2xs px-2 py-0.5 rounded-md font-semibold ${trade.strategy ? `strat-${trade.strategy}` : ''}`}>
              {STRATEGIES[trade.strategy]?.icon} {trade.strategy?.replace('-', ' ')}
            </span>
            {inZone && !isExpired && <span className="badge-blue animate-pulse-gentle text-2xs">IN ZONE</span>}
            {alert === 'TARGET_HIT' && <span className="badge-green animate-pulse-gentle text-2xs">TARGET</span>}
            {alert === 'STOP_HIT' && <span className="badge-red animate-pulse-gentle text-2xs">STOP</span>}
          </div>
          <span className="text-xs text-nx-text-muted mt-0.5 block">{trade.name}</span>
        </div>
        <div className="text-right">
          {price ? (
            <div className={`text-lg font-bold font-mono tabular-nums ${isUp ? 'text-nx-green' : 'text-nx-red'}`}>
              {formatPrice(price, fmtType)}
            </div>
          ) : (
            <div className="text-sm text-nx-text-muted">--</div>
          )}
          <span className={`text-2xs px-2 py-0.5 rounded-md font-bold ${
            trade.risk === 'HIGH' ? 'bg-nx-red-muted text-nx-red border border-nx-red/15' : trade.risk === 'LOW' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-orange-muted text-nx-orange border border-nx-orange/15'
          }`}>
            {trade.risk}
          </span>
        </div>
      </div>

      {/* Entry window guidance */}
      {trade.entryWindow && !isExpired && (
        <div className="flex items-start gap-2 mb-3 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(91, 141, 238, 0.04)', border: '1px solid rgba(91, 141, 238, 0.08)' }}>
          <span className="text-xs shrink-0 mt-px">⏱</span>
          <span className="text-2xs text-nx-accent leading-relaxed">{trade.entryWindow}</span>
        </div>
      )}

      {/* Price bar */}
      <div className="bg-nx-void/60 rounded-lg p-2.5 mb-3 border border-nx-border/30">
        <div className="flex justify-between text-2xs mb-1.5">
          <span className="text-nx-red font-medium">Stop {formatPrice(trade.stopLoss, fmtType)}</span>
          <span className="text-nx-accent font-medium">Entry {formatPrice(trade.entryLow, fmtType)}–{formatPrice(trade.entryHigh, fmtType)}</span>
          <span className="text-nx-green font-medium">Target {formatPrice(trade.target, fmtType)}</span>
        </div>
        {price && (
          <div className="relative h-1.5 bg-nx-border/30 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full rounded-full w-full" style={{ background: 'linear-gradient(90deg, rgba(248,113,113,0.15), rgba(91,141,238,0.15), rgba(52,211,153,0.15))' }} />
            {(() => {
              const min = direction === 'long' ? trade.stopLoss * 0.98 : trade.target * 0.98
              const max = direction === 'long' ? trade.target * 1.02 : trade.stopLoss * 1.02
              const pct = Math.min(100, Math.max(0, ((price - min) / (max - min)) * 100))
              return (
                <div
                  className="absolute top-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg"
                  style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 8px rgba(255,255,255,0.3)' }}
                />
              )
            })()}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-nx-text-muted">Risk:Reward</span>
          <span className={`text-sm font-bold font-mono ${parseFloat(rr) >= 2 ? 'text-nx-green' : 'text-nx-orange'}`}>1:{rr}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-nx-text-muted">RSI</span>
          <span className={`text-sm font-bold font-mono ${trade.rsi < 30 ? 'text-nx-green' : trade.rsi > 70 ? 'text-nx-red' : 'text-nx-orange'}`}>{trade.rsi}</span>
        </div>
        {trade.confidence && (
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Conf</span>
            <span className={`text-sm font-bold font-mono ${trade.confidence >= 65 ? 'text-nx-green' : 'text-nx-orange'}`}>{trade.confidence}%</span>
          </div>
        )}
        <div className="ml-auto text-right shrink-0">
          <div className="text-2xs font-semibold text-nx-accent">{trade.timeframe || 'Variable'}</div>
        </div>
      </div>

      <p className="text-xs text-nx-text-muted leading-relaxed mb-2 line-clamp-2">{trade.thesis}</p>
      <div className="flex items-center justify-between">
        <div className="text-2xs text-nx-purple truncate max-w-[80%]">{trade.catalyst}</div>
        <span className="text-2xs text-nx-accent opacity-0 group-hover:opacity-100 transition-opacity font-medium">View Packet &rarr;</span>
      </div>
    </div>
  )
}

// ── Mini Stats Bar ──
function HistoryStatsBar({ stats }) {
  if (stats.total === 0) return null
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl border border-nx-border/30" style={{ background: 'var(--card-bg)' }}>
      <div className="flex items-center gap-1.5">
        <span className="text-2xs text-nx-text-muted">Tracked</span>
        <span className="text-sm font-bold font-mono text-nx-text-strong">{stats.total}</span>
      </div>
      {stats.resolved > 0 && (
        <>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Win Rate</span>
            <span className={`text-sm font-bold font-mono ${stats.winRate >= 50 ? 'text-nx-green' : 'text-nx-red'}`}>
              {stats.winRate.toFixed(0)}%
            </span>
          </div>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">W/L</span>
            <span className="text-sm font-bold font-mono">
              <span className="text-nx-green">{stats.wins}</span>
              <span className="text-nx-text-hint">/</span>
              <span className="text-nx-red">{stats.losses}</span>
            </span>
          </div>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Avg P/L</span>
            <span className={`text-sm font-bold font-mono ${stats.avgPnl >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
              {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(1)}%
            </span>
          </div>
        </>
      )}
      {stats.open > 0 && (
        <>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Open</span>
            <span className="text-sm font-bold font-mono text-nx-accent">{stats.open}</span>
          </div>
        </>
      )}
      {stats.currentStreak > 1 && (
        <>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Streak</span>
            <span className={`text-sm font-bold font-mono ${stats.streakType === 'win' ? 'text-nx-green' : 'text-nx-red'}`}>
              {stats.currentStreak} {stats.streakType === 'win' ? 'W' : 'L'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default function TradeIdeas({ quotes }) {
  const [tab, setTab] = useState('long')
  const [selectedStrategy, setSelectedStrategy] = useState('all')
  const [openPacket, setOpenPacket] = useState(null)
  const [showExpired, setShowExpired] = useState(false)
  const [, setTick] = useState(0)

  // Signal engine state
  const [signals, setSignals] = useState({ long: [], short: [], forex: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastGenerated, setLastGenerated] = useState(null)
  const [nextRefresh, setNextRefresh] = useState(null)
  const [historyStats, setHistoryStats] = useState({ total: 0, resolved: 0, open: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, avgPnl: 0, currentStreak: 0, streakType: null })

  const catalogedRef = useRef(new Set())  // track which signals we've already cataloged this session
  const quotesRef = useRef(quotes)
  quotesRef.current = quotes  // always keep current

  // Countdown ticker — update every 1s for second-level countdown accuracy
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch signals from real signal engine, with localStorage caching for timestamps
  const fetchSignals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/signals?category=all')
      if (!res.ok) throw new Error(`Signal engine error: ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Load cached signals from localStorage
      let cachedSignals = { long: [], short: [], forex: [] }
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('noctis-signal-cache')
          if (cached) cachedSignals = JSON.parse(cached)
        }
      } catch (e) {
        console.warn('Error reading signal cache:', e)
      }

      // Merge new signals with cached ones: keep old signals if they're still active
      const mergedSignals = { long: [], short: [], forex: [] }
      const now = new Date().getTime()

      // Helper to check if signal has expired
      const isExpired = (signal) => {
        const expiresAt = new Date(signal.expiresAt).getTime()
        return expiresAt <= now
      }

      // Helper to find cached version of signal
      const findCached = (newSignal, category) => {
        return cachedSignals[category].find(
          cached => cached.ticker === newSignal.ticker && cached.direction === newSignal.direction
        )
      }

      // Process each category
      for (const category of ['long', 'short', 'forex']) {
        const newSignals = (data.signals?.[category] || []).filter(s => s != null)

        for (const newSignal of newSignals) {
          const cached = findCached(newSignal, category)
          if (cached && !isExpired(cached)) {
            // Keep the cached version with original timestamps
            mergedSignals[category].push(cached)
          } else {
            // Add the new signal
            mergedSignals[category].push(newSignal)
          }
        }

        // Also keep any expired cached signals (for cataloging)
        for (const cached of cachedSignals[category]) {
          const stillInNew = newSignals.some(
            ns => ns.ticker === cached.ticker && ns.direction === cached.direction
          )
          if (!stillInNew) {
            mergedSignals[category].push(cached)
          }
        }
      }

      // Save merged signals back to localStorage
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('noctis-signal-cache', JSON.stringify(mergedSignals))
        }
      } catch (e) {
        console.warn('Error saving signal cache:', e)
      }

      setSignals(mergedSignals)
      setLastGenerated(data.generatedAt || new Date().toISOString())
      setNextRefresh(Date.now() + SIGNAL_REFRESH_INTERVAL)
    } catch (err) {
      console.error('Signal fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => { fetchSignals() }, [fetchSignals])

  // Auto-refresh signals every 20 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSignals()
    }, SIGNAL_REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchSignals])

  // ── AUTO-CATALOG EXPIRED SIGNALS ──
  // When signals expire, snapshot them as executed trades
  useEffect(() => {
    if (!quotes || Object.keys(quotes).length === 0) return

    const allSignals = [...(signals.long || []), ...(signals.short || []), ...(signals.forex || [])]
    let anyCataloged = false

    for (const signal of allSignals) {
      const urgency = getTradeUrgency(signal)
      if (urgency !== 'expired') continue
      if (catalogedRef.current.has(signal.id)) continue

      // Determine direction
      const direction = signal.direction || (signals.short?.includes(signal) ? 'short' : 'long')

      // Get current price
      const sym = TICKER_MAP[signal.ticker] || signal.ticker
      const price = quotes[sym]?.regularMarketPrice || null

      catalogSignal(signal, direction, price)
      catalogedRef.current.add(signal.id)
      anyCataloged = true
    }

    if (anyCataloged) {
      const history = loadTradeHistory()
      setHistoryStats(calcHistoryStats(history))
    }
  }, [signals, quotes])

  // ── UPDATE TRADE OUTCOMES on every quote refresh ──
  useEffect(() => {
    if (!quotes || Object.keys(quotes).length === 0) return
    const history = updateTradeOutcomes(quotes)
    setHistoryStats(calcHistoryStats(history))
  }, [quotes])

  // Load initial stats
  useEffect(() => {
    const history = loadTradeHistory()
    setHistoryStats(calcHistoryStats(history))
    // Pre-populate cataloged set from existing history
    for (const t of history) catalogedRef.current.add(t.signalId)
  }, [])

  const allStrategies = ['all', ...Object.keys(STRATEGIES)]
  const ideas = signals[tab] || []
  const stratFiltered = selectedStrategy === 'all' ? ideas : ideas.filter(i => i.strategy === selectedStrategy)

  // Sort by urgency: closing > urgent > active > expired
  const urgencyOrder = { closing: 0, urgent: 1, active: 2, expired: 3 }
  const sorted = [...stratFiltered].sort((a, b) => {
    const ua = urgencyOrder[getTradeUrgency(a)] ?? 2
    const ub = urgencyOrder[getTradeUrgency(b)] ?? 2
    return ua - ub
  })

  const filtered = showExpired ? sorted : sorted.filter(i => getTradeUrgency(i) !== 'expired')
  const expiredCount = sorted.filter(i => getTradeUrgency(i) === 'expired').length

  const getDirection = (idea) => {
    if (tab === 'forex') return idea.direction || 'long'
    if (tab === 'short') return idea.direction || 'short'
    return idea.direction || 'long'
  }

  const getQuote = (idea) => {
    const sym = TICKER_MAP[idea.ticker] || idea.ticker
    return quotes[sym]
  }

  // Format next refresh countdown
  const refreshCountdown = nextRefresh ? Math.max(0, Math.ceil((nextRefresh - Date.now()) / 60000)) : null

  return (
    <div className="space-y-5">
      {/* Live signal engine header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: loading ? 'rgba(91, 141, 238, 0.08)' : error ? 'rgba(248, 113, 113, 0.08)' : 'rgba(52, 211, 153, 0.08)', border: `1px solid ${loading ? 'rgba(91, 141, 238, 0.15)' : error ? 'rgba(248, 113, 113, 0.15)' : 'rgba(52, 211, 153, 0.15)'}` }}>
            {loading ? (
              <div className="w-1.5 h-1.5 border border-nx-accent border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-nx-red' : 'bg-nx-green'} animate-pulse`} />
            )}
            <span className={`text-2xs font-semibold ${loading ? 'text-nx-accent' : error ? 'text-nx-red' : 'text-nx-green'}`}>
              {loading ? 'Generating Signals...' : error ? 'Signal Error' : 'Live Signal Engine'}
            </span>
          </div>
          {lastGenerated && !loading && (
            <span className="text-2xs text-nx-text-hint">
              Generated {new Date(lastGenerated).toLocaleTimeString()}
              {refreshCountdown !== null && ` · Next in ${refreshCountdown}m`}
            </span>
          )}
        </div>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all duration-200 disabled:opacity-50"
          style={{ background: 'rgba(91, 141, 238, 0.12)', border: '1px solid rgba(91, 141, 238, 0.2)', color: '#5b8dee' }}
        >
          {loading ? 'Running...' : 'Regenerate Signals'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-xs text-nx-red" style={{ background: 'rgba(248, 113, 113, 0.06)', border: '1px solid rgba(248, 113, 113, 0.12)' }}>
          Signal Engine Error: {error}. Retrying may help.
        </div>
      )}

      {/* Trade History Stats Bar */}
      <HistoryStatsBar stats={historyStats} />

      {/* Tab row */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <h3 className="text-md font-bold text-nx-text-strong mr-2">Trade Ideas</h3>
        {[
          { id: 'long', label: `LONG (${signals.long.length})`, color: 'green' },
          { id: 'short', label: `SHORT (${signals.short.length})`, color: 'red' },
          { id: 'forex', label: `FOREX (${signals.forex.length})`, color: 'blue' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedStrategy('all') }}
            aria-label={`Show ${t.id} trade ideas`}
            aria-pressed={tab === t.id}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
              tab === t.id
                ? t.color === 'green' ? 'bg-nx-green-muted text-nx-green border border-nx-green/20'
                  : t.color === 'red' ? 'bg-nx-red-muted text-nx-red border border-nx-red/20'
                  : 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20'
                : 'text-nx-text-muted hover:text-nx-text-strong bg-nx-surface border border-nx-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Strategy filter + expired toggle */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="text-xs text-nx-text-muted mr-1 font-medium">Strategy:</span>
        {allStrategies.map(s => (
          <button
            key={s}
            onClick={() => setSelectedStrategy(s)}
            aria-label={`Filter by ${s === 'all' ? 'all strategies' : s.replace('-', ' ')} strategy`}
            aria-pressed={selectedStrategy === s}
            className={`px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 ${
              selectedStrategy === s
                ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20'
                : 'text-nx-text-hint hover:text-nx-text-muted bg-nx-void/40 border border-nx-border'
            }`}
          >
            {s === 'all' ? 'All' : `${STRATEGIES[s]?.icon || ''} ${s.replace('-', ' ')}`}
          </button>
        ))}
        {expiredCount > 0 && (
          <button
            onClick={() => setShowExpired(!showExpired)}
            className={`ml-auto px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 ${
              showExpired
                ? 'bg-nx-surface text-nx-text-muted border border-nx-border'
                : 'text-nx-text-hint hover:text-nx-text-muted bg-nx-void/40 border border-nx-border'
            }`}
          >
            {showExpired ? 'Hide' : 'Show'} Expired ({expiredCount})
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-nx-accent border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-nx-text-muted">Running signal engine across {tab === 'forex' ? '8 forex pairs' : tab === 'long' ? '12 long candidates' : '12 short candidates'}...</div>
          <div className="text-xs text-nx-text-hint">Analyzing RSI, MACD, Bollinger Bands, Support/Resistance</div>
        </div>
      )}

      {/* Cards grid */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(idea => (
            <TradeCard
              key={idea.id}
              trade={idea}
              quote={getQuote(idea)}
              direction={getDirection(idea)}
              onOpen={(idea, dir) => setOpenPacket({ idea, direction: dir })}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-16 text-nx-text-muted">
          No trade ideas match the selected strategy filter.
        </div>
      )}

      {openPacket && (
        <TradePacket
          idea={openPacket.idea}
          direction={openPacket.direction}
          currentPrice={getQuote(openPacket.idea)?.regularMarketPrice}
          onClose={() => setOpenPacket(null)}
        />
      )}
    </div>
  )
}
