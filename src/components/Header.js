'use client'
import { useState, useEffect } from 'react'

export default function Header() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const marketOpen = () => {
    const h = time.getUTCHours()
    const m = time.getUTCMinutes()
    const mins = h * 60 + m
    // NYSE: 9:30 AM - 4:00 PM ET = 14:30 - 21:00 UTC
    return mins >= 14 * 60 + 30 && mins < 21 * 60
  }

  return (
    <header className="border-b border-eve-border bg-eve-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-eve-accent to-eve-purple flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Project Eve</h1>
            <p className="text-xs text-eve-muted">Market Intelligence Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${marketOpen() ? 'bg-eve-green animate-pulse' : 'bg-eve-red'}`} />
            <span className="text-xs text-eve-muted">
              {marketOpen() ? 'Markets Open' : 'Markets Closed'}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-white">
              {time.toLocaleTimeString('en-US', { hour12: true })}
            </div>
            <div className="text-xs text-eve-muted">
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
