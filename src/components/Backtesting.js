'use client'
import { useState, useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { CHART_AXIS, CHART_YAXIS, CHART_GRID, CHART_TOOLTIP_STYLE } from '@/lib/chartConfig'
import DemoBanner from '@/components/DemoBanner'

// Generate realistic backtest equity curve data
function generateEquityCurve(months = 12) {
  const data = []
  let equity = 100000
  let benchmark = 100000
  let peak = equity
  const now = new Date()
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1)

  for (let i = 0; i < months * 21; i++) { // ~21 trading days per month
    const date = new Date(startDate.getTime() + i * 86400000 * 1.4) // skip weekends roughly
    const seed = (i * 7919 + 104729) % 100000
    const rand = seed / 100000

    // Strategy returns: slight positive drift with volatility
    const dailyReturn = (0.0008 + (rand - 0.48) * 0.025) * (1 + Math.sin(i / 30) * 0.3)
    equity *= (1 + dailyReturn)

    // Benchmark returns: lower drift, lower vol
    const benchReturn = 0.0003 + (((seed * 3 + 7) % 100000) / 100000 - 0.49) * 0.018
    benchmark *= (1 + benchReturn)

    if (equity > peak) peak = equity
    const drawdown = ((equity - peak) / peak) * 100

    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      equity: Math.round(equity),
      benchmark: Math.round(benchmark),
      drawdown: Math.round(drawdown * 100) / 100,
      day: i,
    })
  }
  return data
}

const BACKTEST_STATS = {
  netProfit: 47832,
  netProfitPct: 47.83,
  totalTrades: 342,
  winRate: 64.3,
  sharpe: 2.18,
  sortino: 3.42,
  maxDrawdown: -8.74,
  avgTrade: 139.86,
  profitFactor: 2.31,
  calmar: 5.47,
  annualReturn: 47.83,
  totalFees: 2847,
  avgHoldDays: 6.2,
  maxConsecWins: 12,
  maxConsecLosses: 4,
  beta: 0.62,
  alpha: 0.31,
  informationRatio: 1.87,
}

const HOLDINGS_LOG = [
  { date: '2026-03-28', symbol: 'NVDA', direction: 'LONG', qty: 15, entry: 842.50, exit: 891.20, pnl: 730.50, pnlPct: 5.78 },
  { date: '2026-03-27', symbol: 'RTX', direction: 'LONG', qty: 50, entry: 139.80, exit: 147.30, pnl: 375.00, pnlPct: 5.36 },
  { date: '2026-03-26', symbol: 'TSLA', direction: 'SHORT', qty: 20, entry: 182.40, exit: 171.60, pnl: 216.00, pnlPct: 5.93 },
  { date: '2026-03-25', symbol: 'GC=F', direction: 'LONG', qty: 2, entry: 2298.00, exit: 2345.80, pnl: 95.60, pnlPct: 2.08 },
  { date: '2026-03-24', symbol: 'EURUSD', direction: 'LONG', qty: 100000, entry: 1.0835, exit: 1.0792, pnl: -430.00, pnlPct: -0.40 },
  { date: '2026-03-21', symbol: 'MSFT', direction: 'LONG', qty: 25, entry: 384.20, exit: 398.50, pnl: 357.50, pnlPct: 3.72 },
  { date: '2026-03-20', symbol: 'XOM', direction: 'LONG', qty: 40, entry: 136.80, exit: 141.20, pnl: 176.00, pnlPct: 3.22 },
  { date: '2026-03-19', symbol: 'CL=F', direction: 'LONG', qty: 5, entry: 82.40, exit: 85.90, pnl: 175.00, pnlPct: 4.25 },
]

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
  const equityCurve = useMemo(() => generateEquityCurve(12), [])

  return (
    <div className="space-y-5">
      <DemoBanner
        type="simulated"
        message="All equity curves, P&L figures, and trade history shown here are procedurally generated. No real backtest engine has been run against historical market data."
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Backtesting Results</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">Strategy performance analysis over rolling 12-month backtest period.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
            342 Trades Analyzed
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      <StatBar stats={BACKTEST_STATS} />

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
                  <Line type="monotone" dataKey="benchmark" stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="5 5" name="S&P 500" />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Extended Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {[
          { label: 'Sortino Ratio', value: BACKTEST_STATS.sortino, color: 'text-nx-green' },
          { label: 'Calmar Ratio', value: BACKTEST_STATS.calmar, color: 'text-nx-green' },
          { label: 'Info Ratio', value: BACKTEST_STATS.informationRatio, color: 'text-nx-green' },
          { label: 'Beta', value: BACKTEST_STATS.beta, color: 'text-nx-accent' },
          { label: 'Avg Hold (Days)', value: BACKTEST_STATS.avgHoldDays, color: 'text-nx-text-strong' },
          { label: 'Avg Trade P&L', value: `$${BACKTEST_STATS.avgTrade}`, color: 'text-nx-green' },
          { label: 'Max Consec Wins', value: BACKTEST_STATS.maxConsecWins, color: 'text-nx-green' },
          { label: 'Max Consec Losses', value: BACKTEST_STATS.maxConsecLosses, color: 'text-nx-red' },
          { label: 'Annual Return', value: `${BACKTEST_STATS.annualReturn}%`, color: 'text-nx-green' },
          { label: 'Avg Trade Return', value: `+${(BACKTEST_STATS.avgTrade / 100000 * 100).toFixed(2)}%`, color: 'text-nx-green' },
        ].map((stat, i) => (
          <div key={i} className="glass-solid p-3">
            <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">{stat.label}</div>
            <div className={`text-lg font-bold font-mono tabular-nums mt-1 ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Holdings Log */}
      <div>
        <div className="nx-section-header">
          <div className="nx-accent-bar" />
          <h3>Recent Holdings</h3>
        </div>
        <div className="space-y-1 mt-3">
          <div className="grid grid-cols-8 gap-2 px-4 py-2 text-2xs text-nx-text-muted uppercase tracking-wider font-medium">
            <span>Date</span><span>Symbol</span><span>Side</span><span>Qty</span><span>Entry</span><span>Exit</span><span className="text-right">P&L</span><span className="text-right">Return</span>
          </div>
          {HOLDINGS_LOG.map((h, i) => (
            <div key={i} className="nx-card grid grid-cols-8 gap-2 px-4 py-3 items-center">
              <span className="text-xs text-nx-text-muted">{h.date}</span>
              <span className="text-xs font-bold text-nx-text-strong">{h.symbol}</span>
              <span className={`text-2xs px-2 py-0.5 rounded-md font-bold inline-block w-fit ${h.direction === 'LONG' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
                {h.direction}
              </span>
              <span className="text-xs font-mono text-nx-text-muted">{h.qty.toLocaleString()}</span>
              <span className="text-xs font-mono text-nx-text">{typeof h.entry === 'number' ? h.entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : h.entry}</span>
              <span className="text-xs font-mono text-nx-text">{typeof h.exit === 'number' ? h.exit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : h.exit}</span>
              <span className={`text-xs font-bold font-mono text-right ${h.pnl >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>{h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)}</span>
              <span className={`text-xs font-bold font-mono text-right ${h.pnlPct >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
