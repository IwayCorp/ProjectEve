'use client'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
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
import CloudResearch from '@/components/CloudResearch'
import Backtesting from '@/components/Backtesting'
import AIAssistant from '@/components/AIAssistant'
import Optimization from '@/components/Optimization'
import LiveTrading from '@/components/LiveTrading'
import MultiAssetPortfolio from '@/components/MultiAssetPortfolio'
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
  { id: 'research', label: 'Research' },
  { id: 'backtest', label: 'Backtesting' },
  { id: 'ai', label: 'AI Assistant' },
  { id: 'optimize', label: 'Optimization' },
  { id: 'live', label: 'Live Trading' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'correlation', label: 'Correlations' },
  { id: 'risk', label: 'Risk Calendar' },
  { id: 'history', label: 'Performance' },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [chartSymbol, setChartSymbol] = useState({ symbol: '^GSPC', title: 'S&P 500' })
  const tabRefs = useRef({})

  const handleTabClick = useCallback((tabId) => {
    setActiveTab(tabId)
    requestAnimationFrame(() => {
      tabRefs.current[tabId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    })
  }, [])

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
    <div className="min-h-screen bg-nx-base relative">
      {/* Ambient background glow orbs */}
      <div className="nx-ambient" />

      {/* Content layer */}
      <div className="relative z-10">
        <Header />
        <TickerBar quotes={quotes} symbols={TICKER_SYMBOLS} />

        {/* Tab navigation */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(10, 14, 23, 0.7), rgba(10, 14, 23, 0.5))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div className="max-w-[1920px] mx-auto px-5">
            <div className="flex items-center">
              <div className="flex gap-0 overflow-x-auto scrollbar-hide">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    ref={el => tabRefs.current[tab.id] = el}
                    onClick={() => handleTabClick(tab.id)}
                    aria-label={`${tab.label} tab`}
                    aria-selected={activeTab === tab.id}
                    role="tab"
                    className={`nx-tab whitespace-nowrap ${activeTab === tab.id ? 'nx-tab-active' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Live indicator */}
              <div className="ml-auto flex items-center gap-2.5 text-2xs">
                <div className="relative">
                  <div className={`w-1.5 h-1.5 rounded-full ${quotesLoading ? 'bg-nx-orange animate-pulse' : 'bg-nx-green'}`} />
                  {!quotesLoading && <div className="absolute -inset-0.5 rounded-full bg-nx-green/30 animate-pulse-gentle" />}
                </div>
                <span className="font-medium" style={{ color: '#94a3b8' }}>{quotesLoading ? 'Refreshing...' : 'Live \u00B7 15s'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="max-w-[1920px] mx-auto p-4 space-y-5">
          {activeTab === 'overview' && (
            <>
              <MarketOverview quotes={quotes} />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="xl:col-span-2">
                  <div className="flex items-center gap-1 mb-3 flex-wrap p-0.5">
                    {chartOptions.map(opt => (
                      <button
                        key={opt.symbol}
                        onClick={() => setChartSymbol(opt)}
                        className={`px-2.5 py-1.5 text-2xs rounded-lg font-semibold transition-all duration-200 ${
                          chartSymbol.symbol === opt.symbol
                            ? 'text-nx-accent border border-nx-accent/20'
                            : 'hover:bg-nx-glass-hover'
                        }`}
                        style={chartSymbol.symbol === opt.symbol
                          ? { background: 'rgba(91, 141, 238, 0.12)', boxShadow: '0 0 12px rgba(91, 141, 238, 0.08)' }
                          : { color: '#94a3b8' }
                        }
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

          {activeTab === 'research' && (
            <CloudResearch />
          )}

          {activeTab === 'backtest' && (
            <Backtesting />
          )}

          {activeTab === 'ai' && (
            <AIAssistant />
          )}

          {activeTab === 'optimize' && (
            <Optimization />
          )}

          {activeTab === 'live' && (
            <LiveTrading />
          )}

          {activeTab === 'portfolio' && (
            <MultiAssetPortfolio />
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
        <footer className="py-5 mt-8" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
          <div className="max-w-[1920px] mx-auto px-5 flex items-center justify-between">
            <p className="text-2xs font-medium tracking-wide" style={{ color: '#475569' }}>
              Noctis &middot; Quantitative Market Intelligence
            </p>
            <p className="text-2xs" style={{ color: '#475569' }}>
              For informational purposes only. Not financial advice.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
