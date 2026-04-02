'use client'
import { useMemo } from 'react'
import { RISK_EVENTS } from '@/lib/tradeIdeas'
import DemoBanner from '@/components/DemoBanner'

function VolBadge({ level }) {
  const cls = level === 'EXTREME' ? 'badge-red' : level === 'HIGH' ? 'badge-orange' : 'badge-blue'
  return <span className={cls} aria-label={`${level} volatility risk`}>{level}</span>
}

export default function RiskCalendar({ showBanner = false }) {
  const monthYear = useMemo(() =>
    new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    []
  )

  return (
    <div className="space-y-3">
      {showBanner && (
        <DemoBanner
          type="demo"
          message="Risk events and volatility ratings are hand-curated examples. This is not connected to a live economic calendar feed."
        />
      )}
      <div className="nx-card">
      <div className="p-3.5 border-b border-nx-border">
        <h3 className="text-sm font-semibold text-nx-text-strong">Risk Event Calendar &mdash; {monthYear}</h3>
      </div>
      <div className="p-3 space-y-0.5">
        {RISK_EVENTS.map((event, i) => (
          <div key={i} className="flex items-center gap-4 p-2.5 rounded-lg hover:bg-nx-glass-hover transition-colors">
            <div className="w-14 shrink-0 text-center">
              <div className="text-sm font-bold text-nx-accent font-mono">{event.date}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-nx-text-strong">{event.event}</span>
                <VolBadge level={event.volatility} />
              </div>
              <div className="text-2xs text-nx-text-muted mt-0.5">{event.impact}</div>
            </div>
            <div className="hidden sm:block text-2xs text-nx-text-hint max-w-[240px]">
              {event.action}
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  )
}
