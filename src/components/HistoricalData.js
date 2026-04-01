'use client'
import { useState, useMemo } from 'react'
import { generateHistoricalTrades, computeStats } from '@/lib/predictions'
import { STRATEGIES } from '@/lib/tradeIdeas'

function StatCard({ label, value, sub, color = 'text-nx-text-strong' }) {
  return (
    <div className="glass-solid p-3.5">
      <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-2xs text-nx-text-hint mt-0.5">{sub}</div>}
    </div>
  )
}

function OutcomeBadge({ outcome }) {
  const map = {
    TARGET: { label: 'TARGET HIT', cls: 'badge-green' },
    STOPPED: { label: 'STOPPED', cls: 'badge-red' },
    PARTIAL_WIN: { label: 'PARTIAL WIN', cls: 'badge-blue' },
    PARTIAL_LOSS: { label: 'PARTIAL LOSS', cls: 'badge-orange' },
  }
  const m = map[outcome] || { label: outcome, cls: 'badge-blue' }
  return <span className={m.cls}>{m.label}</span>
}

export default function HistoricalData() {
  const trades = useMemo(() => generateHistoricalTrades(), [])
  const stats = useMemo(() => computeStats(trades), [trades])
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [expandedId, setExpandedId] = useState(null)

  const filters = ['all', 'wins', 'losses', 'targets', 'stopped']
  const filtered = useMemo(() => {
    let list = [...trades]
    if (filter === 'wins') list = list.filter(t => t.returnPct > 0)
    if (filter === 'losses') list = list.filter(t => t.returnPct <= 0)
    if (filter === 'targets') list = list.filter(t => t.hit)
    if (filter === 'stopped') list = list.filter(t => t.stopped)

    if (sortBy === 'return') list.sort((a, b) => b.returnPct - a.returnPct)
    if (sortBy === 'date') list.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate))
    return list
  }, [trades, filter, sortBy])

  // Equity curve
  const equityCurve = useMemo(() => {
    let equity = 100
    return trades.map(t => {
      equity *= (1 + t.returnPct / 100)
      return { ticker: t.ticker, equity: Math.round(equity * 100) / 100, date: t.exitDate }
    })
  }, [trades])

  return (
    <div className="space-y-5">
      {/* Performance Dashboard */}
      <div>
        <h3 className="text-md font-bold text-nx-text-strong mb-3">Performance Dashboard</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <StatCard label="Total Trades" value={stats.total} />
          <StatCard label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 60 ? 'text-nx-green' : stats.winRate >= 50 ? 'text-nx-orange' : 'text-nx-red'} />
          <StatCard label="Target Hit Rate" value={`${stats.targetHitRate}%`} color={stats.targetHitRate >= 50 ? 'text-nx-green' : 'text-nx-orange'} />
          <StatCard label="Total Return" value={`${stats.totalReturn > 0 ? '+' : ''}${stats.totalReturn}%`} color={stats.totalReturn > 0 ? 'text-nx-green' : 'text-nx-red'} />
          <StatCard label="Avg Win" value={`+${stats.avgWin}%`} color="text-nx-green" />
          <StatCard label="Avg Loss" value={`${stats.avgLoss}%`} color="text-nx-red" />
        </div>
      </div>

      {/* Quantitative Metrics */}
      <div>
        <h3 className="text-md font-bold text-nx-text-strong mb-3">Quantitative Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard label="Sharpe Ratio" value={stats.sharpe} sub="Annualized (4-day trades)" color={stats.sharpe >= 1.5 ? 'text-nx-green' : stats.sharpe >= 1 ? 'text-nx-orange' : 'text-nx-red'} />
          <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? '\u221E' : stats.profitFactor} sub="Gross profit / gross loss" color={stats.profitFactor >= 2 ? 'text-nx-green' : stats.profitFactor >= 1 ? 'text-nx-orange' : 'text-nx-red'} />
          <StatCard label="Max Drawdown" value={`-${stats.maxDrawdown}%`} sub="Peak-to-trough" color="text-nx-red" />
          <StatCard label="Avg Return" value={`${stats.avgReturn > 0 ? '+' : ''}${stats.avgReturn}%`} sub="Per trade" color={stats.avgReturn > 0 ? 'text-nx-green' : 'text-nx-red'} />
        </div>
      </div>

      {/* Equity Curve */}
      <div className="nx-card p-4">
        <h4 className="text-sm font-semibold text-nx-text-strong mb-3">Equity Curve (Starting $100)</h4>
        <div className="flex items-end gap-1 h-32">
          {equityCurve.map((pt, i) => {
            const min = Math.min(...equityCurve.map(p => p.equity))
            const max = Math.max(...equityCurve.map(p => p.equity))
            const range = max - min || 1
            const h = ((pt.equity - min) / range) * 100
            const isUp = i > 0 ? pt.equity >= equityCurve[i - 1].equity : true
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity glass px-2 py-1 text-2xs text-nx-text-strong whitespace-nowrap z-10 pointer-events-none">
                  {pt.ticker} &middot; ${pt.equity}
                </div>
                <div
                  className={`w-full rounded-sm transition-all duration-300 ${isUp ? 'bg-nx-green/60 hover:bg-nx-green' : 'bg-nx-red/60 hover:bg-nx-red'}`}
                  style={{ height: `${Math.max(4, h)}%` }}
                />
                <div className="text-2xs text-nx-text-hint mt-1 -rotate-45 origin-left whitespace-nowrap">{pt.ticker}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Strategy Breakdown */}
      <div className="nx-card p-4">
        <h4 className="text-sm font-semibold text-nx-text-strong mb-3">Strategy Breakdown</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(stats.byStrategy || {}).map(([strat, data]) => {
            const wr = data.trades > 0 ? Math.round((data.wins / data.trades) * 100) : 0
            return (
              <div key={strat} className="glass-solid p-3 text-center">
                <div className={`text-2xs font-semibold uppercase mb-1 px-2 py-0.5 rounded-md inline-block strat-${strat}`}>
                  {STRATEGIES[strat]?.icon} {strat.replace('-', ' ')}
                </div>
                <div className="text-lg font-bold text-nx-text-strong font-mono mt-1">{wr}%</div>
                <div className="text-2xs text-nx-text-muted">{data.wins}W / {data.trades - data.wins}L</div>
                <div className={`text-2xs font-mono mt-0.5 ${data.totalReturn > 0 ? 'text-nx-green' : 'text-nx-red'}`}>
                  {data.totalReturn > 0 ? '+' : ''}{Math.round(data.totalReturn * 100) / 100}%
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Trade Log */}
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="text-md font-bold text-nx-text-strong mr-2">Trade Log</h3>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 capitalize ${
                filter === f
                  ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20'
                  : 'text-nx-text-hint hover:text-nx-text-muted bg-nx-void/40 border border-nx-border'
              }`}
            >
              {f === 'all' ? `All (${trades.length})` : f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Sort:</span>
            <button onClick={() => setSortBy('date')} className={`px-2 py-1 text-2xs rounded-md ${sortBy === 'date' ? 'bg-nx-accent-muted text-nx-accent' : 'text-nx-text-hint'}`}>Date</button>
            <button onClick={() => setSortBy('return')} className={`px-2 py-1 text-2xs rounded-md ${sortBy === 'return' ? 'bg-nx-accent-muted text-nx-accent' : 'text-nx-text-hint'}`}>Return</button>
          </div>
        </div>

        <div className="space-y-1.5">
          {filtered.map(trade => (
            <div
              key={trade.id}
              className={`nx-card p-3.5 cursor-pointer transition-all duration-200 ${expandedId === trade.id ? 'border-nx-accent/20' : ''}`}
              onClick={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-16 shrink-0">
                  <span className="text-sm font-bold text-nx-text-strong">{trade.ticker}</span>
                </div>
                <span className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${trade.direction === 'long' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
                  {trade.direction}
                </span>
                <span className={`text-2xs px-2 py-0.5 rounded-md font-semibold strat-${trade.strategy}`}>
                  {STRATEGIES[trade.strategy]?.icon} {trade.strategy?.replace('-', ' ')}
                </span>
                <OutcomeBadge outcome={trade.outcome} />

                <div className="ml-auto flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-sm font-bold font-mono tabular-nums ${trade.returnPct > 0 ? 'text-nx-green' : 'text-nx-red'}`}>
                      {trade.returnPct > 0 ? '+' : ''}{trade.returnPct}%
                    </div>
                    <div className="text-2xs text-nx-text-hint">{trade.entryDate}</div>
                  </div>
                  <span className={`text-xs transition-transform ${expandedId === trade.id ? 'rotate-180' : ''}`}>&#9662;</span>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === trade.id && (
                <div className="mt-3 pt-3 border-t border-nx-border space-y-2 animate-fade-in">
                  <p className="text-sm text-nx-text leading-relaxed">{trade.thesis}</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="bg-nx-void/40 rounded-lg p-2">
                      <div className="text-2xs text-nx-text-muted">Entry</div>
                      <div className="text-sm font-mono text-nx-accent">{trade.entry}</div>
                    </div>
                    <div className="bg-nx-void/40 rounded-lg p-2">
                      <div className="text-2xs text-nx-text-muted">Target</div>
                      <div className="text-sm font-mono text-nx-green">{trade.target}</div>
                    </div>
                    <div className="bg-nx-void/40 rounded-lg p-2">
                      <div className="text-2xs text-nx-text-muted">Stop</div>
                      <div className="text-sm font-mono text-nx-red">{trade.stop}</div>
                    </div>
                    <div className="bg-nx-void/40 rounded-lg p-2">
                      <div className="text-2xs text-nx-text-muted">Exit Price</div>
                      <div className={`text-sm font-mono ${trade.returnPct > 0 ? 'text-nx-green' : 'text-nx-red'}`}>{trade.exitPrice}</div>
                    </div>
                    <div className="bg-nx-void/40 rounded-lg p-2">
                      <div className="text-2xs text-nx-text-muted">Held</div>
                      <div className="text-sm font-mono text-nx-text">{trade.entryDate} &rarr; {trade.exitDate}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
