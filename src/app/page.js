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
import { getAllSymbols, SYMBOLS } from '@/lib/marketData'

const TICKER_SYMBOLS = {
  'SPX': '^GSPC',
  'NDX': '^IXIC',
  'DJI': '^DJI',
  'VIX': '^VIX',
  'Gold': 'GC=F',
  'Oil': 'CL=F',
  'USD/JPY': 'JPY=X',
  'DXY': 'DX-Y.NYB',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'trades', label: 'Trade Ideas' },
  { id: 'correlation', label: 'Correlations' },
  { id: 'risk', label: 'Risk Calendar' },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [chartSymbol, setChartSymbol] = useState({ symbol: '^GSPC', title: 'S&P 500' })

  const allSymbols = useMemo(() => {
    const syms = getAllSymbols()
    return Object.values(syms)
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
    { symbol: 'MSFT', title: 'MSFT' },
    { symbol: 'AAPL', title: 'AAPL' },
    { symbol: 'XOM', title: 'XOM' },
    { symbol: 'RTX', title: 'RTX' },
    { symbol: 'CAT', title: 'CAT' },
    { symbol: 'TSLA', title: 'TSLA' },
  ]

  return (
    <div className="min-h-screen bg-eve-bg">
      <Header />
      <TickerBar quotes={quotes} symbols={TICKER_SYMBOLS} />

      {/* Tab navigation */}
      <div className="border-b border-eve-border bg-eve-card/50">
        <div className="max-w-[1920px] mx-auto px-4">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-eve-accent'
                    : 'text-eve-muted hover:text-white'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-eve-accent" />
                )}
              </button>
            ))}

            {/* Last refresh indicator */}
            <div className="ml-auto flex items-center gap-2 text-xs text-eve-muted">
              <div className={`w-1.5 h-1.5 rounded-full ${quotesLoading ? 'bg-eve-orange animate-pulse' : 'bg-eve-green'}`} />
              {quotesLoading ? 'Updating...' : 'Live (15s)'}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[1920px] mx-auto p-4 space-y-4">
        {activeTab === 'overview' && (
          <>
            <MarketOverview quotes={quotes} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {chartOptions.map(opt => (
                    <button
                      key={opt.symbol}
                      onClick={() => setChartSymbol(opt)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        chartSymbol.symbol === opt.symbol
                          ? 'bg-eve-accent text-white'
                          : 'text-eve-muted hover:text-white hover:bg-eve-border'
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
      <footer className="border-t border-eve-border py-4 mt-8">
        <div className="max-w-[1920px] mx-auto px-4 text-center">
          <p className="text-xs text-eve-muted">
            Project Eve | For informational purposes only. Not financial advice. All investments carry risk.
          </p>
        </div>
      </footer>
    </div>
  )
}
