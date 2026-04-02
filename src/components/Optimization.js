'use client'
import { useState, useMemo } from 'react'
import DemoBanner from '@/components/DemoBanner'

// Generate heatmap data for parameter optimization
function generateHeatmapData() {
  const data = []
  const rsiValues = [5, 7, 10, 14, 20, 25, 30]
  const holdValues = [2, 3, 5, 7, 10, 14, 21]

  for (let r = 0; r < rsiValues.length; r++) {
    for (let h = 0; h < holdValues.length; h++) {
      // Deterministic pseudo-random based on parameters
      const seed = (rsiValues[r] * 31 + holdValues[h] * 17) % 100
      const baseSharpe = 1.2 + Math.sin(r * 0.8) * 0.6 + Math.cos(h * 0.5) * 0.4
      const noise = (seed - 50) / 100
      const sharpe = Math.round((baseSharpe + noise) * 100) / 100

      data.push({
        rsi: rsiValues[r],
        hold: holdValues[h],
        sharpe,
        winRate: Math.round(52 + sharpe * 6 + noise * 5),
        profit: Math.round(sharpe * 18000 + noise * 5000),
        trades: Math.round(200 + (30 - rsiValues[r]) * 5 + holdValues[h] * -3),
      })
    }
  }
  return { data, rsiValues, holdValues }
}

function getHeatColor(val, min, max) {
  if (min === max) return 'rgba(91, 141, 238, 0.15)'
  const normalized = (val - min) / (max - min)
  if (normalized > 0.8) return 'rgba(52, 211, 153, 0.35)'
  if (normalized > 0.6) return 'rgba(52, 211, 153, 0.22)'
  if (normalized > 0.4) return 'rgba(91, 141, 238, 0.15)'
  if (normalized > 0.2) return 'rgba(251, 191, 36, 0.12)'
  return 'rgba(248, 113, 113, 0.15)'
}

const OPT_PARAMS = [
  { name: 'RSI Lookback', current: 14, optimal: 10, range: '5-30', unit: 'periods' },
  { name: 'Hold Duration', current: 7, optimal: 5, range: '2-21', unit: 'days' },
  { name: 'Stop Loss', current: 3.0, optimal: 2.5, range: '1-5', unit: '%' },
  { name: 'Take Profit', current: 6.0, optimal: 8.0, range: '3-15', unit: '%' },
  { name: 'Volume Threshold', current: 1.5, optimal: 2.0, range: '1-3', unit: 'x avg' },
  { name: 'Position Size', current: 5.0, optimal: 3.5, range: '1-10', unit: '% port' },
]

const WALK_FORWARD = [
  { period: 'Q1 2025', inSample: 2.34, outSample: 1.89, winRate: 67, trades: 28, status: 'pass' },
  { period: 'Q2 2025', inSample: 2.12, outSample: 1.95, winRate: 64, trades: 31, status: 'pass' },
  { period: 'Q3 2025', inSample: 1.98, outSample: 1.42, winRate: 58, trades: 25, status: 'pass' },
  { period: 'Q4 2025', inSample: 2.45, outSample: 0.87, winRate: 52, trades: 34, status: 'warning' },
  { period: 'Q1 2026', inSample: 2.67, outSample: 2.21, winRate: 71, trades: 29, status: 'pass' },
]

export default function Optimization() {
  const [selectedMetric, setSelectedMetric] = useState('sharpe')
  const { data: heatData, rsiValues, holdValues } = useMemo(() => generateHeatmapData(), [])

  const metricKey = selectedMetric
  const allValues = heatData.map(d => d[metricKey])
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)

  const bestCell = heatData.reduce((best, d) =>
    d[metricKey] > best[metricKey] ? d : best
  , heatData[0])

  return (
    <div className="space-y-5">
      <DemoBanner
        type="simulated"
        message="All optimization results, heatmaps, and walk-forward validation metrics shown here are procedurally generated for UI demonstration. No actual parameter sweep or backtest has been run."
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Parameter Optimization</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">Walk-forward parameter optimization with out-of-sample validation to prevent overfitting.</p>
        </div>
        <button className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200" style={{
          background: 'linear-gradient(135deg, rgba(91, 141, 238, 0.2), rgba(167, 139, 250, 0.2))',
          border: '1px solid rgba(91, 141, 238, 0.3)',
          color: '#5b8dee',
        }}>
          Run Optimization
        </button>
      </div>

      {/* Parameter Grid */}
      <div>
        <h4 className="text-sm font-bold text-nx-text-strong mb-3">Strategy Parameters</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {OPT_PARAMS.map((param, i) => (
            <div key={i} className="nx-card p-3.5">
              <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium mb-2">{param.name}</div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-bold font-mono text-nx-text-strong">{param.current}</span>
                <span className="text-2xs text-nx-text-hint">{param.unit}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-nx-text-hint">Optimal:</span>
                <span className={`text-2xs font-bold font-mono ${param.optimal !== param.current ? 'text-nx-green' : 'text-nx-text-muted'}`}>
                  {param.optimal}
                </span>
                {param.optimal !== param.current && (
                  <span className="text-2xs text-nx-green">
                    ({param.optimal > param.current ? '+' : ''}{Math.round((param.optimal - param.current) / param.current * 100)}%)
                  </span>
                )}
              </div>
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
                <div className="h-full rounded-full bg-nx-accent/40" style={{
                  width: `${((param.current - parseFloat(param.range.split('-')[0])) / (parseFloat(param.range.split('-')[1]) - parseFloat(param.range.split('-')[0]))) * 100}%`,
                }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-2xs text-nx-text-hint">{param.range.split('-')[0]}</span>
                <span className="text-2xs text-nx-text-hint">{param.range.split('-')[1]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
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
                    const val = cell[metricKey]
                    const isBest = cell === bestCell
                    return (
                      <td key={hold} className="p-1">
                        <div
                          className={`rounded-lg p-2 text-center transition-all duration-200 cursor-default hover:scale-105 ${isBest ? 'ring-2 ring-nx-green/50' : ''}`}
                          style={{ background: getHeatColor(val, minVal, maxVal) }}
                          title={`RSI: ${rsi}, Hold: ${hold}d\nSharpe: ${cell.sharpe}\nWin Rate: ${cell.winRate}%\nNet Profit: $${cell.profit.toLocaleString()}\nTrades: ${cell.trades}`}
                        >
                          <span className="text-xs font-bold font-mono text-nx-text-strong">
                            {selectedMetric === 'sharpe' ? val : selectedMetric === 'winRate' ? `${val}%` : `$${(val / 1000).toFixed(0)}K`}
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
          <span className="text-2xs text-nx-green font-semibold">Best: RSI {bestCell.rsi}, Hold {bestCell.hold}d</span>
        </div>
      </div>

      {/* Walk-Forward Validation */}
      <div>
        <div className="nx-section-header">
          <div className="nx-accent-bar" />
          <h3>Walk-Forward Validation</h3>
        </div>
        <div className="space-y-1 mt-3">
          <div className="grid grid-cols-6 gap-2 px-4 py-2 text-2xs text-nx-text-muted uppercase tracking-wider font-medium">
            <span>Period</span><span>In-Sample Sharpe</span><span>Out-of-Sample Sharpe</span><span>Win Rate</span><span>Trades</span><span>Status</span>
          </div>
          {WALK_FORWARD.map((wf, i) => (
            <div key={i} className="nx-card grid grid-cols-6 gap-2 px-4 py-3 items-center">
              <span className="text-xs font-semibold text-nx-text-strong">{wf.period}</span>
              <span className="text-xs font-mono text-nx-accent">{wf.inSample}</span>
              <span className={`text-xs font-bold font-mono ${wf.outSample >= 1.5 ? 'text-nx-green' : wf.outSample >= 1.0 ? 'text-nx-orange' : 'text-nx-red'}`}>{wf.outSample}</span>
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
    </div>
  )
}
