'use client'

/**
 * DemoBanner — reusable notice for placeholder / simulated / demo data.
 *
 * type:
 *   'simulated'  — backtested or procedurally generated data
 *   'demo'       — UI demo with hardcoded placeholder content
 *   'partial'    — mix of live API data and hardcoded positions
 *
 * message: optional override for the body text
 */
export default function DemoBanner({ type = 'demo', message, className = '' }) {
  const configs = {
    simulated: {
      icon: '⚠',
      label: 'SIMULATED DATA',
      color: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.06)',
      border: 'rgba(251, 191, 36, 0.15)',
      defaultMsg: 'All data shown is procedurally generated for demonstration purposes. These are not real trades, returns, or performance metrics.',
    },
    demo: {
      icon: '🔧',
      label: 'DEMO / PLACEHOLDER',
      color: '#a78bfa',
      bg: 'rgba(167, 139, 250, 0.06)',
      border: 'rgba(167, 139, 250, 0.15)',
      defaultMsg: 'This feature is a UI preview with static placeholder data. Functionality is not yet connected to live systems.',
    },
    partial: {
      icon: '◐',
      label: 'PARTIALLY LIVE',
      color: '#5b8dee',
      bg: 'rgba(91, 141, 238, 0.06)',
      border: 'rgba(91, 141, 238, 0.15)',
      defaultMsg: 'Some data on this page is live from market APIs. Positions and order history are placeholder examples.',
    },
  }

  const c = configs[type] || configs.demo

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl text-xs leading-relaxed ${className}`}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
      role="status"
      aria-label={c.label}
    >
      <span className="text-base shrink-0 mt-px">{c.icon}</span>
      <div>
        <span className="font-bold uppercase tracking-wider text-2xs" style={{ color: c.color }}>
          {c.label}
        </span>
        <p className="mt-0.5" style={{ color: '#94a3b8' }}>
          {message || c.defaultMsg}
        </p>
      </div>
    </div>
  )
}
