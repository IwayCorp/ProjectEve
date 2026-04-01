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
import HistoricalData from '@/components/HistoricalData'
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
  { id: 'overview', label: 'Overview' },
  { id: 'trades', label: 'Trade Ideas' },
  { id: 'correlation', label: 'Correlations' },
  { id: 'risk', label: 'Risk Calendar' },
  { id: 'history', label: 'Performance' },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [chartSymbol, setChartSymbol] = useState({ symbol: '^GSPC', title: 'S&P 500' })

  const allSymbols = useMemo(() => {
    const syms = getAllSymbols()
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
    <div className="min-h-screen bg-nx-base">
      <Header />
      <TickerBar quotes={quotes} symbols={TICKER_SYMBOLS} />

      {/* Tab navigation */}
      <div className="border-b border-nx-border" style={{ background: 'rgba(10, 14, 23, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="max-w-[1920px] mx-auto px-5">
          <div className="flex items-center">
            <div className="flex gap-0">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`nx-tab ${activeTab === tab.id ? 'nx-tab-active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Live indicator */}
            <div className="ml-auto flex items-center gap-2.5 text-2xs text-nx-text-muted">
              <div className="relative">
                <div className={`w-1.5 h-1.5 rounded-full ${quotesLoading ? 'bg-nx-orange animate-pulse' : 'bg-nx-green'}`} />
                {!quotesLoading && <div className="absolute -inset-0.5 rounded-full bg-nx-green/30 animate-pulse-gentle" />}
              </div>
              <span className="font-medium">{quotesLoading ? 'Refreshing...' : 'Live \u00B7 15s'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[1920px] mx-auto p-4 space-y-4">
        {activeTab === 'overview' && (
          <>
            <MarketOverview quotes={quotes} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="xl:col-span-2">
                <div className="flex items-center gap-1 mb-2.5 flex-wrap p-0.5">
                  {chartOptions.map(opt => (
                    <button
                      key={opt.symbol}
                      onClick={() => setChartSymbol(opt)}
                      className={`px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 ${
                        chartSymbol.symbol === opt.symbol
                          ? 'bg-nx-accent-muted text-nx-accent'
                          : 'text-nx-text-muted hover:text-nx-text-strong hover:bg-nx-glass-hover'
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

            <CorrelationHeatmap correlations={correlations} loading={corrLoading} />
            <RiskCalendar />
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

        {activeTab === 'history' && (
          <HistoricalData />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-nx-border py-4 mt-8">
        <div className="max-w-[1920px] mx-auto px-5 flex items-center justify-between">
          <p className="text-2xs text-nx-text-hint font-medium tracking-wide">
            Noctis &middot; Quantitative Market Intelligence
          </p>
          <p className="text-2xs text-nx-text-hint">
            For informational purposes only. Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  )
}
