'use client'
import { formatPrice, formatChange } from '@/lib/marketData'

function QuoteCard({ label, quote, type = 'stock' }) {
  if (!quote) return (
    <div className="bg-tv-pane border border-tv-border rounded-md p-3 animate-pulse">
      <div className="h-3 w-16 bg-tv-border rounded mb-2" />
      <div className="h-5 w-20 bg-tv-border rounded" />
    </div>
  )

  const isUp = quote.regularMarketChangePercent >= 0
  return (
    <div className={`bg-tv-pane border border-tv-border rounded-md p-3 hover:border-tv-border-light transition-all ${isUp ? 'glow-green' : 'glow-red'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs font-semibold text-tv-text-muted uppercase tracking-wider">{label}</span>
        <span className={`text-2xs px-1.5 py-0.5 rounded font-semibold ${isUp ? 'bg-tv-green-bg text-tv-green' : 'bg-tv-red-bg text-tv-red'}`}>
          {isUp ? '▲' : '▼'} {formatChange(quote.regularMarketChangePercent)}
        </span>
      </div>
      <div className={`text-xl font-bold font-mono ${quote.priceDirection === 'up' ? 'price-up' : quote.priceDirection === 'down' ? 'price-down' : 'text-tv-text-strong'}`}>
        {formatPrice(quote.regularMarketPrice, type)}
      </div>
      <div className="flex items-center justify-between mt-2 text-2xs text-tv-text-hint">
        <span>H: {formatPrice(quote.regularMarketDayHigh, type)}</span>
        <span>L: {formatPrice(quote.regularMarketDayLow, type)}</span>
      </div>
      {quote.regularMarketDayHigh && quote.regularMarketDayLow && (
        <div className="mt-1.5 h-1 bg-tv-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isUp ? 'bg-tv-green' : 'bg-tv-red'}`}
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
      { label: 'EUR/USD', sym: 'EURUSD=X', type: 'forex' },
      { label: 'GBP/USD', sym: 'GBPUSD=X', type: 'forex' },
      { label: 'DXY', sym: 'DX-Y.NYB', type: 'index' },
    ]},
  ]

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <div key={group.title}>
          <h3 className="text-2xs font-semibold text-tv-text-hint uppercase tracking-widest mb-2 px-0.5">
            {group.title}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
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
