'use client'
import { useState } from 'react'
import DemoBanner from '@/components/DemoBanner'

const ASSET_CLASSES = [
  {
    id: 'equity',
    name: 'Equity',
    icon: '📈',
    desc: 'US and international stocks with fundamental and technical screening.',
    markets: ['NYSE', 'NASDAQ', 'LSE', 'TSE'],
    symbols: 8400,
    dataPoints: '25+ years',
    features: ['Price/Volume', 'Fundamentals', 'Insider Trades', 'ETF Holdings'],
    color: 'rgba(91, 141, 238, 0.12)',
    borderColor: 'rgba(91, 141, 238, 0.2)',
    textColor: '#5b8dee',
    active: true,
  },
  {
    id: 'equity-options',
    name: 'Equity Options',
    icon: '📊',
    desc: 'Full options chains with Greeks, implied volatility surfaces, and unusual activity.',
    markets: ['CBOE', 'PHLX', 'ISE'],
    symbols: 4200,
    dataPoints: '10+ years',
    features: ['Options Chains', 'Greeks', 'IV Surface', 'Open Interest'],
    color: 'rgba(167, 139, 250, 0.12)',
    borderColor: 'rgba(167, 139, 250, 0.2)',
    textColor: '#a78bfa',
    active: true,
  },
  {
    id: 'indexes',
    name: 'Indexes',
    icon: '🏛',
    desc: 'Major global equity, bond, and commodity indices with real-time data.',
    markets: ['S&P', 'MSCI', 'FTSE', 'Nikkei'],
    symbols: 350,
    dataPoints: '30+ years',
    features: ['Price Data', 'Components', 'Sector Weights', 'Factor Exposure'],
    color: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.2)',
    textColor: '#34d399',
    active: true,
  },
  {
    id: 'index-options',
    name: 'Index Options',
    icon: '⚖',
    desc: 'SPX, VIX, and global index options with term structure analysis.',
    markets: ['CBOE', 'CME'],
    symbols: 120,
    dataPoints: '15+ years',
    features: ['SPX Options', 'VIX Options', 'Term Structure', 'Skew'],
    color: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.2)',
    textColor: '#fbbf24',
    active: false,
  },
  {
    id: 'futures',
    name: 'Futures',
    icon: '🔮',
    desc: 'Commodity, financial, and equity index futures with roll-adjusted continuous contracts.',
    markets: ['CME', 'ICE', 'LME', 'EUREX'],
    symbols: 680,
    dataPoints: '20+ years',
    features: ['Continuous Contracts', 'Roll Dates', 'COT Data', 'Spreads'],
    color: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.2)',
    textColor: '#f87171',
    active: true,
  },
  {
    id: 'future-options',
    name: 'Future Options',
    icon: '🎯',
    desc: 'Options on commodity and financial futures with margin calculations.',
    markets: ['CME', 'ICE'],
    symbols: 450,
    dataPoints: '10+ years',
    features: ['Futures Options', 'SPAN Margin', 'Greeks', 'Strategy Builder'],
    color: 'rgba(236, 72, 153, 0.12)',
    borderColor: 'rgba(236, 72, 153, 0.2)',
    textColor: '#ec4899',
    active: false,
  },
  {
    id: 'forex',
    name: 'Forex',
    icon: '💱',
    desc: 'Major, minor, and exotic currency pairs with interest rate differentials.',
    markets: ['Interbank', 'Retail'],
    symbols: 85,
    dataPoints: '15+ years',
    features: ['Spot Rates', 'Forwards', 'Carry Data', 'Central Bank'],
    color: 'rgba(20, 184, 166, 0.12)',
    borderColor: 'rgba(20, 184, 166, 0.2)',
    textColor: '#14b8a6',
    active: true,
  },
  {
    id: 'crypto',
    name: 'Crypto',
    icon: '₿',
    desc: 'Top cryptocurrencies with on-chain analytics, DeFi metrics, and exchange flows.',
    markets: ['Binance', 'Coinbase', 'Kraken'],
    symbols: 250,
    dataPoints: '5+ years',
    features: ['Spot Price', 'On-Chain', 'DeFi Metrics', 'Exchange Flows'],
    color: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    textColor: '#f59e0b',
    active: true,
  },
]

const PORTFOLIO_ALLOCATION = [
  { asset: 'US Equities', pct: 35, color: '#5b8dee' },
  { asset: 'Forex', pct: 20, color: '#14b8a6' },
  { asset: 'Commodities', pct: 15, color: '#f59e0b' },
  { asset: 'Bonds', pct: 12, color: '#34d399' },
  { asset: 'Options', pct: 10, color: '#a78bfa' },
  { asset: 'Crypto', pct: 8, color: '#ec4899' },
]

export default function MultiAssetPortfolio() {
  const [selectedAsset, setSelectedAsset] = useState(null)

  const activeCount = ASSET_CLASSES.filter(a => a.active).length
  const totalSymbols = ASSET_CLASSES.reduce((sum, a) => sum + a.symbols, 0)

  return (
    <div className="space-y-5">
      <DemoBanner
        type="demo"
        message="Asset class definitions and portfolio allocations are static placeholders. No real portfolio or brokerage account is connected."
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Multi-Asset Portfolio Modeling</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">Trade across asset classes with unified risk management and cross-asset correlation analysis.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
            {activeCount}/{ASSET_CLASSES.length} Active
          </span>
          <span className="text-2xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(91, 141, 238, 0.08)', border: '1px solid rgba(91, 141, 238, 0.15)', color: '#5b8dee' }}>
            {totalSymbols.toLocaleString()} Symbols
          </span>
        </div>
      </div>

      {/* Asset Class Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ASSET_CLASSES.map(asset => (
          <div
            key={asset.id}
            onClick={() => setSelectedAsset(selectedAsset?.id === asset.id ? null : asset)}
            className={`nx-card p-4 cursor-pointer group transition-all duration-300 hover:scale-[1.02] ${
              selectedAsset?.id === asset.id ? 'ring-1' : ''
            } ${!asset.active ? 'opacity-50' : ''}`}
            style={{
              borderColor: selectedAsset?.id === asset.id ? asset.borderColor : undefined,
              boxShadow: selectedAsset?.id === asset.id ? `0 0 0 1px ${asset.borderColor}, 0 0 20px ${asset.borderColor}15` : undefined,
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{asset.icon}</span>
              <span className={`text-2xs px-2 py-0.5 rounded-md font-bold ${
                asset.active ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-void/60 text-nx-text-hint border border-nx-border'
              }`}>
                {asset.active ? 'ACTIVE' : 'COMING SOON'}
              </span>
            </div>
            <h4 className="text-sm font-bold text-nx-text-strong group-hover:text-nx-accent transition-colors mb-1">{asset.name}</h4>
            <p className="text-2xs text-nx-text-muted leading-relaxed mb-3 line-clamp-2">{asset.desc}</p>

            <div className="flex items-center justify-between">
              <span className="text-2xs font-mono font-bold" style={{ color: asset.textColor }}>{asset.symbols.toLocaleString()} symbols</span>
              <span className="text-2xs text-nx-text-hint">{asset.dataPoints}</span>
            </div>

            {/* Feature tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              {asset.features.slice(0, 3).map((f, i) => (
                <span key={i} className="text-2xs px-1.5 py-0.5 rounded bg-nx-void/60 text-nx-text-hint">{f}</span>
              ))}
              {asset.features.length > 3 && (
                <span className="text-2xs px-1.5 py-0.5 rounded bg-nx-void/60 text-nx-text-hint">+{asset.features.length - 3}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Asset Detail */}
      {selectedAsset && (
        <div className="nx-card p-5 animate-fade-in" style={{ borderColor: selectedAsset.borderColor }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{selectedAsset.icon}</span>
            <div>
              <h4 className="text-md font-bold text-nx-text-strong">{selectedAsset.name}</h4>
              <p className="text-xs text-nx-text-muted">{selectedAsset.desc}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-nx-void/40 rounded-lg p-3">
              <div className="text-2xs text-nx-text-muted">Markets</div>
              <div className="text-sm font-semibold text-nx-text-strong mt-1">{selectedAsset.markets.join(', ')}</div>
            </div>
            <div className="bg-nx-void/40 rounded-lg p-3">
              <div className="text-2xs text-nx-text-muted">Total Symbols</div>
              <div className="text-sm font-bold font-mono mt-1" style={{ color: selectedAsset.textColor }}>{selectedAsset.symbols.toLocaleString()}</div>
            </div>
            <div className="bg-nx-void/40 rounded-lg p-3">
              <div className="text-2xs text-nx-text-muted">History Depth</div>
              <div className="text-sm font-semibold text-nx-text-strong mt-1">{selectedAsset.dataPoints}</div>
            </div>
            <div className="bg-nx-void/40 rounded-lg p-3">
              <div className="text-2xs text-nx-text-muted">Available Features</div>
              <div className="text-sm font-semibold text-nx-text-strong mt-1">{selectedAsset.features.length} modules</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedAsset.features.map((f, i) => (
              <span key={i} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: selectedAsset.color, border: `1px solid ${selectedAsset.borderColor}`, color: selectedAsset.textColor }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Allocation */}
      <div className="nx-card p-5">
        <h4 className="text-sm font-bold text-nx-text-strong mb-4">Current Portfolio Allocation</h4>
        <div className="space-y-3">
          {PORTFOLIO_ALLOCATION.map((alloc, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs font-medium text-nx-text w-28 shrink-0">{alloc.asset}</span>
              <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                <div
                  className="h-full rounded-md transition-all duration-700"
                  style={{
                    width: `${alloc.pct}%`,
                    backgroundColor: alloc.color,
                    opacity: 0.7,
                    boxShadow: `0 0 10px ${alloc.color}40`,
                  }}
                />
              </div>
              <span className="text-xs font-bold font-mono text-nx-text-strong w-10 text-right">{alloc.pct}%</span>
            </div>
          ))}
        </div>

        {/* Total bar */}
        <div className="mt-4 h-3 rounded-full overflow-hidden flex" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
          {PORTFOLIO_ALLOCATION.map((alloc, i) => (
            <div
              key={i}
              className="h-full transition-all duration-700"
              style={{
                width: `${alloc.pct}%`,
                backgroundColor: alloc.color,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-2xs text-nx-text-hint">
          <span>Diversified across {PORTFOLIO_ALLOCATION.length} asset classes</span>
          <span>Max single-asset: {Math.max(...PORTFOLIO_ALLOCATION.map(a => a.pct))}%</span>
        </div>
      </div>
    </div>
  )
}
