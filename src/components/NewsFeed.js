'use client'
import { useState, useEffect, useMemo } from 'react'
import { TermText } from '@/components/Tooltip'

function VolBadge({ level }) {
  const cls = level === 'EXTREME' ? 'badge-red' : level === 'HIGH' ? 'badge-orange' : level === 'MEDIUM' ? 'badge-blue' : 'badge-slate'
  return <span className={cls} aria-label={`${level} volatility risk`}>{level}</span>
}

function CountryFlag({ country }) {
  const countryMap = {
    'US': '🇺🇸',
    'JP': '🇯🇵',
    'EU': '🇪🇺',
    'UK': '🇬🇧',
    'CA': '🇨🇦',
    'AU': '🇦🇺',
    'CH': '🇨🇭',
  }
  return <span className="text-base">{countryMap[country] || country}</span>
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-nx-border"></div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-nx-accent animate-spin"></div>
      </div>
      <span className="ml-3 text-sm text-nx-text-muted">Loading news feed...</span>
    </div>
  )
}

function formatEventDate(dateStr) {
  if (!dateStr) return '—'
  try {
    if (dateStr.includes('T') || dateStr.includes('-') && dateStr.length > 10) {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    }
    return dateStr
  } catch { return dateStr }
}

function formatEventTime(dateStr, timeStr) {
  if (timeStr && timeStr !== '—' && !timeStr.includes('T')) return timeStr
  if (!dateStr) return '—'
  try {
    if (dateStr.includes('T')) {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      }
    }
    return timeStr || '—'
  } catch { return timeStr || '—' }
}

function generateEventAnalysis(event) {
  const eventType = event.event || event.title || ''
  const country = event.country || 'Unknown'

  const analysisMap = {
    'NFP': 'Non-Farm Payrolls is the most market-moving US economic release. Affects USD strength, equities, and bonds. Larger-than-expected jobs growth typically strengthens USD and supports equities. Weaker data may support bonds and weigh on the dollar.',
    'CPI': 'Consumer Price Index is the Fed\'s barometer for inflation. Above forecast suggests potential rate hikes (supportive for USD, negative for equities). Below forecast may ease inflation concerns and support risk assets.',
    'PMI': 'Purchasing Managers\' Index above 50 signals economic expansion, which is positive for the currency and equities. Below 50 signals contraction, typically weighing on risk assets and supporting safe havens like USD/JPY.',
    'GDP': 'Gross Domestic Product growth reports measure economic health. Strong GDP growth typically supports the home currency and equities. Weak growth may trigger risk-off sentiment and flight to safety.',
    'FOMC': 'Federal Open Market Committee decisions set US interest rates. Rate hikes support USD and may pressure equities; rate cuts have the opposite effect. Market expectations often build in advance.',
    'BoJ': 'Bank of Japan policy decisions are crucial for JPY and carry trades. Dovish signals weaken the yen and support carry trade unwinds. Hawkish moves strengthen JPY and support the currency.',
    'ECB': 'European Central Bank rate decisions impact EUR and European equities. Hawkish decisions support EUR; dovish moves weaken the currency but may support risk assets.',
    'Earnings': 'Corporate earnings reports reveal company profitability. Positive surprises support equities and sectors; negative misses create selling pressure. Guidance affects future sentiment.',
  }

  for (const [key, analysis] of Object.entries(analysisMap)) {
    if (eventType.toUpperCase().includes(key)) {
      return analysis
    }
  }

  return `This ${country} economic event is monitored for insights into economic health and potential currency movements. Check forecasts vs. previous values for market impact.`
}

// Generate search URLs across multiple unbiased news sources
function generateNewsLinks(event) {
  const eventName = event.event || event.title || ''
  const country = event.country || ''
  const query = encodeURIComponent(`${eventName} ${country} economic data`)
  const shortQuery = encodeURIComponent(eventName)

  const sources = [
    { name: 'Reuters', url: `https://www.reuters.com/search/news?query=${shortQuery}`, icon: '\u{1F4F0}', color: 'rgb(var(--nx-accent))' },
    { name: 'Bloomberg', url: `https://www.bloomberg.com/search?query=${shortQuery}`, icon: '\u{1F4CA}', color: 'rgb(var(--nx-purple))' },
    { name: 'CNBC', url: `https://www.cnbc.com/search/?query=${shortQuery}`, icon: '\u{1F4FA}', color: 'rgb(var(--nx-green))' },
    { name: 'MarketWatch', url: `https://www.marketwatch.com/search?q=${shortQuery}&ts=0&tab=All%20News`, icon: '\u{1F4C8}', color: 'rgb(var(--nx-orange))' },
    { name: 'Financial Times', url: `https://www.ft.com/search?q=${shortQuery}`, icon: '\u{1F4D1}', color: 'rgb(var(--nx-cyan))' },
    { name: 'Investing.com', url: `https://www.investing.com/search/?q=${shortQuery}&tab=news`, icon: '\u{1F310}', color: 'rgb(var(--nx-text-muted))' },
  ]

  // Add country-specific sources
  if (country === 'JP') {
    sources.push({ name: 'Nikkei Asia', url: `https://asia.nikkei.com/search?query=${shortQuery}`, icon: '\u{1F5FE}', color: 'rgb(var(--nx-red))' })
  } else if (country === 'UK') {
    sources.push({ name: 'BBC Business', url: `https://www.bbc.co.uk/search?q=${shortQuery}&page=1`, icon: '\u{1F1EC}\u{1F1E7}', color: 'rgb(var(--nx-red))' })
  } else if (country === 'EU') {
    sources.push({ name: 'ECB News', url: `https://www.ecb.europa.eu/press/pr/html/index.en.html`, icon: '\u{1F1EA}\u{1F1FA}', color: 'rgb(var(--nx-accent))' })
  }

  return sources
}

export default function NewsFeed({ quotes = {} }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState('All')
  const [expandedIndex, setExpandedIndex] = useState(null)

  const filters = ['All', 'EXTREME', 'HIGH', 'MEDIUM']

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/calendar')

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`)
        }

        const data = await res.json()
        const allEvents = data.events || []

        // Sort by date (newest first)
        const sorted = allEvents.sort((a, b) => {
          try {
            const dateA = new Date(a.date)
            const dateB = new Date(b.date)
            return dateB - dateA
          } catch {
            return 0
          }
        })

        setEvents(sorted)
      } catch (err) {
        console.error('Failed to fetch news:', err)
        setError(err.message)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [])

  // Filter events by volatility
  const filteredEvents = useMemo(() => {
    if (selectedFilter === 'All') return events
    return events.filter(e => (e.volatility || 'LOW').toUpperCase() === selectedFilter)
  }, [events, selectedFilter])

  return (
    <div className="space-y-3">
      <div className="nx-card">
        {/* Header */}
        <div className="p-4 border-b border-nx-border">
          <h3 className="text-sm font-bold text-nx-text-strong mb-4">Economic News Feed</h3>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {filters.map(filter => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedFilter === filter
                    ? 'bg-nx-accent text-white'
                    : 'bg-nx-glass hover:bg-nx-glass-hover text-nx-text-muted'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-nx-border scrollbar-track-transparent">
          {loading && <LoadingSpinner />}

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-base">⚠</span>
              <span className="text-sm text-red-400">Failed to load news: {error}</span>
            </div>
          )}

          {!loading && !error && filteredEvents.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-nx-text-muted">No {selectedFilter !== 'All' ? selectedFilter.toLowerCase() : ''} events</p>
            </div>
          )}

          {/* Event Cards */}
          {!loading && !error && filteredEvents.map((event, i) => {
            const isExpanded = expandedIndex === i
            const volatility = (event.volatility || 'MEDIUM').toUpperCase()

            return (
              <div key={i} className="rounded-lg border border-nx-border transition-all duration-200" style={{ background: isExpanded ? 'var(--nx-glass)' : 'transparent' }}>
                {/* Collapsed View (always visible) */}
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  className="w-full text-left p-3 flex items-center gap-3 hover:bg-nx-glass-hover transition-colors rounded-lg"
                >
                  {/* Country Flag */}
                  <div className="w-6 shrink-0 flex items-center justify-center">
                    <CountryFlag country={event.country} />
                  </div>

                  {/* Date */}
                  <div className="w-24 shrink-0">
                    <div className="text-sm font-bold text-nx-accent font-mono">{formatEventDate(event.date)}</div>
                    <div className="text-2xs text-nx-text-muted mt-0.5">{formatEventTime(event.date, event.time)}</div>
                  </div>

                  {/* Event Name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-nx-text-strong truncate">{event.event || event.title}</div>
                  </div>

                  {/* Volatility Badge */}
                  <div className="shrink-0">
                    <VolBadge level={volatility} />
                  </div>

                  {/* Expand Arrow */}
                  <div className="shrink-0 text-nx-text-muted transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                    ▼
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-nx-border/30 space-y-3">
                    {/* Event Analysis */}
                    <div>
                      <h4 className="text-xs font-semibold text-nx-text-muted uppercase tracking-wider mb-1.5">Impact Assessment</h4>
                      <p className="text-sm text-nx-text-strong leading-relaxed">
                        <TermText>{generateEventAnalysis(event)}</TermText>
                      </p>
                    </div>

                    {/* Forecast vs Previous */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg" style={{ background: 'var(--nx-void / 0.2)' }}>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase tracking-wider mb-0.5">Previous</div>
                        <div className="text-sm font-bold font-mono text-nx-text-strong">{event.previous || '—'}</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase tracking-wider mb-0.5">Forecast</div>
                        <div className="text-sm font-bold font-mono text-nx-accent">{event.forecast || '—'}</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase tracking-wider mb-0.5">Volatility</div>
                        <div className="text-sm font-bold font-mono text-nx-text-strong">{volatility}</div>
                      </div>
                    </div>

                    {/* Action Recommendation */}
                    {event.action && (
                      <div>
                        <h4 className="text-xs font-semibold text-nx-text-muted uppercase tracking-wider mb-1.5">Action Recommendation</h4>
                        <div className="text-sm text-nx-text-strong px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(var(--nx-accent) / 0.1)', color: 'rgb(var(--nx-accent))' }}>
                          <TermText>{event.action}</TermText>
                        </div>
                      </div>
                    )}

                    {/* Market Sectors Affected */}
                    <div>
                      <h4 className="text-xs font-semibold text-nx-text-muted uppercase tracking-wider mb-1.5">Likely Affected Sectors</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          const eventName = (event.event || event.title || '').toUpperCase()
                          let sectors = ['Currencies', 'Bonds']

                          if (eventName.includes('NFP') || eventName.includes('PAYROLL')) {
                            sectors = ['Equities', 'Currencies', 'Bonds']
                          } else if (eventName.includes('CPI') || eventName.includes('INFLATION')) {
                            sectors = ['Bonds', 'Currencies', 'Equities']
                          } else if (eventName.includes('PMI') || eventName.includes('MANUFACTURING')) {
                            sectors = ['Equities', 'Currencies', 'Commodities']
                          } else if (eventName.includes('GDP')) {
                            sectors = ['Equities', 'Bonds', 'Currencies']
                          } else if (eventName.includes('FOMC') || eventName.includes('INTEREST') || eventName.includes('RATE')) {
                            sectors = ['Bonds', 'Currencies', 'Equities', 'Commodities']
                          } else if (event.country === 'JP') {
                            sectors = ['Currencies', 'Equities', 'Bonds']
                          }

                          return sectors.map(sector => (
                            <span key={sector} className="px-2.5 py-1 rounded-md text-2xs font-medium" style={{ background: 'var(--nx-glass)', color: 'rgb(var(--nx-text-muted))' }}>
                              {sector}
                            </span>
                          ))
                        })()}
                      </div>
                    </div>

                    {/* Related News Sources — multi-source hyperlinks */}
                    <div>
                      <h4 className="text-xs font-semibold text-nx-text-muted uppercase tracking-wider mb-1.5">Related Sources</h4>
                      <p className="text-2xs text-nx-text-muted mb-2">Cross-reference multiple outlets for unbiased coverage</p>
                      <div className="flex flex-wrap gap-1.5">
                        {generateNewsLinks(event).map(source => (
                          <a
                            key={source.name}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-semibold transition-all duration-200 hover:scale-[1.03]"
                            style={{
                              background: 'var(--nx-glass)',
                              border: '1px solid var(--nx-border)',
                              color: source.color,
                              textDecoration: 'none',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = source.color; e.currentTarget.style.boxShadow = `0 0 12px ${source.color}20` }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--nx-border)'; e.currentTarget.style.boxShadow = 'none' }}
                          >
                            <span>{source.icon}</span>
                            <span>{source.name}</span>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                              <path d="M4 1h7v7" /><path d="M11 1L1 11" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Historical Context */}
                    <div>
                      <h4 className="text-xs font-semibold text-nx-text-muted uppercase tracking-wider mb-1.5">Historical Context</h4>
                      <p className="text-sm text-nx-text-strong leading-relaxed">
                        {event.country === 'JP' ? 'This Japanese economic event directly influences BoJ policy expectations and USD/JPY carry trade dynamics. Japan\'s economy is heavily export-dependent, making currency movements critical.' :
                          event.country === 'EU' ? 'Eurozone economic data influences ECB policy and EUR strength. Given the diverse economies within the euro area, country-level variance can be significant.' :
                          event.country === 'UK' ? 'UK economic releases impact GBP and UK equity markets. Post-Brexit, the UK economy has shown divergence from EU trends.' :
                          'US economic data sets the global tone for risk sentiment. As the world\'s largest economy, US releases typically create widespread market ripples across asset classes.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
