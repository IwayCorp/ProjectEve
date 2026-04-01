'use client'

function getColor(val) {
  if (val == null) return '#1f2937'
  const abs = Math.abs(val)
  if (val > 0) {
    if (abs > 0.7) return '#065f46'
    if (abs > 0.4) return '#047857'
    return '#10b981'
  } else {
    if (abs > 0.7) return '#7f1d1d'
    if (abs > 0.4) return '#b91c1c'
    return '#ef4444'
  }
}

function getTextColor(val) {
  if (val == null) return '#6b7280'
  return Math.abs(val) > 0.5 ? '#ffffff' : '#e5e7eb'
}

function getAnomaly(val) {
  if (val == null) return null
  const abs = Math.abs(val)
  if (abs > 0.8) return { label: 'ANOMALY', class: 'badge-red' }
  if (abs > 0.6) return { label: 'WATCH', class: 'badge-orange' }
  return null
}

export default function CorrelationHeatmap({ correlations, loading }) {
  if (loading) {
    return (
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-4">Bond-Currency-Equity Correlation Matrix</h3>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-eve-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Correlation Matrix (90-Day)</h3>
        <div className="flex gap-3 text-xs text-eve-muted">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-800" /> Strong +
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-800" /> Strong -
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {correlations.map((pair, i) => {
          const anomaly = getAnomaly(pair.correlation)
          return (
            <div
              key={i}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-eve-border/30 transition-colors"
            >
              <div className="w-48 shrink-0">
                <span className="text-xs font-medium text-eve-text">{pair.label}</span>
              </div>

              {/* Correlation bar */}
              <div className="flex-1 h-8 bg-eve-border/30 rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-1/2 flex justify-end">
                    {pair.correlation < 0 && (
                      <div
                        className="h-6 rounded-l transition-all duration-500"
                        style={{
                          width: `${Math.abs(pair.correlation) * 100}%`,
                          backgroundColor: getColor(pair.correlation),
                        }}
                      />
                    )}
                  </div>
                  <div className="w-px h-full bg-eve-muted/30" />
                  <div className="w-1/2">
                    {pair.correlation > 0 && (
                      <div
                        className="h-6 rounded-r transition-all duration-500"
                        style={{
                          width: `${Math.abs(pair.correlation) * 100}%`,
                          backgroundColor: getColor(pair.correlation),
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="w-14 text-right">
                <span
                  className="text-sm font-bold font-mono"
                  style={{ color: getTextColor(pair.correlation) }}
                >
                  {pair.correlation != null ? pair.correlation.toFixed(2) : '--'}
                </span>
              </div>

              <div className="w-20">
                {anomaly && <span className={anomaly.class}>{anomaly.label}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
