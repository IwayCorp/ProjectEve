'use client'
import { useState, useMemo } from 'react'
import Header from '@/components/Header'
import TickerBar from '@/components/TickerBar'
import MarketOverview from '@/components/MarketOverview'
import PriceChart from '@/components/PriceChart'
import SectorHeatmap from '@/components/SectorHeatmap'
import CorrelationHeatmap from '@/components/CorrelationHeatmap'
import TradeIdeas from '@/components/TradeIdeas'
import RiskCalendar from '@/components/RiskCalendar'
import ScenarioAnalysis from '@/components/ScenarioAnalysis'
import { useQuotes, useCorrelation } from '@/hooks/useMarketData'
import { getAllSymbols } from '@/lib/marketData'

const TICKER_SYMBOLS = {
  'SPX': '^GSPC',
  'NDX': '^IXIC',
  'DJI': '^DJI',
  'VIX': '^VIX',
  'Gold': 'GC=F',
  'Oil': 'CL=F',
  'USD/JPY': 'JPY=X',
  'DXY': 'DX-Y.NYB',
  'BTC': 'BTC-USD',
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: '◐' },
  { id: 'trades', label: 'Trade Ideas', icon: '◈' },
  { id: 'correlation', label: 'Correlations', icon: '◉' },
  { id: 'risk', label: 'Risk Calendar', icon: '◆' },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [chartSymbol, setChartSymbol] = useState({ symbol: '^GSPC', title: 'S&P 500' })

  const allSymbols = useMemo(() => {
    const syms = getAllSymbols()
    // Add forex pairs and crypto for trade idea quotes
    const extra = ['EURUSD=X', 'GBPUSD=X', 'CHF=X', 'AUDUSD=X', 'MXN=X', 'EURGBP=X', 'NZDUSD=X', 'BTC-USD',
      'LMT', 'JPM', 'UNH', 'BYND', 'DIS', 'NKE', 'COIN', 'ARKK', 'IWM', 'TLT', 'XLU', 'XLRE', 'FXI']
    return [...new Set([...Object.values(syms), ...extra])]
  }, [])

  const { data: quotes, loading: quotesLoading } = useQuotes(allSymbols, 15000)
  const { data: correlations, loading: corrLoading } = useCorrelation(300000)

  const chartOptions = [
    { symbol: '^GSPC', title: 'S&P 500' },
    { symbol: '^IXIC', title: 'Nasdaq' },
    { symbol: '^DJI', title: 'Dow Jones' },
    { symbol: '^VIX', title: 'VIX' },
    { symbol: 'GC=F', title: 'Gold' },
    { symbol: 'CL=F', title: 'WTI Crude' },
    { symbol: 'BTC-USD', title: 'Bitcoin' },
    { symbol: 'MSFT', title: 'MSFT' },
    { symbol: 'AAPL', title: 'AAPL' },
    { symbol: 'NVDA', title: 'NVDA' },
    { symbol: 'XOM', title: 'XOM' },
    { symbol: 'RTX', title: 'RTX' },
    { symbol: 'JPY=X', title: 'USD/JPY' },
    { symbol: 'EURUSD=X', title: 'EUR/USD' },
  ]

  return (
    <div className="min-h-screen bg-tv-bg">
      <Header />
      <TickerBar quotes={quotes} symbols={TICKER_SYMBOLS} />

      {/* Tab navigation — TradingView style */}
      <div className="border-b border-tv-border bg-tv-toolbar">
        <div className="max-w-[1920px] mx-auto px-4">
          <div className="flex items-center">
            <div className="flex gap-0">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'text-tv-blue'
                      : 'text-tv-text-muted hover:text-tv-text-strong'
                  }`}
                >
                  <span className="text-xs">{tab.icon}</span>
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-tv-blue" />
                  )}
                </button>
              ))}
            </div>

            {/* Live indicator */}
            <div className="ml-auto flex items-center gap-2 text-2xs text-tv-text-muted">
              <div className={`w-1.5 h-1.5 rounded-full ${quotesLoading ? 'bg-tv-orange animate-pulse' : 'bg-tv-green'}`} />
              {quotesLoading ? 'Refreshing...' : 'Live · 15s'}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[1920px] mx-auto p-3 space-y-3">
        {activeTab === 'overview' && (
          <>
            <MarketOverview quotes={quotes} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="xl:col-span-2">
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  {chartOptions.map(opt => (
                    <button
                      key={opt.symbol}
                      onClick={() => setChartSymbol(opt)}
                      className={`px-2 py-1 text-2xs rounded transition-colors ${
                        chartSymbol.symbol === opt.symbol
                          ? 'bg-tv-blue-muted text-tv-blue'
                          : 'text-tv-text-muted hover:text-tv-text-strong hover:bg-white/5'
                      }`}
                    >
                      {opt.title}
                    </button>
                  ))}
                </div>
                <PriceChart symbol={chartSymbol.symbol} title={chartSymbol.title} />
              </div>
              <div>
                <SectorHeatmap quotes={quotes} />
              </div>
            </div>

            <ScenarioAnalysis />
          </>
        )}

        {activeTab === 'trades' && (
          <TradeIdeas quotes={quotes} />
        )}

        {activeTab === 'correlation' && (
          <CorrelationHeatmap correlations={correlations} loading={corrLoading} />
        )}

        {activeTab === 'risk' && (
          <>
            <RiskCalendar />
            <ScenarioAnalysis />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-tv-border py-3 mt-6">
        <div className="max-w-[1920px] mx-auto px-4 text-center">
          <p className="text-2xs text-tv-text-hint">
            Project Eve · Quantitative Market Intelligence · For informational purposes only. Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  )
}
