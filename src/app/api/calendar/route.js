import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Fetch economic calendar from multiple free sources
async function fetchForexFactoryCalendar() {
  try {
    // Forex Factory JSON feed (free, no auth)
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 }, // cache 1 hour
    })
    if (!res.ok) throw new Error(`FF calendar ${res.status}`)
    const events = await res.json()
    return events.map(e => ({
      date: e.date,
      time: e.time || '',
      title: e.title,
      country: e.country,
      impact: e.impact?.toLowerCase() || 'low',
      forecast: e.forecast || '',
      previous: e.previous || '',
      source: 'forex-factory',
    }))
  } catch (err) {
    return []
  }
}

// Fetch from Trading Economics (public calendar page data)
async function fetchTradingEconomicsCalendar() {
  try {
    // Use the free tradingeconomics stream endpoint
    const today = new Date()
    const endDate = new Date(today.getTime() + 30 * 86400000)
    const start = today.toISOString().split('T')[0]
    const end = endDate.toISOString().split('T')[0]

    const res = await fetch(`https://tradingeconomics.com/calendar?f=json&country=united%20states,japan,euro%20area,united%20kingdom,china,germany&importance=2,3`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      next: { revalidate: 7200 },
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.slice(0, 50).map(e => ({
      date: e.Date ? new Date(e.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      time: e.Date ? new Date(e.Date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      title: e.Event || e.Category || '',
      country: e.Country || '',
      impact: e.Importance >= 3 ? 'high' : e.Importance >= 2 ? 'medium' : 'low',
      forecast: e.Forecast != null ? String(e.Forecast) : '',
      previous: e.Previous != null ? String(e.Previous) : '',
      actual: e.Actual != null ? String(e.Actual) : '',
      source: 'trading-economics',
    }))
  } catch (err) {
    return []
  }
}

// Classify volatility impact for known event types
function classifyVolatility(title, impact) {
  const t = title.toLowerCase()
  if (t.includes('fed') || t.includes('fomc') || t.includes('rate decision') || t.includes('nonfarm') || t.includes('non-farm')) return 'EXTREME'
  if (t.includes('cpi') || t.includes('inflation') || t.includes('gdp') || t.includes('employment') || t.includes('boj') || t.includes('ecb')) return 'HIGH'
  if (t.includes('pmi') || t.includes('retail sales') || t.includes('trade balance') || t.includes('housing') || t.includes('consumer confidence')) return 'HIGH'
  if (impact === 'high') return 'HIGH'
  if (impact === 'medium') return 'MEDIUM'
  return 'LOW'
}

// Generate action recommendation
function generateAction(title, volatility, impact) {
  const t = title.toLowerCase()
  if (volatility === 'EXTREME') {
    if (t.includes('fed') || t.includes('fomc')) return 'Reduce position sizes. Consider hedging with VIX calls or put spreads. No new entries 24h before.'
    if (t.includes('nonfarm') || t.includes('non-farm')) return 'Reduce equity and forex exposure. Expect USD volatility. Tighten stops on all positions.'
    return 'Maximum caution. Reduce all position sizes by 50%. Widen stops or hedge with options.'
  }
  if (volatility === 'HIGH') {
    if (t.includes('cpi') || t.includes('inflation')) return 'Hot CPI = sell bonds/buy USD. Cool CPI = buy bonds/sell USD. Pre-position accordingly.'
    if (t.includes('gdp')) return 'Strong GDP = risk-on. Weak GDP = risk-off. Monitor for surprise vs consensus.'
    if (t.includes('boj')) return 'Watch for yield curve control changes. JPY pairs volatile. Reduce USDJPY size.'
    return 'Tighten stops on correlated positions. Consider reducing size by 25%.'
  }
  return 'Monitor for surprises vs consensus. Standard position sizing acceptable.'
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'all'

  try {
    let events = []

    // Try multiple sources
    if (source === 'all' || source === 'ff') {
      const ffEvents = await fetchForexFactoryCalendar()
      events = events.concat(ffEvents)
    }

    if ((source === 'all' && events.length < 5) || source === 'te') {
      const teEvents = await fetchTradingEconomicsCalendar()
      events = events.concat(teEvents)
    }

    // Process and enrich events
    const enriched = events
      .filter(e => e.title && e.title.trim())
      .map(e => {
        const volatility = classifyVolatility(e.title, e.impact)
        return {
          date: e.date,
          time: e.time,
          event: e.title,
          country: e.country,
          impact: `${e.forecast ? 'Forecast: ' + e.forecast : ''}${e.previous ? ' | Previous: ' + e.previous : ''}${e.actual ? ' | Actual: ' + e.actual : ''}`.trim() || `${e.country} economic release`,
          volatility,
          action: generateAction(e.title, volatility, e.impact),
          source: e.source,
        }
      })

    // Sort by date and deduplicate
    const seen = new Set()
    const unique = enriched.filter(e => {
      const key = `${e.date}-${e.event}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // If no live data available, return curated current events based on known schedule
    if (unique.length === 0) {
      const fallback = generateFallbackCalendar()
      return NextResponse.json({ events: fallback, source: 'curated-fallback', live: false })
    }

    return NextResponse.json({ events: unique.slice(0, 30), source: source, live: true })
  } catch (error) {
    // Fallback to curated calendar
    const fallback = generateFallbackCalendar()
    return NextResponse.json({ events: fallback, source: 'curated-fallback', live: false, error: error.message })
  }
}

// Curated fallback based on standard economic calendar patterns
function generateFallbackCalendar() {
  const now = new Date()
  const month = now.toLocaleString('en-US', { month: 'short' })
  const year = now.getFullYear()

  // Standard recurring events that happen every month
  const recurring = [
    { dayOffset: 1, event: 'ISM Manufacturing PMI', country: 'US', volatility: 'HIGH', impact: 'Manufacturing sector health indicator' },
    { dayOffset: 3, event: 'ADP Employment Change', country: 'US', volatility: 'HIGH', impact: 'Private sector employment gauge' },
    { dayOffset: 4, event: 'ISM Services PMI', country: 'US', volatility: 'HIGH', impact: 'Services sector activity' },
    { dayOffset: 5, event: 'Non-Farm Payrolls', country: 'US', volatility: 'EXTREME', impact: 'Key employment report — drives USD, yields, equities' },
    { dayOffset: 10, event: 'CPI (Consumer Price Index)', country: 'US', volatility: 'EXTREME', impact: 'Inflation measure — critical for Fed policy expectations' },
    { dayOffset: 12, event: 'PPI (Producer Price Index)', country: 'US', volatility: 'HIGH', impact: 'Pipeline inflation indicator' },
    { dayOffset: 15, event: 'Retail Sales', country: 'US', volatility: 'HIGH', impact: 'Consumer spending strength' },
    { dayOffset: 16, event: 'Industrial Production', country: 'US', volatility: 'MEDIUM', impact: 'Manufacturing output' },
    { dayOffset: 18, event: 'Housing Starts / Building Permits', country: 'US', volatility: 'MEDIUM', impact: 'Housing market health' },
    { dayOffset: 22, event: 'Existing Home Sales', country: 'US', volatility: 'MEDIUM', impact: 'Housing demand indicator' },
    { dayOffset: 25, event: 'GDP (Advance/Preliminary/Final)', country: 'US', volatility: 'HIGH', impact: 'Economic growth measure' },
    { dayOffset: 27, event: 'PCE Price Index (Core)', country: 'US', volatility: 'EXTREME', impact: "Fed's preferred inflation gauge" },
    { dayOffset: 28, event: 'BoJ Interest Rate Decision', country: 'JP', volatility: 'HIGH', impact: 'JPY pairs — watch for YCC changes' },
    { dayOffset: 29, event: 'ECB Interest Rate Decision', country: 'EU', volatility: 'HIGH', impact: 'EUR pairs — forward guidance key' },
    { dayOffset: 30, event: 'FOMC Rate Decision', country: 'US', volatility: 'EXTREME', impact: 'Federal Reserve policy — moves all markets' },
  ]

  return recurring.map(e => {
    const eventDate = new Date(now.getFullYear(), now.getMonth(), e.dayOffset)
    if (eventDate < now) eventDate.setMonth(eventDate.getMonth() + 1)
    return {
      date: eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: '08:30 AM',
      event: e.event,
      country: e.country,
      impact: e.impact,
      volatility: e.volatility,
      action: generateAction(e.event, e.volatility, e.volatility.toLowerCase()),
      source: 'curated',
    }
  }).sort((a, b) => new Date(a.date) - new Date(b.date))
}
