'use client'
import { formatPrice, formatChange } from '@/lib/marketData'

function QuoteCard({ label, quote, type = 'stock' }) {
  if (!quote) return (
    <div className="nx-quote-card p-4">
      <div className="h-3 w-16 nx-shimmer mb-3" />
      <div className="h-6 w-24 nx-shimmer" />
    </div>
  )

  const isUp = quote.regularMarketChangePercent >= 0
  const cardClass = `nx-quote-card ${isUp ? 'nx-quote-card-up' : 'nx-quote-card-down'} p-4`

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</span>
        <span className={`text-2xs px-2.5 py-0.5 rounded-md font-bold ${
          isUp
            ? 'bg-nx-green-muted text-nx-green border border-nx-green/20'
            : 'bg-nx-red-muted text-nx-red border border-nx-red/20'
        }`}>
          {isUp ? '\u25B2' : '\u25BC'} {formatChange(quote.regularMarketChangePercent)}
        </span>
      </div>

      <div className={`text-2xl font-bold font-mono tabular-nums ${
        quote.priceDirection === 'up' ? 'price-up'
        : quote.priceDirection === 'down' ? 'price-down'
        : ''
      }`} style={quote.priceDirection ? {} : { color: '#f1f5f9' }}>
        {formatPrice(quote.regularMarketPrice, type)}
      </div>

      <div className="flex items-center justify-between mt-3 text-2xs font-medium" style={{ color: '#94a3b8' }}>
        <span>H: {formatPrice(quote.regularMarketDayHigh, type)}</span>
        <span>L: {formatPrice(quote.regularMarketDayLow, type)}</span>
      </div>

      {quote.regularMarketDayHigh && quote.regularMarketDayLow && quote.regularMarketDayHigh > quote.regularMarketDayLow && (
        <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, Math.max(5, ((quote.regularMarketPrice - quote.regularMarketDayLow) / (quote.regularMarketDayHigh - quote.regularMarketDayLow)) * 100))}%`,
              background: isUp
                ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.4), rgba(52, 211, 153, 0.7))'
                : 'linear-gradient(90deg, rgba(248, 113, 113, 0.4), rgba(248, 113, 113, 0.7))',
              boxShadow: isUp
                ? '0 0 8px rgba(52, 211, 153, 0.3)'
                : '0 0 8px rgba(248, 113, 113, 0.3)',
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
    <div className="space-y-5">
      {groups.map(group => (
        <div key={group.title}>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>{group.title}</h3>
          </div>
          <div className={`grid grid-cols-2 gap-3 ${group.items.length > 4 ? 'lg:grid-cols-6' : 'lg:grid-cols-4'}`}>
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
