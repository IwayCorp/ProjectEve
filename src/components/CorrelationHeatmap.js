'use client'
import { useState } from 'react'
import { TermText } from '@/components/Tooltip'

function getColor(val) {
  if (val == null) return 'rgba(255, 255, 255, 0.03)'
  if (val > 0) return val > 0.5 ? '#34d399' : '#34d399b3'
  return val < -0.5 ? '#f87171' : '#f87171b3'
}

function getAnomaly(val) {
  if (val == null) return null
  const abs = Math.abs(val)
  if (abs > 0.8) return { label: 'ANOMALY', cls: 'badge-red' }
  if (abs > 0.6) return { label: 'WATCH', cls: 'badge-orange' }
  return null
}

const CORRELATION_EXPLANATIONS = {
  'JGB 10Y vs USD/JPY': 'Japanese Government Bond yields and USD/JPY have a strong inverse relationship. When JGB yields rise (BoJ tightening), the yen strengthens (USD/JPY falls). Rising JGB yields signal potential carry trade unwinds.',
  'US 10Y vs DXY': 'US Treasury yields and the Dollar Index typically move together. Higher US yields attract foreign capital into dollar-denominated assets, strengthening the dollar.',
  'US 10Y vs S&P 500': 'US equities and Treasury yields show a negative relationship. Rising yields increase discount rates, compressing equity valuations. Tech stocks are especially sensitive due to their long-duration growth profiles.',
  'WTI vs US 10Y': 'Oil and Treasury yields correlate positively. Rising energy prices boost inflation expectations and bond yields. This creates a self-reinforcing cycle: higher oil flows through to inflation, which pressures bonds.',
  'Gold vs VIX': 'Gold and equity volatility show a positive relationship. Risk-off periods drive both higher VIX and gold buying as a safe-haven asset. This makes gold an effective portfolio hedge.',
  'DXY vs EUR/USD': 'The Dollar Index and EUR/USD have a strong inverse relationship. When the dollar strengthens (DXY rises), EUR/USD typically falls. This relationship is mechanical given EUR\'s weight in the DXY basket.',
  'Oil vs Energy (XLE)': 'WTI crude oil and the Energy sector ETF are strongly correlated. Oil prices are the primary driver of energy sector profitability and valuations.',
  'S&P 500 vs Nasdaq': 'Large-cap and tech-heavy indices show high positive correlation. During growth-friendly periods, both rally together. Correlation weakens during rate-hiking cycles when growth is penalized.',
  'Gold vs USD/JPY': 'Gold and USD/JPY can move together during carry-trade unwinds or risk-off periods. However, the correlation is unstable—it strengthens during crisis moments but weakens during normal market conditions.',
  'VIX vs S&P 500': 'Equity volatility and the S&P 500 exhibit a negative relationship. Rising equity prices reduce uncertainty and lower the VIX. Market crashes sharply elevate both the VIX and equity losses simultaneously.',
}

export default function CorrelationHeatmap({ correlations, loading }) {
  const [expandedIndex, setExpandedIndex] = useState(null)

  if (loading) {
    return (
      <div className="nx-card p-4">
        <h3 className="text-sm font-bold mb-4 text-nx-text-strong">Bond-Currency-Equity Correlation (90-Day)</h3>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5">
              <div className="w-44 h-3 nx-shimmer rounded" />
              <div className="flex-1 h-5 nx-shimmer rounded" />
              <div className="w-10 h-3 nx-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="nx-card">
      <div className="border-b border-nx-border flex items-center justify-between p-4">
        <h3 className="text-sm font-bold text-nx-text-strong">Bond-Currency-Equity Correlation (90-Day)</h3>
        <div className="flex gap-4 text-2xs font-medium text-nx-text-muted">
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-nx-green/70" /> Positive
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-nx-red/70" /> Negative
          </span>
        </div>
      </div>

      <div className="p-3 space-y-1.5">
        {correlations.map((pair, i) => {
          const anomaly = getAnomaly(pair.correlation)
          const isExpanded = expandedIndex === i
          const explanation = CORRELATION_EXPLANATIONS[pair.label]

          return (
            <div key={i} className="rounded-lg border border-nx-border transition-all duration-200" style={{ background: isExpanded ? 'var(--nx-glass)' : 'transparent' }}>
              {/* Collapsed Row */}
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-nx-glass-hover"
              >
                <div className="w-44 shrink-0">
                  <span className="text-xs font-semibold text-nx-text-strong">{pair.label}</span>
                </div>

                <div className="flex-1 h-6 rounded-md overflow-hidden relative" style={{ background: 'rgb(var(--nx-void) / 0.4)' }}>
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-1/2 flex justify-end">
                      {pair.correlation < 0 && (
                        <div
                          className="h-4 rounded-l transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.abs(pair.correlation) * 100}%`,
                            backgroundColor: getColor(pair.correlation),
                            opacity: 0.85,
                            boxShadow: `0 0 12px ${getColor(pair.correlation)}40`,
                          }}
                        />
                      )}
                    </div>
                    <div className="w-px h-full" style={{ background: 'var(--nx-border)' }} />
                    <div className="w-1/2">
                      {pair.correlation > 0 && (
                        <div
                          className="h-4 rounded-r transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.abs(pair.correlation) * 100}%`,
                            backgroundColor: getColor(pair.correlation),
                            opacity: 0.85,
                            boxShadow: `0 0 12px ${getColor(pair.correlation)}40`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-12 text-right">
                  <span className="text-sm font-bold font-mono tabular-nums text-nx-text-strong">
                    {pair.correlation != null ? pair.correlation.toFixed(2) : '--'}
                  </span>
                </div>

                <div className="w-16">
                  {anomaly && <span className={anomaly.cls}>{anomaly.label}</span>}
                </div>

                {explanation && (
                  <div className="shrink-0 text-nx-text-muted transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                    ▼
                  </div>
                )}
              </button>

              {/* Expanded Details */}
              {isExpanded && explanation && (
                <div className="px-3 pb-3 pt-0 border-t border-nx-border/30">
                  <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(var(--nx-accent) / 0.08)', borderLeft: '3px solid rgb(var(--nx-accent))' }}>
                    <p className="text-sm text-nx-text-strong leading-relaxed">
                      <TermText>{explanation}</TermText>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
