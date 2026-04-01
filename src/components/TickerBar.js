'use client'
import { formatPrice, formatChange } from '@/lib/marketData'

export default function TickerBar({ quotes, symbols }) {
  if (!quotes || Object.keys(quotes).length === 0) {
    return (
      <div className="border-b border-nx-border py-2 px-5 overflow-x-auto" style={{ background: 'rgba(10, 14, 23, 0.6)' }}>
        <div className="flex gap-6 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-2 items-center min-w-[140px]">
              <div className="h-3 w-14 nx-shimmer" />
              <div className="h-3 w-10 nx-shimmer" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const tickerItems = Object.entries(symbols).map(([label, sym]) => {
    const q = quotes[sym]
    if (!q) return null
    const isUp = q.regularMarketChangePercent >= 0
    return (
      <div key={sym} className="flex items-center gap-2.5 min-w-[155px] shrink-0 group">
        <span className="text-2xs font-semibold text-nx-text-hint uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-mono font-semibold ${q.priceDirection === 'up' ? 'price-up' : q.priceDirection === 'down' ? 'price-down' : 'text-nx-text-strong'}`}>
          {formatPrice(q.regularMarketPrice, sym.includes('=X') ? 'forex' : sym.startsWith('^') ? 'index' : 'stock')}
        </span>
        <span className={`text-2xs font-mono font-medium ${isUp ? 'text-nx-green' : 'text-nx-red'}`}>
          {formatChange(q.regularMarketChangePercent)}
        </span>
      </div>
    )
  }).filter(Boolean)

  return (
    <div className="border-b border-nx-border py-2 px-5 overflow-x-auto" style={{ background: 'rgba(10, 14, 23, 0.5)' }}>
      <div className="flex gap-5 items-center max-w-[1920px] mx-auto">
        {tickerItems}
      </div>
    </div>
  )
}
