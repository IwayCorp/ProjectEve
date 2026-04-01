'use client'
import { RISK_EVENTS } from '@/lib/tradeIdeas'

function VolBadge({ level }) {
  const cls = level === 'EXTREME' ? 'badge-red' : level === 'HIGH' ? 'badge-orange' : 'badge-blue'
  return <span className={cls}>{level}</span>
}

export default function RiskCalendar() {
  return (
    <div className="card">
      <h3 className="text-sm font-bold text-white mb-4">Risk Event Calendar</h3>
      <div className="space-y-2">
        {RISK_EVENTS.map((event, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 rounded-lg bg-eve-bg hover:bg-eve-border/20 transition-colors"
          >
            <div className="w-16 shrink-0 text-center">
              <div className="text-sm font-bold text-eve-accent">{event.date}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{event.event}</span>
                <VolBadge level={event.volatility} />
              </div>
              <div className="text-xs text-eve-muted mt-0.5">{event.impact}</div>
            </div>
            <div className="hidden sm:block text-xs text-eve-muted max-w-[200px]">
              {event.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
