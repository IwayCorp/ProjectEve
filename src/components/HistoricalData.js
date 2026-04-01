'use client'
import { useState, useMemo } from 'react'
import { generateHistoricalTrades, computeStats, groupTradesByMonth, groupTradesByDate } from '@/lib/predictions'
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

function TradeRow({ trade, isExpanded, onToggle }) {
  return (
    <div
      className={`nx-card p-3.5 cursor-pointer transition-all duration-200 ${isExpanded ? 'border-nx-accent/20' : ''}`}
      onClick={onToggle}
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
        <span className="text-2xs text-nx-text-hint hidden md:inline">{trade.holdDays}d hold</span>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <div className={`text-sm font-bold font-mono tabular-nums ${trade.returnPct > 0 ? 'text-nx-green' : 'text-nx-red'}`}>
              {trade.returnPct > 0 ? '+' : ''}{trade.returnPct}%
            </div>
          </div>
          <span className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>&#9662;</span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-nx-border space-y-2 animate-fade-in">
          <p className="text-sm text-nx-text leading-relaxed">{trade.thesis}</p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
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
              <div className="text-2xs text-nx-text-muted">R:R</div>
              <div className={`text-sm font-mono ${trade.rr >= 2 ? 'text-nx-green' : 'text-nx-orange'}`}>{trade.rr}:1</div>
            </div>
            <div className="bg-nx-void/40 rounded-lg p-2">
              <div className="text-2xs text-nx-text-muted">Held</div>
              <div className="text-sm font-mono text-nx-text">{trade.entryDate} &rarr; {trade.exitDate}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Clickable date group showing all trades for a specific day
function DateGroup({ dateStr, trades, expandedId, onToggle }) {
  const [isOpen, setIsOpen] = useState(false)
  const d = new Date(dateStr + 'T12:00:00')
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const dayPnl = trades.reduce((sum, t) => sum + t.returnPct, 0)
  const dayWins = trades.filter(t => t.returnPct > 0).length

  return (
    <div className="mb-2">
      {/* Date header — clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group"
        style={{
          background: isOpen ? 'rgba(91, 141, 238, 0.06)' : 'rgba(255, 255, 255, 0.015)',
          border: `1px solid ${isOpen ? 'rgba(91, 141, 238, 0.12)' : 'rgba(255, 255, 255, 0.04)'}`,
        }}
      >
        <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: '#64748b' }}>&#9654;</span>
        <span className="text-sm font-semibold text-nx-text-strong">{dayLabel}</span>
        <span className="text-2xs text-nx-text-muted">{trades.length} trade{trades.length > 1 ? 's' : ''}</span>
        <span className="text-2xs text-nx-text-hint">{dayWins}W / {trades.length - dayWins}L</span>
        <div className="ml-auto flex items-center gap-3">
          <div className={`text-sm font-bold font-mono ${dayPnl > 0 ? 'text-nx-green' : dayPnl < 0 ? 'text-nx-red' : 'text-nx-text-muted'}`}>
            {dayPnl > 0 ? '+' : ''}{Math.round(dayPnl * 100) / 100}%
          </div>
          {/* Mini pips for quick glance */}
          <div className="flex gap-0.5">
            {trades.map((t, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${t.returnPct > 0 ? 'bg-nx-green' : 'bg-nx-red'}`} title={`${t.ticker}: ${t.returnPct > 0 ? '+' : ''}${t.returnPct}%`} />
            ))}
          </div>
        </div>
      </button>

      {/* Expanded trades for this date */}
      {isOpen && (
        <div className="ml-6 mt-1.5 space-y-1.5 animate-fade-in">
          {trades.map(trade => (
            <TradeRow
              key={trade.id}
              trade={trade}
              isExpanded={expandedId === trade.id}
              onToggle={() => onToggle(trade.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Month section with summary stats and date groups
function MonthSection({ monthLabel, trades, expandedId, onToggle }) {
  const [isOpen, setIsOpen] = useState(true)
  const stats = useMemo(() => computeStats(trades), [trades])
  const dateGroups = useMemo(() => groupTradesByDate(trades), [trades])
  const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(b) - new Date(a))

  // Month equity curve mini-bar
  const equityCurve = useMemo(() => {
    let eq = 100
    return trades.map(t => {
      eq *= (1 + t.returnPct / 100)
      return eq
    })
  }, [trades])
  const eqMin = Math.min(...equityCurve, 100)
  const eqMax = Math.max(...equityCurve, 100)

  return (
    <div className="mb-5">
      {/* Month Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 mb-2"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 21, 35, 0.7), rgba(10, 14, 23, 0.5))',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <span className={`text-sm font-bold transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: '#5b8dee' }}>&#9654;</span>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-md font-bold text-nx-text-strong">{monthLabel}</h3>
            <span className="text-2xs px-2.5 py-0.5 rounded-lg font-semibold" style={{ background: 'rgba(91, 141, 238, 0.1)', border: '1px solid rgba(91, 141, 238, 0.15)', color: '#5b8dee' }}>
              {stats.total} trades
            </span>
            <span className="text-2xs text-nx-text-muted">{stats.winRate}% win rate</span>
            <span className="text-2xs text-nx-text-muted">Avg hold {stats.avgHoldDays}d</span>
          </div>
        </div>

        {/* Mini equity curve */}
        <div className="hidden md:flex items-end gap-px h-6 w-32">
          {equityCurve.map((eq, i) => {
            const h = eqMax > eqMin ? ((eq - eqMin) / (eqMax - eqMin)) * 100 : 50
            const up = i > 0 ? eq >= equityCurve[i - 1] : eq >= 100
            return <div key={i} className={`flex-1 rounded-sm ${up ? 'bg-nx-green/50' : 'bg-nx-red/50'}`} style={{ height: `${Math.max(8, h)}%` }} />
          })}
        </div>

        <div className="flex items-center gap-4">
          <div className={`text-lg font-bold font-mono ${stats.totalReturn > 0 ? 'text-nx-green' : 'text-nx-red'}`}>
            {stats.totalReturn > 0 ? '+' : ''}{stats.totalReturn}%
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="animate-fade-in">
          {/* Month stats row */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3 ml-2">
            <StatCard label="Trades" value={stats.total} />
            <StatCard label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 60 ? 'text-nx-green' : stats.winRate >= 50 ? 'text-nx-orange' : 'text-nx-red'} />
            <StatCard label="Total Return" value={`${stats.totalReturn > 0 ? '+' : ''}${stats.totalReturn}%`} color={stats.totalReturn > 0 ? 'text-nx-green' : 'text-nx-red'} />
            <StatCard label="Avg Win" value={`+${stats.avgWin}%`} color="text-nx-green" />
            <StatCard label="Avg Loss" value={`${stats.avgLoss}%`} color="text-nx-red" />
            <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? '\u221E' : stats.profitFactor} color={stats.profitFactor >= 2 ? 'text-nx-green' : stats.profitFactor >= 1 ? 'text-nx-orange' : 'text-nx-red'} />
          </div>

          {/* Date groups */}
          <div className="ml-2">
            {sortedDates.map(dateStr => (
              <DateGroup
                key={dateStr}
                dateStr={dateStr}
                trades={dateGroups[dateStr]}
                expandedId={expandedId}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoricalData() {
  const allTrades = useMemo(() => generateHistoricalTrades(), [])
  const globalStats = useMemo(() => computeStats(allTrades), [allTrades])
  const monthGroups = useMemo(() => groupTradesByMonth(allTrades), [allTrades])
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')

  // Apply filter
  const filteredTrades = useMemo(() => {
    if (filter === 'all') return allTrades
    if (filter === 'wins') return allTrades.filter(t => t.returnPct > 0)
    if (filter === 'losses') return allTrades.filter(t => t.returnPct <= 0)
    if (filter === 'targets') return allTrades.filter(t => t.hit)
    if (filter === 'stopped') return allTrades.filter(t => t.stopped)
    return allTrades
  }, [allTrades, filter])

  const filteredMonths = useMemo(() => groupTradesByMonth(filteredTrades), [filteredTrades])

  // Sort months newest first
  const sortedMonths = Object.keys(filteredMonths).sort((a, b) => {
    const da = new Date(filteredMonths[a][0].entryDate)
    const db = new Date(filteredMonths[b][0].entryDate)
    return db - da
  })

  // Global equity curve
  const equityCurve = useMemo(() => {
    let equity = 10000
    return allTrades.map(t => {
      equity *= (1 + t.returnPct / 100)
      return { ticker: t.ticker, equity: Math.round(equity), date: t.entryDate, pct: t.returnPct }
    })
  }, [allTrades])

  const toggleTrade = (id) => setExpandedId(expandedId === id ? null : id)

  // Strategy breakdown from global stats
  const stratEntries = Object.entries(globalStats.byStrategy || {})

  return (
    <div className="space-y-5">
      {/* Performance Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Performance Dashboard</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">
            {allTrades.length} trades across {sortedMonths.length} months — Jan 2026 to Mar 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'wins', 'losses', 'targets', 'stopped'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 capitalize ${
                filter === f
                  ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20'
                  : 'text-nx-text-hint hover:text-nx-text-muted bg-nx-void/40 border border-nx-border'
              }`}
            >
              {f === 'all' ? `All (${allTrades.length})` : f}
            </button>
          ))}
        </div>
      </div>

      {/* Global Stats Bar */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-0 rounded-xl overflow-hidden" style={{ background: 'rgba(15, 21, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        {[
          { label: 'Total Trades', value: globalStats.total, color: 'text-nx-text-strong' },
          { label: 'Win Rate', value: `${globalStats.winRate}%`, color: globalStats.winRate >= 60 ? 'text-nx-green' : 'text-nx-orange' },
          { label: 'Target Hit', value: `${globalStats.targetHitRate}%`, color: globalStats.targetHitRate >= 50 ? 'text-nx-green' : 'text-nx-orange' },
          { label: 'Total Return', value: `${globalStats.totalReturn > 0 ? '+' : ''}${globalStats.totalReturn}%`, color: globalStats.totalReturn > 0 ? 'text-nx-green' : 'text-nx-red' },
          { label: 'Avg Win', value: `+${globalStats.avgWin}%`, color: 'text-nx-green' },
          { label: 'Avg Loss', value: `${globalStats.avgLoss}%`, color: 'text-nx-red' },
          { label: 'Sharpe', value: globalStats.sharpe, color: globalStats.sharpe >= 1.5 ? 'text-nx-green' : 'text-nx-orange' },
          { label: 'Profit Factor', value: globalStats.profitFactor === Infinity ? '\u221E' : globalStats.profitFactor, color: globalStats.profitFactor >= 2 ? 'text-nx-green' : 'text-nx-orange' },
          { label: 'Max DD', value: `-${globalStats.maxDrawdown}%`, color: 'text-nx-red' },
          { label: 'Avg Hold', value: `${globalStats.avgHoldDays}d`, color: 'text-nx-text-strong' },
        ].map((item, i) => (
          <div key={i} className="p-3 text-center" style={{ borderRight: i < 9 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none' }}>
            <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">{item.label}</div>
            <div className={`text-sm font-bold font-mono tabular-nums mt-1 ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Equity Curve */}
      <div className="nx-card p-4">
        <h4 className="text-sm font-semibold text-nx-text-strong mb-3">Equity Curve ($10,000 starting)</h4>
        <div className="flex items-end gap-0.5 h-28">
          {equityCurve.map((pt, i) => {
            const min = Math.min(...equityCurve.map(p => p.equity))
            const max = Math.max(...equityCurve.map(p => p.equity))
            const range = max - min || 1
            const h = ((pt.equity - min) / range) * 100
            const isUp = pt.pct > 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity glass px-2 py-1 text-2xs text-nx-text-strong whitespace-nowrap z-10 pointer-events-none" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  {pt.ticker} &middot; ${pt.equity.toLocaleString()} &middot; {pt.date}
                </div>
                <div
                  className={`w-full rounded-sm transition-all duration-300 ${isUp ? 'bg-nx-green/50 hover:bg-nx-green' : 'bg-nx-red/50 hover:bg-nx-red'}`}
                  style={{ height: `${Math.max(4, h)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-2xs text-nx-text-hint">
          <span>Jan 2026</span>
          <span>Current: ${equityCurve.length ? equityCurve[equityCurve.length - 1].equity.toLocaleString() : '10,000'}</span>
          <span>Mar 2026</span>
        </div>
      </div>

      {/* Strategy Breakdown */}
      {stratEntries.length > 0 && (
        <div className="nx-card p-4">
          <h4 className="text-sm font-semibold text-nx-text-strong mb-3">Strategy Breakdown</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {stratEntries.map(([strat, data]) => {
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
      )}

      {/* Calendar Month Log */}
      <div>
        <div className="nx-section-header mb-4">
          <div className="nx-accent-bar" />
          <h3>Trade Log by Month</h3>
        </div>

        {sortedMonths.map(monthLabel => (
          <MonthSection
            key={monthLabel}
            monthLabel={monthLabel}
            trades={filteredMonths[monthLabel]}
            expandedId={expandedId}
            onToggle={toggleTrade}
          />
        ))}

        {sortedMonths.length === 0 && (
          <div className="text-center py-12 text-nx-text-muted">
            No trades match the selected filter.
          </div>
        )}
      </div>
    </div>
  )
}
