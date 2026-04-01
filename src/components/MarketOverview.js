'use client'
import { formatPrice, formatChange } from '@/lib/marketData'

function QuoteCard({ label, quote, type = 'stock' }) {
  if (!quote) return (
    <div className="card animate-pulse">
      <div className="h-4 w-20 bg-eve-border rounded mb-2" />
      <div className="h-6 w-24 bg-eve-border rounded" />
    </div>
  )

  const isUp = quote.regularMarketChangePercent >= 0
  return (
    <div className={`card ${isUp ? 'glow-green' : 'glow-red'} hover:border-eve-accent/30 transition-all`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-eve-muted uppercase tracking-wider">{label}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${isUp ? 'bg-emerald-900/30 text-eve-green' : 'bg-red-900/30 text-eve-red'}`}>
          {isUp ? '\u25B2' : '\u25BC'} {formatChange(quote.regularMarketChangePercent)}
        </span>
      </div>
      <div className={`text-xl font-bold font-mono ${quote.priceDirection === 'up' ? 'price-up' : quote.priceDirection === 'down' ? 'price-down' : 'text-white'}`}>
        {formatPrice(quote.regularMarketPrice, type)}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-eve-muted">
        <span>H: {formatPrice(quote.regularMarketDayHigh, type)}</span>
        <span>L: {formatPrice(quote.regularMarketDayLow, type)}</span>
      </div>
      {quote.regularMarketDayHigh && quote.regularMarketDayLow && (
        <div className="mt-2 h-1.5 bg-eve-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isUp ? 'bg-eve-green' : 'bg-eve-red'}`}
            style={{
              width: `${Math.min(100, Math.max(5, ((quote.regularMarketPrice - quote.regularMarketDayLow) / (quote.regularMarketDayHigh - quote.regularMarketDayLow)) * 100))}%`
            }}
          />
        </div>
      )}
    </div>
  )
}

export default function MarketOverview({ quotes }) {
  const groups = [
    { title: 'Indices', items: [
      { label: 'S&P 500', sym: '^GSPC', type: 'index' },
      { label: 'Nasdaq', sym: '^IXIC', type: 'index' },
      { label: 'Dow Jones', sym: '^DJI', type: 'index' },
      { label: 'VIX', sym: '^VIX', type: 'index' },
    ]},
    { title: 'Bonds & Rates', items: [
      { label: 'US 10Y Yield', sym: '^TNX', type: 'yield' },
      { label: 'US 30Y Yield', sym: '^TYX', type: 'yield' },
    ]},
    { title: 'Commodities', items: [
      { label: 'Gold', sym: 'GC=F', type: 'stock' },
      { label: 'WTI Crude', sym: 'CL=F', type: 'stock' },
    ]},
    { title: 'Forex', items: [
      { label: 'USD/JPY', sym: 'JPY=X', type: 'forex' },
      { label: 'DXY', sym: 'DX-Y.NYB', type: 'index' },
    ]},
  ]

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.title}>
          <h3 className="text-xs font-bold text-eve-muted uppercase tracking-widest mb-2 px-1">
            {group.title}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {group.items.map(item => (
              <QuoteCard
                key={item.sym}
                label={item.label}
                quote={quotes[item.sym]}
                type={item.type}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
