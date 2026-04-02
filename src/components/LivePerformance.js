'use client'
import { useState } from 'react'

/**
 * LivePerformance — real performance tracking page.
 * Only shows data once a broker / execution feed is connected.
 * Until then it renders an empty-state explainer.
 */
export default function LivePerformance() {
  const [connected] = useState(false) // future: set true when broker API is wired

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="nx-section-header">
          <div className="nx-accent-bar" />
          <h3>Live Performance</h3>
        </div>
        <p className="text-xs text-nx-text-muted mt-1 ml-3">Real-time P&L, equity curve, and trade journal from your connected execution feed.</p>
      </div>

      {!connected && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          {/* Icon */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
            style={{
              background: 'rgba(91, 141, 238, 0.08)',
              border: '1px solid rgba(91, 141, 238, 0.15)',
            }}
          >
            <span className="text-4xl">📡</span>
          </div>

          <h4 className="text-lg font-semibold text-nx-text-strong mb-2">
            No Execution Feed Connected
          </h4>
          <p className="text-sm text-nx-text-muted max-w-lg leading-relaxed mb-8">
            This page will display real P&L, equity curves, and a trade journal once
            a broker or execution API is connected. All data here will reflect actual
            fills — no simulations.
          </p>

          {/* What will appear */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
            {[
              {
                icon: '📈',
                title: 'Live Equity Curve',
                desc: 'Real-time portfolio value tracked tick-by-tick from your execution feed.',
              },
              {
                icon: '📋',
                title: 'Trade Journal',
                desc: 'Every fill logged with entry, exit, P&L, slippage, and commission data.',
              },
              {
                icon: '📊',
                title: 'Performance Metrics',
                desc: 'Sharpe, Sortino, max drawdown, win rate — all from verified executions.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl text-left"
                style={{
                  background: 'rgba(15, 21, 35, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <h5 className="text-sm font-semibold text-nx-text-strong mb-1">{item.title}</h5>
                <p className="text-2xs text-nx-text-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Planned integrations */}
          <div className="mt-10 text-center">
            <p className="text-2xs text-nx-text-hint uppercase tracking-wider font-medium mb-3">Planned Integrations</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {['Interactive Brokers', 'Alpaca', 'TD Ameritrade', 'Binance', 'OANDA'].map((name) => (
                <span
                  key={name}
                  className="px-3 py-1.5 text-2xs font-medium rounded-lg"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    color: '#64748b',
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
