'use client'
import { formatPrice, formatChange } from '@/lib/marketData'

export default function TickerBar({ quotes, symbols }) {
  if (!quotes || Object.keys(quotes).length === 0) {
    return (
      <div className="bg-tv-bg border-b border-tv-border py-1.5 px-4 overflow-x-auto">
        <div className="flex gap-6 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-2 items-center min-w-[140px]">
              <div className="h-3 w-14 bg-tv-border rounded" />
              <div className="h-3 w-10 bg-tv-border rounded" />
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
      <div key={sym} className="flex items-center gap-2 min-w-[150px] shrink-0">
        <span className="text-2xs font-semibold text-tv-text-muted">{label}</span>
        <span className={`text-xs font-mono font-bold ${q.priceDirection === 'up' ? 'price-up' : q.priceDirection === 'down' ? 'price-down' : 'text-tv-text-strong'}`}>
          {formatPrice(q.regularMarketPrice, sym.includes('=X') ? 'forex' : sym.startsWith('^') ? 'index' : 'stock')}
        </span>
        <span className={`text-2xs font-mono ${isUp ? 'text-tv-green' : 'text-tv-red'}`}>
          {formatChange(q.regularMarketChangePercent)}
        </span>
      </div>
    )
  }).filter(Boolean)

  return (
    <div className="bg-tv-bg border-b border-tv-border py-1.5 px-4 overflow-x-auto">
      <div className="flex gap-5 items-center">
        {tickerItems}
      </div>
    </div>
  )
}
