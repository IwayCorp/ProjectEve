'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { formatPrice, formatChange } from '@/lib/marketData'

// ─── Default favorites (the 6 index cells) ───
const DEFAULT_FAVORITES = [
  { label: 'S&P 500', sym: '^GSPC', type: 'index' },
  { label: 'Nasdaq', sym: '^IXIC', type: 'index' },
  { label: 'Dow Jones', sym: '^DJI', type: 'index' },
  { label: 'Russell 2000', sym: '^RUT', type: 'index' },
  { label: 'VIX', sym: '^VIX', type: 'index' },
  { label: 'Bitcoin', sym: 'BTC-USD', type: 'stock' },
]

const MAX_FAVORITES = 6

// ─── Infer formatting type from Yahoo Finance quoteType / symbol ───
function inferType(symbol, quoteType) {
  if (symbol.startsWith('^')) {
    if (['IRX', 'TNX', 'TYX'].some(s => symbol.includes(s))) return 'yield'
    return 'index'
  }
  if (quoteType === 'CURRENCY' || symbol.includes('=X')) return 'forex'
  if (quoteType === 'INDEX') return 'index'
  return 'stock'
}

// ─── localStorage helpers ───
function loadFavorites() {
  try {
    const raw = localStorage.getItem('noctis-favorites')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sym) return parsed.slice(0, MAX_FAVORITES)
    }
  } catch {}
  return null
}

function saveFavorites(favs) {
  try { localStorage.setItem('noctis-favorites', JSON.stringify(favs)) } catch {}
}

// ═══════════════════════════════════════════
//  QuoteCard — individual market tile
// ═══════════════════════════════════════════
function QuoteCard({ label, quote, type = 'stock', onRemove, editable }) {
  if (!quote) return (
    <div className="nx-quote-card p-4 relative group">
      <div className="h-3 w-16 nx-shimmer mb-3" />
      <div className="h-6 w-24 nx-shimmer" />
      {editable && onRemove && (
        <button onClick={onRemove} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--nx-red-muted)', color: 'rgb(var(--nx-red))' }} title="Remove from favorites">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1l-8 8" /></svg>
        </button>
      )}
    </div>
  )

  const isUp = quote.regularMarketChangePercent >= 0
  const cardClass = `nx-quote-card ${isUp ? 'nx-quote-card-up' : 'nx-quote-card-down'} p-4 relative group`

  return (
    <div className={cardClass}>
      {editable && onRemove && (
        <button onClick={onRemove} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center z-10" style={{ background: 'var(--nx-red-muted)', color: 'rgb(var(--nx-red))' }} title="Remove from favorites">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1l-8 8" /></svg>
        </button>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--nx-text-muted))' }}>{label}</span>
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
      }`} style={quote.priceDirection ? {} : { color: 'rgb(var(--nx-text-strong))' }}>
        {formatPrice(quote.regularMarketPrice, type)}
      </div>

      <div className="flex items-center justify-between mt-3 text-2xs font-medium" style={{ color: 'rgb(var(--nx-text-muted))' }}>
        <span>H: {formatPrice(quote.regularMarketDayHigh, type)}</span>
        <span>L: {formatPrice(quote.regularMarketDayLow, type)}</span>
      </div>

      {quote.regularMarketDayHigh && quote.regularMarketDayLow && quote.regularMarketDayHigh > quote.regularMarketDayLow && (
        <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--nx-glass-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, Math.max(5, ((quote.regularMarketPrice - quote.regularMarketDayLow) / (quote.regularMarketDayHigh - quote.regularMarketDayLow)) * 100))}%`,
              background: isUp
                ? 'linear-gradient(90deg, rgba(var(--nx-green) / 0.4), rgba(var(--nx-green) / 0.7))'
                : 'linear-gradient(90deg, rgba(var(--nx-red) / 0.4), rgba(var(--nx-red) / 0.7))',
              boxShadow: isUp
                ? '0 0 8px rgba(var(--nx-green) / 0.3)'
                : '0 0 8px rgba(var(--nx-red) / 0.3)',
            }}
          />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
//  AddFavoriteCard — search + add slot
// ═══════════════════════════════════════════
function AddFavoriteCard({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const debounceRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
        setResults([])
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  // Debounced search
  const handleSearch = useCallback((value) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 1) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setResults(data.results || [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const handleSelect = useCallback((item) => {
    onAdd({
      label: item.name,
      sym: item.symbol,
      type: inferType(item.symbol, item.type),
    })
    setOpen(false)
    setQuery('')
    setResults([])
  }, [onAdd])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="nx-quote-card p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 min-h-[120px]"
        style={{ borderStyle: 'dashed' }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--nx-accent-muted)', color: 'rgb(var(--nx-accent))' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
        </div>
        <span className="text-2xs font-semibold" style={{ color: 'rgb(var(--nx-text-muted))' }}>Add Favorite</span>
      </button>
    )
  }

  return (
    <div ref={panelRef} className="nx-quote-card p-3 relative min-h-[120px]" style={{ zIndex: 20 }}>
      {/* Search input */}
      <div className="flex items-center gap-2 mb-2 rounded-lg px-3 py-2" style={{ background: 'rgb(var(--nx-surface))', border: '1px solid var(--nx-border)' }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgb(var(--nx-text-muted))" strokeWidth="2" strokeLinecap="round">
          <circle cx="6.5" cy="6.5" r="5.5" />
          <path d="M10.5 10.5L15 15" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search ticker or name..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'rgb(var(--nx-text-strong))' }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery('')
              setResults([])
            }
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }} className="text-nx-text-muted hover:text-nx-text-strong">
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l8 8M9 1l-8 8" /></svg>
          </button>
        )}
      </div>

      {/* Results */}
      <div className="max-h-[200px] overflow-y-auto space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
        {searching && (
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgb(var(--nx-accent))', borderTopColor: 'transparent' }} />
            <span className="text-2xs" style={{ color: 'rgb(var(--nx-text-muted))' }}>Searching...</span>
          </div>
        )}

        {!searching && query.length > 0 && results.length === 0 && (
          <div className="px-2 py-3 text-center">
            <span className="text-2xs" style={{ color: 'rgb(var(--nx-text-muted))' }}>No results for "{query}"</span>
          </div>
        )}

        {results.map((item) => (
          <button
            key={item.symbol}
            onClick={() => handleSelect(item)}
            className="w-full flex items-center justify-between px-2 py-2 rounded-lg transition-all duration-150 text-left"
            style={{ color: 'rgb(var(--nx-text))' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--nx-glass-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono" style={{ color: 'rgb(var(--nx-accent))' }}>{item.symbol}</span>
                <span className="text-2xs px-1.5 py-0.5 rounded font-semibold" style={{
                  background: item.type === 'EQUITY' ? 'var(--nx-accent-muted)' : item.type === 'ETF' ? 'var(--nx-purple-muted)' : item.type === 'CRYPTOCURRENCY' ? 'var(--nx-orange-muted)' : item.type === 'INDEX' ? 'var(--nx-green-muted)' : item.type === 'CURRENCY' ? 'var(--nx-cyan-muted)' : 'var(--nx-glass-hover)',
                  color: item.type === 'EQUITY' ? 'rgb(var(--nx-accent))' : item.type === 'ETF' ? 'rgb(var(--nx-purple))' : item.type === 'CRYPTOCURRENCY' ? 'rgb(var(--nx-orange))' : item.type === 'INDEX' ? 'rgb(var(--nx-green))' : item.type === 'CURRENCY' ? 'rgb(var(--nx-cyan))' : 'rgb(var(--nx-text-muted))',
                }}>
                  {item.type === 'EQUITY' ? 'Stock' : item.type === 'CRYPTOCURRENCY' ? 'Crypto' : item.type || '—'}
                </span>
              </div>
              <p className="text-2xs truncate mt-0.5" style={{ color: 'rgb(var(--nx-text-muted))' }}>{item.name}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgb(var(--nx-text-hint))" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          </button>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
//  FavoritesBar — edit toggle + reset
// ═══════════════════════════════════════════
function FavoritesBar({ editing, onToggleEdit, onReset, count }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleEdit}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-semibold transition-all duration-200"
        style={{
          background: editing ? 'var(--nx-accent-muted)' : 'transparent',
          color: editing ? 'rgb(var(--nx-accent))' : 'rgb(var(--nx-text-muted))',
          border: editing ? '1px solid rgba(var(--nx-accent) / 0.2)' : '1px solid transparent',
        }}
      >
        {editing ? (
          <>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 8 7 11 12 5" /></svg>
            Done
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11.534 1.535a1.889 1.889 0 112.67 2.671L5.932 12.478l-3.596.899.899-3.596 8.299-8.246z" />
            </svg>
            Edit
          </>
        )}
      </button>
      {editing && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-semibold transition-all duration-200"
          style={{ color: 'rgb(var(--nx-text-muted))' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--nx-glass-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4v5h5" /><path d="M3.51 10.5a7 7 0 1 0 .74-7.49L1 4" />
          </svg>
          Reset Defaults
        </button>
      )}
      <span className="text-2xs ml-1 font-mono" style={{ color: 'rgb(var(--nx-text-hint))' }}>{count}/{MAX_FAVORITES}</span>
    </div>
  )
}

// ═══════════════════════════════════════════
//  MarketOverview — main component
// ═══════════════════════════════════════════
export default function MarketOverview({ quotes, onFavoritesChange }) {
  const [favorites, setFavorites] = useState(DEFAULT_FAVORITES)
  const [editing, setEditing] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load favorites from localStorage on mount
  useEffect(() => {
    const saved = loadFavorites()
    if (saved) setFavorites(saved)
    setMounted(true)
  }, [])

  // Persist + notify parent when favorites change
  useEffect(() => {
    if (!mounted) return
    saveFavorites(favorites)
    if (onFavoritesChange) onFavoritesChange(favorites)
  }, [favorites, mounted, onFavoritesChange])

  const handleAdd = useCallback((item) => {
    setFavorites(prev => {
      if (prev.length >= MAX_FAVORITES) return prev
      if (prev.some(f => f.sym === item.sym)) return prev
      return [...prev, item]
    })
  }, [])

  const handleRemove = useCallback((sym) => {
    setFavorites(prev => prev.filter(f => f.sym !== sym))
  }, [])

  const handleReset = useCallback(() => {
    setFavorites(DEFAULT_FAVORITES)
  }, [])

  // Static groups (bonds, commodities, forex) — unchanged
  const staticGroups = useMemo(() => [
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
  ], [])

  return (
    <div className="space-y-5">
      {/* ── Favorites Section (replaces static Indices) ── */}
      <div>
        <div className="nx-section-header">
          <div className="nx-accent-bar" />
          <h3>Favorites</h3>
          <div className="ml-auto flex items-center" style={{ marginRight: '-0.25rem' }}>
            <FavoritesBar
              editing={editing}
              onToggleEdit={() => setEditing(e => !e)}
              onReset={handleReset}
              count={favorites.length}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {favorites.map(item => (
            <QuoteCard
              key={item.sym}
              label={item.label}
              quote={quotes[item.sym]}
              type={item.type}
              editable={editing}
              onRemove={() => handleRemove(item.sym)}
            />
          ))}

          {/* Add slot — visible when editing and under limit */}
          {editing && favorites.length < MAX_FAVORITES && (
            <AddFavoriteCard onAdd={handleAdd} />
          )}
        </div>
      </div>

      {/* ── Static Sections (Bonds, Commodities, Forex) ── */}
      {staticGroups.map(group => (
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

// Export for page.js to get favorite symbols for fetching
export { DEFAULT_FAVORITES, loadFavorites }
