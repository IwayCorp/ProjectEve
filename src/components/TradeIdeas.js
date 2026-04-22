'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { calcRR, isInEntryZone, checkAlerts, getTradeUrgency, formatCountdown } from '@/lib/tradeIdeas'
import { formatPrice } from '@/lib/marketData'
import { catalogSignal, updateTradeOutcomes, loadTradeHistory, calcHistoryStats } from '@/lib/tradeHistory'
import { initAdaptiveEngine, scoreSignalQuality, getPerformanceReport, getStrategyRecommendation } from '@/lib/adaptiveEngine'
import { Term, TermText } from './Tooltip'
import TradePacket from './TradePacket'

// ── Constants ──

const STRATEGIES = {
  'momentum': { icon: '\u26A1', name: 'Momentum' },
  'mean-reversion': { icon: '\u21A9', name: 'Mean Reversion' },
  'breakout': { icon: '\uD83D\uDD3A', name: 'Breakout' },
  'carry': { icon: '\uD83D\uDCB0', name: 'Carry' },
  'macro': { icon: '\uD83C\uDF0D', name: 'Macro' },
  'relative-value': { icon: '\u2696', name: 'Relative Value' },
}

const URGENCY_CONFIG = {
  closing: { label: 'CLOSING', color: '#f87171', bg: 'rgba(248, 113, 113, 0.10)', border: 'rgba(248, 113, 113, 0.25)', pulse: true },
  urgent:  { label: 'URGENT', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.20)', pulse: true },
  active:  { label: 'ACTIVE', color: '#34d399', bg: 'rgba(52, 211, 153, 0.06)', border: 'rgba(52, 211, 153, 0.15)', pulse: false },
  expired: { label: 'EXPIRED', color: '#64748b', bg: 'rgba(100, 116, 139, 0.06)', border: 'rgba(100, 116, 139, 0.15)', pulse: false },
}

const TICKER_MAP = {
  'USDJPY': 'JPY=X', 'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDCHF': 'CHF=X',
  'AUDUSD': 'AUDUSD=X', 'USDMXN': 'MXN=X', 'EURGBP': 'EURGBP=X', 'NZDUSD': 'NZDUSD=X',
}

const SIGNAL_REFRESH_INTERVAL = 20 * 60 * 1000

const TIMELINE_TABS = [
  { id: 'scalp', label: 'Scalp/Day', icon: '\u23F1', desc: '4-24h signals' },
  { id: 'swing', label: 'Swing', icon: '\uD83C\uDF0A', desc: '1-5 day lifecycle' },
  { id: 'position', label: 'Position', icon: '\uD83D\uDCCA', desc: '1-4 week holds' },
  { id: 'macro', label: 'Macro', icon: '\uD83C\uDF10', desc: 'Regime shifts' },
]

const DIRECTION_TABS = ['long', 'short', 'forex']

const GRADE_CONFIG = {
  A: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', label: 'A' },
  B: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)', label: 'B' },
  C: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', label: 'C' },
  D: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)', label: 'D' },
}

const TIMELINE_BADGE_CONFIG = {
  scalp: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.20)', icon: '\u23F1' },
  swing: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.20)', icon: '\uD83C\uDF0A' },
  position: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.10)', border: 'rgba(139, 92, 246, 0.20)', icon: '\uD83D\uDCCA' },
  macro: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.10)', border: 'rgba(6, 182, 212, 0.20)', icon: '\uD83C\uDF10' },
}

// ── Timeframe Classification ──

function classifyTimeframe(signal) {
  if (!signal) return 'swing'

  const strategy = (signal.strategy || '').toLowerCase()
  const timeframe = (signal.timeframe || '').toLowerCase()
  const atrPct = signal.atrPercentile ?? 50

  // Macro signals: macro strategy, regime-based signals, correlation anomalies
  if (strategy === 'macro' || strategy === 'relative-value') return 'macro'
  if (signal.regimeAnalysis?.regimeShift) return 'macro'
  if (signal.correlationAnomaly) return 'macro'

  // Scalp/Day: tight timeframes with high ATR percentile
  if (timeframe.includes('hour') || timeframe.includes('4h') || timeframe.includes('8h')) return 'scalp'
  if (timeframe === '1 day' || timeframe === 'intraday') return 'scalp'
  if (timeframe.includes('1-3 day') && atrPct > 60 && signal.entryBy) {
    const entryByMs = new Date(signal.entryBy).getTime() - Date.now()
    if (entryByMs > 0 && entryByMs < 24 * 60 * 60 * 1000) return 'scalp'
  }

  // Position: 1-2+ week timeframes
  // Matches: '10-21 days', 'week', '1-2 week', '2-4 week', '1 month'
  if (timeframe.includes('10-21') || timeframe.includes('14-') || timeframe.includes('week') || timeframe.includes('month')) return 'position'

  // Swing: default bucket - 1-7 day trades (Matt's primary focus)
  return 'swing'
}

// ── Adaptive Signal Enrichment ──

function enrichSignalWithAdaptive(signal) {
  const quality = scoreSignalQuality(signal)
  return {
    ...signal,
    _timeline: classifyTimeframe(signal),
    _quality: quality,
    _adaptiveConfidence: quality.pass
      ? Math.round(Math.min(99, (signal.confidence || 50) * (1 + quality.expectedValue * 2)))
      : Math.round(Math.max(20, (signal.confidence || 50) * 0.7)),
    _expectedValue: quality.expectedValue,
    _strategyRecord: {
      winRate: quality.winRate,
      avgWin: quality.avgWin,
      avgLoss: quality.avgLoss,
    },
  }
}

// ── Sorting Logic ──

const GRADE_ORDER = { A: 0, B: 1, C: 2, D: 3 }

function sortSignals(signals) {
  return [...signals].sort((a, b) => {
    // 1. Quality grade (A first)
    const gradeA = GRADE_ORDER[a._quality?.grade] ?? 2
    const gradeB = GRADE_ORDER[b._quality?.grade] ?? 2
    if (gradeA !== gradeB) return gradeA - gradeB

    // 2. Adaptive confidence (highest first)
    const confA = a._adaptiveConfidence ?? 50
    const confB = b._adaptiveConfidence ?? 50
    if (confA !== confB) return confB - confA

    // 3. Expected value (highest first)
    const evA = a._expectedValue ?? 0
    const evB = b._expectedValue ?? 0
    return evB - evA
  })
}

// ── Sparkline Component ──

function MiniSparkline({ values, width = 48, height = 16 }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  const trend = values[values.length - 1] > values[0]
  const color = trend ? '#34d399' : '#f87171'
  return (
    <svg width={width} height={height} className="inline-block ml-1">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Quality Grade Badge ──

function QualityBadge({ quality, isLearning }) {
  if (!quality) return null
  const grade = quality.grade || 'C'
  const config = GRADE_CONFIG[grade]
  const evPer1000 = (quality.expectedValue * 1000).toFixed(1)
  const winPct = (quality.winRate * 100).toFixed(0)
  const tooltipText = isLearning
    ? 'Learning mode -- collecting data for grading'
    : `EV: +$${evPer1000} per $1000 risked | Win rate: ${winPct}%`

  return (
    <span
      className="text-2xs px-1.5 py-0.5 rounded-md font-bold"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
      title={tooltipText}
    >
      {isLearning ? `${config.label}*` : config.label}
    </span>
  )
}

// ── Timeline Badge ──

function TimelineBadge({ timeline }) {
  const config = TIMELINE_BADGE_CONFIG[timeline] || TIMELINE_BADGE_CONFIG.swing
  const label = TIMELINE_TABS.find(t => t.id === timeline)?.label || 'Swing'
  return (
    <span
      className="text-2xs px-1.5 py-0.5 rounded-md font-semibold"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      {config.icon} {label}
    </span>
  )
}

// ── Trade Card ──

function TradeCard({ trade, quote, direction, onOpen, isLearning }) {
  const price = quote?.regularMarketPrice
  const inZone = price ? isInEntryZone(price, trade.entryLow, trade.entryHigh) : false
  const midEntry = (trade.entryLow + trade.entryHigh) / 2
  const rr = calcRR(midEntry, trade.target, trade.stopLoss, direction)
  const isUp = quote?.regularMarketChangePercent >= 0
  const alert = price ? checkAlerts(price, trade.target, trade.stopLoss, direction) : null
  const fmtType = trade.asset === 'forex' ? 'forex' : 'stock'

  const urgency = getTradeUrgency(trade)
  const uc = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.active
  const countdown = formatCountdown(trade.entryBy)
  const expiresCountdown = formatCountdown(trade.expiresAt)
  const isExpired = urgency === 'expired'

  const quality = trade._quality
  const grade = quality?.grade || 'C'
  const isDGrade = grade === 'D'
  const adaptiveConf = trade._adaptiveConfidence
  const ev = trade._expectedValue
  const stratRecord = trade._strategyRecord

  const evDisplay = ev != null ? (ev * 1000).toFixed(1) : null
  const regime = trade.regimeAnalysis?.currentRegime || 'unknown'
  const stratName = STRATEGIES[trade.strategy]?.name || trade.strategy?.replace('-', ' ') || 'Unknown'
  const winCount = stratRecord ? Math.round(stratRecord.winRate * 25) : null
  const totalCount = 25

  return (
    <div
      onClick={() => onOpen(trade, direction)}
      className={`nx-card p-4 cursor-pointer group transition-all duration-300 ${
        isExpired ? 'opacity-50' :
        isDGrade ? 'opacity-60' :
        alert === 'TARGET_HIT' ? 'glow-green border-nx-green/20' : alert === 'STOP_HIT' ? 'glow-red border-nx-red/20' : ''
      } hover:border-nx-accent/20`}
    >
      {/* Urgency + Expiration header bar */}
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-nx-border/30">
        <div className="flex items-center gap-2">
          <span
            className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${uc.pulse ? 'animate-pulse-gentle' : ''}`}
            style={{ background: uc.bg, color: uc.color, border: `1px solid ${uc.border}` }}
          >
            {uc.label}
          </span>
          {countdown && !isExpired && (
            <span className="text-2xs font-mono font-semibold" style={{ color: uc.color }}>
              Entry by: {countdown}
            </span>
          )}
          {isExpired && (
            <span className="text-2xs font-mono text-nx-text-hint">Cataloged as executed</span>
          )}
        </div>
        {expiresCountdown && !isExpired && (
          <span className="text-2xs text-nx-text-hint font-mono">
            Expires: {expiresCountdown}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-nx-text-strong group-hover:text-nx-accent transition-colors">{trade.ticker}</span>
            <span className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${direction === 'long' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
              <Term>{direction === 'long' ? 'Long' : 'Short'}</Term>
            </span>
            <span className={`text-2xs px-2 py-0.5 rounded-md font-semibold ${trade.strategy ? `strat-${trade.strategy}` : ''}`}>
              {STRATEGIES[trade.strategy]?.icon} <Term>{STRATEGIES[trade.strategy]?.name || trade.strategy?.replace('-', ' ')}</Term>
            </span>
            {inZone && !isExpired && <span className="badge-blue animate-pulse-gentle text-2xs">IN ZONE</span>}
            {alert === 'TARGET_HIT' && <span className="badge-green animate-pulse-gentle text-2xs">TARGET</span>}
            {alert === 'STOP_HIT' && <span className="badge-red animate-pulse-gentle text-2xs">STOP</span>}
          </div>
          {/* Badge row: AI, Timeline, Quality Grade */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {trade.regimeAnalysis && (
              <span className="text-2xs px-1.5 py-0.5 rounded-md font-medium bg-purple-500/10 text-purple-400 border border-purple-500/15" title={`HMM: ${trade.regimeAnalysis.currentRegime}`}>AI</span>
            )}
            <TimelineBadge timeline={trade._timeline} />
            <QualityBadge quality={quality} isLearning={isLearning} />
            {trade.ensemble?.conflictDetected && <span className="text-2xs px-1.5 py-0.5 rounded-md font-medium bg-nx-red-muted text-nx-red border border-nx-red/15" title="Strategy conflict detected">{'\u26A0'}</span>}
          </div>
          <span className="text-xs text-nx-text-muted mt-0.5 block">{trade.name}</span>
        </div>
        <div className="text-right">
          {price ? (
            <div className={`text-lg font-bold font-mono tabular-nums ${isUp ? 'text-nx-green' : 'text-nx-red'}`}>
              {formatPrice(price, fmtType)}
            </div>
          ) : (
            <div className="text-sm text-nx-text-muted">--</div>
          )}
          <span className={`text-2xs px-2 py-0.5 rounded-md font-bold ${
            trade.risk === 'HIGH' ? 'bg-nx-red-muted text-nx-red border border-nx-red/15' : trade.risk === 'LOW' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-orange-muted text-nx-orange border border-nx-orange/15'
          }`}>
            {trade.risk}
          </span>
        </div>
      </div>

      {/* Entry window guidance */}
      {trade.entryWindow && !isExpired && (
        <div className="flex items-start gap-2 mb-3 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(91, 141, 238, 0.04)', border: '1px solid rgba(91, 141, 238, 0.08)' }}>
          <span className="text-xs shrink-0 mt-px">{'\u23F1'}</span>
          <span className="text-2xs text-nx-accent leading-relaxed">{trade.entryWindow}</span>
        </div>
      )}

      {/* Price bar */}
      <div className="bg-nx-void/60 rounded-lg p-2.5 mb-3 border border-nx-border/30">
        <div className="flex justify-between text-2xs mb-1.5">
          <span className="text-nx-red font-medium"><Term>Stop Loss</Term> {formatPrice(trade.stopLoss, fmtType)}</span>
          <span className="text-nx-accent font-medium"><Term>Entry Zone</Term> {formatPrice(trade.entryLow, fmtType)}{'\u2013'}{formatPrice(trade.entryHigh, fmtType)}</span>
          <span className="text-nx-green font-medium"><Term>Target</Term> {formatPrice(trade.target, fmtType)}</span>
        </div>
        {price && (
          <div className="relative h-1.5 bg-nx-border/30 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full rounded-full w-full" style={{ background: 'linear-gradient(90deg, rgba(248,113,113,0.15), rgba(91,141,238,0.15), rgba(52,211,153,0.15))' }} />
            {(() => {
              const min = direction === 'long' ? trade.stopLoss * 0.98 : trade.target * 0.98
              const max = direction === 'long' ? trade.target * 1.02 : trade.stopLoss * 1.02
              const pct = Math.min(100, Math.max(0, ((price - min) / (max - min)) * 100))
              return (
                <div
                  className="absolute top-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg"
                  style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 8px rgba(255,255,255,0.3)' }}
                />
              )
            })()}
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-nx-text-muted"><Term>Risk:Reward</Term></span>
          <span className={`text-sm font-bold font-mono ${parseFloat(rr) >= 2 ? 'text-nx-green' : 'text-nx-orange'}`}>1:{rr}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-nx-text-muted"><Term>RSI</Term></span>
          <span className={`text-sm font-bold font-mono ${trade.rsi < 30 ? 'text-nx-green' : trade.rsi > 70 ? 'text-nx-red' : 'text-nx-orange'}`}>{trade.rsi}</span>
        </div>
        {adaptiveConf != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Adj Conf</span>
            <span className={`text-sm font-bold font-mono ${adaptiveConf >= 65 ? 'text-nx-green' : adaptiveConf >= 50 ? 'text-nx-orange' : 'text-nx-red'}`}>{adaptiveConf}%</span>
          </div>
        )}
        {evDisplay != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">EV</span>
            <span className={`text-2xs font-bold font-mono ${parseFloat(evDisplay) >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
              {parseFloat(evDisplay) >= 0 ? '+' : ''}${evDisplay}/1k
            </span>
          </div>
        )}
        <div className="ml-auto text-right shrink-0">
          <div className="text-2xs font-semibold text-nx-accent">{trade.timeframe || 'Variable'}</div>
        </div>
      </div>

      {/* Strategy track record */}
      {stratRecord && stratRecord.winRate > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-2xs text-nx-text-hint">
            {stratName} in {regime.replace('trending-', '').replace('volatile-', '').replace('-', ' ')}: {(stratRecord.winRate * 100).toFixed(0)}% win rate
            {winCount != null ? ` (${winCount}/${totalCount})` : ''}
          </span>
        </div>
      )}

      <p className="text-xs text-nx-text-muted leading-relaxed mb-2 line-clamp-2"><TermText>{trade.thesis}</TermText></p>
      <div className="flex items-center justify-between">
        <div className="text-2xs text-nx-purple truncate max-w-[80%]">{trade.catalyst}</div>
        <span className="text-2xs text-nx-accent opacity-0 group-hover:opacity-100 transition-opacity font-medium">View Packet &rarr;</span>
      </div>
    </div>
  )
}

// ── Enhanced Stats Bar ──

function HistoryStatsBar({ stats, timelineCounts, activeTimeline, perfReport }) {
  if (stats.total === 0 && (!perfReport || !perfReport.summary)) return null

  const isLearning = perfReport?.summary?.isLearningMode
  const learningPct = perfReport?.summary?.learningProgress
    ? Math.round(perfReport.summary.learningProgress * 100)
    : 0

  // Build a simple sparkline from recent win/loss data if available
  const recentValues = useMemo(() => {
    if (!perfReport?.metrics?.overall?.allTime) return null
    const wr = perfReport.metrics.overall
    const vals = []
    if (wr.last20?.winRate != null) vals.push(wr.last20.winRate)
    if (wr.last50?.winRate != null) vals.push(wr.last50.winRate)
    if (wr.last100?.winRate != null) vals.push(wr.last100.winRate)
    if (wr.allTime?.winRate != null) vals.push(wr.allTime.winRate)
    return vals.length >= 2 ? vals.reverse() : null
  }, [perfReport])

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl border border-nx-border/30 flex-wrap" style={{ background: 'var(--card-bg)' }}>
      {isLearning && (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Adaptive</span>
            <span className="text-2xs font-bold font-mono text-amber-400">Learning {learningPct}%</span>
          </div>
          <div className="w-px h-4 bg-nx-border/30" />
        </>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-2xs text-nx-text-muted">Tracked</span>
        <span className="text-sm font-bold font-mono text-nx-text-strong">{stats.total}</span>
      </div>
      {stats.resolved > 0 && (
        <>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted"><Term>Win Rate</Term></span>
            <span className={`text-sm font-bold font-mono ${stats.winRate >= 50 ? 'text-nx-green' : 'text-nx-red'}`}>
              {stats.winRate.toFixed(0)}%
            </span>
            {recentValues && <MiniSparkline values={recentValues} />}
          </div>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">W/L</span>
            <span className="text-sm font-bold font-mono">
              <span className="text-nx-green">{stats.wins}</span>
              <span className="text-nx-text-hint">/</span>
              <span className="text-nx-red">{stats.losses}</span>
            </span>
          </div>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Avg <Term>P/L</Term></span>
            <span className={`text-sm font-bold font-mono ${stats.avgPnl >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
              {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(1)}%
            </span>
          </div>
        </>
      )}
      {stats.open > 0 && (
        <>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Open</span>
            <span className="text-sm font-bold font-mono text-nx-accent">{stats.open}</span>
          </div>
        </>
      )}
      {stats.currentStreak > 1 && (
        <>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-nx-text-muted">Streak</span>
            <span className={`text-sm font-bold font-mono ${stats.streakType === 'win' ? 'text-nx-green' : 'text-nx-red'}`}>
              {stats.currentStreak} {stats.streakType === 'win' ? 'W' : 'L'}
            </span>
          </div>
        </>
      )}
      {/* Per-timeline active counts */}
      {timelineCounts && (
        <>
          <div className="w-px h-4 bg-nx-border/30" />
          <div className="flex items-center gap-2">
            {TIMELINE_TABS.map(t => (
              <span key={t.id} className={`text-2xs font-mono ${activeTimeline === t.id ? 'text-nx-accent font-bold' : 'text-nx-text-hint'}`}>
                {t.icon}{timelineCounts[t.id] || 0}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Component ──

export default function TradeIdeas({ quotes }) {
  const [activeTimeline, setActiveTimeline] = useState('swing')
  const [directionTab, setDirectionTab] = useState('long')
  const [selectedStrategy, setSelectedStrategy] = useState('all')
  const [openPacket, setOpenPacket] = useState(null)
  const [showExpired, setShowExpired] = useState(false)
  const [, setTick] = useState(0)

  // Signal engine state
  const [signals, setSignals] = useState({ long: [], short: [], forex: [] })
  const [enrichedSignals, setEnrichedSignals] = useState({ long: [], short: [], forex: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastGenerated, setLastGenerated] = useState(null)
  const [nextRefresh, setNextRefresh] = useState(null)
  const [historyStats, setHistoryStats] = useState({ total: 0, resolved: 0, open: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, avgPnl: 0, currentStreak: 0, streakType: null })

  // Adaptive engine state
  const [adaptiveReady, setAdaptiveReady] = useState(false)
  const [isLearningMode, setIsLearningMode] = useState(true)
  const [perfReport, setPerfReport] = useState(null)

  const catalogedRef = useRef(new Set())
  const quotesRef = useRef(quotes)
  quotesRef.current = quotes

  // Initialize adaptive engine on mount
  useEffect(() => {
    try {
      const result = initAdaptiveEngine()
      setAdaptiveReady(true)
      setIsLearningMode(result.isLearningMode)
      const report = getPerformanceReport()
      setPerfReport(report)
    } catch (err) {
      console.warn('Adaptive engine init error:', err)
      setAdaptiveReady(true)
      setIsLearningMode(true)
    }
  }, [])

  // Countdown ticker
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Enrich signals with adaptive scoring whenever signals or adaptive state changes
  useEffect(() => {
    if (!adaptiveReady) return
    const enriched = { long: [], short: [], forex: [], macro: [] }
    for (const category of ['long', 'short', 'forex', 'macro']) {
      enriched[category] = (signals[category] || []).map(s => enrichSignalWithAdaptive(s))
    }
    setEnrichedSignals(enriched)

    // Update perf report
    try {
      const report = getPerformanceReport()
      setPerfReport(report)
      setIsLearningMode(report.summary?.isLearningMode ?? true)
    } catch (e) {
      // non-fatal
    }
  }, [signals, adaptiveReady])

  // Fetch signals from real signal engine, with localStorage caching
  const fetchSignals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/signals?category=all')
      if (!res.ok) throw new Error(`Signal engine error: ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Load cached signals from localStorage
      let cachedSignals = { long: [], short: [], forex: [], macro: [] }
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('noctis-signal-cache')
          if (cached) {
            const parsed = JSON.parse(cached)
            cachedSignals = { long: parsed.long || [], short: parsed.short || [], forex: parsed.forex || [], macro: parsed.macro || [] }
          }
        }
      } catch (e) {
        console.warn('Error reading signal cache:', e)
      }

      // Merge new signals with cached ones
      const mergedSignals = { long: [], short: [], forex: [], macro: [] }
      const now = new Date().getTime()

      const isExpired = (signal) => {
        const expiresAt = new Date(signal.expiresAt).getTime()
        return expiresAt <= now
      }

      const findCached = (newSignal, category) => {
        return cachedSignals[category].find(
          cached => cached.ticker === newSignal.ticker && cached.direction === newSignal.direction
        )
      }

      for (const category of ['long', 'short', 'forex', 'macro']) {
        const newSignals = (data.signals?.[category] || []).filter(s => s != null)

        for (const newSignal of newSignals) {
          const cached = findCached(newSignal, category)
          if (cached && !isExpired(cached)) {
            mergedSignals[category].push(cached)
          } else {
            mergedSignals[category].push(newSignal)
          }
        }

        for (const cached of cachedSignals[category]) {
          const stillInNew = newSignals.some(
            ns => ns.ticker === cached.ticker && ns.direction === cached.direction
          )
          if (!stillInNew) {
            mergedSignals[category].push(cached)
          }
        }
      }

      // Save merged signals back to localStorage
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('noctis-signal-cache', JSON.stringify(mergedSignals))
        }
      } catch (e) {
        console.warn('Error saving signal cache:', e)
      }

      setSignals(mergedSignals)
      setLastGenerated(data.generatedAt || new Date().toISOString())
      setNextRefresh(Date.now() + SIGNAL_REFRESH_INTERVAL)
    } catch (err) {
      console.error('Signal fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => { fetchSignals() }, [fetchSignals])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => { fetchSignals() }, SIGNAL_REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchSignals])

  // Auto-catalog expired signals
  useEffect(() => {
    if (!quotes || Object.keys(quotes).length === 0) return

    const allSignals = [...(signals.long || []), ...(signals.short || []), ...(signals.forex || []), ...(signals.macro || [])]
    let anyCataloged = false

    for (const signal of allSignals) {
      const urgency = getTradeUrgency(signal)
      if (urgency !== 'expired') continue
      if (catalogedRef.current.has(signal.id)) continue

      const direction = signal.direction || (signals.short?.includes(signal) ? 'short' : 'long')
      const sym = TICKER_MAP[signal.ticker] || signal.ticker
      const price = quotes[sym]?.regularMarketPrice || null

      catalogSignal(signal, direction, price)
      catalogedRef.current.add(signal.id)
      anyCataloged = true
    }

    if (anyCataloged) {
      const history = loadTradeHistory()
      setHistoryStats(calcHistoryStats(history))
    }
  }, [signals, quotes])

  // Update trade outcomes on quote refresh
  useEffect(() => {
    if (!quotes || Object.keys(quotes).length === 0) return
    const history = updateTradeOutcomes(quotes)
    setHistoryStats(calcHistoryStats(history))
  }, [quotes])

  // Load initial stats
  useEffect(() => {
    const history = loadTradeHistory()
    setHistoryStats(calcHistoryStats(history))
    for (const t of history) catalogedRef.current.add(t.signalId)
  }, [])

  // ── Compute filtered/sorted signals ──

  const allStrategies = ['all', ...Object.keys(STRATEGIES)]

  // Helper: check if a signal should be visible (respects showExpired toggle)
  const isVisible = useCallback((s) => showExpired || getTradeUrgency(s) !== 'expired', [showExpired])

  // Count signals per direction tab per timeline
  const timelineCounts = useMemo(() => {
    const counts = { scalp: 0, swing: 0, position: 0, macro: 0 }
    for (const category of ['long', 'short', 'forex']) {
      for (const s of enrichedSignals[category] || []) {
        if (!isVisible(s)) continue
        const tl = s._timeline || 'swing'
        if (counts[tl] != null) counts[tl]++
      }
    }
    // Count dedicated macro signals
    for (const s of enrichedSignals.macro || []) {
      if (isVisible(s)) counts.macro++
    }
    return counts
  }, [enrichedSignals, isVisible])

  // Direction counts per timeline
  const directionCounts = useMemo(() => {
    const counts = { long: 0, short: 0, forex: 0 }
    for (const category of DIRECTION_TABS) {
      for (const s of enrichedSignals[category] || []) {
        if (!isVisible(s)) continue
        if ((s._timeline || 'swing') === activeTimeline) {
          counts[category]++
        }
      }
    }
    // For macro timeline, count macro-bucket signals across all directions
    if (activeTimeline === 'macro') {
      for (const s of enrichedSignals.macro || []) {
        if (!isVisible(s)) continue
        const dir = s.direction === 'short' ? 'short' : s.asset === 'forex' ? 'forex' : 'long'
        counts[dir]++
      }
    }
    return counts
  }, [enrichedSignals, activeTimeline, isVisible])

  // Get ideas filtered by timeline + direction + strategy
  const ideas = useMemo(() => {
    let dirSignals = [...(enrichedSignals[directionTab] || [])]

    // For macro timeline, also include signals from the macro bucket
    if (activeTimeline === 'macro') {
      const macroSignals = (enrichedSignals.macro || []).filter(s => {
        const dir = s.direction === 'short' ? 'short' : s.asset === 'forex' ? 'forex' : 'long'
        return dir === directionTab
      })
      // Merge without duplicates (by id)
      const existingIds = new Set(dirSignals.map(s => s.id))
      for (const ms of macroSignals) {
        if (!existingIds.has(ms.id)) {
          dirSignals.push(ms)
        }
      }
    }

    // Filter by timeline
    const timelineFiltered = dirSignals.filter(s => (s._timeline || 'swing') === activeTimeline)
    // Filter by strategy
    const stratFiltered = selectedStrategy === 'all' ? timelineFiltered : timelineFiltered.filter(i => i.strategy === selectedStrategy)
    // Sort by quality grade, adaptive confidence, EV
    return sortSignals(stratFiltered)
  }, [enrichedSignals, directionTab, activeTimeline, selectedStrategy])

  const filtered = showExpired ? ideas : ideas.filter(i => getTradeUrgency(i) !== 'expired')
  const expiredCount = ideas.filter(i => getTradeUrgency(i) === 'expired').length

  const getDirection = (idea) => {
    if (directionTab === 'forex') return idea.direction || 'long'
    if (directionTab === 'short') return idea.direction || 'short'
    return idea.direction || 'long'
  }

  const getQuote = (idea) => {
    const sym = TICKER_MAP[idea.ticker] || idea.ticker
    return quotes[sym]
  }

  const refreshCountdown = nextRefresh ? Math.max(0, Math.ceil((nextRefresh - Date.now()) / 60000)) : null

  return (
    <div className="space-y-5">
      {/* Live signal engine header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: loading ? 'rgba(91, 141, 238, 0.08)' : error ? 'rgba(248, 113, 113, 0.08)' : 'rgba(52, 211, 153, 0.08)', border: `1px solid ${loading ? 'rgba(91, 141, 238, 0.15)' : error ? 'rgba(248, 113, 113, 0.15)' : 'rgba(52, 211, 153, 0.15)'}` }}>
            {loading ? (
              <div className="w-1.5 h-1.5 border border-nx-accent border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-nx-red' : 'bg-nx-green'} animate-pulse`} />
            )}
            <span className={`text-2xs font-semibold ${loading ? 'text-nx-accent' : error ? 'text-nx-red' : 'text-nx-green'}`}>
              {loading ? 'Generating Signals...' : error ? 'Signal Error' : 'Live Signal Engine'}
            </span>
          </div>
          {lastGenerated && !loading && (
            <span className="text-2xs text-nx-text-hint">
              Generated {new Date(lastGenerated).toLocaleTimeString()}
              {refreshCountdown !== null && ` \u00B7 Next in ${refreshCountdown}m`}
            </span>
          )}
        </div>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all duration-200 disabled:opacity-50"
          style={{ background: 'rgba(91, 141, 238, 0.12)', border: '1px solid rgba(91, 141, 238, 0.2)', color: '#5b8dee' }}
        >
          {loading ? 'Running...' : 'Regenerate Signals'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-xs text-nx-red" style={{ background: 'rgba(248, 113, 113, 0.06)', border: '1px solid rgba(248, 113, 113, 0.12)' }}>
          Signal Engine Error: {error}. Retrying may help.
        </div>
      )}

      {/* Enhanced Stats Bar */}
      <HistoryStatsBar
        stats={historyStats}
        timelineCounts={timelineCounts}
        activeTimeline={activeTimeline}
        perfReport={perfReport}
      />

      {/* Level 1: Timeline Tabs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-md font-bold text-nx-text-strong mr-2">Trade Ideas</h3>
          {TIMELINE_TABS.map(t => {
            const count = timelineCounts[t.id] || 0
            const isActive = activeTimeline === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTimeline(t.id); setSelectedStrategy('all') }}
                aria-label={`Show ${t.label} trade ideas`}
                aria-pressed={isActive}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/25 shadow-sm'
                    : 'text-nx-text-muted hover:text-nx-text-strong bg-nx-surface border border-nx-border hover:border-nx-border/60'
                }`}
                title={t.desc}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
                <span className={`ml-1.5 text-2xs font-mono ${isActive ? 'text-nx-accent' : 'text-nx-text-hint'}`}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Level 2: Direction Tabs */}
        <div className="flex items-center gap-2 pl-1">
          {[
            { id: 'long', label: 'LONG', color: 'green' },
            { id: 'short', label: 'SHORT', color: 'red' },
            { id: 'forex', label: 'FOREX', color: 'blue' },
          ].map(t => {
            const count = directionCounts[t.id] || 0
            return (
              <button
                key={t.id}
                onClick={() => { setDirectionTab(t.id); setSelectedStrategy('all') }}
                aria-label={`Show ${t.id} trade ideas`}
                aria-pressed={directionTab === t.id}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                  directionTab === t.id
                    ? t.color === 'green' ? 'bg-nx-green-muted text-nx-green border border-nx-green/20'
                      : t.color === 'red' ? 'bg-nx-red-muted text-nx-red border border-nx-red/20'
                      : 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20'
                    : 'text-nx-text-muted hover:text-nx-text-strong bg-nx-surface border border-nx-border'
                }`}
              >
                {t.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Strategy filter + expired toggle */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="text-xs text-nx-text-muted mr-1 font-medium">Strategy:</span>
        {allStrategies.map(s => (
          <button
            key={s}
            onClick={() => setSelectedStrategy(s)}
            aria-label={`Filter by ${s === 'all' ? 'all strategies' : s.replace('-', ' ')} strategy`}
            aria-pressed={selectedStrategy === s}
            className={`px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 ${
              selectedStrategy === s
                ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20'
                : 'text-nx-text-hint hover:text-nx-text-muted bg-nx-void/40 border border-nx-border'
            }`}
          >
            {s === 'all' ? 'All' : `${STRATEGIES[s]?.icon || ''} ${s.replace('-', ' ')}`}
          </button>
        ))}
        {expiredCount > 0 && (
          <button
            onClick={() => setShowExpired(!showExpired)}
            className={`ml-auto px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 ${
              showExpired
                ? 'bg-nx-surface text-nx-text-muted border border-nx-border'
                : 'text-nx-text-hint hover:text-nx-text-muted bg-nx-void/40 border border-nx-border'
            }`}
          >
            {showExpired ? 'Hide' : 'Show'} Expired ({expiredCount})
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-nx-accent border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-nx-text-muted">Running signal engine across {directionTab === 'forex' ? '8 forex pairs' : directionTab === 'long' ? '12 long candidates' : '12 short candidates'}...</div>
          <div className="text-xs text-nx-text-hint">Analyzing RSI, MACD, Bollinger Bands, Support/Resistance</div>
        </div>
      )}

      {/* Cards grid */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(idea => (
            <TradeCard
              key={idea.id}
              trade={idea}
              quote={getQuote(idea)}
              direction={getDirection(idea)}
              onOpen={(idea, dir) => setOpenPacket({ idea, direction: dir })}
              isLearning={isLearningMode}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-16 text-nx-text-muted">
          <div className="text-lg mb-2">{TIMELINE_TABS.find(t => t.id === activeTimeline)?.icon}</div>
          {expiredCount > 0 ? (
            <>
              All {activeTimeline} trade ideas have expired.
              <div className="text-2xs mt-2 text-nx-text-hint">
                <button onClick={() => setShowExpired(true)} className="text-nx-accent hover:underline mr-3">Show {expiredCount} expired</button>
                or
                <button onClick={fetchSignals} className="text-nx-accent hover:underline ml-3">Refresh signals</button>
              </div>
            </>
          ) : (
            <>
              No {activeTimeline} trade ideas match the selected filters.
              {activeTimeline === 'scalp' && <div className="text-2xs mt-2 text-nx-text-hint">Scalp signals require tight entry windows and high ATR percentile.</div>}
              {activeTimeline === 'macro' && <div className="text-2xs mt-2 text-nx-text-hint">Macro signals are generated from regime shifts and correlation anomalies.</div>}
            </>
          )}
        </div>
      )}

      {openPacket && (
        <TradePacket
          idea={openPacket.idea}
          direction={openPacket.direction}
          currentPrice={getQuote(openPacket.idea)?.regularMarketPrice}
          onClose={() => setOpenPacket(null)}
        />
      )}
    </div>
  )
}
