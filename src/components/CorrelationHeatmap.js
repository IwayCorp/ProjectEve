'use client'

function getColor(val) {
  if (val == null) return 'rgba(255, 255, 255, 0.03)'
  if (val > 0) return val > 0.5 ? '#34d399' : 'rgba(52, 211, 153, 0.7)'
  return val < -0.5 ? '#f87171' : 'rgba(248, 113, 113, 0.7)'
}

function getAnomaly(val) {
  if (val == null) return null
  const abs = Math.abs(val)
  if (abs > 0.8) return { label: 'ANOMALY', cls: 'badge-red' }
  if (abs > 0.6) return { label: 'WATCH', cls: 'badge-orange' }
  return null
}

export default function CorrelationHeatmap({ correlations, loading }) {
  if (loading) {
    return (
      <div className="nx-card p-4">
        <h3 className="text-sm font-bold mb-4" style={{ color: '#f1f5f9' }}>Correlation Matrix (90-Day)</h3>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-nx-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="nx-card">
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h3 className="text-sm font-bold" style={{ color: '#f1f5f9' }}>Bond-Currency-Equity Correlation (90-Day)</h3>
        <div className="flex gap-4 text-2xs font-medium" style={{ color: '#94a3b8' }}>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-nx-green/70" /> Positive
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-nx-red/70" /> Negative
          </span>
        </div>
      </div>

      <div className="p-3 space-y-0.5">
        {correlations.map((pair, i) => {
          const anomaly = getAnomaly(pair.correlation)
          return (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg transition-colors" style={{ ':hover': { background: 'rgba(255,255,255,0.02)' } }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div className="w-44 shrink-0">
                <span className="text-xs font-semibold" style={{ color: '#cbd5e1' }}>{pair.label}</span>
              </div>

              <div className="flex-1 h-6 rounded-md overflow-hidden relative" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
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
                  <div className="w-px h-full" style={{ background: 'rgba(255, 255, 255, 0.08)' }} />
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
                <span className="text-sm font-bold font-mono tabular-nums" style={{ color: '#f1f5f9' }}>
                  {pair.correlation != null ? pair.correlation.toFixed(2) : '--'}
                </span>
              </div>

              <div className="w-16">
                {anomaly && <span className={anomaly.cls}>{anomaly.label}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
