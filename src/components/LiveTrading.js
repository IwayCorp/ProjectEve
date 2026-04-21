'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

// ============ CONSTANTS ============

const STORAGE_KEY = 'noctis_paper_positions'
const MAX_HOLD_DAYS = 4
const LIFECYCLE_HOURS = MAX_HOLD_DAYS * 24

const ASSET_CLASS_COLORS = {
  equity: '#22c55e', forex: '#f59e0b', crypto: '#a855f7',
  commodity: '#ef4444', macro: '#06b6d4',
}

// ============ HELPERS ============

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadPositions() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePositions(positions) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)) } catch {}
}

function hoursElapsed(ts) {
  return (Date.now() - ts) / (1000 * 60 * 60)
}

function daysFrac(ts) {
  return hoursElapsed(ts) / 24
}

function fmt(n) {
  if (n == null) return '--'
  return typeof n === 'number' ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n
}

// ============ GLASS CARD ============

function GlassCard({ children, className = '', style = {} }) {
  return (
    <div className={`p-4 rounded-xl ${className}`} style={{
      background: 'rgba(15, 21, 35, 0.55)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      backdropFilter: 'blur(12px)', ...style,
    }}>
      {children}
    </div>
  )
}

// ============ MAIN COMPONENT ============

export default function LiveTrading({ quotes = {} }) {
  const [positions, setPositions] = useState([])
  const [closedPositions, setClosedPositions] = useState([])
  const [view, setView] = useState('positions')
  const [importing, setImporting] = useState(false)
  const initializedRef = useRef(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const all = loadPositions()
    setPositions(all.filter(p => p.status === 'OPEN'))
    setClosedPositions(all.filter(p => p.status !== 'OPEN').slice(-50))
  }, [])

  // Persist when positions change
  useEffect(() => {
    if (!initializedRef.current) return
    savePositions([...positions, ...closedPositions])
  }, [positions, closedPositions])

  // ============ IMPORT SIGNALS AS PAPER POSITIONS ============

  const importSignals = useCallback(() => {
    setImporting(true)
    try {
      // Read signals from TradeIdeas localStorage cache
      let signalCache = { long: [], short: [], forex: [], macro: [] }
      try {
        const raw = localStorage.getItem('noctis-signal-cache')
        if (raw) signalCache = JSON.parse(raw)
      } catch {}

      const allSignals = []
      for (const cat of ['long', 'short', 'forex', 'macro']) {
        if (Array.isArray(signalCache[cat])) {
          allSignals.push(...signalCache[cat])
        }
      }

      if (allSignals.length === 0) {
        setImporting(false)
        return 0
      }

      // Filter out signals already imported
      const existingTickers = new Set(positions.map(p => p.signalId))
      const newSignals = allSignals.filter(s => s.id && !existingTickers.has(s.id))

      const newPositions = newSignals.map(sig => {
        const entryMid = sig.entryLow && sig.entryHigh
          ? (sig.entryLow + sig.entryHigh) / 2
          : sig.entryLow || sig.entryHigh || 0

        // Get live price if available
        const quoteKey = sig.ticker?.includes('=') ? sig.ticker : sig.ticker
        const q = quotes[quoteKey]
        const livePrice = q?.regularMarketPrice || entryMid

        return {
          id: uid(),
          signalId: sig.id,
          ticker: sig.ticker,
          name: sig.name || sig.ticker,
          asset: sig.asset || 'equity',
          assetClass: sig.assetClass || sig.asset || 'equity',
          direction: sig.direction?.toUpperCase() || 'LONG',
          strategy: sig.strategy || 'momentum',
          entryPrice: livePrice || entryMid,
          targetPrice: sig.target || 0,
          stopLoss: sig.stopLoss || 0,
          confidence: sig.confidence || 50,
          regime: sig.regimeAnalysis?.currentRegime || 'volatile-transition',
          qualityGrade: sig.qualityGrade || 'C',
          expectedValue: sig.expectedValue || 0,
          openedAt: Date.now(),
          expiresAt: Date.now() + LIFECYCLE_HOURS * 3600000,
          status: 'OPEN',
          currentPrice: livePrice || entryMid,
          peakPrice: livePrice || entryMid,
          troughPrice: livePrice || entryMid,
          factors: {
            rsiAtEntry: sig.rsi,
            confidenceAtEntry: sig.confidence,
          },
        }
      })

      if (newPositions.length > 0) {
        setPositions(prev => [...prev, ...newPositions])
      }

      setImporting(false)
      return newPositions.length
    } catch (e) {
      setImporting(false)
      return 0
    }
  }, [quotes, positions])

  // ============ LIVE PRICE UPDATES + AUTO-RESOLVE ============

  const updatedPositions = useMemo(() => {
    return positions.map(pos => {
      // Find matching quote
      const quoteKey = pos.ticker
      const q = quotes[quoteKey]
      const livePrice = q?.regularMarketPrice || pos.currentPrice

      // Calculate P&L
      const pnlRaw = pos.direction === 'LONG'
        ? livePrice - pos.entryPrice
        : pos.entryPrice - livePrice
      const pnlPct = pos.entryPrice > 0 ? (pnlRaw / pos.entryPrice) * 100 : 0

      // Track peak/trough for trailing analysis
      const peak = Math.max(pos.peakPrice || pos.entryPrice, livePrice)
      const trough = Math.min(pos.troughPrice || pos.entryPrice, livePrice)

      // Lifecycle
      const holdHours = hoursElapsed(pos.openedAt)
      const holdDays = holdHours / 24
      const lifecyclePct = Math.min(100, (holdHours / LIFECYCLE_HOURS) * 100)
      const expired = holdHours >= LIFECYCLE_HOURS

      // Auto-resolve checks
      let autoResolve = null
      if (pos.direction === 'LONG') {
        if (livePrice >= pos.targetPrice && pos.targetPrice > 0) autoResolve = 'TARGET_HIT'
        else if (livePrice <= pos.stopLoss && pos.stopLoss > 0) autoResolve = 'STOP_HIT'
      } else {
        if (livePrice <= pos.targetPrice && pos.targetPrice > 0) autoResolve = 'TARGET_HIT'
        else if (livePrice >= pos.stopLoss && pos.stopLoss > 0) autoResolve = 'STOP_HIT'
      }
      if (expired && !autoResolve) autoResolve = 'EXPIRED'

      return {
        ...pos,
        currentPrice: livePrice,
        peakPrice: peak,
        troughPrice: trough,
        unrealizedPnl: pnlRaw,
        unrealizedPct: pnlPct,
        holdHours,
        holdDays,
        lifecyclePct,
        expired,
        autoResolve,
      }
    })
  }, [positions, quotes])

  // Auto-close resolved positions and record to audit API
  useEffect(() => {
    const toClose = updatedPositions.filter(p => p.autoResolve)
    if (toClose.length === 0) return

    const remaining = []
    const justClosed = []

    for (const pos of updatedPositions) {
      if (pos.autoResolve) {
        const closed = {
          ...pos,
          status: pos.autoResolve,
          closedAt: Date.now(),
          closedPrice: pos.currentPrice,
          actualReturn: pos.unrealizedPct / 100,
          holdDuration: pos.holdHours,
        }
        justClosed.push(closed)

        // Record outcome to adaptive engine via audit API
        try {
          fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'record',
              signal: {
                id: closed.signalId || closed.id,
                ticker: closed.ticker,
                direction: closed.direction.toLowerCase(),
                strategy: closed.strategy,
                confidence: closed.confidence,
                regime: closed.regime,
                assetType: closed.asset,
                entryPrice: closed.entryPrice,
                targetPrice: closed.targetPrice,
                stopPrice: closed.stopLoss,
                factors: closed.factors,
              },
              outcome: {
                result: closed.autoResolve === 'TARGET_HIT' ? 'WIN'
                  : closed.autoResolve === 'STOP_HIT' ? 'LOSS'
                  : closed.actualReturn >= 0 ? 'WIN' : 'LOSS',
                actualReturn: closed.actualReturn,
                holdDuration: closed.holdDuration,
                resolvedAt: closed.closedAt,
              },
            }),
          }).catch(() => {})
        } catch {}
      } else {
        remaining.push(pos)
      }
    }

    if (justClosed.length > 0) {
      setPositions(remaining.map(p => ({
        id: p.id, signalId: p.signalId, ticker: p.ticker, name: p.name,
        asset: p.asset, assetClass: p.assetClass, direction: p.direction,
        strategy: p.strategy, entryPrice: p.entryPrice, targetPrice: p.targetPrice,
        stopLoss: p.stopLoss, confidence: p.confidence, regime: p.regime,
        qualityGrade: p.qualityGrade, expectedValue: p.expectedValue,
        openedAt: p.openedAt, expiresAt: p.expiresAt, status: 'OPEN',
        currentPrice: p.currentPrice, peakPrice: p.peakPrice, troughPrice: p.troughPrice,
        factors: p.factors,
      })))
      setClosedPositions(prev => [...prev, ...justClosed].slice(-50))
    }
  }, [updatedPositions])

  // ============ MANUAL CLOSE ============

  const closePosition = useCallback((posId) => {
    const pos = updatedPositions.find(p => p.id === posId)
    if (!pos) return

    const closed = {
      ...pos,
      status: 'MANUAL_CLOSE',
      closedAt: Date.now(),
      closedPrice: pos.currentPrice,
      actualReturn: pos.unrealizedPct / 100,
      holdDuration: pos.holdHours,
    }

    // Record to audit API
    try {
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          signal: {
            id: closed.signalId || closed.id,
            ticker: closed.ticker,
            direction: closed.direction.toLowerCase(),
            strategy: closed.strategy,
            confidence: closed.confidence,
            regime: closed.regime,
            assetType: closed.asset,
            entryPrice: closed.entryPrice,
            targetPrice: closed.targetPrice,
            stopPrice: closed.stopLoss,
            factors: closed.factors,
          },
          outcome: {
            result: closed.actualReturn >= 0 ? 'WIN' : 'LOSS',
            actualReturn: closed.actualReturn,
            holdDuration: closed.holdDuration,
            resolvedAt: closed.closedAt,
          },
        }),
      }).catch(() => {})
    } catch {}

    setPositions(prev => prev.filter(p => p.id !== posId))
    setClosedPositions(prev => [...prev, closed].slice(-50))
  }, [updatedPositions])

  // ============ DERIVED METRICS ============

  const totalUnrealized = updatedPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0)
  const totalEntryValue = updatedPositions.reduce((sum, p) => sum + (p.entryPrice || 0), 0)
  const portfolioPnlPct = totalEntryValue > 0 ? (totalUnrealized / totalEntryValue) * 100 : 0

  const closedWins = closedPositions.filter(p => (p.actualReturn || 0) > 0).length
  const closedTotal = closedPositions.length
  const closedWinRate = closedTotal > 0 ? (closedWins / closedTotal) * 100 : 0
  const closedTotalReturn = closedPositions.reduce((sum, p) => sum + (p.actualReturn || 0), 0) * 100

  // Per-class breakdown
  const classCounts = useMemo(() => {
    const counts = {}
    for (const p of updatedPositions) {
      const ac = p.assetClass || p.asset || 'equity'
      if (!counts[ac]) counts[ac] = { open: 0, pnl: 0 }
      counts[ac].open++
      counts[ac].pnl += p.unrealizedPnl || 0
    }
    return counts
  }, [updatedPositions])

  // ============ RENDER ============

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Paper Trading</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">
            4-day lifecycle paper trading with auto-resolution. Outcomes feed back into the adaptive engine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={importSignals}
            disabled={importing}
            className="px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all"
            style={{ background: 'rgba(91, 141, 238, 0.12)', border: '1px solid rgba(91, 141, 238, 0.25)', color: '#5b8dee' }}
          >
            {importing ? 'Importing...' : 'Import Signals'}
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-nx-green animate-pulse" />
            <span className="text-2xs font-semibold text-nx-green">Paper Mode</span>
          </div>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-0 rounded-xl overflow-hidden" style={{ background: 'rgba(15, 21, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        {[
          { label: 'Open Positions', value: updatedPositions.length, color: 'text-nx-text-strong' },
          { label: 'Unrealized P&L', value: `${totalUnrealized >= 0 ? '+' : ''}${portfolioPnlPct.toFixed(2)}%`, color: totalUnrealized >= 0 ? 'text-nx-green' : 'text-nx-red' },
          { label: 'Closed Trades', value: closedTotal, color: 'text-nx-text-strong' },
          { label: 'Win Rate', value: `${closedWinRate.toFixed(0)}%`, color: closedWinRate >= 60 ? 'text-nx-green' : closedWinRate >= 50 ? 'text-nx-orange' : 'text-nx-red' },
          { label: 'Total Return', value: `${closedTotalReturn >= 0 ? '+' : ''}${closedTotalReturn.toFixed(2)}%`, color: closedTotalReturn >= 0 ? 'text-nx-green' : 'text-nx-red' },
          { label: 'Avg Hold', value: closedTotal > 0 ? `${(closedPositions.reduce((s, p) => s + (p.holdDuration || 0), 0) / closedTotal / 24).toFixed(1)}d` : '--', color: 'text-nx-accent' },
        ].map((item, i) => (
          <div key={i} className="p-3.5 text-center" style={{ borderRight: i < 5 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none' }}>
            <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">{item.label}</div>
            <div className={`text-lg font-bold font-mono tabular-nums mt-1 ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Per-class mini badges */}
      {Object.keys(classCounts).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(classCounts).map(([ac, data]) => (
            <div key={ac} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs"
              style={{ background: `${ASSET_CLASS_COLORS[ac] || '#5b8dee'}10`, border: `1px solid ${ASSET_CLASS_COLORS[ac] || '#5b8dee'}30` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ASSET_CLASS_COLORS[ac] || '#5b8dee' }} />
              <span className="font-semibold capitalize" style={{ color: ASSET_CLASS_COLORS[ac] || '#5b8dee' }}>{ac}</span>
              <span className="text-nx-text-muted">{data.open} open</span>
              <span className={`font-mono ${data.pnl >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
                {data.pnl >= 0 ? '+' : ''}{((data.pnl / (totalEntryValue || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-1 p-0.5">
        {['positions', 'closed', 'log'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-2xs rounded-lg font-semibold transition-all duration-200 capitalize ${
              view === v ? 'text-nx-accent border border-nx-accent/20' : 'text-nx-text-muted hover:text-nx-text-strong'
            }`}
            style={view === v ? { background: 'rgba(91, 141, 238, 0.12)' } : {}}
          >
            {v === 'positions' ? `Open (${updatedPositions.length})`
              : v === 'closed' ? `Closed (${closedTotal})`
              : `Feed (${closedTotal})`}
          </button>
        ))}
      </div>

      {/* ======== OPEN POSITIONS ======== */}
      {view === 'positions' && (
        <div className="space-y-2">
          {updatedPositions.length === 0 ? (
            <GlassCard>
              <div className="flex flex-col items-center py-12 text-center">
                <div className="text-3xl mb-3">&#x1F4CB;</div>
                <div className="text-sm font-semibold text-nx-text-strong mb-1">No Open Positions</div>
                <div className="text-xs text-nx-text-muted mb-4">
                  Import signals from Trade Ideas to start paper trading with the 4-day lifecycle.
                </div>
                <button
                  onClick={importSignals}
                  disabled={importing}
                  className="px-4 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(91, 141, 238, 0.15)', border: '1px solid rgba(91, 141, 238, 0.3)', color: '#5b8dee' }}
                >
                  Import Active Signals
                </button>
              </div>
            </GlassCard>
          ) : (
            updatedPositions.map(pos => {
              const acColor = ASSET_CLASS_COLORS[pos.assetClass || pos.asset] || '#5b8dee'
              const isWinning = (pos.unrealizedPnl || 0) >= 0
              const lifecycleUrgent = pos.lifecyclePct > 80

              return (
                <GlassCard key={pos.id} style={{ borderLeft: `3px solid ${acColor}` }}>
                  {/* Row 1: Ticker, direction, P&L, close button */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-nx-text-strong">{pos.ticker}</span>
                      <span className={`text-2xs px-2 py-0.5 rounded-md font-bold ${
                        pos.direction === 'LONG'
                          ? 'bg-nx-green-muted text-nx-green border border-nx-green/15'
                          : 'bg-nx-red-muted text-nx-red border border-nx-red/15'
                      }`}>{pos.direction}</span>
                      <span className="text-2xs px-1.5 py-0.5 rounded font-semibold capitalize"
                        style={{ background: `${acColor}15`, color: acColor, border: `1px solid ${acColor}25` }}>
                        {pos.assetClass || pos.asset}
                      </span>
                      <span className="text-2xs text-nx-text-hint">{pos.strategy}</span>
                      {pos.qualityGrade && (
                        <span className={`text-2xs px-1.5 py-0.5 rounded font-bold ${
                          pos.qualityGrade === 'A' || pos.qualityGrade === 'A+' ? 'text-nx-green bg-nx-green-muted'
                            : pos.qualityGrade === 'B' ? 'text-nx-accent bg-nx-accent-muted'
                            : 'text-nx-text-muted bg-nx-text-muted/5'
                        }`}>{pos.qualityGrade}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`text-sm font-bold font-mono ${isWinning ? 'text-nx-green' : 'text-nx-red'}`}>
                          {isWinning ? '+' : ''}{(pos.unrealizedPct || 0).toFixed(2)}%
                        </div>
                        <div className="text-2xs text-nx-text-hint font-mono">
                          ${fmt(pos.currentPrice)}
                        </div>
                      </div>
                      <button
                        onClick={() => closePosition(pos.id)}
                        className="px-2 py-1 rounded text-2xs font-semibold transition-all"
                        style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Entry/Stop/Target bar */}
                  <div className="flex items-center gap-3 text-2xs mb-2">
                    <span className="text-nx-text-muted">Entry: <span className="font-mono text-nx-text-strong">${fmt(pos.entryPrice)}</span></span>
                    <span className="text-nx-red">Stop: <span className="font-mono">${fmt(pos.stopLoss)}</span></span>
                    <span className="text-nx-green">Target: <span className="font-mono">${fmt(pos.targetPrice)}</span></span>
                    <span className="text-nx-text-hint">Conf: {pos.confidence}%</span>
                  </div>

                  {/* Row 3: 4-day lifecycle progress */}
                  <div className="relative">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${Math.max(2, pos.lifecyclePct || 0)}%`,
                        background: lifecycleUrgent
                          ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                          : 'linear-gradient(90deg, rgba(91,141,238,0.4), rgba(91,141,238,0.7))',
                      }} />
                    </div>
                    <div className="flex justify-between mt-1 text-2xs text-nx-text-hint">
                      <span>Day {Math.floor(pos.holdDays || 0) + 1} of {MAX_HOLD_DAYS}</span>
                      <span>{lifecycleUrgent ? 'Expiring soon' : `${(LIFECYCLE_HOURS - (pos.holdHours || 0)).toFixed(0)}h remaining`}</span>
                    </div>
                  </div>
                </GlassCard>
              )
            })
          )}
        </div>
      )}

      {/* ======== CLOSED POSITIONS ======== */}
      {view === 'closed' && (
        <div className="space-y-1">
          {closedPositions.length === 0 ? (
            <GlassCard>
              <div className="flex flex-col items-center py-12 text-center">
                <div className="text-3xl mb-3">&#x1F4C8;</div>
                <div className="text-sm font-semibold text-nx-text-strong mb-1">No Closed Trades Yet</div>
                <div className="text-xs text-nx-text-muted">
                  Positions auto-close when they hit target, stop loss, or the 4-day lifecycle expires.
                </div>
              </div>
            </GlassCard>
          ) : (
            <>
              <div className="grid grid-cols-8 gap-2 px-4 py-2 text-2xs text-nx-text-muted uppercase tracking-wider font-medium">
                <span>Ticker</span><span>Side</span><span>Class</span><span>Strategy</span>
                <span>Return</span><span>Hold</span><span>Exit</span><span>Result</span>
              </div>
              {[...closedPositions].reverse().map(pos => {
                const isWin = (pos.actualReturn || 0) > 0
                const exitLabel = pos.status === 'TARGET_HIT' ? 'Target' : pos.status === 'STOP_HIT' ? 'Stop' : pos.status === 'EXPIRED' ? 'Expired' : 'Manual'
                return (
                  <div key={pos.id} className="nx-card grid grid-cols-8 gap-2 px-4 py-3 items-center">
                    <span className="text-xs font-bold text-nx-text-strong">{pos.ticker}</span>
                    <span className={`text-2xs px-2 py-0.5 rounded-md font-bold inline-block w-fit ${
                      pos.direction === 'LONG' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'
                    }`}>{pos.direction}</span>
                    <span className="text-2xs capitalize" style={{ color: ASSET_CLASS_COLORS[pos.assetClass || pos.asset] || '#5b8dee' }}>
                      {pos.assetClass || pos.asset}
                    </span>
                    <span className="text-2xs text-nx-text-muted">{pos.strategy}</span>
                    <span className={`text-xs font-bold font-mono ${isWin ? 'text-nx-green' : 'text-nx-red'}`}>
                      {isWin ? '+' : ''}{((pos.actualReturn || 0) * 100).toFixed(2)}%
                    </span>
                    <span className="text-2xs text-nx-text-muted font-mono">{((pos.holdDuration || 0) / 24).toFixed(1)}d</span>
                    <span className="text-2xs text-nx-text-muted">{exitLabel}</span>
                    <span className={`text-2xs px-2 py-0.5 rounded-md font-bold inline-block w-fit ${
                      isWin ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'
                    }`}>{isWin ? 'WIN' : 'LOSS'}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* ======== FEEDBACK LOG ======== */}
      {view === 'log' && (
        <div className="space-y-2">
          {closedPositions.length === 0 ? (
            <GlassCard>
              <div className="text-center py-8 text-sm text-nx-text-muted">
                No feedback data yet. Close positions to see the learning feed.
              </div>
            </GlassCard>
          ) : (
            [...closedPositions].reverse().map(pos => {
              const isWin = (pos.actualReturn || 0) > 0
              const acColor = ASSET_CLASS_COLORS[pos.assetClass || pos.asset] || '#5b8dee'
              return (
                <div key={pos.id} className="px-4 py-3 rounded-xl" style={{
                  background: isWin ? 'rgba(34, 197, 94, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                  border: `1px solid ${isWin ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)'}`,
                }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-2xs font-bold ${isWin ? 'text-nx-green' : 'text-nx-red'}`}>
                        {isWin ? 'WIN' : 'LOSS'}
                      </span>
                      <span className="text-xs font-bold text-nx-text-strong">{pos.ticker}</span>
                      <span className="text-2xs capitalize" style={{ color: acColor }}>{pos.assetClass || pos.asset}</span>
                    </div>
                    <span className={`text-xs font-mono font-bold ${isWin ? 'text-nx-green' : 'text-nx-red'}`}>
                      {isWin ? '+' : ''}{((pos.actualReturn || 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-2xs text-nx-text-hint">
                    {pos.strategy} | {pos.direction} | {((pos.holdDuration || 0) / 24).toFixed(1)}d hold | {pos.status?.replace(/_/g, ' ')} |
                    Recorded to {pos.assetClass || pos.asset} model at {pos.closedAt ? new Date(pos.closedAt).toLocaleTimeString() : '--'}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
