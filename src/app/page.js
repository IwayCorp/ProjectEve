'use client'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ThemeProvider } from '@/context/ThemeContext'
import Header from '@/components/Header'
import TickerBar from '@/components/TickerBar'

// Padlock SVG icon for lock/unlock toggle
const LockIcon = ({ locked }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.7 }}>
    {locked ? (
      <>
        <rect x="2" y="7" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M4 7V4.5C4 2.57 5.57 1 7.5 1C9.43 1 11 2.57 11 4.5V7" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <circle cx="8" cy="10.5" r="0.5" fill="currentColor"/>
      </>
    ) : (
      <>
        <rect x="2" y="7" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <path d="M4 7V4.5C4 2.57 5.57 1 7.5 1C9.43 1 11 2.57 11 4.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="2,2"/>
        <circle cx="8" cy="10.5" r="0.5" fill="currentColor"/>
      </>
    )}
  </svg>
)
import MarketOverview, { DEFAULT_FAVORITES, loadFavorites } from '@/components/MarketOverview'
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
import LivePerformance from '@/components/LivePerformance'
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
  { id: 'history', label: 'Simulated Results' },
  { id: 'performance', label: 'Performance' },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [chartSymbol, setChartSymbol] = useState({ symbol: '^GSPC', title: 'S&P 500' })
  const tabRefs = useRef({})
  const [stickyBars, setStickyBars] = useState(() => {
    // SSR-safe: read from localStorage with default true
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('noctis-sticky-bars')
      return saved !== null ? JSON.parse(saved) : true
    }
    return true
  })
  const [favSymbols, setFavSymbols] = useState(() => {
    // SSR-safe: try reading from localStorage, fall back to defaults
    if (typeof window !== 'undefined') {
      const saved = loadFavorites()
      if (saved) return saved.map(f => f.sym)
    }
    return DEFAULT_FAVORITES.map(f => f.sym)
  })

  const handleFavoritesChange = useCallback((favs) => {
    setFavSymbols(favs.map(f => f.sym))
  }, [])

  const handleToggleStickyBars = useCallback(() => {
    setStickyBars(prev => {
      const newValue = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('noctis-sticky-bars', JSON.stringify(newValue))
      }
      return newValue
    })
  }, [])

  const handleTabClick = useCallback((tabId) => {
    setActiveTab(tabId)
    requestAnimationFrame(() => {
      tabRefs.current[tabId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    })
  }, [])

  const handleSearchSelect = useCallback((result) => {
    // Set the chart to the selected symbol and navigate to trade ideas tab
    setChartSymbol({
      symbol: result.symbol,
      title: result.name || result.symbol
    })
    setActiveTab('trades')
  }, [])

  const allSymbols = useMemo(() => {
    const syms = getAllSymbols()
    const extra = ['EURUSD=X', 'GBPUSD=X', 'CHF=X', 'AUDUSD=X', 'MXN=X', 'EURGBP=X', 'NZDUSD=X', 'BTC-USD',
      'LMT', 'JPM', 'UNH', 'BYND', 'DIS', 'NKE', 'COIN', 'ARKK', 'IWM', 'TLT', 'XLU', 'XLRE', 'FXI']
    return [...new Set([...Object.values(syms), ...extra, ...favSymbols])]
  }, [favSymbols])

  const { data: quotes, loading: quotesLoading, error: quotesError } = useQuotes(allSymbols, 15000)
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
    <ThemeProvider>
    <div className="min-h-screen bg-nx-base relative flex flex-col">
      {/* Ambient background glow orbs */}
      <div className="nx-ambient" />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col flex-1">
        <Header onSearchSelect={handleSearchSelect} />
        <div style={stickyBars ? { position: 'sticky', top: '52px', zIndex: 40 } : {}}>
          <TickerBar quotes={quotes} symbols={TICKER_SYMBOLS} />
        </div>

        {/* Tab navigation */}
        <div style={{
          position: stickyBars ? 'sticky' : 'static',
          top: stickyBars ? '88px' : 'auto',
          zIndex: stickyBars ? 39 : 'auto',
          background: 'var(--tab-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--tab-border)',
          transition: 'var(--theme-transition)',
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

              {/* Live indicator + Sticky bars lock toggle */}
              <div className="ml-auto flex items-center gap-2.5 text-2xs">
                <div className="relative">
                  <div className={`w-1.5 h-1.5 rounded-full ${quotesError ? 'bg-nx-red' : quotesLoading ? 'bg-nx-orange animate-pulse' : 'bg-nx-green'}`} />
                  {!quotesLoading && !quotesError && <div className="absolute -inset-0.5 rounded-full bg-nx-green/30 animate-pulse-gentle" />}
                </div>
                <span className="font-medium" style={{ color: quotesError ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-text-muted))' }}>
                  {quotesError ? 'API Error' : quotesLoading ? 'Refreshing...' : 'Live \u00B7 15s'}
                </span>

                <div className="w-px h-4 bg-nx-border/30 mx-1" />

                <button
                  onClick={handleToggleStickyBars}
                  aria-label={stickyBars ? 'Unlock sticky bars' : 'Lock sticky bars'}
                  className="p-1.5 rounded-md transition-all duration-200 hover:bg-nx-surface"
                  style={{ color: 'rgb(var(--nx-text-muted))' }}
                  title={stickyBars ? 'Bars are locked (sticky)' : 'Bars are unlocked'}
                >
                  <LockIcon locked={stickyBars} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="max-w-[1920px] mx-auto p-4 space-y-5 flex-1">
          {activeTab === 'overview' && (
            <>
              <MarketOverview quotes={quotes} onFavoritesChange={handleFavoritesChange} />

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
                          ? { background: 'var(--nx-accent-muted)', boxShadow: '0 0 12px rgba(var(--nx-accent) / 0.08)' }
                          : { color: 'rgb(var(--nx-text-muted))' }
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
              <RiskCalendar quotes={quotes} />
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
            <LiveTrading quotes={quotes} />
          )}

          {activeTab === 'portfolio' && (
            <MultiAssetPortfolio />
          )}

          {activeTab === 'correlation' && (
            <CorrelationHeatmap correlations={correlations} loading={corrLoading} />
          )}

          {activeTab === 'risk' && (
            <>
              <RiskCalendar showBanner quotes={quotes} />
              <ScenarioAnalysis showBanner />
            </>
          )}

          {activeTab === 'history' && (
            <HistoricalData />
          )}

          {activeTab === 'performance' && (
            <LivePerformance />
          )}
        </main>

        {/* Footer */}
        <footer className="py-4 mt-auto" style={{ borderTop: '1px solid var(--nx-border)', transition: 'var(--theme-transition)' }}>
          <div className="max-w-[1920px] mx-auto px-5 flex items-center justify-between">
            <p className="text-2xs font-medium tracking-wide" style={{ color: 'rgb(var(--nx-text-hint))' }}>
              Noctis &middot; Quantitative Market Intelligence
              <span className="mx-2">|</span>
              Data via Yahoo Finance
            </p>
            <p className="text-2xs" style={{ color: 'rgb(var(--nx-text-hint))' }}>
              For informational purposes only. Not financial advice.
            </p>
          </div>
        </footer>
      </div>
    </div>
    </ThemeProvider>
  )
}
