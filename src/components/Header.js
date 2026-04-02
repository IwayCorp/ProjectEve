'use client'
import { useState, useEffect, useMemo } from 'react'

export default function Header() {
  const [time, setTime] = useState(null)

  useEffect(() => {
    setTime(new Date())
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Derive Eastern Time values once per tick
  const et = useMemo(() => {
    if (!time) return null
    try {
      const etStr = time.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
      return new Date(etStr)
    } catch { return null }
  }, [time])

  const isMarketOpen = useMemo(() => {
    if (!et) return false
    const day = et.getDay()
    if (day === 0 || day === 6) return false
    const mins = et.getHours() * 60 + et.getMinutes()
    return mins >= 9 * 60 + 30 && mins < 16 * 60
  }, [et])

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
        <div className="flex items-center gap-5">
          {/* Market status */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div className="relative">
              <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-nx-green' : 'bg-nx-red'}`} />
              {isMarketOpen && (
                <div className="absolute -inset-1 rounded-full bg-nx-green/30 animate-pulse-gentle" />
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>
              {isMarketOpen ? 'NYSE Open' : 'NYSE Closed'}
            </span>
          </div>

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
    </header>
  )
}
