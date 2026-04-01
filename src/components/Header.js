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
    return mins >= 14 * 60 + 30 && mins < 21 * 60
  }

  return (
    <header className="border-b border-tv-border bg-tv-toolbar sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-tv-blue flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <div>
            <h1 className="text-md font-bold text-tv-text-strong tracking-tight">Project Eve</h1>
            <p className="text-2xs text-tv-text-muted">Quantitative Market Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${marketOpen() ? 'bg-tv-green animate-pulse' : 'bg-tv-red'}`} />
            <span className="text-xs text-tv-text-muted">
              {marketOpen() ? 'NYSE Open' : 'NYSE Closed'}
            </span>
          </div>
          <div className="tv-divider" />
          <div className="text-right">
            <div className="text-sm font-mono text-tv-text-strong">
              {time.toLocaleTimeString('en-US', { hour12: true })}
            </div>
            <div className="text-2xs text-tv-text-muted">
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
