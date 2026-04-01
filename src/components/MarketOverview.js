'use client'
import { formatPrice, formatChange } from '@/lib/marketData'

function QuoteCard({ label, quote, type = 'stock' }) {
  if (!quote) return (
    <div className="nx-card p-3.5">
      <div className="h-3 w-16 nx-shimmer mb-2.5" />
      <div className="h-5 w-20 nx-shimmer" />
    </div>
  )

  const isUp = quote.regularMarketChangePercent >= 0
  return (
    <div className={`nx-card p-3.5 transition-all duration-300 ${isUp ? 'hover:border-nx-green/15' : 'hover:border-nx-red/15'} ${isUp ? 'glow-green' : 'glow-red'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-2xs font-semibold text-nx-text-muted uppercase tracking-wider">{label}</span>
        <span className={`text-2xs px-2 py-0.5 rounded-md font-semibold ${isUp ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
          {isUp ? '\u25B2' : '\u25BC'} {formatChange(quote.regularMarketChangePercent)}
        </span>
      </div>
      <div className={`text-xl font-bold font-mono tabular-nums ${quote.priceDirection === 'up' ? 'price-up' : quote.priceDirection === 'down' ? 'price-down' : 'text-nx-text-strong'}`}>
        {formatPrice(quote.regularMarketPrice, type)}
      </div>
      <div className="flex items-center justify-between mt-2.5 text-2xs text-nx-text-hint">
        <span>H: {formatPrice(quote.regularMarketDayHigh, type)}</span>
        <span>L: {formatPrice(quote.regularMarketDayLow, type)}</span>
      </div>
      {quote.regularMarketDayHigh && quote.regularMarketDayLow && (
        <div className="mt-2 h-1 bg-nx-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isUp ? 'bg-nx-green/60' : 'bg-nx-red/60'}`}
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
      { label: 'Russell 2000', sym: '^RUT', type: 'index' },
      { label: 'VIX', sym: '^VIX', type: 'index' },
      { label: 'Bitcoin', sym: 'BTC-USD', type: 'stock' },
    ]},
    { title: 'Bonds & Rates', items: [
      { label: '3-Mo T-Bill', sym: '^IRX', type: 'yield' },
      { label: 'US 10Y Yield', sym: '^TNX', type: 'yield' },
      { label: 'US 30Y Yield', sym: '^TYX', type: 'yield' },
      { label: 'TLT (20Y+ Bond)', sym: 'TLT', type: 'stock' },
    ]},
    { title: 'Commodities', items: [
      { label: 'Gold', sym: 'GC=F', type: 'stock' },
      { label: 'Silver', sym: 'SI=F', type: 'stock' },
      { label: 'WTI Crude', sym: 'CL=F', type: 'stock' },
      { label: 'Natural Gas', sym: 'NG=F', type: 'stock' },
    ]},
    { title: 'Forex', items: [
      { label: 'USD/JPY', sym: 'JPY=X', type: 'forex' },
      { label: 'EUR/USD', sym: 'EURUSD=X', type: 'forex' },
      { label: 'GBP/USD', sym: 'GBPUSD=X', type: 'forex' },
      { label: 'DXY', sym: 'DX-Y.NYB', type: 'index' },
    ]},
  ]

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.title}>
          <h3 className="text-2xs font-semibold text-nx-text-hint uppercase tracking-[0.15em] mb-2.5 px-0.5">
            {group.title}
          </h3>
          <div className={`grid grid-cols-2 gap-2.5 ${group.items.length > 4 ? 'lg:grid-cols-6' : 'lg:grid-cols-4'}`}>
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
