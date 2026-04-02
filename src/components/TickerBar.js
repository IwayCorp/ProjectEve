'use client'
import { formatPrice, formatChange } from '@/lib/marketData'

export default function TickerBar({ quotes, symbols }) {
  if (!quotes || Object.keys(quotes).length === 0) {
    return (
      <div className="nx-ticker-bar py-2.5 px-5 overflow-x-auto">
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
      <div key={sym} className="flex items-center gap-2.5 min-w-[155px] shrink-0" aria-label={`${label} ticker`}>
        <span className="text-2xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>{label}</span>
        <span className={`text-xs font-mono font-bold ${q.priceDirection === 'up' ? 'price-up' : q.priceDirection === 'down' ? 'price-down' : ''}`} style={q.priceDirection ? {} : { color: '#e2e8f0' }}>
          {formatPrice(q.regularMarketPrice, sym.includes('=X') ? 'forex' : sym.startsWith('^') ? 'index' : 'stock')}
        </span>
        <span className={`text-2xs font-mono font-semibold ${isUp ? 'text-nx-green' : 'text-nx-red'}`}>
          {formatChange(q.regularMarketChangePercent)}
        </span>
      </div>
    )
  }).filter(Boolean)

  return (
    <div className="nx-ticker-bar py-2.5 px-5 overflow-x-auto" role="region" aria-label="Live market ticker">
      <div className="flex gap-5 items-center max-w-[1920px] mx-auto">
        {tickerItems}
      </div>
    </div>
  )
}
