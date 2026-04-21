'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ============ CONSTANTS ============

const BRIEF_DEFS = [
  {
    id: 'pre-market',
    key: 'preMarket',
    label: 'Pre-Market',
    time: '8:30 AM ET',
    scheduleHour: 8, scheduleMinute: 30,
    accentColor: '96, 165, 250',   // blue
    accentHex: '#60a5fa',
    iconBg: 'rgba(96, 165, 250, 0.1)',
    iconBorder: 'rgba(96, 165, 250, 0.2)',
  },
  {
    id: 'midday',
    key: 'midday',
    label: 'Midday',
    time: '12:30 PM ET',
    scheduleHour: 12, scheduleMinute: 30,
    accentColor: '245, 158, 11',   // amber
    accentHex: '#f59e0b',
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconBorder: 'rgba(245, 158, 11, 0.2)',
  },
  {
    id: 'post-close',
    key: 'postClose',
    label: 'Post-Close',
    time: '5:30 PM ET',
    scheduleHour: 17, scheduleMinute: 30,
    accentColor: '167, 139, 250',  // purple
    accentHex: '#a78bfa',
    iconBg: 'rgba(167, 139, 250, 0.1)',
    iconBorder: 'rgba(167, 139, 250, 0.2)',
  },
]

const REGIME_STYLES = {
  'trending-bull':       { color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)',  label: 'BULL' },
  'trending-bear':       { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',  label: 'BEAR' },
  'mean-reverting':      { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', label: 'NEUTRAL' },
  'volatile-transition': { color: '#a78bfa', bg: 'rgba(167,139,250,0.10)',border: 'rgba(167,139,250,0.25)',label: 'VOLATILE' },
}

// ============ SVG ICONS ============

function ClockIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5" opacity="0.8" />
      <path d="M10 5.5V10L13 12.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SunIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="4" stroke={color} strokeWidth="1.5" />
      <path d="M10 2V4M10 16V18M2 10H4M16 10H18M4.93 4.93L6.34 6.34M13.66 13.66L15.07 15.07M15.07 4.93L13.66 6.34M6.34 13.66L4.93 15.07" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M17.5 11.2A7.5 7.5 0 018.8 2.5 7.5 7.5 0 1017.5 11.2z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ expanded }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
    >
      <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RefreshIcon({ spinning }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={spinning ? { animation: 'spin 1s linear infinite' } : {}}
    >
      <path d="M11.5 2.5V5.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 8.5A4.5 4.5 0 113.1 4.6L2.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ============ HELPERS ============

function getETNow() {
  try {
    const str = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
    const d = new Date(str)
    return { hour: d.getHours(), minute: d.getMinutes(), dayOfWeek: d.getDay() }
  } catch {
    const d = new Date()
    return { hour: d.getHours(), minute: d.getMinutes(), dayOfWeek: d.getDay() }
  }
}

function getBriefStatus(briefDef) {
  const et = getETNow()
  const nowMins = et.hour * 60 + et.minute
  const scheduleMins = briefDef.scheduleHour * 60 + briefDef.scheduleMinute

  if (nowMins >= scheduleMins && nowMins < scheduleMins + 240) return 'active'
  if (nowMins > scheduleMins + 240) return 'past'
  return 'upcoming'
}

function getNextBriefCountdown() {
  const et = getETNow()
  const nowMins = et.hour * 60 + et.minute

  for (const bd of BRIEF_DEFS) {
    const scheduleMins = bd.scheduleHour * 60 + bd.scheduleMinute
    if (nowMins < scheduleMins) {
      const diff = scheduleMins - nowMins
      const h = Math.floor(diff / 60)
      const m = diff % 60
      return { label: bd.label, countdown: h > 0 ? `${h}h ${m}m` : `${m}m`, id: bd.id }
    }
  }
  // All briefs have passed for today
  return { label: 'Pre-Market', countdown: 'Tomorrow', id: 'pre-market' }
}

function isMarketHours() {
  const et = getETNow()
  // Weekdays only, 9:30 AM - 4:00 PM ET
  if (et.dayOfWeek === 0 || et.dayOfWeek === 6) return false
  const nowMins = et.hour * 60 + et.minute
  return nowMins >= 570 && nowMins <= 960 // 9:30=570, 16:00=960
}

function formatTimestamp(isoStr) {
  if (!isoStr) return null
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return isoStr
  }
}

function timeSince(isoStr) {
  if (!isoStr) return null
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m ago`
  return `${Math.floor(hours / 24)}d ago`
}

function fmtChange(val) {
  if (val == null || isNaN(val)) return '--'
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(2)}%`
}

function changeColor(val) {
  if (val == null) return 'rgb(var(--nx-text-hint))'
  if (val > 0.05) return '#22c55e'
  if (val < -0.05) return '#ef4444'
  return 'rgb(var(--nx-text-muted))'
}

// ============ SUB-COMPONENTS ============

function MarketSnapshot({ snapshot }) {
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
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-3">
      {items.map(item => (
        <div
          key={item.label}
          className="rounded-lg p-1.5 text-center"
          style={{
            background: 'rgba(var(--nx-void) / 0.5)',
            border: '1px solid var(--nx-border)',
          }}
        >
          <div className="text-2xs font-medium" style={{ color: 'rgb(var(--nx-text-hint))' }}>{item.label}</div>
          <div className="text-xs font-mono font-bold" style={{ color: 'rgb(var(--nx-text-strong))' }}>
            {item.data?.price ? (item.label === '10Y' ? item.data.price.toFixed(3) : item.data.price.toFixed(2)) : '--'}
          </div>
          <div className="text-2xs font-mono font-semibold" style={{ color: changeColor(item.data?.change) }}>
            {fmtChange(item.data?.change)}
          </div>
        </div>
      ))}
    </div>
  )
}

function InsightList({ insights, maxVisible = 5 }) {
  const [showAll, setShowAll] = useState(false)
  if (!insights || insights.length === 0) return null
  const visible = showAll ? insights : insights.slice(0, maxVisible)

  return (
    <div className="mt-3">
      <div className="text-2xs font-semibold mb-1.5" style={{ color: 'rgb(var(--nx-text-muted))' }}>Key Insights</div>
      <div className="space-y-1">
        {visible.map((insight, i) => {
          const isIndented = insight.startsWith('  ')
          return (
            <div
              key={i}
              className={`text-xs leading-relaxed flex items-start gap-1.5 ${isIndented ? 'ml-4' : ''}`}
              style={{ color: 'rgb(var(--nx-text-secondary, var(--nx-text-muted)))' }}
            >
              {!isIndented && (
                <span className="inline-block w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'rgb(var(--nx-accent))' }} />
              )}
              <span>{insight.trim()}</span>
            </div>
          )
        })}
      </div>
      {insights.length > maxVisible && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-2xs font-medium mt-1.5 transition-colors"
          style={{ color: 'rgb(var(--nx-accent-dim))' }}
        >
          {showAll ? 'Show less' : `Show ${insights.length - maxVisible} more`}
        </button>
      )}
    </div>
  )
}

function ActionList({ items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="mt-3">
      <div className="text-2xs font-semibold mb-1.5" style={{ color: 'rgb(var(--nx-text-muted))' }}>Action Items</div>
      <div className="space-y-1">
        {items.map((item, i) => {
          const isCritical = item.toLowerCase().includes('critical')
          return (
            <div key={i} className="flex items-start gap-2 text-xs leading-relaxed">
              <span
                className="mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-2xs font-bold"
                style={{
                  background: isCritical ? 'rgba(239,68,68,0.12)' : 'rgba(var(--nx-accent) / 0.10)',
                  border: `1px solid ${isCritical ? 'rgba(239,68,68,0.25)' : 'rgba(var(--nx-accent) / 0.20)'}`,
                  color: isCritical ? '#ef4444' : 'rgb(var(--nx-accent))',
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: isCritical ? '#ef4444' : 'rgb(var(--nx-text-muted))' }}>
                {item}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SectorStrip({ sectors }) {
  if (!sectors || Object.keys(sectors).length === 0) return null
  const sorted = Object.entries(sectors).sort((a, b) => (b[1].change || 0) - (a[1].change || 0))
  return (
    <div className="mt-3">
      <div className="text-2xs font-semibold mb-1.5" style={{ color: 'rgb(var(--nx-text-muted))' }}>Sectors</div>
      <div className="flex flex-wrap gap-1">
        {sorted.map(([name, data]) => (
          <div
            key={name}
            className="px-1.5 py-0.5 rounded text-2xs font-mono font-medium"
            style={{
              background: data.change > 0 ? 'rgba(34,197,94,0.06)' : data.change < 0 ? 'rgba(239,68,68,0.06)' : 'rgba(var(--nx-void) / 0.5)',
              border: `1px solid ${data.change > 0 ? 'rgba(34,197,94,0.15)' : data.change < 0 ? 'rgba(239,68,68,0.15)' : 'var(--nx-border)'}`,
              color: changeColor(data.change),
            }}
          >
            {name}: {fmtChange(data.change)}
          </div>
        ))}
      </div>
    </div>
  )
}

function InterMarketSignals({ signals }) {
  if (!signals || signals.length === 0) return null
  return (
    <div className="mt-3">
      <div className="text-2xs font-semibold mb-1.5" style={{ color: 'rgb(var(--nx-text-muted))' }}>Cross-Asset Signals</div>
      <div className="space-y-1">
        {signals.map((signal, i) => (
          <div
            key={i}
            className="text-xs leading-relaxed flex items-start gap-1.5"
            style={{ color: 'rgb(var(--nx-text-muted))' }}
          >
            <span className="inline-block w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'rgb(var(--nx-purple, 124 58 237))' }} />
            <span>{signal}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ BRIEF CARD ============

function BriefCard({ def, brief, status, onGenerate, generating }) {
  const [expanded, setExpanded] = useState(status === 'active')
  const hasBrief = brief && brief.generatedAt

  const IconComponent = def.id === 'pre-market' ? ClockIcon : def.id === 'midday' ? SunIcon : MoonIcon

  const isActive = status === 'active'
  const isPast = status === 'past'
  const isUpcoming = status === 'upcoming'

  const regimeStyle = brief?.regime ? REGIME_STYLES[brief.regime] : null
  const freshness = hasBrief ? timeSince(brief.generatedAt) : null

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: isActive
          ? `rgba(${def.accentColor} / 0.04)`
          : 'rgba(var(--nx-surface) / 0.6)',
        border: `1px solid ${isActive
          ? `rgba(${def.accentColor} / 0.2)`
          : 'var(--nx-border)'}`,
        opacity: isPast && !hasBrief ? 0.5 : isPast ? 0.7 : 1,
        backdropFilter: 'blur(12px)',
        boxShadow: isActive ? `0 0 20px rgba(${def.accentColor} / 0.06)` : 'none',
      }}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors"
        style={{ background: 'transparent' }}
      >
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: def.iconBg,
            border: `1px solid ${def.iconBorder}`,
          }}
        >
          <IconComponent color={def.accentHex} />
        </div>

        {/* Title area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'rgb(var(--nx-text-strong))' }}>{def.label}</span>

            {isActive && (
              <span
                className="px-1.5 py-0.5 rounded text-2xs font-bold tracking-wide"
                style={{ background: `rgba(${def.accentColor} / 0.12)`, border: `1px solid rgba(${def.accentColor} / 0.25)`, color: def.accentHex }}
              >
                ACTIVE
              </span>
            )}

            {isUpcoming && !hasBrief && (
              <span
                className="px-1.5 py-0.5 rounded text-2xs font-semibold"
                style={{ background: 'rgba(var(--nx-void) / 0.5)', border: '1px solid var(--nx-border)', color: 'rgb(var(--nx-text-hint))' }}
              >
                SCHEDULED
              </span>
            )}

            {regimeStyle && hasBrief && (
              <span
                className="px-1.5 py-0.5 rounded text-2xs font-bold tracking-wide"
                style={{ background: regimeStyle.bg, border: `1px solid ${regimeStyle.border}`, color: regimeStyle.color }}
              >
                {regimeStyle.label}
              </span>
            )}
          </div>

          <div className="text-2xs mt-0.5" style={{ color: 'rgb(var(--nx-text-hint))' }}>
            {hasBrief ? (
              <>
                {formatTimestamp(brief.generatedAt)}
                <span className="mx-1.5" style={{ opacity: 0.4 }}>|</span>
                <span style={{ color: freshness?.includes('m ago') && !freshness.includes('h') ? '#22c55e' : 'rgb(var(--nx-text-hint))' }}>
                  {freshness}
                </span>
              </>
            ) : (
              <span>{def.time}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onGenerate(def.id) }}
            disabled={generating}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-semibold transition-all"
            style={{
              background: generating ? `rgba(${def.accentColor} / 0.08)` : 'rgba(var(--nx-void) / 0.5)',
              border: `1px solid ${generating ? `rgba(${def.accentColor} / 0.2)` : 'var(--nx-border)'}`,
              color: generating ? def.accentHex : 'rgb(var(--nx-text-muted))',
              cursor: generating ? 'wait' : 'pointer',
            }}
          >
            <RefreshIcon spinning={generating} />
            {generating ? 'Generating...' : 'Generate Now'}
          </button>

          <div style={{ color: 'rgb(var(--nx-text-hint))' }}>
            <ChevronIcon expanded={expanded} />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-4 pb-4"
          style={{ borderTop: '1px solid var(--nx-border)' }}
        >
          {!hasBrief ? (
            <div className="py-8 text-center">
              <div
                className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: def.iconBg, border: `1px solid ${def.iconBorder}` }}
              >
                <IconComponent color={def.accentHex} />
              </div>
              <div className="text-sm font-medium mb-1" style={{ color: 'rgb(var(--nx-text-muted))' }}>
                No brief generated yet
              </div>
              <div className="text-2xs mb-4" style={{ color: 'rgb(var(--nx-text-hint))' }}>
                {isUpcoming
                  ? `Scheduled for ${def.time} — or generate now with live market data.`
                  : `Click below to generate the ${def.label.toLowerCase()} brief with live market data.`
                }
              </div>
              <button
                onClick={() => onGenerate(def.id)}
                disabled={generating}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-2"
                style={{
                  background: `rgba(${def.accentColor} / 0.10)`,
                  border: `1px solid rgba(${def.accentColor} / 0.25)`,
                  color: def.accentHex,
                }}
              >
                <RefreshIcon spinning={generating} />
                {generating ? 'Fetching live data...' : `Generate ${def.label} Brief`}
              </button>
            </div>
          ) : (
            <div className="pt-3">
              {/* Title */}
              {brief.title && (
                <div className="text-sm font-semibold mb-1" style={{ color: 'rgb(var(--nx-text-strong))' }}>{brief.title}</div>
              )}

              {/* Regime bar */}
              {brief.regimeReason && (
                <div
                  className="text-2xs px-2.5 py-1.5 rounded-lg mb-2 flex items-center gap-2"
                  style={{
                    background: regimeStyle?.bg || 'rgba(var(--nx-void) / 0.5)',
                    border: `1px solid ${regimeStyle?.border || 'var(--nx-border)'}`,
                  }}
                >
                  <span className="font-bold" style={{ color: regimeStyle?.color || 'rgb(var(--nx-text-muted))' }}>
                    {brief.regime?.replace(/-/g, ' ').toUpperCase()}
                  </span>
                  <span style={{ color: 'rgb(var(--nx-text-muted))' }}>
                    {brief.regimeConfidence ? `${brief.regimeConfidence}%` : ''} — {brief.regimeReason}
                  </span>
                </div>
              )}

              {/* Breadth indicator */}
              {brief.sectorBreadth && (
                <div className="text-2xs font-medium mb-2" style={{ color: 'rgb(var(--nx-text-hint))' }}>
                  Breadth: {brief.sectorBreadth}
                </div>
              )}

              {/* Market snapshot */}
              <MarketSnapshot snapshot={brief.marketSnapshot} />

              {/* Sectors */}
              <SectorStrip sectors={brief.sectors} />

              {/* Inter-market signals */}
              <InterMarketSignals signals={brief.interMarketSignals} />

              {/* Insights */}
              <InsightList insights={brief.insights} maxVisible={5} />

              {/* Action items */}
              <ActionList items={brief.actionItems} />

              {/* Additional assets */}
              {brief.additionalAssets && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {Object.entries(brief.additionalAssets).map(([sym, data]) => {
                    if (!data?.price) return null
                    return (
                      <div
                        key={sym}
                        className="px-2 py-1 rounded-md text-2xs font-mono"
                        style={{
                          background: 'rgba(var(--nx-void) / 0.5)',
                          border: '1px solid var(--nx-border)',
                          color: 'rgb(var(--nx-text-muted))',
                        }}
                      >
                        {sym}: ${sym === 'BTC' ? data.price.toFixed(0) : data.price.toFixed(2)}{' '}
                        <span style={{ color: changeColor(data.change) }}>{fmtChange(data.change)}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Freshness footer */}
              <div className="mt-3 pt-2 flex items-center justify-between text-2xs" style={{ borderTop: '1px solid var(--nx-border)', color: 'rgb(var(--nx-text-hint))' }}>
                <span>Generated: {formatTimestamp(brief.generatedAt)}</span>
                <span style={{
                  color: freshness?.includes('Just') || (freshness?.includes('m ago') && !freshness.includes('h'))
                    ? '#22c55e'
                    : freshness?.includes('h') && parseInt(freshness) < 3
                      ? 'rgb(var(--nx-text-muted))'
                      : 'rgb(var(--nx-orange))',
                }}>
                  {freshness}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============ MAIN COMPONENT ============

export default function DailyBriefPanel() {
  const [briefs, setBriefs] = useState({})
  const [generatingType, setGeneratingType] = useState(null)
  const [error, setError] = useState(null)
  const [nextBrief, setNextBrief] = useState(() => getNextBriefCountdown())
  const intervalRef = useRef(null)
  const countdownRef = useRef(null)

  // Fetch stored briefs on mount
  useEffect(() => {
    async function loadBriefs() {
      const types = ['pre-market', 'midday', 'post-close']
      const results = await Promise.allSettled(
        types.map(t =>
          fetch(`/api/cron/daily-brief?type=${t}&action=get`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      )
      const loaded = {}
      types.forEach((t, i) => {
        const r = results[i]
        if (r.status === 'fulfilled' && r.value?.brief) {
          const key = t === 'pre-market' ? 'preMarket' : t === 'midday' ? 'midday' : 'postClose'
          loaded[key] = r.value.brief
        }
      })
      if (Object.keys(loaded).length > 0) {
        setBriefs(prev => ({ ...prev, ...loaded }))
      }
    }
    loadBriefs()
  }, [])

  // Auto-refresh every 5 minutes during market hours
  useEffect(() => {
    function maybeRefresh() {
      if (isMarketHours()) {
        const types = ['pre-market', 'midday', 'post-close']
        Promise.allSettled(
          types.map(t =>
            fetch(`/api/cron/daily-brief?type=${t}&action=get`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          )
        ).then(results => {
          const loaded = {}
          types.forEach((t, i) => {
            const r = results[i]
            if (r.status === 'fulfilled' && r.value?.brief) {
              const key = t === 'pre-market' ? 'preMarket' : t === 'midday' ? 'midday' : 'postClose'
              loaded[key] = r.value.brief
            }
          })
          if (Object.keys(loaded).length > 0) {
            setBriefs(prev => ({ ...prev, ...loaded }))
          }
        })
      }
    }

    intervalRef.current = setInterval(maybeRefresh, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(intervalRef.current)
  }, [])

  // Update countdown every minute
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNextBrief(getNextBriefCountdown())
    }, 60 * 1000)
    return () => clearInterval(countdownRef.current)
  }, [])

  // Generate a brief on demand
  const handleGenerate = useCallback(async (briefType) => {
    try {
      setGeneratingType(briefType)
      setError(null)

      const res = await fetch(`/api/cron/daily-brief?type=${briefType}`, {
        method: 'POST',
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to generate brief (${res.status})`)
      }

      const data = await res.json()
      if (data.brief) {
        const key = briefType === 'pre-market' ? 'preMarket' : briefType === 'midday' ? 'midday' : 'postClose'
        setBriefs(prev => ({ ...prev, [key]: data.brief }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingType(null)
    }
  }, [])

  return (
    <div className="space-y-3">
      {/* Spin animation for refresh icon */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold" style={{ color: 'rgb(var(--nx-text-strong))' }}>
              Daily Intelligence Briefs
            </h2>
            <span
              className="px-1.5 py-0.5 rounded text-2xs font-semibold"
              style={{
                background: 'rgba(var(--nx-accent) / 0.08)',
                border: '1px solid rgba(var(--nx-accent) / 0.15)',
                color: 'rgb(var(--nx-accent))',
              }}
            >
              AUTO
            </span>
          </div>
          <div className="text-2xs mt-0.5" style={{ color: 'rgb(var(--nx-text-hint))' }}>
            3x daily: pre-market, midday, and post-close with live market data and regime analysis
            <span className="mx-1.5" style={{ opacity: 0.3 }}>|</span>
            Next: <span className="font-medium" style={{ color: 'rgb(var(--nx-text-muted))' }}>{nextBrief.label}</span> in{' '}
            <span className="font-mono font-medium" style={{ color: 'rgb(var(--nx-text-muted))' }}>{nextBrief.countdown}</span>
          </div>
        </div>

        {isMarketHours() && (
          <div className="flex items-center gap-1.5 text-2xs" style={{ color: 'rgb(var(--nx-text-hint))' }}>
            <div className="relative">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgb(var(--nx-green))' }} />
              <div className="absolute -inset-0.5 rounded-full animate-pulse" style={{ background: 'rgba(var(--nx-green) / 0.3)' }} />
            </div>
            <span>Auto-refresh active</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="px-3 py-2 rounded-lg text-xs flex items-center gap-2"
          style={{
            background: 'rgba(var(--nx-red) / 0.06)',
            border: '1px solid rgba(var(--nx-red) / 0.15)',
            color: 'rgb(var(--nx-red))',
          }}
        >
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-2xs font-medium underline flex-shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Brief cards - horizontal on large screens, stacked on small */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {BRIEF_DEFS.map(def => {
          const status = getBriefStatus(def)
          const brief = briefs[def.key] || null

          return (
            <BriefCard
              key={def.id}
              def={def}
              brief={brief}
              status={status}
              onGenerate={handleGenerate}
              generating={generatingType === def.id}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-2xs pt-1" style={{ color: 'rgb(var(--nx-text-hint))' }}>
        {BRIEF_DEFS.map(def => (
          <div key={def.id} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: def.accentHex, opacity: 0.6 }} />
            <span>{def.label} ({def.time})</span>
          </div>
        ))}
        <div className="ml-auto font-mono" style={{ color: 'rgb(var(--nx-text-hint))' }}>
          Powered by Vercel Cron
        </div>
      </div>
    </div>
  )
}
