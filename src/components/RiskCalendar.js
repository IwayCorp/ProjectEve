'use client'
import { RISK_EVENTS } from '@/lib/tradeIdeas'

function VolBadge({ level }) {
  const cls = level === 'EXTREME' ? 'badge-red' : level === 'HIGH' ? 'badge-orange' : 'badge-blue'
  return <span className={cls}>{level}</span>
}

export default function RiskCalendar() {
  return (
    <div className="bg-tv-pane border border-tv-border rounded-md">
      <div className="p-3 border-b border-tv-border">
        <h3 className="text-sm font-semibold text-tv-text-strong">Risk Event Calendar — April 2026</h3>
      </div>
      <div className="p-3 space-y-1">
        {RISK_EVENTS.map((event, i) => (
          <div key={i} className="flex items-center gap-4 p-2.5 rounded hover:bg-white/[0.02] transition-colors">
            <div className="w-14 shrink-0 text-center">
              <div className="text-sm font-bold text-tv-blue">{event.date}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-tv-text-strong">{event.event}</span>
                <VolBadge level={event.volatility} />
              </div>
              <div className="text-2xs text-tv-text-muted mt-0.5">{event.impact}</div>
            </div>
            <div className="hidden sm:block text-2xs text-tv-text-hint max-w-[240px]">
              {event.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
