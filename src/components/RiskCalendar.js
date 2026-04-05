'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  catalogCalendarEvents,
  loadCalendarHistory,
  saveCalendarHistory,
  updateEventOutcomes,
  getCalendarStats,
  getPastEvents,
} from '@/lib/calendarHistory'

function VolBadge({ level }) {
  const cls = level === 'EXTREME' ? 'badge-red' : level === 'HIGH' ? 'badge-orange' : 'badge-blue'
  return <span className={cls} aria-label={`${level} volatility risk`}>{level}</span>
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-nx-border"></div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-nx-accent animate-spin"></div>
      </div>
      <span className="ml-3 text-sm text-nx-text-muted">Loading calendar...</span>
    </div>
  )
}

function formatEventDate(dateStr) {
  if (!dateStr) return '—'
  try {
    // If it looks like an ISO string or contains 'T', parse it
    if (dateStr.includes('T') || dateStr.includes('-') && dateStr.length > 10) {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
    }
    // Already formatted (e.g. "Apr 5") — return as-is
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

export default function RiskCalendar({ showBanner = false, quotes = {} }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState('All')
  const [activeView, setActiveView] = useState('upcoming') // 'upcoming' or 'history'
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const months = ['All', 'US', 'JP', 'EU', 'UK']

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/calendar')

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`)
        }

        const data = await res.json()
        const upcomingEvents = data.events || []

        // Catalog events into history
        const cataloged = catalogCalendarEvents(upcomingEvents)
        setHistory(cataloged)

        // Set upcoming events (those in the future)
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        const upcoming = upcomingEvents.filter(e => {
          try {
            const eventDate = new Date(e.date)
            if (isNaN(eventDate.getTime())) {
              // Try parsing "Apr 5" format
              const match = e.date.match(/^([A-Z][a-z]{2})\s+(\d{1,2})$/)
              if (match) {
                const [_, month, day] = match
                const d = new Date(`${month} ${day}, ${now.getFullYear()}`)
                if (d < now) d.setFullYear(now.getFullYear() + 1)
                return d >= now
              }
              return false
            }
            return eventDate >= now
          } catch {
            return false
          }
        })

        setEvents(upcoming)
        setIsLive(data.live === true)
      } catch (err) {
        console.error('Failed to fetch calendar:', err)
        setError(err.message)
        setEvents([])
        setIsLive(false)
      } finally {
        setLoading(false)
      }
    }

    fetchCalendar()
  }, [])

  // Filter events by selected country
  const filteredEvents = useMemo(() => {
    const sourceEvents = activeView === 'history' ? history : events
    return selectedFilter === 'All'
      ? sourceEvents
      : sourceEvents.filter(e => e.country === selectedFilter)
  }, [activeView, events, history, selectedFilter])

  // Get past events with market outcomes
  const pastEventsWithOutcomes = useMemo(() => {
    const pastEvents = getPastEvents(history)
    // Update with market reaction data if quotes available
    return updateEventOutcomes(pastEvents, quotes)
  }, [history, quotes])

  // Calculate statistics for history view
  const stats = useMemo(() => {
    return getCalendarStats(pastEventsWithOutcomes)
  }, [pastEventsWithOutcomes])

  const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-3">
      <div className="nx-card">
        {/* Header */}
        <div className="p-3.5 border-b border-nx-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-nx-text-strong">
              {activeView === 'history' ? 'Event History' : 'Risk Event Calendar'} &mdash; {monthYear}
            </h3>
            {/* View toggle tabs */}
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--nx-glass)' }}>
              <button
                onClick={() => setActiveView('upcoming')}
                className={`px-3 py-1 rounded text-2xs font-medium transition-colors ${
                  activeView === 'upcoming'
                    ? 'text-nx-accent'
                    : 'text-nx-text-muted hover:text-nx-text-strong'
                }`}
                style={activeView === 'upcoming' ? { background: 'rgba(var(--nx-accent) / 0.1)' } : {}}
              >
                Upcoming
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`px-3 py-1 rounded text-2xs font-medium transition-colors ${
                  activeView === 'history'
                    ? 'text-nx-accent'
                    : 'text-nx-text-muted hover:text-nx-text-strong'
                }`}
                style={activeView === 'history' ? { background: 'rgba(var(--nx-accent) / 0.1)' } : {}}
              >
                History
              </button>
            </div>
          </div>

          {/* Live/Curated Status Indicator (only show for upcoming view) */}
          {activeView === 'upcoming' && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-2xs font-medium"
                 style={{
                   background: isLive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                   color: isLive ? '#22c55e' : '#94a3b8'
                 }}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-slate-400'}`}></span>
              {isLive ? 'LIVE FEED' : 'CURATED FALLBACK'}
            </div>
          )}
        </div>

        {/* History Stats (shown above filter in history view) */}
        {activeView === 'history' && stats && (
          <div className="px-3.5 pt-3 pb-2 border-b border-nx-border/50">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-2xs">
              <div style={{ background: 'var(--nx-glass-hover)', padding: '0.75rem' }} className="rounded-lg">
                <div className="text-nx-text-muted">Total Events</div>
                <div className="text-sm font-bold text-nx-accent">{stats.totalEvents || 0}</div>
              </div>
              <div style={{ background: 'var(--nx-glass-hover)', padding: '0.75rem' }} className="rounded-lg">
                <div className="text-nx-text-muted">Extreme</div>
                <div className="text-sm font-bold text-red-400">{stats.byVolatility?.EXTREME || 0}</div>
              </div>
              <div style={{ background: 'var(--nx-glass-hover)', padding: '0.75rem' }} className="rounded-lg">
                <div className="text-nx-text-muted">High</div>
                <div className="text-sm font-bold text-orange-400">{stats.byVolatility?.HIGH || 0}</div>
              </div>
              <div style={{ background: 'var(--nx-glass-hover)', padding: '0.75rem' }} className="rounded-lg">
                <div className="text-nx-text-muted">Medium</div>
                <div className="text-sm font-bold text-blue-400">{stats.byVolatility?.MEDIUM || 0}</div>
              </div>
              <div style={{ background: 'var(--nx-glass-hover)', padding: '0.75rem' }} className="rounded-lg">
                <div className="text-nx-text-muted">Low</div>
                <div className="text-sm font-bold text-slate-400">{stats.byVolatility?.LOW || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Buttons */}
        <div className="px-3 pt-3 flex flex-wrap gap-2">
          {months.map(month => (
            <button
              key={month}
              onClick={() => setSelectedFilter(month)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedFilter === month
                  ? 'bg-nx-accent text-white'
                  : 'bg-nx-glass hover:bg-nx-glass-hover text-nx-text-muted'
              }`}
            >
              {month}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-3 space-y-0.5">
          {(loading || historyLoading) && <LoadingSpinner />}

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-base">⚠</span>
              <span className="text-sm text-red-400">Failed to load calendar: {error}</span>
            </div>
          )}

          {!loading && !error && filteredEvents.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-nx-text-muted">
                {activeView === 'history'
                  ? 'No past events in history'
                  : `No events scheduled for ${selectedFilter}`}
              </p>
            </div>
          )}

          {/* Upcoming view */}
          {!loading && !error && activeView === 'upcoming' && filteredEvents.map((event, i) => (
            <div key={i} className="flex items-center gap-4 p-2.5 rounded-lg hover:bg-nx-glass-hover transition-colors">
              {/* Country Flag */}
              <div className="w-6 shrink-0 flex items-center justify-center">
                <CountryFlag country={event.country} />
              </div>

              {/* Date and Time */}
              <div className="w-20 shrink-0">
                <div className="text-sm font-bold text-nx-accent font-mono">{formatEventDate(event.date)}</div>
                <div className="text-2xs text-nx-text-muted mt-0.5">{formatEventTime(event.date, event.time)}</div>
              </div>

              {/* Event and Volatility */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-nx-text-strong">{event.event}</span>
                  <VolBadge level={event.volatility} />
                </div>
                <div className="text-2xs text-nx-text-muted mt-0.5">{event.impact || '—'}</div>
              </div>

              {/* Action (hidden on mobile) */}
              <div className="hidden sm:block text-2xs text-nx-text-hint max-w-[240px]">
                {event.action || '—'}
              </div>
            </div>
          ))}

          {/* History view */}
          {!loading && !error && activeView === 'history' && pastEventsWithOutcomes.length > 0 && (
            <div className="space-y-0.5">
              {pastEventsWithOutcomes.map((event, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-nx-glass-hover transition-colors text-2xs">
                  {/* Country Flag */}
                  <div className="w-6 shrink-0 flex items-center justify-center">
                    <CountryFlag country={event.country} />
                  </div>

                  {/* Date */}
                  <div className="w-20 shrink-0">
                    <div className="font-mono font-bold text-nx-accent">{formatEventDate(event.date)}</div>
                  </div>

                  {/* Event name + Volatility */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-nx-text-strong truncate">{event.event}</span>
                      <VolBadge level={event.volatility} />
                    </div>
                  </div>

                  {/* Market Impact */}
                  <div className="hidden md:block flex-1 min-w-0">
                    {event.marketReaction ? (
                      <div className="text-nx-text-muted">{event.marketReaction}</div>
                    ) : (
                      <div className="text-nx-text-hint">—</div>
                    )}
                  </div>

                  {/* Impact Summary */}
                  <div className="hidden lg:block flex-1 min-w-0 text-nx-text-muted max-w-[200px] truncate">
                    {event.impactSummary || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
