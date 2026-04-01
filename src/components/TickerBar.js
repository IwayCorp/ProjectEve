'use client'
import { formatPrice, formatChange } from '@/lib/marketData'

export default function TickerBar({ quotes, symbols }) {
  if (!quotes || Object.keys(quotes).length === 0) {
    return (
      <div className="bg-eve-bg border-b border-eve-border py-2 px-4 overflow-x-auto">
        <div className="flex gap-6 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-2 items-center min-w-[140px]">
              <div className="h-4 w-16 bg-eve-border rounded" />
              <div className="h-4 w-12 bg-eve-border rounded" />
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
      <div key={sym} className="flex items-center gap-2 min-w-[160px] shrink-0">
        <span className="text-xs font-bold text-eve-muted">{label}</span>
        <span className={`text-sm font-mono font-bold ${q.priceDirection === 'up' ? 'price-up' : q.priceDirection === 'down' ? 'price-down' : 'text-white'}`}>
          {formatPrice(q.regularMarketPrice, sym.includes('=X') ? 'forex' : sym.startsWith('^') ? 'index' : 'stock')}
        </span>
        <span className={`text-xs font-mono ${isUp ? 'text-eve-green' : 'text-eve-red'}`}>
          {formatChange(q.regularMarketChangePercent)}
        </span>
      </div>
    )
  }).filter(Boolean)

  return (
    <div className="bg-eve-bg/90 border-b border-eve-border py-2 px-4 overflow-x-auto">
      <div className="flex gap-6 items-center">
        {tickerItems}
      </div>
    </div>
  )
}
