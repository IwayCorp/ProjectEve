'use client'
import { useState, useEffect, useCallback } from 'react'

// ============ CONSTANTS ============

const BRIEF_TYPES = [
  { id: 'pre-market', key: 'preMarket', label: 'Pre-Market', time: '~8:30 AM ET', icon: '\u2600\uFE0F' },
  { id: 'midday', key: 'midday', label: 'Midday', time: '~12:30 PM ET', icon: '\u2601\uFE0F' },
  { id: 'post-close', key: 'postClose', label: 'Post-Close', time: '~5:30 PM ET', icon: '\u{1F319}' },
]

const REGIME_COLORS = {
  'trending-bull': { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.25)' },
  'trending-bear': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' },
  'mean-reverting': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' },
  'volatile-transition': { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.25)' },
}

// ============ HELPERS ============

function getETHour() {
  try {
    const str = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
    return new Date(str).getHours()
  } catch {
    return new Date().getHours()
  }
}

function getActiveBriefType() {
  const hour = getETHour()
  if (hour < 10) return 'pre-market'
  if (hour < 14) return 'midday'
  return 'post-close'
}

function formatChange(val) {
  if (val == null || isNaN(val)) return '--'
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(2)}%`
}

function changeColor(val) {
  if (val == null) return 'rgba(255,255,255,0.4)'
  if (val > 0.1) return '#22c55e'
  if (val < -0.1) return '#ef4444'
  return 'rgba(255,255,255,0.5)'
}

// ============ SUB-COMPONENTS ============

function MarketSnapshotRow({ snapshot }) {
  if (!snapshot) return null
  const items = [
    { label: 'SPY', data: snapshot.SPY },
    { label: 'QQQ', data: snapshot.QQQ },
    { label: 'IWM', data: snapshot.IWM },
    { label: 'VIX', data: snapshot.VIX },
    { label: '10Y', data: snapshot['10Y'] },
    { label: 'DXY', data: snapshot.DXY },
  ]
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {items.map(item => (
        <div
          key={item.label}
          className="p-2 rounded-lg text-center"
          style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="text-2xs text-nx-text-hint mb-0.5">{item.label}</div>
          <div className="text-xs font-mono font-bold text-nx-text-strong">
            {item.data?.price ? (item.label === '10Y' ? item.data.price.toFixed(3) : item.data.price.toFixed(2)) : '--'}
          </div>
          <div className="text-2xs font-mono" style={{ color: changeColor(item.data?.change) }}>
            {formatChange(item.data?.change)}
          </div>
        </div>
      ))}
    </div>
  )
}

function SectorGrid({ sectors }) {
  if (!sectors || Object.keys(sectors).length === 0) return null
  const sorted = Object.entries(sectors).sort((a, b) => (b[1].change || 0) - (a[1].change || 0))
  return (
    <div className="mt-3">
      <div className="text-2xs text-nx-text-muted font-semibold mb-2">Sector Performance</div>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map(([name, data]) => (
          <div
            key={name}
            className="px-2 py-1 rounded-md text-2xs font-mono"
            style={{
              background: data.change > 0 ? 'rgba(34,197,94,0.08)' : data.change < 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${data.change > 0 ? 'rgba(34,197,94,0.2)' : data.change < 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
              color: data.change > 0 ? '#22c55e' : data.change < 0 ? '#ef4444' : 'rgba(255,255,255,0.5)',
            }}
          >
            {name}: {formatChange(data.change)}
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightsList({ insights }) {
  if (!insights || insights.length === 0) return null
  return (
    <div className="mt-3">
      <div className="text-2xs text-nx-text-muted font-semibold mb-2">Key Insights</div>
      <div className="space-y-1.5">
        {insights.map((insight, i) => {
          const isIndented = insight.startsWith('  ')
          return (
            <div
              key={i}
              className={`text-xs leading-relaxed ${isIndented ? 'ml-4' : ''}`}
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {!isIndented && (
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0" style={{ background: '#5b8dee', verticalAlign: 'middle' }} />
              )}
              {insight.trim()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActionItems({ items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="mt-3">
      <div className="text-2xs text-nx-text-muted font-semibold mb-2">Action Items</div>
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const isCritical = item.toLowerCase().includes('critical')
          return (
            <div
              key={i}
              className="flex items-start gap-2 text-xs leading-relaxed"
            >
              <span
                className="mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-2xs font-bold"
                style={{
                  background: isCritical ? 'rgba(239,68,68,0.15)' : 'rgba(91,141,238,0.12)',
                  border: `1px solid ${isCritical ? 'rgba(239,68,68,0.3)' : 'rgba(91,141,238,0.25)'}`,
                  color: isCritical ? '#ef4444' : '#5b8dee',
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: isCritical ? '#ef4444' : 'rgba(255,255,255,0.7)' }}>
                {item}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============ BRIEF CARD ============

function BriefCard({ briefDef, brief, isActive, isPast, onRefresh, refreshing }) {
  const [expanded, setExpanded] = useState(isActive)

  const hasBrief = brief && brief.generatedAt
  const regimeStyle = brief?.regime ? REGIME_COLORS[brief.regime] : null

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: isActive
          ? 'rgba(91, 141, 238, 0.06)'
          : 'rgba(15, 21, 35, 0.55)',
        border: `1px solid ${isActive
          ? 'rgba(91, 141, 238, 0.2)'
          : 'rgba(255, 255, 255, 0.06)'}`,
        opacity: isPast && !isActive ? 0.6 : 1,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <span className="text-xl">{briefDef.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-nx-text-strong">{briefDef.label}</span>
            {isActive && (
              <span
                className="px-1.5 py-0.5 rounded text-2xs font-bold"
                style={{ background: 'rgba(91,141,238,0.15)', border: '1px solid rgba(91,141,238,0.25)', color: '#5b8dee' }}
              >
                ACTIVE
              </span>
            )}
            {regimeStyle && hasBrief && (
              <span
                className="px-1.5 py-0.5 rounded text-2xs font-semibold"
                style={{ background: regimeStyle.bg, border: `1px solid ${regimeStyle.border}`, color: regimeStyle.color }}
              >
                {brief.regime.replace(/-/g, ' ')}
              </span>
            )}
          </div>
          <div className="text-2xs text-nx-text-hint">
            {hasBrief ? new Date(brief.generatedAt).toLocaleString() : briefDef.time}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh(briefDef.id) }}
            disabled={refreshing}
            className="px-2.5 py-1 rounded-md text-2xs font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgb(var(--nx-text-muted))',
            }}
          >
            {refreshing ? '...' : 'Refresh'}
          </button>
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {!hasBrief ? (
            <div className="py-8 text-center">
              <div className="text-sm text-nx-text-muted mb-2">No brief generated yet</div>
              <div className="text-2xs text-nx-text-hint mb-4">
                Click &ldquo;Refresh&rdquo; to fetch the latest {briefDef.label.toLowerCase()} brief with live market data.
              </div>
              <button
                onClick={() => onRefresh(briefDef.id)}
                disabled={refreshing}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(91, 141, 238, 0.12)',
                  border: '1px solid rgba(91, 141, 238, 0.25)',
                  color: '#5b8dee',
                }}
              >
                {refreshing ? 'Fetching...' : `Generate ${briefDef.label} Brief`}
              </button>
            </div>
          ) : (
            <div className="pt-3 space-y-3">
              {/* Brief title */}
              {brief.title && (
                <div className="text-sm font-semibold text-nx-text-strong">{brief.title}</div>
              )}

              {/* Market snapshot */}
              <MarketSnapshotRow snapshot={brief.marketSnapshot} />

              {/* Sectors */}
              <SectorGrid sectors={brief.sectors} />

              {/* Insights */}
              <InsightsList insights={brief.insights} />

              {/* Action items */}
              <ActionItems items={brief.actionItems} />

              {/* Mode indicator */}
              {brief.mode === 'learning' && (
                <div
                  className="mt-2 px-3 py-2 rounded-lg text-2xs flex items-center gap-2"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  <span style={{ color: '#f59e0b' }}>&#x1F4D6;</span>
                  <span className="text-nx-text-muted">Engine is in learning mode. Recommendations are based on default weights.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============ MAIN COMPONENT ============

export default function DailyBrief({ briefs: externalBriefs }) {
  const [briefs, setBriefs] = useState(externalBriefs || {})
  const [refreshingType, setRefreshingType] = useState(null)
  const [error, setError] = useState(null)
  const [activeBrief] = useState(() => getActiveBriefType())

  // Sync external briefs
  useEffect(() => {
    if (externalBriefs) setBriefs(externalBriefs)
  }, [externalBriefs])

  const handleRefresh = useCallback(async (briefType) => {
    try {
      setRefreshingType(briefType)
      setError(null)
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'daily-brief', briefType }),
      })
      if (!res.ok) throw new Error(`Failed to fetch brief: ${res.status}`)
      const data = await res.json()
      if (data.brief) {
        const key = briefType === 'pre-market' ? 'preMarket' : briefType === 'midday' ? 'midday' : 'postClose'
        setBriefs(prev => ({ ...prev, [key]: data.brief }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshingType(null)
    }
  }, [])

  // Determine which briefs are past/active
  const etHour = getETHour()

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm font-semibold text-nx-text-strong">Daily Intelligence Briefs</div>
          <div className="text-2xs text-nx-text-muted">
            Three daily briefs with live market data, regime analysis, and strategy recommendations
          </div>
        </div>
        <button
          onClick={() => handleRefresh(activeBrief)}
          disabled={refreshingType !== null}
          className="px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all"
          style={{
            background: 'rgba(91, 141, 238, 0.12)',
            border: '1px solid rgba(91, 141, 238, 0.25)',
            color: '#5b8dee',
          }}
        >
          {refreshingType ? 'Fetching...' : 'Refresh Current'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="px-4 py-2 rounded-lg text-xs flex items-center gap-2"
          style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-2xs underline">Dismiss</button>
        </div>
      )}

      {/* Brief cards */}
      {BRIEF_TYPES.map(bt => {
        const isActive = bt.id === activeBrief
        const isPast = (bt.id === 'pre-market' && etHour >= 10)
          || (bt.id === 'midday' && etHour >= 14)
        const brief = briefs?.[bt.key] || null

        return (
          <BriefCard
            key={bt.id}
            briefDef={bt}
            brief={brief}
            isActive={isActive}
            isPast={isPast && !isActive}
            onRefresh={handleRefresh}
            refreshing={refreshingType === bt.id}
          />
        )
      })}

      {/* Quick legend */}
      <div className="flex items-center gap-4 text-2xs text-nx-text-hint pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#5b8dee' }} />
          Active slot
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
          Past brief (dimmed)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          Upcoming
        </div>
      </div>
    </div>
  )
}
