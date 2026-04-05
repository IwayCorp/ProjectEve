export const STORAGE_KEY = 'noctis-calendar-history'

/**
 * Load calendar history from localStorage
 * @returns {Array} Array of cataloged calendar events
 */
export function loadCalendarHistory() {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (err) {
    console.error('Error loading calendar history:', err)
    return []
  }
}

/**
 * Save calendar history to localStorage
 * @param {Array} events - Events to save
 */
export function saveCalendarHistory(events) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch (err) {
    console.error('Error saving calendar history:', err)
  }
}

/**
 * Catalog current calendar events into history
 * Merges with existing history, deduplicates by date+event name, keeps max 500 events
 * @param {Array} events - Current calendar events from API
 * @returns {Array} Updated history with cataloged events
 */
export function catalogCalendarEvents(events) {
  if (!Array.isArray(events)) return loadCalendarHistory()

  const existing = loadCalendarHistory()
  const now = new Date()
  const catalogedAt = now.toISOString()

  // Create a map for deduplication: key = "${date}-${event}"
  const eventMap = new Map()

  // Add existing events first
  existing.forEach(e => {
    const key = `${e.date}-${e.event}`
    eventMap.set(key, e)
  })

  // Add/update new events
  events.forEach(e => {
    const key = `${e.date}-${e.event}`
    if (!eventMap.has(key)) {
      eventMap.set(key, {
        ...e,
        catalogedAt,
      })
    }
  })

  // Convert back to array, sort by date (descending = most recent first)
  let history = Array.from(eventMap.values())

  // Sort by date descending
  history.sort((a, b) => {
    const dateA = parseEventDate(a.date)
    const dateB = parseEventDate(b.date)
    return dateB - dateA
  })

  // Keep max 500 events
  history = history.slice(0, 500)

  saveCalendarHistory(history)
  return history
}

/**
 * Update event outcomes based on price data before/after the event
 * Calculates market reaction and impact summary
 * @param {Array} events - Calendar events with date and volatility info
 * @param {Object} quotes - Quote data keyed by symbol { symbol: { regularMarketPrice, ... } }
 * @returns {Array} Events with added marketReaction and impactSummary fields
 */
export function updateEventOutcomes(events, quotes) {
  if (!Array.isArray(events) || !quotes) return events

  return events.map(event => {
    // Only update if the event has a date and is in the past
    const eventDate = parseEventDate(event.date)
    if (!eventDate || eventDate > new Date()) {
      return event
    }

    // Default symbols to track impact for (by country)
    const trackedSymbols = getTrackedSymbolsByCountry(event.country)
    const reactions = []

    trackedSymbols.forEach(symbol => {
      const quote = quotes[symbol]
      if (quote && quote.regularMarketPrice !== undefined) {
        // In a real scenario, we'd compare prices before/after event
        // For now, we'll just note the current price direction
        const change = quote.regularMarketChangePercent || 0
        const direction = change > 0.5 ? '↑' : change < -0.5 ? '↓' : '→'
        reactions.push(`${symbol} ${direction} ${Math.abs(change).toFixed(1)}%`)
      }
    })

    const marketReaction = reactions.length > 0
      ? reactions.join(', ')
      : null

    const impactSummary = marketReaction
      ? generateImpactSummary(event.volatility, marketReaction)
      : null

    return {
      ...event,
      marketReaction,
      impactSummary,
    }
  })
}

/**
 * Parse event date string to Date object
 * Handles formats like "Apr 5", "Apr 05", or ISO dates
 * @param {string} dateStr - Date string
 * @returns {Date|null} Parsed date or null
 */
function parseEventDate(dateStr) {
  if (!dateStr) return null
  try {
    // Try ISO format first
    if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const d = new Date(dateStr)
      return isNaN(d.getTime()) ? null : d
    }
    // Try "Apr 5" format
    if (dateStr.match(/^[A-Z][a-z]{2}\s+\d{1,2}$/)) {
      const now = new Date()
      const [month, day] = dateStr.split(' ')
      const monthIdx = new Date(`${month} 1, 2024`).getMonth()
      const d = new Date(now.getFullYear(), monthIdx, parseInt(day))
      // If parsed date is in future, it's probably from previous year
      if (d > now) {
        d.setFullYear(now.getFullYear() - 1)
      }
      return d
    }
  } catch (err) {
    return null
  }
  return null
}

/**
 * Get symbols to track by country
 * @param {string} country - Country code (US, JP, EU, UK, etc.)
 * @returns {Array} Array of symbols to track
 */
function getTrackedSymbolsByCountry(country) {
  const countrySymbols = {
    'US': ['^GSPC', 'DXY', '^VIX'],
    'JP': ['JPY=X', '^N225'],
    'EU': ['EURUSD=X', 'EURGBP=X'],
    'UK': ['GBPUSD=X', '^FTSE'],
    'CA': ['CADUSD=X'],
    'AU': ['AUDUSD=X'],
    'CH': ['CHF=X'],
  }
  return countrySymbols[country] || ['^GSPC', 'DXY']
}

/**
 * Generate impact summary text based on volatility and market reaction
 * @param {string} volatility - Volatility level (LOW, MEDIUM, HIGH, EXTREME)
 * @param {string} reaction - Market reaction string
 * @returns {string} Impact summary
 */
function generateImpactSummary(volatility, reaction) {
  if (volatility === 'EXTREME') {
    return `Extreme volatility event - Market reacted: ${reaction}`
  }
  if (volatility === 'HIGH') {
    return `Significant market movement: ${reaction}`
  }
  if (volatility === 'MEDIUM') {
    return `Moderate impact observed: ${reaction}`
  }
  return `Minor event impact: ${reaction}`
}

/**
 * Get aggregate statistics for historical events
 * @param {Array} events - Calendar history events
 * @returns {Object} Statistics including event counts by volatility
 */
export function getCalendarStats(events) {
  if (!Array.isArray(events)) return {}

  const stats = {
    totalEvents: events.length,
    byVolatility: {
      EXTREME: events.filter(e => e.volatility === 'EXTREME').length,
      HIGH: events.filter(e => e.volatility === 'HIGH').length,
      MEDIUM: events.filter(e => e.volatility === 'MEDIUM').length,
      LOW: events.filter(e => e.volatility === 'LOW').length,
    },
    byCountry: {},
  }

  // Count by country
  events.forEach(e => {
    if (e.country) {
      stats.byCountry[e.country] = (stats.byCountry[e.country] || 0) + 1
    }
  })

  return stats
}

/**
 * Get past events (older than today)
 * @param {Array} events - Calendar events
 * @returns {Array} Events in the past
 */
export function getPastEvents(events) {
  if (!Array.isArray(events)) return []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return events.filter(e => {
    const eventDate = parseEventDate(e.date)
    return eventDate && eventDate < now
  })
}

/**
 * Get upcoming events (today or later)
 * @param {Array} events - Calendar events
 * @returns {Array} Events in the future or today
 */
export function getUpcomingEvents(events) {
  if (!Array.isArray(events)) return []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return events.filter(e => {
    const eventDate = parseEventDate(e.date)
    return eventDate && eventDate >= now
  })
}
