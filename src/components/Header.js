'use client'
import { useState, useEffect } from 'react'

export default function Header() {
  const [time, setTime] = useState(null)

  useEffect(() => {
    setTime(new Date())
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const marketOpen = () => {
    if (!time) return false
    const h = time.getUTCHours()
    const m = time.getUTCMinutes()
    const mins = h * 60 + m
    return mins >= 14 * 60 + 30 && mins < 21 * 60
  }

  return (
    <header className="sticky top-0 z-50 border-b border-nx-border" style={{ background: 'rgba(10, 14, 23, 0.85)', backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)' }}>
      <div className="max-w-[1920px] mx-auto px-5 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #5b8dee, #a78bfa)' }}>
              <span className="text-white font-bold text-sm tracking-tight">N</span>
            </div>
            <div className="absolute -inset-0.5 rounded-lg opacity-30 blur-sm" style={{ background: 'linear-gradient(135deg, #5b8dee, #a78bfa)' }} />
          </div>
          <div>
            <h1 className="text-md font-bold text-nx-text-strong tracking-tight">
              Noctis
            </h1>
            <p className="text-2xs text-nx-text-muted font-medium tracking-wide">
              Quantitative Intelligence
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-5">
          {/* Market status */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className={`w-1.5 h-1.5 rounded-full ${marketOpen() ? 'bg-nx-green' : 'bg-nx-red'}`} />
              {marketOpen() && (
                <div className="absolute -inset-1 rounded-full bg-nx-green/30 animate-pulse-gentle" />
              )}
            </div>
            <span className="text-xs text-nx-text-muted font-medium">
              {marketOpen() ? 'NYSE Open' : 'NYSE Closed'}
            </span>
          </div>

          <div className="nx-divider" />

          {/* Clock */}
          <div className="text-right">
            <div className="text-sm font-mono font-medium text-nx-text-strong tabular-nums" suppressHydrationWarning>
              {time ? time.toLocaleTimeString('en-US', { hour12: true }) : '--:--:--'}
            </div>
            <div className="text-2xs text-nx-text-muted" suppressHydrationWarning>
              {time ? time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '---'}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
