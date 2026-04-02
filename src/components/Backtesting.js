'use client'
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { CHART_AXIS, CHART_YAXIS, CHART_GRID, CHART_TOOLTIP_STYLE } from '@/lib/chartConfig'

function StatBar({ stats }) {
  const items = [
    { label: 'Net Profit', value: `$${stats.netProfit.toLocaleString()}`, sub: `${stats.netProfitPct}%`, color: 'text-nx-green' },
    { label: 'Sharpe', value: stats.sharpe, color: stats.sharpe >= 2 ? 'text-nx-green' : 'text-nx-orange' },
    { label: 'Win Rate', value: `${stats.winRate}%`, color: stats.winRate >= 60 ? 'text-nx-green' : 'text-nx-orange' },
    { label: 'Max DD', value: `${stats.maxDrawdown}%`, color: 'text-nx-red' },
    { label: 'Profit Factor', value: stats.profitFactor, color: stats.profitFactor >= 2 ? 'text-nx-green' : 'text-nx-orange' },
    { label: 'Total Trades', value: stats.totalTrades, color: 'text-nx-text-strong' },
    { label: 'Total Fees', value: `$${stats.totalFees.toLocaleString()}`, color: 'text-nx-orange' },
    { label: 'Alpha', value: stats.alpha, color: stats.alpha > 0 ? 'text-nx-green' : 'text-nx-red' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-0 rounded-xl overflow-hidden" style={{ background: 'rgba(15, 21, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
      {items.map((item, i) => (
        <div key={i} className="p-3 text-center" style={{ borderRight: i < items.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none' }}>
          <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">{item.label}</div>
          <div className={`text-sm font-bold font-mono tabular-nums mt-1 ${item.color}`}>{item.value}</div>
          {item.sub && <div className="text-2xs text-nx-text-hint">{item.sub}</div>}
        </div>
      ))}
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="p-3 text-xs" style={{
      background: 'linear-gradient(145deg, rgba(15, 21, 35, 0.95), rgba(10, 14, 23, 0.98))',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    }}>
      <div className="mb-1 font-medium" style={{ color: '#94a3b8' }}>{d.date}</div>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4"><span style={{ color: '#5b8dee' }}>Strategy</span><span className="font-mono text-nx-text-strong">${d.equity?.toLocaleString()}</span></div>
        <div className="flex justify-between gap-4"><span style={{ color: '#64748b' }}>Benchmark</span><span className="font-mono text-nx-text-muted">${d.benchmark?.toLocaleString()}</span></div>
        <div className="flex justify-between gap-4"><span style={{ color: '#f87171' }}>Drawdown</span><span className="font-mono text-nx-red">{d.drawdown}%</span></div>
      </div>
    </div>
  )
}

export default function Backtesting() {
  const [chartView, setChartView] = useState('equity')
  const [symbol, setSymbol] = useState('SPY')
  const [symbolInput, setSymbolInput] = useState('SPY')
  const [strategy, setStrategy] = useState('rsi-mean-reversion')
  const [range, setRange] = useState('1y')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [equityCurve, setEquityCurve] = useState([])
  const [trades, setTrades] = useState([])

  const strategyOptions = [
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion' },
    { value: 'momentum-breakout', label: 'Momentum Breakout' },
    { value: 'macd-crossover', label: 'MACD Crossover' },
    { value: 'bollinger-squeeze', label: 'Bollinger Squeeze' },
  ]

  const rangeOptions = [
    { value: '6mo', label: '6 Months' },
    { value: '1y', label: '1 Year' },
    { value: '2y', label: '2 Years' },
  ]

  useEffect(() => {
    const fetchBacktestData = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/backtest?symbol=${symbol}&strategy=${strategy}&range=${range}`)
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }
        const data = await response.json()
        setStats(data.stats)
        setEquityCurve(data.equityCurve || [])
        setTrades(data.trades || [])
      } catch (err) {
        setError(err.message)
        setStats(null)
        setEquityCurve([])
        setTrades([])
      } finally {
        setLoading(false)
      }
    }

    fetchBacktestData()
  }, [symbol, strategy, range])

  const handleRunBacktest = () => {
    setSymbol(symbolInput.toUpperCase())
  }

  return (
    <div className="space-y-5">
      {/* Header with Selectors */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Backtesting Results</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">Real backtest engine performance analysis with live API data.</p>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <span className="text-2xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
              {stats.totalTrades} Trades Analyzed
            </span>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="glass-solid p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Symbol Input */}
          <div>
            <label className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium block mb-2">Symbol</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                placeholder="Enter ticker"
                className="flex-1 px-3 py-2 text-sm rounded-lg font-mono"
                style={{
                  background: 'rgba(15, 21, 35, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e2e8f0',
                }}
              />
              <button
                onClick={handleRunBacktest}
                className="px-4 py-2 text-2xs font-bold rounded-lg transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #5b8dee, #5b8dee)',
                  color: '#ffffff',
                  border: '1px solid rgba(91, 141, 238, 0.3)',
                }}
              >
                Run
              </button>
            </div>
          </div>

          {/* Strategy Selector */}
          <div>
            <label className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium block mb-2">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{
                background: 'rgba(15, 21, 35, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
              }}
            >
              {strategyOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Range Selector */}
          <div>
            <label className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium block mb-2">Range</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{
                background: 'rgba(15, 21, 35, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
              }}
            >
              {rangeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Current Symbol Display */}
          <div>
            <label className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium block mb-2">Active</label>
            <div className="px-3 py-2 text-sm rounded-lg font-mono font-bold" style={{
              background: 'rgba(52, 211, 153, 0.08)',
              border: '1px solid rgba(52, 211, 153, 0.15)',
              color: '#34d399',
            }}>
              {symbol}
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="inline-block mb-3">
              <div className="w-8 h-8 border-2 border-nx-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-sm text-nx-text-muted">Fetching backtest data...</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
          <div className="text-sm text-nx-red font-medium">Error loading backtest data</div>
          <div className="text-xs text-nx-text-muted mt-1">{error}</div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && !loading && (
        <>
          <StatBar stats={stats} />

          {/* Chart Toggle */}
          <div className="flex items-center gap-1 p-0.5">
            {['equity', 'drawdown', 'benchmark'].map(view => (
              <button
                key={view}
                onClick={() => setChartView(view)}
                aria-label={`Show ${view} chart`}
                aria-pressed={chartView === view}
                className={`px-3 py-1.5 text-2xs rounded-lg font-semibold transition-all duration-200 capitalize ${
                  chartView === view
                    ? 'text-nx-accent border border-nx-accent/20'
                    : 'text-nx-text-muted hover:text-nx-text-strong'
                }`}
                style={chartView === view ? { background: 'rgba(91, 141, 238, 0.12)' } : {}}
              >
                {view === 'equity' ? 'Strategy Equity' : view === 'drawdown' ? 'Drawdown' : 'vs Benchmark'}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="nx-chart-panel">
            <div className="h-[360px] p-4">
              {equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={equityCurve}>
                    <CartesianGrid {...CHART_GRID} />
                    <XAxis dataKey="date" {...CHART_AXIS} interval={Math.floor(equityCurve.length / 12)} />
                    <Tooltip content={<CustomTooltip />} />

                    {chartView === 'equity' && (
                      <>
                        <YAxis {...CHART_YAXIS} width={70} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                        <defs>
                          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#5b8dee" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#5b8dee" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="equity" fill="url(#equityFill)" stroke="none" />
                        <Line type="monotone" dataKey="equity" stroke="#5b8dee" strokeWidth={2} dot={false} style={{ filter: 'drop-shadow(0 0 4px rgba(91, 141, 238, 0.3))' }} />
                      </>
                    )}

                    {chartView === 'drawdown' && (
                      <>
                        <YAxis {...CHART_YAXIS} width={50} tickFormatter={v => `${v}%`} />
                        <defs>
                          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f87171" stopOpacity={0.01} />
                            <stop offset="100%" stopColor="#f87171" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="drawdown" fill="url(#ddFill)" stroke="none" />
                        <Line type="monotone" dataKey="drawdown" stroke="#f87171" strokeWidth={2} dot={false} style={{ filter: 'drop-shadow(0 0 4px rgba(248, 113, 113, 0.3))' }} />
                      </>
                    )}

                    {chartView === 'benchmark' && (
                      <>
                        <YAxis {...CHART_YAXIS} width={70} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                        <defs>
                          <linearGradient id="stratFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#5b8dee" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#5b8dee" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="equity" fill="url(#stratFill)" stroke="none" />
                        <Line type="monotone" dataKey="equity" stroke="#5b8dee" strokeWidth={2} dot={false} name="Strategy" />
                        <Line type="monotone" dataKey="benchmark" stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="5 5" name="Benchmark" />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-sm text-nx-text-muted">No chart data available</div>
                </div>
              )}
            </div>
          </div>

          {/* Extended Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {[
              { label: 'Sortino Ratio', value: stats.sortino, color: 'text-nx-green' },
              { label: 'Calmar Ratio', value: stats.calmar, color: 'text-nx-green' },
              { label: 'Info Ratio', value: stats.informationRatio, color: 'text-nx-green' },
              { label: 'Beta', value: stats.beta, color: 'text-nx-accent' },
              { label: 'Avg Hold (Days)', value: stats.avgHoldDays, color: 'text-nx-text-strong' },
              { label: 'Avg Trade P&L', value: `$${stats.avgTrade.toFixed(2)}`, color: 'text-nx-green' },
              { label: 'Max Consec Wins', value: stats.maxConsecWins, color: 'text-nx-green' },
              { label: 'Max Consec Losses', value: stats.maxConsecLosses, color: 'text-nx-red' },
              { label: 'Annual Return', value: `${stats.annualReturn}%`, color: 'text-nx-green' },
              { label: 'Avg Trade Return', value: `+${(stats.avgTrade / 100000 * 100).toFixed(2)}%`, color: 'text-nx-green' },
            ].map((stat, i) => (
              <div key={i} className="glass-solid p-3">
                <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">{stat.label}</div>
                <div className={`text-lg font-bold font-mono tabular-nums mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Recent Holdings Log */}
          {trades.length > 0 && (
            <div>
              <div className="nx-section-header">
                <div className="nx-accent-bar" />
                <h3>Recent Holdings</h3>
              </div>
              <div className="space-y-1 mt-3">
                <div className="grid grid-cols-8 gap-2 px-4 py-2 text-2xs text-nx-text-muted uppercase tracking-wider font-medium">
                  <span>Date</span><span>Symbol</span><span>Side</span><span>Entry</span><span>Exit</span><span className="text-right">P&L</span><span className="text-right">Return %</span><span className="text-right">Days</span>
                </div>
                {trades.slice(0, 10).map((t, i) => (
                  <div key={i} className="nx-card grid grid-cols-8 gap-2 px-4 py-3 items-center">
                    <span className="text-xs text-nx-text-muted">{t.date}</span>
                    <span className="text-xs font-bold text-nx-text-strong">{t.symbol}</span>
                    <span className={`text-2xs px-2 py-0.5 rounded-md font-bold inline-block w-fit ${t.direction === 'LONG' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
                      {t.direction}
                    </span>
                    <span className="text-xs font-mono text-nx-text">{typeof t.entry === 'number' ? t.entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : t.entry}</span>
                    <span className="text-xs font-mono text-nx-text">{typeof t.exit === 'number' ? t.exit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : t.exit}</span>
                    <span className={`text-xs font-bold font-mono text-right ${t.pnl >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>{t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}</span>
                    <span className={`text-xs font-bold font-mono text-right ${t.pnlPct >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>{t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%</span>
                    <span className="text-xs font-mono text-nx-text-muted text-right">{t.holdDays}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
