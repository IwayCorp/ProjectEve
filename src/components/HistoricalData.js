'use client'
import { useState, useMemo } from 'react'
import { generateHistoricalTrades, computeStats, groupTradesByMonth, groupTradesByDate } from '@/lib/predictions'
import { STRATEGIES } from '@/lib/tradeIdeas'

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

// ── Calendar Heatmap ──
// Shows a month as a grid of day cells, each colored by that day's P&L
function CalendarHeatmap({ year, month, tradesByDate, selectedDate, onSelectDate }) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = firstDay.getDay() // 0=Sun

  const monthName = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Build cells: leading blanks + actual days
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null) // blank
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const trades = tradesByDate[dateStr] || []
    const pnl = trades.reduce((s, t) => s + t.returnPct, 0)
    cells.push({ day: d, dateStr, trades, pnl })
  }

  function getHeatColor(pnl, hasTrades) {
    if (!hasTrades) return 'rgba(255,255,255,0.015)'
    if (pnl > 8) return 'rgba(52, 211, 153, 0.35)'
    if (pnl > 5) return 'rgba(52, 211, 153, 0.25)'
    if (pnl > 2) return 'rgba(52, 211, 153, 0.15)'
    if (pnl > 0) return 'rgba(52, 211, 153, 0.08)'
    if (pnl > -2) return 'rgba(248, 113, 113, 0.08)'
    if (pnl > -5) return 'rgba(248, 113, 113, 0.15)'
    return 'rgba(248, 113, 113, 0.25)'
  }

  function getHeatBorder(pnl, hasTrades) {
    if (!hasTrades) return 'rgba(255,255,255,0.04)'
    if (pnl > 0) return 'rgba(52, 211, 153, 0.2)'
    return 'rgba(248, 113, 113, 0.2)'
  }

  return (
    <div className="nx-card p-4">
      <h4 className="text-sm font-bold text-nx-text-strong mb-3">{monthName}</h4>
      {/* DOW header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-2xs text-nx-text-hint font-medium py-1">{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />
          const hasTrades = cell.trades.length > 0
          const isSelected = selectedDate === cell.dateStr
          return (
            <button
              key={cell.dateStr}
              onClick={() => hasTrades && onSelectDate(isSelected ? null : cell.dateStr)}
              className={`relative rounded-lg p-1.5 text-center transition-all duration-200 min-h-[52px] flex flex-col items-center justify-center ${
                hasTrades ? 'cursor-pointer hover:scale-[1.05]' : 'cursor-default opacity-40'
              } ${isSelected ? 'ring-2 ring-nx-accent/50 scale-[1.05]' : ''}`}
              style={{
                background: getHeatColor(cell.pnl, hasTrades),
                border: `1px solid ${isSelected ? 'rgba(91,141,238,0.4)' : getHeatBorder(cell.pnl, hasTrades)}`,
              }}
              aria-label={hasTrades ? `${cell.dateStr}: ${cell.trades.length} signal${cell.trades.length > 1 ? 's' : ''}, ${cell.pnl > 0 ? '+' : ''}${Math.round(cell.pnl * 100) / 100}%` : `${cell.dateStr}: no signals`}
            >
              <span className="text-2xs font-medium text-nx-text-muted">{cell.day}</span>
              {hasTrades && (
                <>
                  <span className={`text-2xs font-bold font-mono ${cell.pnl > 0 ? 'text-nx-green' : 'text-nx-red'}`}>
                    {cell.pnl > 0 ? '+' : ''}{Math.round(cell.pnl * 100) / 100}%
                  </span>
                  <div className="flex gap-0.5 mt-0.5">
                    {cell.trades.map((t, j) => (
                      <div key={j} className={`w-1 h-1 rounded-full ${t.returnPct > 0 ? 'bg-nx-green' : 'bg-nx-red'}`} />
                    ))}
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Expanded Day Detail ──
// Shows when user clicks a day in the heatmap
function DayDetail({ dateStr, trades, expandedId, onToggle }) {
  const d = new Date(dateStr + 'T12:00:00')
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const dayPnl = trades.reduce((sum, t) => sum + t.returnPct, 0)
  const dayWins = trades.filter(t => t.returnPct > 0).length

  return (
    <div className="nx-card p-4 animate-fade-in" style={{ borderColor: 'rgba(91, 141, 238, 0.15)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-bold text-nx-text-strong">{dayLabel}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xs text-nx-text-muted">{trades.length} signal{trades.length > 1 ? 's' : ''}</span>
            <span className="text-2xs text-nx-text-hint">{dayWins}W / {trades.length - dayWins}L</span>
          </div>
        </div>
        <div className={`text-lg font-bold font-mono ${dayPnl > 0 ? 'text-nx-green' : 'text-nx-red'}`}>
          {dayPnl > 0 ? '+' : ''}{Math.round(dayPnl * 100) / 100}%
        </div>
      </div>
      <div className="space-y-2">
        {trades.map(trade => (
          <div
            key={trade.id}
            className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${expandedId === trade.id ? 'border-nx-accent/20' : ''}`}
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
            onClick={() => onToggle(trade.id)}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-nx-text-strong w-16">{trade.ticker}</span>
              <span className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${trade.direction === 'long' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
                {trade.direction}
              </span>
              <span className={`text-2xs px-2 py-0.5 rounded-md font-semibold strat-${trade.strategy}`}>
                {STRATEGIES[trade.strategy]?.icon} {trade.strategy?.replace('-', ' ')}
              </span>
              <OutcomeBadge outcome={trade.outcome} />
              <span className="text-2xs text-nx-text-hint hidden md:inline">{trade.holdDays}d hold</span>
              <div className="ml-auto">
                <span className={`text-sm font-bold font-mono ${trade.returnPct > 0 ? 'text-nx-green' : 'text-nx-red'}`}>
                  {trade.returnPct > 0 ? '+' : ''}{trade.returnPct}%
                </span>
              </div>
            </div>
            {expandedId === trade.id && (
              <div className="mt-3 pt-3 border-t border-nx-border space-y-2 animate-fade-in">
                <p className="text-sm text-nx-text leading-relaxed">{trade.thesis}</p>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  {[
                    { label: 'Entry', value: trade.entry, cls: 'text-nx-accent' },
                    { label: 'Target', value: trade.target, cls: 'text-nx-green' },
                    { label: 'Stop', value: trade.stop, cls: 'text-nx-red' },
                    { label: 'Exit Price', value: trade.exitPrice, cls: trade.returnPct > 0 ? 'text-nx-green' : 'text-nx-red' },
                    { label: 'R:R', value: `${trade.rr}:1`, cls: trade.rr >= 2 ? 'text-nx-green' : 'text-nx-orange' },
                    { label: 'Held', value: `${trade.entryDate} \u2192 ${trade.exitDate}`, cls: 'text-nx-text' },
                  ].map((item, i) => (
                    <div key={i} className="bg-nx-void/40 rounded-lg p-2">
                      <div className="text-2xs text-nx-text-muted">{item.label}</div>
                      <div className={`text-sm font-mono ${item.cls}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HistoricalData() {
  const allTrades = useMemo(() => generateHistoricalTrades(), [])
  const globalStats = useMemo(() => computeStats(allTrades), [allTrades])
  const monthGroups = useMemo(() => groupTradesByMonth(allTrades), [allTrades])
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [selectedDate, setSelectedDate] = useState(null)

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

  // Build calendar month data from filtered trades
  const calendarMonths = useMemo(() => {
    const byDate = groupTradesByDate(filteredTrades)
    // Determine unique year-month combos
    const monthSet = new Set()
    filteredTrades.forEach(t => {
      const d = new Date(t.entryDate)
      monthSet.add(`${d.getFullYear()}-${d.getMonth()}`)
    })
    // Sort newest first
    return [...monthSet]
      .map(key => {
        const [y, m] = key.split('-').map(Number)
        return { year: y, month: m, tradesByDate: byDate }
      })
      .sort((a, b) => b.year - a.year || b.month - a.month)
  }, [filteredTrades])

  // Strategy breakdown from global stats
  const stratEntries = Object.entries(globalStats.byStrategy || {})

  return (
    <div className="space-y-5">
      {/* Backtest Disclaimer */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.06), rgba(248, 113, 113, 0.04))',
        border: '1px solid rgba(251, 191, 36, 0.12)',
      }}>
        <span className="text-lg">&#9888;</span>
        <div>
          <span className="text-xs font-bold text-nx-orange">BACKTESTED RESULTS</span>
          <span className="text-2xs text-nx-text-muted ml-2">
            These are simulated signals from the Noctis strategy engine applied to historical market data. They are <strong className="text-nx-text">not</strong> real executed trades and do not represent actual P&amp;L. Past backtest performance does not guarantee future results.
          </span>
        </div>
      </div>

      {/* Performance Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Backtest Performance</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">
            {allTrades.length} simulated signals across {sortedMonths.length} months of historical data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'wins', 'losses', 'targets', 'stopped'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-label={`Filter by ${f}`}
              aria-pressed={filter === f}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-0 rounded-xl overflow-hidden" style={{ background: 'rgba(15, 21, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
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
        <h4 className="text-sm font-semibold text-nx-text-strong mb-3">Simulated Equity Curve ($10,000 hypothetical starting capital)</h4>
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
          <span>{equityCurve.length ? equityCurve[0].date : ''}</span>
          <span>Current: ${equityCurve.length ? equityCurve[equityCurve.length - 1].equity.toLocaleString() : '10,000'}</span>
          <span>{equityCurve.length ? equityCurve[equityCurve.length - 1].date : ''}</span>
        </div>
      </div>

      {/* Strategy Breakdown */}
      {stratEntries.length > 0 && (
        <div className="nx-card p-4">
          <h4 className="text-sm font-semibold text-nx-text-strong mb-3">Strategy Breakdown (Backtested)</h4>
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

      {/* Calendar Heatmap Log */}
      <div>
        <div className="nx-section-header mb-4">
          <div className="nx-accent-bar" />
          <h3>Signal Calendar</h3>
        </div>

        {/* Heatmap legend */}
        <div className="flex items-center gap-3 mb-4 ml-1 text-2xs text-nx-text-muted">
          <span>Loss</span>
          <div className="flex gap-0.5">
            {[
              'rgba(248, 113, 113, 0.25)',
              'rgba(248, 113, 113, 0.15)',
              'rgba(248, 113, 113, 0.08)',
              'rgba(255,255,255,0.015)',
              'rgba(52, 211, 153, 0.08)',
              'rgba(52, 211, 153, 0.15)',
              'rgba(52, 211, 153, 0.25)',
              'rgba(52, 211, 153, 0.35)',
            ].map((c, i) => (
              <div key={i} className="w-4 h-3 rounded-sm" style={{ background: c, border: '1px solid rgba(255,255,255,0.06)' }} />
            ))}
          </div>
          <span>Gain</span>
          <span className="ml-2 text-nx-text-hint">Click a day to see details</span>
        </div>

        {/* Render calendar grids per month */}
        <div className="space-y-4">
          {calendarMonths.map(cm => (
            <div key={`${cm.year}-${cm.month}`}>
              <CalendarHeatmap
                year={cm.year}
                month={cm.month}
                tradesByDate={cm.tradesByDate}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
              {/* If a date in this month is selected, show detail below */}
              {selectedDate && cm.tradesByDate[selectedDate] && (
                <div className="mt-2">
                  <DayDetail
                    dateStr={selectedDate}
                    trades={cm.tradesByDate[selectedDate]}
                    expandedId={expandedId}
                    onToggle={toggleTrade}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredTrades.length === 0 && (
          <div className="text-center py-12 text-nx-text-muted">
            No signals match the selected filter.
          </div>
        )}
      </div>
    </div>
  )
}
