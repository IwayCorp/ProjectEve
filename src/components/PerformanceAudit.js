'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import DailyBrief from './DailyBrief'

// ============ CONSTANTS ============

const STRATEGIES = ['momentum', 'meanReversion', 'breakout']
const REGIMES = ['trending-bull', 'trending-bear', 'mean-reverting', 'volatile-transition']

const STRATEGY_LABELS = {
  momentum: 'Momentum',
  meanReversion: 'Mean Reversion',
  breakout: 'Breakout',
}

const REGIME_LABELS = {
  'trending-bull': 'Bull',
  'trending-bear': 'Bear',
  'mean-reverting': 'Mean Rev',
  'volatile-transition': 'Volatile',
}

const SEVERITY_STYLES = {
  critical: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', label: 'CRITICAL' },
  warning: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b', label: 'WARNING' },
  info: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6', label: 'INFO' },
}

// ============ HELPER COMPONENTS ============

function GlassCard({ children, className = '', style = {} }) {
  return (
    <div
      className={`nx-card p-4 ${className}`}
      style={{
        background: 'rgba(15, 21, 35, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        backdropFilter: 'blur(12px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="nx-section-header">
        <div className="nx-accent-bar" />
        <h3>{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-nx-text-muted mt-1 ml-3">{subtitle}</p>}
    </div>
  )
}

function StatCard({ label, value, subtext, color }) {
  return (
    <div
      className="p-3 rounded-xl text-center"
      style={{ background: 'rgba(15, 21, 35, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <div className="text-2xs text-nx-text-muted mb-1">{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color: color || 'rgb(var(--nx-text-strong))' }}>
        {value}
      </div>
      {subtext && <div className="text-2xs text-nx-text-hint mt-0.5">{subtext}</div>}
    </div>
  )
}

// ============ WIN RATE GAUGE ============

function WinRateGauge({ winRate, target = 0.6 }) {
  const pct = Math.round(winRate * 100)
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (winRate * circumference)
  const color = pct >= 60 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const targetDash = circumference - (target * circumference)

  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="130" viewBox="0 0 130 130">
        {/* Background circle */}
        <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        {/* Target marker */}
        <circle
          cx="65" cy="65" r={radius} fill="none"
          stroke="rgba(255,255,255,0.15)" strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={targetDash}
          transform="rotate(-90 65 65)"
          strokeLinecap="round"
          style={{ opacity: 0.3 }}
        />
        {/* Actual win rate */}
        <circle
          cx="65" cy="65" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 65 65)"
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }}
        />
        <text x="65" y="60" textAnchor="middle" fill={color} fontSize="24" fontWeight="bold" fontFamily="monospace">
          {pct}%
        </text>
        <text x="65" y="78" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">
          Win Rate
        </text>
      </svg>
      <div className="text-2xs text-nx-text-hint mt-1">
        Target: {Math.round(target * 100)}%
      </div>
    </div>
  )
}

// ============ STRATEGY MATRIX ============

function StrategyMatrix({ matrix }) {
  if (!matrix || Object.keys(matrix).length === 0) {
    return (
      <div className="text-center text-sm text-nx-text-muted py-8">
        No strategy data yet. Record signals to populate the matrix.
      </div>
    )
  }

  function cellColor(wr, count) {
    if (count === 0) return 'rgba(255,255,255,0.03)'
    if (wr >= 0.6) return 'rgba(34, 197, 94, 0.2)'
    if (wr >= 0.5) return 'rgba(245, 158, 11, 0.2)'
    return 'rgba(239, 68, 68, 0.2)'
  }

  function cellBorder(wr, count) {
    if (count === 0) return 'rgba(255,255,255,0.04)'
    if (wr >= 0.6) return 'rgba(34, 197, 94, 0.35)'
    if (wr >= 0.5) return 'rgba(245, 158, 11, 0.35)'
    return 'rgba(239, 68, 68, 0.35)'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-nx-text-muted font-medium" />
            {REGIMES.map(r => (
              <th key={r} className="px-2 py-1.5 text-nx-text-muted font-medium text-center">
                {REGIME_LABELS[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STRATEGIES.map(strat => (
            <tr key={strat}>
              <td className="px-2 py-1.5 text-nx-text-strong font-semibold whitespace-nowrap">
                {STRATEGY_LABELS[strat]}
              </td>
              {REGIMES.map(regime => {
                const cell = matrix[strat]?.[regime] || { winRate: 0, count: 0, avgReturn: 0 }
                return (
                  <td key={regime} className="px-1 py-1">
                    <div
                      className="rounded-lg px-2 py-1.5 text-center"
                      style={{
                        background: cellColor(cell.winRate, cell.count),
                        border: `1px solid ${cellBorder(cell.winRate, cell.count)}`,
                      }}
                    >
                      {cell.count > 0 ? (
                        <>
                          <div className="font-mono font-bold" style={{
                            color: cell.winRate >= 0.6 ? '#22c55e' : cell.winRate >= 0.5 ? '#f59e0b' : '#ef4444'
                          }}>
                            {(cell.winRate * 100).toFixed(0)}%
                          </div>
                          <div className="text-2xs text-nx-text-hint">
                            n={cell.count}
                          </div>
                        </>
                      ) : (
                        <div className="text-nx-text-hint">--</div>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============ CUSTOM CHART TOOLTIP ============

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{
        background: 'rgba(10, 14, 28, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-nx-text-muted">{p.name}:</span>
          <span className="font-mono font-semibold text-nx-text-strong">
            {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============ MAIN COMPONENT ============

export default function PerformanceAudit() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [auditing, setAuditing] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState('dashboard')
  const [correctionFilter, setCorrectionFilter] = useState('all')

  // Fetch performance report
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/audit')
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      setReport(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Run full audit
  const runAudit = useCallback(async () => {
    try {
      setAuditing(true)
      setError(null)
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audit' }),
      })
      if (!res.ok) throw new Error(`Audit failed: ${res.status}`)
      const data = await res.json()
      setReport(data.report)
    } catch (err) {
      setError(err.message)
    } finally {
      setAuditing(false)
    }
  }, [])

  // Reset engine
  const resetEngine = useCallback(async () => {
    if (!confirm('This will erase all signal history and reset the adaptive engine. Continue?')) return
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      await fetchReport()
    } catch (err) {
      setError(err.message)
    }
  }, [fetchReport])

  useEffect(() => { fetchReport() }, [fetchReport])

  // Derived data
  const metrics = useMemo(() => {
    if (!report?.metrics?.overall) return null
    return report.metrics.overall.allTime || report.metrics.overall
  }, [report])

  const last20Metrics = useMemo(() => {
    if (!report?.metrics?.overall) return null
    return report.metrics.overall.last20 || null
  }, [report])

  const equityCurve = useMemo(() => {
    return report?.equityCurve || []
  }, [report])

  const factorData = useMemo(() => {
    if (!report?.factorAttribution) return []
    return Object.entries(report.factorAttribution).map(([name, data]) => ({
      name: name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
      weight: parseFloat((data.weight * 100).toFixed(1)),
      default: parseFloat((data.defaultWeight * 100).toFixed(1)),
      change: parseFloat((data.change * 100).toFixed(1)),
    })).sort((a, b) => b.weight - a.weight)
  }, [report])

  const filteredCorrections = useMemo(() => {
    const all = report?.corrections || []
    if (correctionFilter === 'all') return all
    return all.filter(c => c.type === correctionFilter)
  }, [report, correctionFilter])

  const subTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'matrix', label: 'Strategy Matrix' },
    { id: 'factors', label: 'Factor Attribution' },
    { id: 'anomalies', label: 'Anomalies' },
    { id: 'corrections', label: 'Corrections' },
    { id: 'brief', label: 'Daily Brief' },
    { id: 'intelligence', label: 'Intel Report' },
  ]

  // ============ LOADING STATE ============

  if (loading && !report) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Performance Audit" subtitle="Loading adaptive engine data..." />
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(91, 141, 238, 0.3)', borderTopColor: '#5b8dee' }}
            />
            <span className="text-sm text-nx-text-muted">Loading performance data...</span>
          </div>
        </div>
      </div>
    )
  }

  // ============ ERROR STATE ============

  if (error && !report) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Performance Audit" subtitle="Error loading data" />
        <GlassCard>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="text-3xl mb-3">!</div>
            <h4 className="text-sm font-semibold text-nx-red mb-2">Failed to Load</h4>
            <p className="text-xs text-nx-text-muted mb-4">{error}</p>
            <button
              onClick={fetchReport}
              className="px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(91, 141, 238, 0.15)', border: '1px solid rgba(91, 141, 238, 0.3)', color: '#5b8dee' }}
            >
              Retry
            </button>
          </div>
        </GlassCard>
      </div>
    )
  }

  const summary = report?.summary || {}
  const isLearning = summary.isLearningMode
  const anomalies = report?.anomalies || []
  const corrections = report?.corrections || []

  // ============ EMPTY STATE ============

  if (!report || summary.resolvedSignals === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="Performance Audit"
          subtitle="Adaptive learning engine with real-time self-correction"
        />
        <GlassCard>
          <div className="flex flex-col items-center py-16 text-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: 'rgba(91, 141, 238, 0.08)', border: '1px solid rgba(91, 141, 238, 0.15)' }}
            >
              <span className="text-4xl">&#x1F9E0;</span>
            </div>
            <h4 className="text-lg font-semibold text-nx-text-strong mb-2">
              Adaptive Engine Ready
            </h4>
            <p className="text-sm text-nx-text-muted max-w-lg leading-relaxed mb-6">
              The performance audit system tracks every signal outcome, learns from wins and losses,
              and self-corrects strategy weights, factor importance, and confidence thresholds.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full mb-8">
              {[
                { title: 'Record Outcomes', desc: 'Log signal results to build the performance database.' },
                { title: 'Learn Patterns', desc: 'Engine needs 20 resolved signals to exit learning mode.' },
                { title: 'Self-Correct', desc: 'Adaptive weights, anomaly detection, and daily intelligence briefs.' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl text-left"
                  style={{ background: 'rgba(15, 21, 35, 0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="text-sm font-semibold text-nx-text-strong mb-1">{item.title}</div>
                  <div className="text-2xs text-nx-text-muted leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
            <button
              onClick={runAudit}
              disabled={auditing}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: 'rgba(91, 141, 238, 0.15)',
                border: '1px solid rgba(91, 141, 238, 0.3)',
                color: '#5b8dee',
              }}
            >
              {auditing ? 'Running Audit...' : 'Run Initial Audit'}
            </button>
          </div>
        </GlassCard>
      </div>
    )
  }

  // ============ FULL RENDER ============

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <SectionHeader
          title="Performance Audit"
          subtitle={`Adaptive engine ${isLearning ? '(learning mode)' : '(active)'} \u00B7 ${summary.resolvedSignals} resolved signals`}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(var(--nx-text-muted))' }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={runAudit}
            disabled={auditing}
            className="px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all"
            style={{ background: 'rgba(91, 141, 238, 0.12)', border: '1px solid rgba(91, 141, 238, 0.25)', color: '#5b8dee' }}
          >
            {auditing ? 'Auditing...' : 'Run Audit'}
          </button>
          <button
            onClick={resetEngine}
            className="px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all"
            style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Learning mode banner */}
      {isLearning && (
        <div
          className="px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
        >
          <div className="text-lg">&#x1F4D6;</div>
          <div>
            <div className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Learning Mode</div>
            <div className="text-2xs text-nx-text-muted">
              {summary.resolvedSignals} / 20 signals needed for calibration.
              Using default weights until enough data is collected.
            </div>
          </div>
          <div className="ml-auto">
            <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(summary.learningProgress || 0) * 100}%`,
                  background: 'linear-gradient(90deg, #f59e0b, #22c55e)',
                }}
              />
            </div>
            <div className="text-2xs text-nx-text-hint text-right mt-0.5">
              {Math.round((summary.learningProgress || 0) * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="flex gap-0 overflow-x-auto scrollbar-hide">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3 py-2 text-2xs font-semibold whitespace-nowrap rounded-lg transition-all duration-200 ${
              activeSubTab === tab.id ? 'text-nx-accent' : 'text-nx-text-hint hover:text-nx-text-muted'
            }`}
            style={activeSubTab === tab.id ? {
              background: 'var(--nx-accent-muted)',
              border: '1px solid rgba(var(--nx-accent) / 0.2)',
            } : {}}
          >
            {tab.label}
            {tab.id === 'anomalies' && anomalies.length > 0 && (
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-2xs font-bold"
                style={{
                  background: anomalies.some(a => a.severity === 'critical') ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                  color: anomalies.some(a => a.severity === 'critical') ? '#ef4444' : '#f59e0b',
                }}
              >
                {anomalies.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ======== DASHBOARD TAB ======== */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard
              label="Win Rate"
              value={`${(metrics?.winRate * 100 || 0).toFixed(1)}%`}
              subtext={last20Metrics ? `Last 20: ${(last20Metrics.winRate * 100).toFixed(1)}%` : null}
              color={metrics?.winRate >= 0.6 ? '#22c55e' : metrics?.winRate >= 0.5 ? '#f59e0b' : '#ef4444'}
            />
            <StatCard
              label="Sharpe Ratio"
              value={(metrics?.sharpeRatio || 0).toFixed(2)}
              subtext={last20Metrics ? `Last 20: ${last20Metrics.sharpeRatio.toFixed(2)}` : null}
              color={metrics?.sharpeRatio >= 1.5 ? '#22c55e' : metrics?.sharpeRatio >= 1 ? '#f59e0b' : '#ef4444'}
            />
            <StatCard
              label="Profit Factor"
              value={metrics?.profitFactor === Infinity ? 'INF' : (metrics?.profitFactor || 0).toFixed(2)}
              color={metrics?.profitFactor >= 1.5 ? '#22c55e' : metrics?.profitFactor >= 1 ? '#f59e0b' : '#ef4444'}
            />
            <StatCard
              label="Max Drawdown"
              value={`${(metrics?.maxDrawdown * 100 || 0).toFixed(1)}%`}
              color={metrics?.maxDrawdown <= 0.1 ? '#22c55e' : metrics?.maxDrawdown <= 0.2 ? '#f59e0b' : '#ef4444'}
            />
            <StatCard
              label="Avg Return"
              value={`${(metrics?.avgReturn * 100 || 0).toFixed(2)}%`}
              color={metrics?.avgReturn > 0 ? '#22c55e' : '#ef4444'}
            />
            <StatCard
              label="Kelly %"
              value={`${(metrics?.kellyFraction * 100 || 0).toFixed(1)}%`}
              subtext="Optimal allocation"
              color="#5b8dee"
            />
          </div>

          {/* Equity Curve + Win Rate Gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <GlassCard className="lg:col-span-3">
              <div className="text-sm font-semibold text-nx-text-strong mb-3">Equity Curve</div>
              {equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={equityCurve}>
                    <XAxis
                      dataKey="index"
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={v => v.toFixed(2)}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      name="Equity"
                      stroke="#5b8dee"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#5b8dee', stroke: 'rgba(91,141,238,0.3)', strokeWidth: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-60 text-sm text-nx-text-muted">
                  No equity data available yet
                </div>
              )}
            </GlassCard>

            <GlassCard className="flex flex-col items-center justify-center">
              <WinRateGauge winRate={metrics?.winRate || 0} />
              <div className="mt-3 text-center">
                <div className="text-2xs text-nx-text-muted">
                  {summary.resolvedSignals} resolved / {summary.totalSignals} total
                </div>
                {summary.openSignals > 0 && (
                  <div className="text-2xs text-nx-accent mt-1">
                    {summary.openSignals} open
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Adaptive Intelligence Card */}
          <GlassCard>
            <div className="text-sm font-semibold text-nx-text-strong mb-3">Adaptive Intelligence</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-2.5 rounded-lg" style={{ background: 'rgba(15,21,35,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-2xs text-nx-text-muted mb-1">Mode</div>
                <div className="text-xs font-semibold" style={{ color: isLearning ? '#f59e0b' : '#22c55e' }}>
                  {isLearning ? 'Learning' : 'Active'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg" style={{ background: 'rgba(15,21,35,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-2xs text-nx-text-muted mb-1">Training Set</div>
                <div className="text-xs font-semibold text-nx-text-strong font-mono">
                  {summary.resolvedSignals} signals
                </div>
              </div>
              <div className="p-2.5 rounded-lg" style={{ background: 'rgba(15,21,35,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-2xs text-nx-text-muted mb-1">Min Confidence</div>
                <div className="text-xs font-semibold text-nx-text-strong font-mono">
                  {report?.minimumConfidence || 50}%
                  {report?.minimumConfidence > 50 && <span className="text-2xs text-nx-accent ml-1">(+{report.minimumConfidence - 50})</span>}
                </div>
              </div>
              <div className="p-2.5 rounded-lg" style={{ background: 'rgba(15,21,35,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-2xs text-nx-text-muted mb-1">Active Anomalies</div>
                <div className="text-xs font-semibold font-mono" style={{
                  color: anomalies.length === 0 ? '#22c55e' : anomalies.some(a => a.severity === 'critical') ? '#ef4444' : '#f59e0b'
                }}>
                  {anomalies.length}
                </div>
              </div>
              <div className="p-2.5 rounded-lg" style={{ background: 'rgba(15,21,35,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-2xs text-nx-text-muted mb-1">Corrections</div>
                <div className="text-xs font-semibold text-nx-text-strong font-mono">
                  {corrections.length} active
                </div>
              </div>
            </div>
            {summary.lastAuditAt && (
              <div className="text-2xs text-nx-text-hint mt-3">
                Last audit: {new Date(summary.lastAuditAt).toLocaleString()}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ======== STRATEGY MATRIX TAB ======== */}
      {activeSubTab === 'matrix' && (
        <GlassCard>
          <div className="text-sm font-semibold text-nx-text-strong mb-1">Strategy x Regime Matrix</div>
          <div className="text-2xs text-nx-text-muted mb-4">Win rates by strategy and market regime. Color-coded: green (&gt;60%), yellow (50-60%), red (&lt;50%)</div>
          <StrategyMatrix matrix={report?.strategyMatrix} />
        </GlassCard>
      )}

      {/* ======== FACTOR ATTRIBUTION TAB ======== */}
      {activeSubTab === 'factors' && (
        <GlassCard>
          <div className="text-sm font-semibold text-nx-text-strong mb-1">Factor Attribution</div>
          <div className="text-2xs text-nx-text-muted mb-4">Adaptive factor weights based on discriminative power between wins and losses</div>
          {factorData.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={factorData} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <XAxis
                    type="number"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                    tickFormatter={v => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="weight" name="Current Weight" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {factorData.map((entry, i) => (
                      <Cell key={i} fill={entry.change > 0 ? '#22c55e' : entry.change < -1 ? '#ef4444' : '#5b8dee'} />
                    ))}
                  </Bar>
                  <Bar dataKey="default" name="Default Weight" radius={[0, 4, 4, 0]} maxBarSize={24} fill="rgba(255,255,255,0.1)" />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-4">
                {factorData.map((f, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg text-xs"
                    style={{ background: 'rgba(15,21,35,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="text-nx-text-muted text-2xs">{f.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-mono font-bold text-nx-text-strong">{f.weight}%</span>
                      {f.change !== 0 && (
                        <span className={`text-2xs font-mono ${f.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ({f.change > 0 ? '+' : ''}{f.change}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-nx-text-muted">
              Factor data will appear after signals are recorded with factor snapshots.
            </div>
          )}
        </GlassCard>
      )}

      {/* ======== ANOMALIES TAB ======== */}
      {activeSubTab === 'anomalies' && (
        <div className="space-y-3">
          {anomalies.length === 0 ? (
            <GlassCard>
              <div className="flex flex-col items-center py-12 text-center">
                <div className="text-3xl mb-3">&#x2705;</div>
                <div className="text-sm font-semibold text-nx-text-strong mb-1">No Anomalies Detected</div>
                <div className="text-xs text-nx-text-muted">All metrics are within normal parameters.</div>
              </div>
            </GlassCard>
          ) : (
            anomalies.map((a, i) => {
              const style = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info
              return (
                <div
                  key={i}
                  className="px-4 py-3 rounded-xl"
                  style={{ background: style.bg, border: `1px solid ${style.border}` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="px-2 py-0.5 rounded text-2xs font-bold uppercase"
                      style={{ background: style.border, color: style.text }}
                    >
                      {style.label}
                    </span>
                    <span className="text-2xs text-nx-text-hint font-mono">{a.type}</span>
                    <span className="ml-auto text-2xs text-nx-text-hint">
                      {new Date(a.detectedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-nx-text-strong">{a.message}</div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ======== CORRECTIONS TAB ======== */}
      {activeSubTab === 'corrections' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {['all', 'STRATEGY_WEIGHT', 'CONFIDENCE_THRESHOLD', 'FACTOR_WEIGHT'].map(filter => (
              <button
                key={filter}
                onClick={() => setCorrectionFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all ${
                  correctionFilter === filter ? 'text-nx-accent' : 'text-nx-text-hint'
                }`}
                style={correctionFilter === filter ? {
                  background: 'var(--nx-accent-muted)',
                  border: '1px solid rgba(var(--nx-accent) / 0.2)',
                } : {
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {filter === 'all' ? 'All' : filter.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {filteredCorrections.length === 0 ? (
            <GlassCard>
              <div className="flex flex-col items-center py-12 text-center">
                <div className="text-3xl mb-3">&#x2696;</div>
                <div className="text-sm font-semibold text-nx-text-strong mb-1">No Active Corrections</div>
                <div className="text-xs text-nx-text-muted">Engine is operating on default weights.</div>
              </div>
            </GlassCard>
          ) : (
            filteredCorrections.map((c, i) => (
              <GlassCard key={i}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded text-2xs font-bold"
                        style={{
                          background: 'rgba(91, 141, 238, 0.12)',
                          border: '1px solid rgba(91, 141, 238, 0.25)',
                          color: '#5b8dee',
                        }}
                      >
                        {c.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-nx-text-strong mt-1">{c.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xs text-nx-text-hint">Magnitude</div>
                    <div className="text-sm font-mono font-bold" style={{
                      color: c.magnitude > 0.1 ? '#f59e0b' : '#22c55e'
                    }}>
                      {(c.magnitude * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="text-2xs text-nx-text-hint mt-2">
                  {new Date(c.generatedAt).toLocaleString()}
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}

      {/* ======== DAILY BRIEF TAB ======== */}
      {activeSubTab === 'brief' && (
        <DailyBrief briefs={report?.briefs} />
      )}

      {/* ======== INTELLIGENCE REPORT TAB ======== */}
      {activeSubTab === 'intelligence' && (
        <GlassCard>
          <div className="text-sm font-semibold text-nx-text-strong mb-3">Market Intelligence Brief</div>
          <pre
            className="text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto p-4 rounded-lg"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {report?.intelligenceBrief || 'Run an audit to generate the intelligence brief.'}
          </pre>
        </GlassCard>
      )}

      {/* Error banner (non-blocking) */}
      {error && report && (
        <div
          className="px-4 py-2 rounded-lg text-xs flex items-center gap-2"
          style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
        >
          <span>Error: {error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-2xs underline">Dismiss</button>
        </div>
      )}
    </div>
  )
}
