'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import SettingsModal from '@/components/SettingsModal'

// Market sessions with timezone + hours in local time
const MARKETS = [
  { id: 'tse', label: 'TSE', full: 'Tokyo', tz: 'Asia/Tokyo', open: [9, 0], close: [15, 0], color: '#f87171', weekdays: true },
  { id: 'sse', label: 'SSE', full: 'Shanghai', tz: 'Asia/Shanghai', open: [9, 30], close: [15, 0], color: '#fbbf24', weekdays: true },
  { id: 'lse', label: 'LSE', full: 'London', tz: 'Europe/London', open: [8, 0], close: [16, 30], color: '#a78bfa', weekdays: true },
  { id: 'nyse', label: 'NYSE', full: 'New York', tz: 'America/New_York', open: [9, 30], close: [16, 0], color: '#5b8dee', weekdays: true },
  { id: 'cme', label: 'CME', full: 'Chicago (Futures)', tz: 'America/Chicago', open: [17, 0], close: [16, 0], color: '#34d399', weekdays: true, overnight: true },
  { id: 'fx', label: 'FX', full: 'Forex (24h)', tz: 'America/New_York', open: [17, 0], close: [17, 0], color: '#38bdf8', weekdays: true, h24: true },
]

function getMarketTime(tz) {
  try {
    const str = new Date().toLocaleString('en-US', { timeZone: tz, hour12: false })
    return new Date(str)
  } catch { return null }
}

function isOpen(market) {
  const t = getMarketTime(market.tz)
  if (!t) return false
  const day = t.getDay()
  if (market.weekdays && (day === 0 || day === 6)) return false
  if (market.h24) return day >= 1 && day <= 5 // Mon-Fri for FX
  const mins = t.getHours() * 60 + t.getMinutes()
  const openMins = market.open[0] * 60 + market.open[1]
  const closeMins = market.close[0] * 60 + market.close[1]
  if (market.overnight) {
    return mins >= openMins || mins < closeMins
  }
  return mins >= openMins && mins < closeMins
}

export default function Header({ onSearchSelect }) {
  const [time, setTime] = useState(null)
  const [showMarkets, setShowMarkets] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchInputRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    setTime(new Date())
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Handle search input with debounce
  const handleSearchInput = useCallback((e) => {
    const query = e.target.value
    setSearchQuery(query)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!query.trim()) {
      setSearchResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setSearchResults(data.results || [])
      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }, [])

  // Close search on Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setShowSearch(false)
      setSearchQuery('')
      setSearchResults([])
    }
  }, [])

  // Handle search result click
  const handleSelectResult = useCallback((result) => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    if (onSearchSelect) {
      onSearchSelect(result)
    }
  }, [onSearchSelect])

  // Close search on outside click
  useEffect(() => {
    if (!showSearch) return

    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-search-modal]') && !e.target.closest('[data-search-trigger]')) {
        setShowSearch(false)
        setSearchQuery('')
        setSearchResults([])
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showSearch])

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  const et = useMemo(() => {
    if (!time) return null
    try {
      const etStr = time.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
      return new Date(etStr)
    } catch { return null }
  }, [time])

  const marketStatuses = useMemo(() => {
    if (!time) return []
    return MARKETS.map(m => ({
      ...m,
      isOpen: isOpen(m),
      localTime: getMarketTime(m.tz),
    }))
  }, [time])

  const openCount = marketStatuses.filter(m => m.isOpen).length

  const handleToggleSettings = useCallback(() => {
    setShowSettings(prev => !prev)
  }, [])

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-50" style={{
        background: 'var(--header-bg)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        borderBottom: '1px solid var(--header-border)',
        boxShadow: 'var(--header-shadow)',
        transition: 'var(--theme-transition)',
      }}>
        <div className="max-w-[1920px] mx-auto px-5 py-2.5 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <img src="/logo.svg" alt="Noctis" className="w-9 h-9 rounded-lg relative z-10" />
              <div className="absolute -inset-1.5 rounded-xl opacity-25 blur-lg transition-opacity duration-500 group-hover:opacity-40" style={{ background: 'linear-gradient(135deg, #5b8dee, #a78bfa)' }} />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight" style={{ color: 'var(--header-text-bright)' }}>
                Noctis
              </h1>
              <p className="text-2xs font-medium tracking-[0.12em] uppercase" style={{ color: 'var(--header-text-dim)' }}>
                Quantitative Intelligence
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Market session pills — compact row */}
            <div className="hidden lg:flex items-center gap-1.5">
              {marketStatuses.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-default transition-all duration-200"
                  style={{
                    background: m.isOpen ? `${m.color}10` : 'var(--nx-glass-hover)',
                    border: `1px solid ${m.isOpen ? `${m.color}25` : 'var(--nx-border)'}`,
                  }}
                  title={`${m.full}: ${m.localTime ? m.localTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'} local`}
                >
                  <div className="relative">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.isOpen ? m.color : '#475569' }} />
                    {m.isOpen && <div className="absolute -inset-0.5 rounded-full animate-pulse-gentle" style={{ background: `${m.color}30` }} />}
                  </div>
                  <span className="text-2xs font-bold" style={{ color: m.isOpen ? m.color : '#475569' }}>{m.label}</span>
                </div>
              ))}
            </div>

            {/* Mobile: summary pill */}
            <button
              onClick={() => setShowMarkets(!showMarkets)}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--nx-glass-hover)', border: '1px solid var(--nx-border)' }}
            >
              <div className={`w-2 h-2 rounded-full ${openCount > 0 ? 'bg-nx-green' : 'bg-nx-red'}`} />
              <span className="text-xs font-medium" style={{ color: 'var(--header-text-dim)' }}>{openCount} Open</span>
            </button>

            <div className="nx-divider" />

            {/* Clock */}
            <div className="text-right">
              <div className="text-sm font-mono font-semibold tabular-nums" style={{ color: 'var(--header-text-bright)' }} suppressHydrationWarning>
                {et ? et.toLocaleTimeString('en-US', { hour12: true }) : '--:--:--'}
                <span className="text-2xs ml-1 font-normal" style={{ color: 'var(--header-text-dim)' }}>ET</span>
              </div>
              <div className="text-2xs font-medium" style={{ color: 'var(--header-text-dim)' }} suppressHydrationWarning>
                {et ? et.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '---'}
              </div>
            </div>

            <div className="nx-divider" />

            {/* Search magnifying glass */}
            <button
              data-search-trigger
              onClick={() => setShowSearch(!showSearch)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{
                color: showSearch ? 'rgb(var(--nx-accent))' : 'var(--header-text-dim)',
                background: showSearch ? 'rgba(var(--nx-accent) / 0.08)' : 'transparent',
                border: showSearch ? '1px solid rgba(var(--nx-accent) / 0.15)' : '1px solid transparent',
              }}
              aria-label="Open search"
              title="Search assets"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6.5" cy="6.5" r="5" />
                <path d="M9.9 9.9L14 14" />
              </svg>
            </button>

            {/* Settings gear */}
            <button
              onClick={handleToggleSettings}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{
                color: showSettings ? 'rgb(var(--nx-accent))' : 'var(--header-text-dim)',
                background: showSettings ? 'rgba(var(--nx-accent) / 0.08)' : 'transparent',
                border: showSettings ? '1px solid rgba(var(--nx-accent) / 0.15)' : '1px solid transparent',
              }}
              aria-label="Open settings"
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.902 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile market detail dropdown */}
        {showMarkets && (
          <div className="lg:hidden px-5 pb-3 space-y-1 animate-fade-in">
            {marketStatuses.map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'var(--nx-glass-hover)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.isOpen ? m.color : '#475569' }} />
                  <span className="text-xs font-semibold" style={{ color: m.isOpen ? m.color : 'var(--header-text-dim)' }}>{m.label}</span>
                  <span className="text-2xs" style={{ color: 'rgb(var(--nx-text-muted))' }}>{m.full}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-mono" style={{ color: 'var(--header-text-dim)' }} suppressHydrationWarning>
                    {m.localTime ? m.localTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
                  </span>
                  <span className={`text-2xs font-bold ${m.isOpen ? 'text-nx-green' : 'text-nx-red'}`}>
                    {m.isOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search modal overlay */}
        {showSearch && (
          <div
            data-search-modal
            className="animate-fade-in"
            style={{
              background: 'var(--card-bg)',
              borderBottom: '1px solid var(--nx-border)',
              boxShadow: 'var(--header-shadow)',
            }}
          >
            <div className="max-w-[1920px] mx-auto px-5 py-4 space-y-3">
              {/* Search Input */}
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search any asset... (e.g. AAPL, Bitcoin, EUR/USD)"
                  value={searchQuery}
                  onChange={handleSearchInput}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-2.5 rounded-lg text-sm"
                  style={{
                    background: 'var(--nx-glass)',
                    color: 'var(--nx-text-strong)',
                    border: '1px solid var(--nx-border)',
                    outline: 'none',
                  }}
                />
                {searchLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-nx-accent/20 border-t-nx-accent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchQuery && (
                <div
                  className="rounded-lg max-h-[400px] overflow-y-auto space-y-1"
                  style={{ background: 'var(--nx-glass-hover)' }}
                >
                  {searchLoading && !searchResults.length ? (
                    <div className="px-4 py-6 text-center text-sm text-nx-text-muted">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-nx-text-muted">
                      No results found for "{searchQuery}"
                    </div>
                  ) : (
                    searchResults.map((result, idx) => (
                      <button
                        key={`${result.symbol}-${idx}`}
                        onClick={() => handleSelectResult(result)}
                        className="w-full px-4 py-3 text-left hover:bg-nx-glass transition-colors border-b border-nx-border last:border-b-0"
                        style={{
                          color: 'var(--nx-text-strong)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">{result.symbol}</div>
                            <div className="text-2xs text-nx-text-muted truncate">{result.name}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Type badge with color */}
                            <span
                              className="px-2 py-1 rounded-md text-2xs font-bold"
                              style={{
                                background:
                                  result.type === 'EQUITY' ? 'rgba(59, 130, 246, 0.15)' :
                                  result.type === 'ETF' ? 'rgba(139, 92, 246, 0.15)' :
                                  result.type === 'CRYPTOCURRENCY' ? 'rgba(249, 115, 22, 0.15)' :
                                  result.type === 'INDEX' ? 'rgba(34, 197, 94, 0.15)' :
                                  result.type === 'CURRENCY' ? 'rgba(168, 85, 247, 0.15)' :
                                  'rgba(148, 163, 184, 0.15)',
                                color:
                                  result.type === 'EQUITY' ? '#3b82f6' :
                                  result.type === 'ETF' ? '#8b5cf6' :
                                  result.type === 'CRYPTOCURRENCY' ? '#f97316' :
                                  result.type === 'INDEX' ? '#22c55e' :
                                  result.type === 'CURRENCY' ? '#a855f7' :
                                  '#94a3b8',
                              }}
                            >
                              {result.type === 'EQUITY' ? 'Stock' :
                               result.type === 'CRYPTOCURRENCY' ? 'Crypto' :
                               result.type === 'INDEX' ? 'Index' :
                               result.type === 'CURRENCY' ? 'Currency' :
                               result.type === 'ETF' ? 'ETF' :
                               result.type}
                            </span>
                            {result.exchange && (
                              <span className="text-2xs text-nx-text-muted">{result.exchange}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Settings modal */}
      <SettingsModal open={showSettings} onClose={handleCloseSettings} />
    </>
  )
}
