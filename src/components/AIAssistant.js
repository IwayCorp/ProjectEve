'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'

// ============ CONSTANTS ============

const ASSET_CLASS_COLORS = {
  equity: '#22c55e', forex: '#f59e0b', crypto: '#a855f7',
  commodity: '#ef4444', macro: '#06b6d4',
}

const REGIME_LABELS = {
  'trending-bull': 'Bullish Trend',
  'trending-bear': 'Bearish Trend',
  'mean-reverting': 'Range-Bound',
  'volatile-transition': 'Volatile / Transition',
}

const STRATEGY_ICONS = {
  momentum: '\u2191', meanReversion: '\u21C4', breakout: '\u26A1', macro: '\u{1F30D}',
  'relative-value': '\u2696', carry: '\u{1F4B1}',
}

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '--'
  return Number(n).toFixed(d)
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

export default function AIAssistant({ quotes = {} }) {
  const [signals, setSignals] = useState(null)
  const [auditData, setAuditData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  // Fetch signals + audit data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sigRes, auditRes] = await Promise.allSettled([
        fetch('/api/signals').then(r => r.ok ? r.json() : null),
        fetch('/api/audit').then(r => r.ok ? r.json() : null),
      ])
      if (sigRes.status === 'fulfilled' && sigRes.value) setSignals(sigRes.value)
      if (auditRes.status === 'fulfilled' && auditRes.value) setAuditData(auditRes.value)
      setLastRefresh(new Date())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ============ DERIVED INTELLIGENCE ============

  // Top signals across all categories
  const topSignals = useMemo(() => {
    if (!signals) return []
    const all = []
    for (const cat of ['long', 'short', 'forex', 'macro']) {
      if (Array.isArray(signals.signals?.[cat])) {
        all.push(...signals.signals[cat])
      }
    }
    // Sort by confidence * quality
    return all
      .filter(s => s.confidence >= 60)
      .sort((a, b) => {
        const scoreA = (a.confidence || 0) + (a.expectedValue || 0) * 100 + (a.qualityGrade === 'A' || a.qualityGrade === 'A+' ? 20 : a.qualityGrade === 'B' ? 10 : 0)
        const scoreB = (b.confidence || 0) + (b.expectedValue || 0) * 100 + (b.qualityGrade === 'A' || b.qualityGrade === 'A+' ? 20 : b.qualityGrade === 'B' ? 10 : 0)
        return scoreB - scoreA
      })
      .slice(0, 8)
  }, [signals])

  // Current regime
  const currentRegime = signals?.marketRegime || {}
  const regimeKey = currentRegime.regime || 'volatile-transition'

  // Anomalies from audit
  const anomalies = auditData?.anomalies || []
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical')
  const corrections = auditData?.corrections || []

  // Per-class performance summary
  const classPerformance = useMemo(() => {
    if (!auditData?.perClass) return []
    return Object.entries(auditData.perClass)
      .filter(([, data]) => data.resolvedCount > 0 || data.signalCount > 0)
      .map(([ac, data]) => ({
        class: ac,
        color: ASSET_CLASS_COLORS[ac] || '#5b8dee',
        ...data,
        winRate: data.metrics?.winRate || 0,
        sharpe: data.metrics?.sharpeRatio || 0,
        avgReturn: data.metrics?.avgReturn || 0,
      }))
      .sort((a, b) => b.winRate - a.winRate)
  }, [auditData])

  // Regime-specific signals
  const regimeSignals = useMemo(() => {
    return topSignals.filter(s => {
      const sigRegime = s.regimeAnalysis?.currentRegime
      return !sigRegime || sigRegime === regimeKey
    })
  }, [topSignals, regimeKey])

  // Macro flags
  const macroFlags = useMemo(() => {
    const flags = []
    for (const sig of topSignals) {
      if (sig.regimeShift) flags.push({ type: 'regime_shift', ticker: sig.ticker, message: `Regime shift detected on ${sig.ticker}` })
      if (sig.correlationAnomaly) flags.push({ type: 'correlation', ticker: sig.ticker, message: `Correlation anomaly on ${sig.ticker}` })
    }
    return flags.slice(0, 5)
  }, [topSignals])

  // Build daily synthesis
  const synthesis = useMemo(() => {
    const lines = []

    // Regime
    lines.push({
      type: 'regime',
      title: 'Market Regime',
      content: `${REGIME_LABELS[regimeKey] || regimeKey}${currentRegime.strength ? ` (strength: ${currentRegime.strength}/5)` : ''}`,
      color: regimeKey.includes('bull') ? '#22c55e' : regimeKey.includes('bear') ? '#ef4444' : '#f59e0b',
    })

    // Critical anomalies first
    if (criticalAnomalies.length > 0) {
      lines.push({
        type: 'alert',
        title: 'Critical Anomalies',
        content: criticalAnomalies.map(a => a.message).join(' | '),
        color: '#ef4444',
      })
    }

    // Best class right now
    if (classPerformance.length > 0) {
      const best = classPerformance[0]
      lines.push({
        type: 'insight',
        title: 'Best Performing Class',
        content: `${best.class.toUpperCase()} — ${(best.winRate * 100).toFixed(0)}% win rate, Sharpe ${best.sharpe.toFixed(2)} across ${best.resolvedCount} trades`,
        color: best.color,
      })
    }

    // Top signal
    if (topSignals.length > 0) {
      const top = topSignals[0]
      lines.push({
        type: 'signal',
        title: 'Highest Conviction Signal',
        content: `${top.ticker} ${top.direction?.toUpperCase()} — ${top.confidence}% conf, ${top.strategy} strategy, grade ${top.qualityGrade || 'C'}`,
        color: top.direction === 'long' ? '#22c55e' : '#ef4444',
      })
    }

    // Macro flags
    if (macroFlags.length > 0) {
      lines.push({
        type: 'macro',
        title: 'Macro Flags Active',
        content: macroFlags.map(f => f.message).join(' | '),
        color: '#06b6d4',
      })
    }

    // Corrections active
    if (corrections.length > 0) {
      lines.push({
        type: 'correction',
        title: 'Adaptive Corrections',
        content: `${corrections.length} weight adjustments active across strategy and factor weights`,
        color: '#a855f7',
      })
    }

    return lines
  }, [regimeKey, currentRegime, criticalAnomalies, classPerformance, topSignals, macroFlags, corrections])

  // ============ LOADING ============

  if (loading && !signals) {
    return (
      <div className="space-y-5">
        <div className="nx-section-header"><div className="nx-accent-bar" /><h3>Signal Intelligence</h3></div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(91, 141, 238, 0.3)', borderTopColor: '#5b8dee' }} />
            <span className="text-sm text-nx-text-muted">Synthesizing market intelligence...</span>
          </div>
        </div>
      </div>
    )
  }

  // ============ RENDER ============

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Signal Intelligence</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">
            Cross-asset signal synthesis, regime context, and adaptive engine insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} disabled={loading}
            className="px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(var(--nx-text-muted))' }}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {lastRefresh && (
            <span className="text-2xs text-nx-text-hint">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Synthesis Cards */}
      <div className="space-y-2">
        {synthesis.map((item, i) => (
          <div key={i} className="px-4 py-3 rounded-xl flex items-start gap-3" style={{
            background: `${item.color}08`,
            border: `1px solid ${item.color}20`,
          }}>
            <div className="w-1 h-8 rounded-full mt-0.5" style={{ background: item.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-2xs font-bold uppercase tracking-wider mb-0.5" style={{ color: item.color }}>
                {item.title}
              </div>
              <div className="text-xs text-nx-text-strong leading-relaxed">{item.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Top Signals */}
        <div className="xl:col-span-2 space-y-3">
          <div className="text-sm font-semibold text-nx-text-strong">Top Conviction Signals</div>
          {topSignals.length === 0 ? (
            <GlassCard>
              <div className="text-center py-8 text-sm text-nx-text-muted">
                No high-confidence signals available. Check Trade Ideas for the latest scan.
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-1.5">
              {topSignals.map((sig, i) => {
                const acColor = ASSET_CLASS_COLORS[sig.asset] || '#5b8dee'
                const isLong = sig.direction === 'long'
                return (
                  <GlassCard key={sig.id || i} className="py-3" style={{ borderLeft: `3px solid ${acColor}` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-nx-text-strong">{sig.ticker}</span>
                        <span className={`text-2xs px-2 py-0.5 rounded-md font-bold ${
                          isLong ? 'bg-nx-green-muted text-nx-green border border-nx-green/15'
                            : 'bg-nx-red-muted text-nx-red border border-nx-red/15'
                        }`}>{sig.direction?.toUpperCase()}</span>
                        <span className="text-2xs px-1.5 py-0.5 rounded font-semibold capitalize"
                          style={{ background: `${acColor}15`, color: acColor, border: `1px solid ${acColor}25` }}>
                          {sig.asset}
                        </span>
                        <span className="text-2xs text-nx-text-hint">
                          {STRATEGY_ICONS[sig.strategy] || ''} {sig.strategy}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {sig.qualityGrade && (
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                            sig.qualityGrade === 'A' || sig.qualityGrade === 'A+' ? 'text-nx-green bg-nx-green-muted'
                              : sig.qualityGrade === 'B' ? 'text-nx-accent bg-nx-accent-muted'
                              : 'text-nx-text-muted'
                          }`}>{sig.qualityGrade}</span>
                        )}
                        <div className="text-right">
                          <div className="text-xs font-bold font-mono text-nx-accent">{sig.confidence}%</div>
                          <div className="text-2xs text-nx-text-hint">conf</div>
                        </div>
                      </div>
                    </div>

                    {/* Details row */}
                    <div className="flex items-center gap-4 mt-2 text-2xs text-nx-text-muted">
                      <span>Entry: <span className="font-mono text-nx-text-strong">${fmt(sig.entryLow)}-${fmt(sig.entryHigh)}</span></span>
                      <span>Target: <span className="font-mono text-nx-green">${fmt(sig.target)}</span></span>
                      <span>Stop: <span className="font-mono text-nx-red">${fmt(sig.stopLoss)}</span></span>
                      {sig.expectedValue != null && (
                        <span>EV: <span className={`font-mono ${sig.expectedValue >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>{fmt(sig.expectedValue * 100, 1)}%</span></span>
                      )}
                      <span>{sig.timeframe}</span>
                      {sig.regimeShift && <span className="px-1.5 py-0.5 rounded bg-nx-orange-muted text-nx-orange font-bold">REGIME SHIFT</span>}
                      {sig.correlationAnomaly && <span className="px-1.5 py-0.5 rounded bg-nx-cyan-muted text-cyan-400 font-bold">CORR ANOMALY</span>}
                    </div>

                    {/* Thesis */}
                    {sig.thesis && (
                      <div className="mt-2 text-2xs text-nx-text-muted leading-relaxed italic">
                        {sig.thesis}
                      </div>
                    )}
                  </GlassCard>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column — Class Performance + Anomalies */}
        <div className="space-y-4">
          {/* Per-Class Performance */}
          <GlassCard>
            <div className="text-sm font-semibold text-nx-text-strong mb-3">Class Performance</div>
            {classPerformance.length === 0 ? (
              <div className="text-xs text-nx-text-muted text-center py-6">
                No trade outcomes recorded yet. Paper trade signals to build performance data.
              </div>
            ) : (
              <div className="space-y-2">
                {classPerformance.map(cp => (
                  <div key={cp.class} className="flex items-center justify-between p-2.5 rounded-lg"
                    style={{ background: `${cp.color}08`, border: `1px solid ${cp.color}15` }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: cp.color }} />
                      <span className="text-xs font-semibold capitalize" style={{ color: cp.color }}>{cp.class}</span>
                    </div>
                    <div className="flex items-center gap-3 text-2xs">
                      <span className={`font-mono font-bold ${cp.winRate >= 0.6 ? 'text-nx-green' : cp.winRate >= 0.5 ? 'text-nx-orange' : 'text-nx-red'}`}>
                        {(cp.winRate * 100).toFixed(0)}% WR
                      </span>
                      <span className="text-nx-text-muted font-mono">{cp.resolvedCount} trades</span>
                      {cp.isLearningMode && (
                        <span className="text-nx-orange text-2xs">learning</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Active Anomalies */}
          <GlassCard>
            <div className="text-sm font-semibold text-nx-text-strong mb-3">
              Anomalies
              {anomalies.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-2xs font-bold"
                  style={{
                    background: criticalAnomalies.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                    color: criticalAnomalies.length > 0 ? '#ef4444' : '#f59e0b',
                  }}>
                  {anomalies.length}
                </span>
              )}
            </div>
            {anomalies.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-1">&#x2705;</div>
                <div className="text-xs text-nx-text-muted">All clear — no anomalies detected</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {anomalies.slice(0, 6).map((a, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg text-2xs" style={{
                    background: a.severity === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`,
                  }}>
                    <span className={`font-bold uppercase ${a.severity === 'critical' ? 'text-nx-red' : 'text-nx-orange'}`}>
                      {a.severity}
                    </span>
                    <span className="text-nx-text-muted ml-2">{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Macro Flags */}
          {macroFlags.length > 0 && (
            <GlassCard>
              <div className="text-sm font-semibold text-nx-text-strong mb-3">Macro Flags</div>
              <div className="space-y-1.5">
                {macroFlags.map((f, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg text-2xs flex items-center gap-2" style={{
                    background: 'rgba(6, 182, 212, 0.06)',
                    border: '1px solid rgba(6, 182, 212, 0.15)',
                  }}>
                    <span className="text-cyan-400 font-bold">{f.type === 'regime_shift' ? 'SHIFT' : 'CORR'}</span>
                    <span className="text-nx-text-muted">{f.message}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
