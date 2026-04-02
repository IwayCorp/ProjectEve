'use client'
import { useState, useEffect, useMemo } from 'react'

// Market sessions with timezone + hours in local time
const MARKETS = [
  { id: 'tse', label: 'TSE', full: 'Tokyo', tz: 'Asia/Tokyo', open: [9, 0], close: [15, 0], color: '#f87171', weekdays: true },
  { id: 'sse', label: 'SSE', full: 'Shanghai', tz: 'Asia/Shanghai', open: [9, 30], close: [15, 0], color: '#fbbf24', weekdays: true },
  { id: 'lse', label: 'LSE', full: 'London', tz: 'Europe/London', open: [8, 0], close: [16, 30], color: '#a78bfa', weekdays: true },
  { id: 'nyse', label: 'NYSE', full: 'New York', tz: 'America/New_York', open: [9, 30], close: [16, 0], color: '#5b8dee', weekdays: true },
  { id: 'cme', label: 'CME', full: 'Chicago (Futures)', tz: 'America/Chicago', open: [17, 0], close: [16, 0], color: '#34d399', weekdays: true, overnight: true },
  { id: 'fx', label: 'FX', full: 'Forex (24h)', tz: 'America/New_York', open: [17, 0], close: [17, 0], color: '#38bdf8', weekdays: true, h24: true },
]

function getMarketTime(tz) {
  try {
    const str = new Date().toLocaleString('en-US', { timeZone: tz, hour12: false })
    return new Date(str)
  } catch { return null }
}

function isOpen(market) {
  const t = getMarketTime(market.tz)
  if (!t) return false
  const day = t.getDay()
  if (market.weekdays && (day === 0 || day === 6)) return false
  if (market.h24) return day >= 1 && day <= 5 // Mon-Fri for FX
  const mins = t.getHours() * 60 + t.getMinutes()
  const openMins = market.open[0] * 60 + market.open[1]
  const closeMins = market.close[0] * 60 + market.close[1]
  if (market.overnight) {
    // e.g., CME 5pm-4pm next day — open if NOT between close and open
    return mins >= openMins || mins < closeMins
  }
  return mins >= openMins && mins < closeMins
}

export default function Header() {
  const [time, setTime] = useState(null)
  const [showMarkets, setShowMarkets] = useState(false)

  useEffect(() => {
    setTime(new Date())
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const et = useMemo(() => {
    if (!time) return null
    try {
      const etStr = time.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
      return new Date(etStr)
    } catch { return null }
  }, [time])

  const marketStatuses = useMemo(() => {
    if (!time) return []
    return MARKETS.map(m => ({
      ...m,
      isOpen: isOpen(m),
      localTime: getMarketTime(m.tz),
    }))
  }, [time])

  const openCount = marketStatuses.filter(m => m.isOpen).length

  return (
    <header className="sticky top-0 z-50" style={{
      background: 'linear-gradient(180deg, rgba(10, 14, 23, 0.92), rgba(10, 14, 23, 0.85))',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3), inset 0 -1px 0 rgba(255, 255, 255, 0.03)'
    }}>
      <div className="max-w-[1920px] mx-auto px-5 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="relative group">
            <img src="/logo.svg" alt="Noctis" className="w-9 h-9 rounded-lg relative z-10" />
            <div className="absolute -inset-1.5 rounded-xl opacity-25 blur-lg transition-opacity duration-500 group-hover:opacity-40" style={{ background: 'linear-gradient(135deg, #5b8dee, #a78bfa)' }} />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight" style={{ color: '#edf0f7' }}>
              Noctis
            </h1>
            <p className="text-2xs font-medium tracking-[0.12em] uppercase" style={{ color: '#64748b' }}>
              Quantitative Intelligence
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Market session pills — compact row */}
          <div className="hidden lg:flex items-center gap-1.5">
            {marketStatuses.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-default transition-all duration-200"
                style={{
                  background: m.isOpen ? `${m.color}10` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${m.isOpen ? `${m.color}25` : 'rgba(255,255,255,0.04)'}`,
                }}
                title={`${m.full}: ${m.localTime ? m.localTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'} local`}
              >
                <div className="relative">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.isOpen ? m.color : '#475569' }} />
                  {m.isOpen && <div className="absolute -inset-0.5 rounded-full animate-pulse-gentle" style={{ background: `${m.color}30` }} />}
                </div>
                <span className="text-2xs font-bold" style={{ color: m.isOpen ? m.color : '#475569' }}>{m.label}</span>
              </div>
            ))}
          </div>

          {/* Mobile: summary pill */}
          <button
            onClick={() => setShowMarkets(!showMarkets)}
            className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className={`w-2 h-2 rounded-full ${openCount > 0 ? 'bg-nx-green' : 'bg-nx-red'}`} />
            <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{openCount} Open</span>
          </button>

          <div className="nx-divider" />

          {/* Clock */}
          <div className="text-right">
            <div className="text-sm font-mono font-semibold tabular-nums" style={{ color: '#edf0f7' }} suppressHydrationWarning>
              {et ? et.toLocaleTimeString('en-US', { hour12: true }) : '--:--:--'}
              <span className="text-2xs ml-1 font-normal" style={{ color: '#64748b' }}>ET</span>
            </div>
            <div className="text-2xs font-medium" style={{ color: '#64748b' }} suppressHydrationWarning>
              {et ? et.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '---'}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile market detail dropdown */}
      {showMarkets && (
        <div className="lg:hidden px-5 pb-3 space-y-1 animate-fade-in">
          {marketStatuses.map(m => (
            <div key={m.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.isOpen ? m.color : '#475569' }} />
                <span className="text-xs font-semibold" style={{ color: m.isOpen ? m.color : '#64748b' }}>{m.label}</span>
                <span className="text-2xs text-nx-text-muted">{m.full}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-mono" style={{ color: '#94a3b8' }} suppressHydrationWarning>
                  {m.localTime ? m.localTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
                </span>
                <span className={`text-2xs font-bold ${m.isOpen ? 'text-nx-green' : 'text-nx-red'}`}>
                  {m.isOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
