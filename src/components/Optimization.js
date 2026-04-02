'use client'
import { useState, useEffect } from 'react'

function getHeatColor(val, min, max) {
  if (min === max) return 'rgba(91, 141, 238, 0.15)'
  const normalized = (val - min) / (max - min)
  if (normalized > 0.8) return 'rgba(52, 211, 153, 0.35)'
  if (normalized > 0.6) return 'rgba(52, 211, 153, 0.22)'
  if (normalized > 0.4) return 'rgba(91, 141, 238, 0.15)'
  if (normalized > 0.2) return 'rgba(251, 191, 36, 0.12)'
  return 'rgba(248, 113, 113, 0.15)'
}

export default function Optimization() {
  const [symbol, setSymbol] = useState('SPY')
  const [strategy, setStrategy] = useState('rsi-mean-reversion')
  const [selectedMetric, setSelectedMetric] = useState('sharpe')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const fetchOptimizationData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/optimize?symbol=${symbol}&strategy=${strategy}`)
      if (!response.ok) throw new Error('Failed to fetch optimization data')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching optimization data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOptimizationData()
  }, [symbol, strategy])

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="nx-section-header">
              <div className="nx-accent-bar" />
              <h3>Parameter Optimization</h3>
            </div>
            <p className="text-xs text-nx-text-muted mt-1 ml-3">Walk-forward parameter optimization with out-of-sample validation to prevent overfitting.</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-nx-accent/30 border-t-nx-accent rounded-full animate-spin" />
            <p className="text-sm text-nx-text-muted">Running optimization...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="nx-section-header">
              <div className="nx-accent-bar" />
              <h3>Parameter Optimization</h3>
            </div>
          </div>
        </div>
        <div className="nx-card p-4 border border-nx-red/20 bg-nx-red-muted/30">
          <p className="text-sm text-nx-red">{error || 'No data available'}</p>
        </div>
      </div>
    )
  }

  const heatData = data.heatmapData || []
  const rsiValues = data.rsiValues || []
  const holdValues = data.holdValues || []
  const params = data.params || []
  const walkForward = data.walkForward || []

  const metricKey = selectedMetric
  const allValues = heatData.map(d => d[metricKey]).filter(v => v !== undefined && v !== null)
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1

  const bestCell = heatData.length > 0 ? heatData.reduce((best, d) =>
    (d[metricKey] || 0) > (best[metricKey] || 0) ? d : best
  , heatData[0]) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Parameter Optimization</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">Walk-forward parameter optimization with out-of-sample validation to prevent overfitting.</p>
        </div>
        <button
          onClick={fetchOptimizationData}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(91, 141, 238, 0.2), rgba(167, 139, 250, 0.2))',
            border: '1px solid rgba(91, 141, 238, 0.3)',
            color: '#5b8dee',
          }}
        >
          {loading ? 'Running...' : 'Run Optimization'}
        </button>
      </div>

      {/* Symbol and Strategy Controls */}
      <div className="grid grid-cols-2 gap-3">
        <div className="nx-card p-3.5">
          <label className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium block mb-2">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="SPY"
            className="w-full bg-nx-void border border-nx-border rounded-lg px-3 py-2 text-sm font-mono text-nx-text-strong focus:outline-none focus:border-nx-accent/50"
          />
        </div>
        <div className="nx-card p-3.5">
          <label className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium block mb-2">Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full bg-nx-void border border-nx-border rounded-lg px-3 py-2 text-sm text-nx-text-strong focus:outline-none focus:border-nx-accent/50"
          >
            <option value="rsi-mean-reversion">RSI Mean Reversion</option>
            <option value="momentum">Momentum</option>
            <option value="trend">Trend Following</option>
          </select>
        </div>
      </div>

      {/* Parameter Grid */}
      {params.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-nx-text-strong mb-3">Strategy Parameters</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {params.map((param, i) => {
              const rangeMin = parseFloat(param.range.split('-')[0])
              const rangeMax = parseFloat(param.range.split('-')[1])
              const currentVal = parseFloat(param.current)
              return (
                <div key={i} className="nx-card p-3.5">
                  <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium mb-2">{param.name}</div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-lg font-bold font-mono text-nx-text-strong">{param.current}</span>
                    <span className="text-2xs text-nx-text-hint">{param.unit}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs text-nx-text-hint">Optimal:</span>
                    <span className={`text-2xs font-bold font-mono ${parseFloat(param.optimal) !== currentVal ? 'text-nx-green' : 'text-nx-text-muted'}`}>
                      {param.optimal}
                    </span>
                    {parseFloat(param.optimal) !== currentVal && (
                      <span className="text-2xs text-nx-green">
                        ({parseFloat(param.optimal) > currentVal ? '+' : ''}{Math.round((parseFloat(param.optimal) - currentVal) / currentVal * 100)}%)
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
                    <div className="h-full rounded-full bg-nx-accent/40" style={{
                      width: `${((currentVal - rangeMin) / (rangeMax - rangeMin)) * 100}%`,
                    }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-2xs text-nx-text-hint">{param.range.split('-')[0]}</span>
                    <span className="text-2xs text-nx-text-hint">{param.range.split('-')[1]}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {heatData.length > 0 && rsiValues.length > 0 && holdValues.length > 0 && (
        <div className="nx-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-nx-text-strong">Parameter Heatmap — RSI Lookback vs Hold Duration</h4>
            <div className="flex gap-1">
              {['sharpe', 'winRate', 'profit'].map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMetric(m)}
                  aria-label={`Show ${m === 'sharpe' ? 'Sharpe ratio' : m === 'winRate' ? 'win rate' : 'net profit'} heatmap`}
                  aria-pressed={selectedMetric === m}
                  className={`px-2.5 py-1 text-2xs rounded-md font-semibold transition-all duration-200 ${
                    selectedMetric === m ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20' : 'text-nx-text-hint bg-nx-void/40 border border-nx-border'
                  }`}
                >
                  {m === 'sharpe' ? 'Sharpe' : m === 'winRate' ? 'Win Rate' : 'Net Profit'}
                </button>
              ))}
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-2xs text-nx-text-muted font-medium p-2 text-left">RSI \ Hold</th>
                  {holdValues.map(h => (
                    <th key={h} className="text-2xs text-nx-text-muted font-medium p-2 text-center">{h}d</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rsiValues.map(rsi => (
                  <tr key={rsi}>
                    <td className="text-2xs font-mono text-nx-text-muted p-2">{rsi}</td>
                    {holdValues.map(hold => {
                      const cell = heatData.find(d => d.rsi === rsi && d.hold === hold)
                      if (!cell) return <td key={hold} className="p-1"><div className="rounded-lg p-2 text-center bg-nx-void/20" /></td>
                      const val = cell[metricKey]
                      const isBest = bestCell && cell === bestCell
                      return (
                        <td key={hold} className="p-1">
                          <div
                            className={`rounded-lg p-2 text-center transition-all duration-200 cursor-default hover:scale-105 ${isBest ? 'ring-2 ring-nx-green/50' : ''}`}
                            style={{ background: getHeatColor(val, minVal, maxVal) }}
                            title={`RSI: ${rsi}, Hold: ${hold}d\nSharpe: ${cell.sharpe}\nWin Rate: ${cell.winRate}%\nMax Drawdown: ${cell.maxDrawdown}%\nTrades: ${cell.trades}`}
                          >
                            <span className="text-xs font-bold font-mono text-nx-text-strong">
                              {selectedMetric === 'sharpe' ? val.toFixed(2) : selectedMetric === 'winRate' ? `${val}%` : `$${(val / 1000).toFixed(0)}K`}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 px-2">
            <div className="flex items-center gap-3 text-2xs text-nx-text-muted">
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(248, 113, 113, 0.15)' }} /> Poor</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(251, 191, 36, 0.12)' }} /> Below Avg</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(91, 141, 238, 0.15)' }} /> Average</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(52, 211, 153, 0.22)' }} /> Good</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(52, 211, 153, 0.35)' }} /> Optimal</span>
            </div>
            {bestCell && <span className="text-2xs text-nx-green font-semibold">Best: RSI {bestCell.rsi}, Hold {bestCell.hold}d</span>}
          </div>
        </div>
      )}

      {/* Walk-Forward Validation */}
      {walkForward.length > 0 && (
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Walk-Forward Validation</h3>
          </div>
          <div className="space-y-1 mt-3">
            <div className="grid grid-cols-6 gap-2 px-4 py-2 text-2xs text-nx-text-muted uppercase tracking-wider font-medium">
              <span>Period</span><span>In-Sample Sharpe</span><span>Out-of-Sample Sharpe</span><span>Win Rate</span><span>Trades</span><span>Status</span>
            </div>
            {walkForward.map((wf, i) => (
              <div key={i} className="nx-card grid grid-cols-6 gap-2 px-4 py-3 items-center">
                <span className="text-xs font-semibold text-nx-text-strong">{wf.period}</span>
                <span className="text-xs font-mono text-nx-accent">{wf.inSample.toFixed(2)}</span>
                <span className={`text-xs font-bold font-mono ${wf.outSample >= 1.5 ? 'text-nx-green' : wf.outSample >= 1.0 ? 'text-nx-orange' : 'text-nx-red'}`}>{wf.outSample.toFixed(2)}</span>
                <span className="text-xs font-mono text-nx-text">{wf.winRate}%</span>
                <span className="text-xs font-mono text-nx-text-muted">{wf.trades}</span>
                <span className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase inline-block w-fit ${
                  wf.status === 'pass' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-orange-muted text-nx-orange border border-nx-orange/15'
                }`}>
                  {wf.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
