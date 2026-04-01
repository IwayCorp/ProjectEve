'use client'

function getColor(val) {
  if (val == null) return '#2a2e39'
  if (val > 0) return val > 0.5 ? '#089981' : '#26a69a'
  return val < -0.5 ? '#f23645' : '#ef5350'
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
      <div className="bg-tv-pane border border-tv-border rounded-md p-4">
        <h3 className="text-sm font-semibold text-tv-text-strong mb-4">Correlation Matrix (90-Day)</h3>
        <div className="flex items-center justify-center h-64">
          <div className="w-5 h-5 border-2 border-tv-blue border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-tv-pane border border-tv-border rounded-md">
      <div className="flex items-center justify-between p-3 border-b border-tv-border">
        <h3 className="text-sm font-semibold text-tv-text-strong">Bond-Currency-Equity Correlation (90-Day)</h3>
        <div className="flex gap-3 text-2xs text-tv-text-muted">
          <span className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-tv-green" /> Positive
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-tv-red" /> Negative
          </span>
        </div>
      </div>

      <div className="p-3 space-y-1">
        {correlations.map((pair, i) => {
          const anomaly = getAnomaly(pair.correlation)
          return (
            <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-white/[0.02] transition-colors">
              <div className="w-44 shrink-0">
                <span className="text-xs text-tv-text">{pair.label}</span>
              </div>

              <div className="flex-1 h-6 bg-tv-bg rounded overflow-hidden relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-1/2 flex justify-end">
                    {pair.correlation < 0 && (
                      <div
                        className="h-4 rounded-l transition-all duration-500"
                        style={{ width: `${Math.abs(pair.correlation) * 100}%`, backgroundColor: getColor(pair.correlation) }}
                      />
                    )}
                  </div>
                  <div className="w-px h-full bg-tv-border" />
                  <div className="w-1/2">
                    {pair.correlation > 0 && (
                      <div
                        className="h-4 rounded-r transition-all duration-500"
                        style={{ width: `${Math.abs(pair.correlation) * 100}%`, backgroundColor: getColor(pair.correlation) }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="w-12 text-right">
                <span className="text-sm font-bold font-mono text-tv-text-strong">
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
