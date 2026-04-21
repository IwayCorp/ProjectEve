'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Area } from 'recharts'
import { TIMEFRAMES, generatePrediction } from '@/lib/predictions'
import { calcRR, getTradeUrgency, formatCountdown } from '@/lib/tradeIdeas'
import { CHART_AXIS, CHART_YAXIS, CHART_TOOLTIP_STYLE } from '@/lib/chartConfig'
import { Term, TermText } from './Tooltip'

// Map a trade's timeframe string (e.g. "5-14 days") to the best matching TIMEFRAMES id
function getDefaultTimeframe(tradeTimeframe) {
  if (!tradeTimeframe) return '4d'
  const match = tradeTimeframe.match(/(\d+)/)
  if (!match) return '4d'
  const days = parseInt(match[1])
  const rangeMatch = tradeTimeframe.match(/(\d+)\s*-\s*(\d+)/)
  const midDays = rangeMatch ? Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2) : days
  if (midDays <= 1) return '1d'
  if (midDays <= 3) return '4d'
  if (midDays <= 6) return '1w'
  if (midDays <= 12) return '2w'
  if (midDays <= 21) return '2w'
  return '1mo'
}

export default function TradePacket({ idea, direction, onClose, currentPrice }) {
  const [chartData, setChartData] = useState([])
  const [chartRange, setChartRange] = useState('3M')
  const [chartLoading, setChartLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview')
  const [selectedTimeframe, setSelectedTimeframe] = useState(() => getDefaultTimeframe(idea.timeframe))
  const [, setTick] = useState(0) // drives countdown re-renders
  const dp = idea.dataPacket

  // Tick every second for live countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Generate prediction based on selected timeframe
  const prediction = useMemo(() => {
    const tf = TIMEFRAMES.find(t => t.id === selectedTimeframe)
    if (!tf || !currentPrice) return null
    return generatePrediction(currentPrice, idea.target, idea.stopLoss, direction, tf.minutes, idea.rsi, idea.strategy)
  }, [currentPrice, idea.target, idea.stopLoss, direction, selectedTimeframe, idea.rsi, idea.strategy])
  const scrollRef = useRef(null)
  const sectionRefs = useRef({})

  const rangeMap = {
    '1M': { range: '1mo', interval: '1d' },
    '3M': { range: '3mo', interval: '1d' },
    '6M': { range: '6mo', interval: '1d' },
    '1Y': { range: '1y', interval: '1wk' },
  }

  const yahooSymbol = idea.ticker === 'BTC-USD' ? 'BTC-USD'
    : idea.ticker === 'USDJPY' ? 'JPY=X'
    : idea.ticker === 'EURUSD' ? 'EURUSD=X'
    : idea.ticker === 'GBPUSD' ? 'GBPUSD=X'
    : idea.ticker === 'USDCHF' ? 'CHF=X'
    : idea.ticker === 'AUDUSD' ? 'AUDUSD=X'
    : idea.ticker === 'USDMXN' ? 'MXN=X'
    : idea.ticker === 'EURGBP' ? 'EURGBP=X'
    : idea.ticker === 'NZDUSD' ? 'NZDUSD=X'
    : idea.ticker

  useEffect(() => {
    async function fetchChart() {
      setChartLoading(true)
      try {
        const r = rangeMap[chartRange] || rangeMap['3M']
        const res = await fetch(`/api/market?symbol=${encodeURIComponent(yahooSymbol)}&range=${r.range}&interval=${r.interval}`)
        const data = await res.json()
        setChartData((data.candles || []).map(c => ({
          ...c,
          date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        })))
      } catch (e) {
        console.error(e)
      } finally {
        setChartLoading(false)
      }
    }
    fetchChart()
  }, [chartRange, yahooSymbol])

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'prediction', label: 'Prediction' },
    { id: 'chart', label: 'Chart' },
    { id: 'ai-intel', label: 'AI Intelligence' },
    { id: 'adaptive', label: 'Adaptive Engine' },
    { id: 'bonds', label: 'Bond Correlation' },
    { id: 'macro', label: 'Global Macro' },
    { id: 'news', label: 'News & Catalysts' },
    { id: 'technicals', label: 'Technicals' },
    { id: 'risks', label: 'Risk Factors' },
  ]

  const isLong = direction === 'long'
  const avgEntry = idea.entryLow && idea.entryHigh ? (idea.entryLow + idea.entryHigh) / 2 : null
  const rr = avgEntry ? calcRR(avgEntry, idea.target, idea.stopLoss, direction) : '--'

  const priceInZone = currentPrice >= idea.entryLow && currentPrice <= idea.entryHigh
  const alert = currentPrice
    ? (isLong
      ? (currentPrice >= idea.target ? 'TARGET_HIT' : currentPrice <= idea.stopLoss ? 'STOP_HIT' : null)
      : (currentPrice <= idea.target ? 'TARGET_HIT' : currentPrice >= idea.stopLoss ? 'STOP_HIT' : null))
    : null

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const handleScroll = () => {
      const scrollTop = container.scrollTop + 160
      let current = 'overview'
      for (const s of sections) {
        const el = sectionRefs.current[s.id]
        if (el && el.offsetTop <= scrollTop) {
          current = s.id
        }
      }
      setActiveSection(current)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id) => {
    const el = sectionRefs.current[id]
    if (el && scrollRef.current) {
      const offset = el.offsetTop - 140
      scrollRef.current.scrollTo({ top: offset, behavior: 'smooth' })
    }
  }

  const setSectionRef = (id) => (el) => { sectionRefs.current[id] = el }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={onClose}>
      {/* Overlay — no blur, just a semi-transparent scrim */}
      <div className="absolute inset-0" style={{ background: 'rgb(var(--nx-void) / 0.7)' }} />
      <div
        className="relative w-full max-w-5xl mx-4 mt-4 mb-4 rounded-2xl shadow-glass-lg animate-slide-up flex flex-col border"
        style={{
          maxHeight: 'calc(100vh - 32px)',
          background: 'rgb(var(--nx-base) / 0.98)',
          borderColor: 'var(--nx-border)',
          transition: 'var(--theme-transition)',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* Sticky Header + Nav */}
        <div
          className="sticky top-0 z-10 rounded-t-2xl shrink-0 border-b"
          style={{
            background: 'rgb(var(--nx-elevated) / 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: 'var(--nx-border)',
            transition: 'var(--theme-transition)',
          }}
        >
          <div className="flex items-center justify-between p-5 pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-2xl font-bold ${isLong ? 'text-nx-green' : 'text-nx-red'}`}>
                {idea.ticker}
              </span>
              <span className="text-nx-text-muted text-md">{idea.name}</span>
              <span className={`px-2.5 py-0.5 rounded-md text-2xs font-bold uppercase ${isLong ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
                {isLong ? 'LONG' : 'SHORT'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-2xs font-semibold ${idea.strategy ? `strat-${idea.strategy}` : 'badge-blue'}`}>
                {idea.strategy?.replace('-', ' ').toUpperCase() || 'STRATEGY'}
              </span>
              {priceInZone && <span className="badge-blue animate-pulse-gentle">IN ZONE</span>}
              {alert === 'TARGET_HIT' && <span className="badge-green animate-pulse-gentle">TARGET HIT</span>}
              {alert === 'STOP_HIT' && <span className="badge-red animate-pulse-gentle">STOP HIT</span>}
            </div>
            <button onClick={onClose} className="text-nx-text-muted hover:text-nx-text-strong text-xl px-2 transition-colors rounded-lg hover:bg-nx-glass-hover w-8 h-8 flex items-center justify-center">&times;</button>
          </div>

          {/* Navigation bar */}
          <div className="flex gap-0 px-5 overflow-x-auto">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`nx-tab whitespace-nowrap ${activeSection === s.id ? 'nx-tab-active' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1" ref={scrollRef}>
          <div className="p-6 space-y-8">

            {/* Urgency & Timing Banner */}
            {(() => {
              const urgency = getTradeUrgency(idea)
              const urgencyConfig = {
                closing: { label: 'CLOSING SOON', color: '#f87171', bg: 'rgba(248, 113, 113, 0.08)', border: 'rgba(248, 113, 113, 0.20)', icon: '⚡' },
                urgent:  { label: 'URGENT', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.06)', border: 'rgba(251, 191, 36, 0.15)', icon: '⏰' },
                active:  { label: 'ACTIVE', color: '#34d399', bg: 'rgba(52, 211, 153, 0.05)', border: 'rgba(52, 211, 153, 0.12)', icon: '✓' },
                expired: { label: 'EXPIRED', color: '#64748b', bg: 'rgba(100, 116, 139, 0.05)', border: 'rgba(100, 116, 139, 0.12)', icon: '✕' },
              }
              const uc = urgencyConfig[urgency] || urgencyConfig.active
              const entryCountdown = formatCountdown(idea.entryBy)
              const expiresCountdown = formatCountdown(idea.expiresAt)
              const isExpired = urgency === 'expired'

              return (
                <div className="rounded-xl p-4" style={{ background: uc.bg, border: `1px solid ${uc.border}` }}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{uc.icon}</span>
                      <div>
                        <span className={`text-sm font-bold uppercase ${urgency === 'closing' ? 'animate-pulse-gentle' : ''}`} style={{ color: uc.color }}>{uc.label}</span>
                        {isExpired && <span className="text-xs text-nx-text-hint ml-2">— Thesis window has closed</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 text-xs">
                      {entryCountdown && !isExpired && (
                        <div>
                          <span className="text-nx-text-muted">Entry Deadline: </span>
                          <span className="font-bold font-mono" style={{ color: uc.color }}>{entryCountdown}</span>
                        </div>
                      )}
                      {expiresCountdown && !isExpired && (
                        <div>
                          <span className="text-nx-text-muted">Expires: </span>
                          <span className="font-bold font-mono text-nx-text-strong">{expiresCountdown}</span>
                        </div>
                      )}
                      {idea.expiresAt && !isExpired && (
                        <div className="text-nx-text-hint text-2xs">
                          {new Date(idea.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                  {idea.entryWindow && !isExpired && (
                    <div className="mt-3 pt-3 flex items-start gap-2" style={{ borderTop: `1px solid ${uc.border}` }}>
                      <span className="text-xs shrink-0 mt-px">⏱</span>
                      <span className="text-xs leading-relaxed" style={{ color: uc.color }}>{idea.entryWindow}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Key metrics bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {[
                { label: <Term>Entry Zone</Term>, value: `${idea.entryLow} \u2013 ${idea.entryHigh}`, color: 'text-nx-accent' },
                { label: <Term>Target</Term>, value: idea.target, color: 'text-nx-green' },
                { label: <Term>Stop Loss</Term>, value: idea.stopLoss, color: 'text-nx-red' },
                { label: <Term>Risk:Reward</Term>, value: `1:${rr}`, color: parseFloat(rr) >= 2 ? 'text-nx-green' : 'text-nx-orange' },
                { label: <Term>RSI</Term>, value: idea.rsi, color: idea.rsi < 30 ? 'text-nx-green' : idea.rsi > 70 ? 'text-nx-red' : 'text-nx-orange' },
                { label: 'Risk', value: idea.risk, color: idea.risk === 'LOW' ? 'text-nx-green' : idea.risk === 'HIGH' ? 'text-nx-red' : 'text-nx-orange' },
                { label: 'Timeframe', value: idea.timeframe || 'Variable', color: 'text-nx-accent' },
              ].map((m, i) => (
                <div key={i} className="glass-solid p-3">
                  <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">{m.label}</div>
                  <div className={`text-md font-semibold mt-1 font-mono tabular-nums ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* OVERVIEW */}
            <div ref={setSectionRef('overview')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Overview</span>
              </div>
              <div className="space-y-5">
                {/* Adaptive quick-glance badges */}
                {(idea.qualityGrade || idea.regimeShift || idea.correlationAnomaly) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {idea.qualityGrade && (
                      <span className="px-2.5 py-1 rounded-lg text-2xs font-bold" style={{
                        color: idea.qualityGrade === 'A' ? '#10b981' : idea.qualityGrade === 'B' ? '#3b82f6' : idea.qualityGrade === 'C' ? '#f59e0b' : '#ef4444',
                        background: idea.qualityGrade === 'A' ? 'rgba(16, 185, 129, 0.10)' : idea.qualityGrade === 'B' ? 'rgba(59, 130, 246, 0.10)' : idea.qualityGrade === 'C' ? 'rgba(245, 158, 11, 0.10)' : 'rgba(239, 68, 68, 0.10)',
                        border: `1px solid ${idea.qualityGrade === 'A' ? 'rgba(16, 185, 129, 0.20)' : idea.qualityGrade === 'B' ? 'rgba(59, 130, 246, 0.20)' : idea.qualityGrade === 'C' ? 'rgba(245, 158, 11, 0.20)' : 'rgba(239, 68, 68, 0.20)'}`,
                      }}>
                        Grade {idea.qualityGrade} {idea.expectedValue != null ? `· EV ${idea.expectedValue > 0 ? '+' : ''}${typeof idea.expectedValue === 'number' ? idea.expectedValue.toFixed(2) : idea.expectedValue}` : ''}
                      </span>
                    )}
                    {idea.adaptiveConfidence != null && idea.adaptiveConfidence !== idea.confidence && (
                      <span className="px-2.5 py-1 rounded-lg text-2xs font-semibold" style={{ color: 'rgb(var(--nx-accent))', background: 'rgba(var(--nx-accent) / 0.08)', border: '1px solid rgba(var(--nx-accent) / 0.15)' }}>
                        Adaptive: {typeof idea.adaptiveConfidence === 'number' ? idea.adaptiveConfidence.toFixed(1) : idea.adaptiveConfidence}%
                      </span>
                    )}
                    {idea.regimeShift && (
                      <span className="px-2.5 py-1 rounded-lg text-2xs font-semibold" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                        ⚠ Regime Shift
                      </span>
                    )}
                    {idea.correlationAnomaly && (
                      <span className="px-2.5 py-1 rounded-lg text-2xs font-semibold" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                        🔀 Correlation Anomaly
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-md font-semibold text-nx-text-strong mb-2">Thesis</h4>
                  <p className="text-sm text-nx-text leading-relaxed"><TermText>{idea.thesis}</TermText></p>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-nx-text-strong mb-2">Catalyst</h4>
                  <p className="text-sm text-nx-text leading-relaxed"><TermText>{idea.catalyst}</TermText></p>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-nx-text-strong mb-2">Historical Context</h4>
                  <p className="text-sm text-nx-text leading-relaxed"><TermText>{dp.historicalContext}</TermText></p>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-nx-text-strong mb-2">Sector Context</h4>
                  <p className="text-sm text-nx-text leading-relaxed"><TermText>{dp.sectorContext}</TermText></p>
                </div>
              </div>
            </div>

            {/* PREDICTION */}
            <div ref={setSectionRef('prediction')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Price Prediction</span>
              </div>

              {/* Timeframe Selector */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs text-nx-text-muted font-medium">Position Length:</span>
                {idea.timeframe && (
                  <span className="text-2xs px-2 py-1 rounded-md font-semibold bg-nx-accent-muted text-nx-accent border border-nx-accent/20">
                    Rec: {idea.timeframe}
                  </span>
                )}
                <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgb(var(--nx-void) / 0.4)' }}>
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf.id}
                      onClick={() => setSelectedTimeframe(tf.id)}
                      className={`px-2.5 py-1.5 text-2xs rounded-md font-medium transition-all duration-200 ${
                        selectedTimeframe === tf.id
                          ? 'bg-nx-accent-muted text-nx-accent shadow-sm'
                          : 'text-nx-text-muted hover:text-nx-text-strong'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {prediction && (
                <div className="space-y-4">
                  {/* Timeframe alignment indicator */}
                  {prediction.timeframeAlignment && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-2xs font-medium ${
                      prediction.timeframeAlignment === 'optimal'
                        ? 'text-nx-green'
                        : prediction.timeframeAlignment === 'acceptable'
                        ? 'text-nx-orange'
                        : 'text-nx-red'
                    }`} style={{
                      background: prediction.timeframeAlignment === 'optimal'
                        ? 'rgba(52, 211, 153, 0.06)'
                        : prediction.timeframeAlignment === 'acceptable'
                        ? 'rgba(251, 191, 36, 0.06)'
                        : 'rgba(248, 113, 113, 0.06)',
                      border: `1px solid ${
                        prediction.timeframeAlignment === 'optimal'
                          ? 'rgba(52, 211, 153, 0.15)'
                          : prediction.timeframeAlignment === 'acceptable'
                          ? 'rgba(251, 191, 36, 0.15)'
                          : 'rgba(248, 113, 113, 0.15)'
                      }`,
                    }}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        prediction.timeframeAlignment === 'optimal' ? 'bg-nx-green' : prediction.timeframeAlignment === 'acceptable' ? 'bg-nx-orange' : 'bg-nx-red'
                      }`} />
                      {prediction.timeframeAlignment === 'optimal'
                        ? `Optimal timeframe for ${idea.strategy?.replace('-', ' ')} strategy — ${prediction.captureRate}% move capture`
                        : prediction.timeframeAlignment === 'acceptable'
                        ? `Acceptable timeframe — ${prediction.captureRate}% move capture. Recommended: ${idea.timeframe}`
                        : `Misaligned timeframe — only ${prediction.captureRate}% move capture. Recommended: ${idea.timeframe}`
                      }
                    </div>
                  )}

                  {/* Hold Reason */}
                  {idea.holdReason && (
                    <div className="px-3 py-2 rounded-lg text-2xs text-nx-text-muted" style={{
                      background: 'rgba(91, 141, 238, 0.04)',
                      border: '1px solid rgba(91, 141, 238, 0.08)',
                    }}>
                      <span className="text-nx-accent font-semibold uppercase tracking-wider mr-1.5">Hold Thesis:</span>
                      {idea.holdReason}
                    </div>
                  )}

                  {/* Prediction Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                    <div className="glass-solid p-3">
                      <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium"><Term>Confidence</Term></div>
                      <div className={`text-lg font-bold font-mono mt-1 ${prediction.confidence >= 65 ? 'text-nx-green' : prediction.confidence >= 50 ? 'text-nx-orange' : 'text-nx-red'}`}>{prediction.confidence}%</div>
                    </div>
                    <div className="glass-solid p-3">
                      <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">Expected Return</div>
                      <div className={`text-lg font-bold font-mono mt-1 ${prediction.expectedReturn > 0 ? 'text-nx-green' : 'text-nx-red'}`}>{prediction.expectedReturn > 0 ? '+' : ''}{prediction.expectedReturn}%</div>
                    </div>
                    <div className="glass-solid p-3">
                      <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">Move Capture</div>
                      <div className={`text-lg font-bold font-mono mt-1 ${prediction.captureRate >= 80 ? 'text-nx-green' : prediction.captureRate >= 50 ? 'text-nx-orange' : 'text-nx-red'}`}>{prediction.captureRate}%</div>
                    </div>
                    <div className="glass-solid p-3">
                      <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">Est. Entry</div>
                      <div className="text-sm font-mono mt-1 text-nx-accent">{prediction.estimatedEntryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="glass-solid p-3">
                      <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">Est. Target</div>
                      <div className="text-sm font-mono mt-1 text-nx-green">{prediction.estimatedTargetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>

                  {/* Prediction Chart */}
                  <div className="nx-card p-4" style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={prediction.path}>
                        <XAxis dataKey="time" {...CHART_AXIS} interval={Math.floor(prediction.path.length / 8)} />
                        <YAxis domain={['auto', 'auto']} {...CHART_YAXIS} />
                        <Tooltip
                          {...CHART_TOOLTIP_STYLE}
                          formatter={(val) => [`$${val.toFixed(2)}`, 'Predicted']}
                        />
                        {/* Confidence bands */}
                        <Area type="monotone" dataKey="price" data={prediction.upperBand} fill="rgba(91, 141, 238, 0.04)" stroke="none" />
                        <Area type="monotone" dataKey="price" data={prediction.lowerBand} fill="rgba(91, 141, 238, 0.04)" stroke="none" />
                        {/* Main prediction line */}
                        <Area type="monotone" dataKey="predicted" fill="rgba(91, 141, 238, 0.08)" stroke="none" />
                        <Line type="monotone" dataKey="predicted" stroke="#5b8dee" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                        {/* Target & Stop lines */}
                        {idea.target && <ReferenceLine y={idea.target} stroke="#34d399" strokeDasharray="4 4" label={{ value: `Target $${idea.target}`, fill: '#34d399', fontSize: 10, position: 'right' }} />}
                        {idea.stopLoss && <ReferenceLine y={idea.stopLoss} stroke="#f87171" strokeDasharray="4 4" label={{ value: `Stop $${idea.stopLoss}`, fill: '#f87171', fontSize: 10, position: 'right' }} />}
                        {currentPrice && <ReferenceLine y={currentPrice} stroke="rgba(128,128,128,0.4)" strokeDasharray="2 4" label={{ value: `Now $${currentPrice.toFixed(2)}`, fill: '#6b7280', fontSize: 10, position: 'left' }} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center gap-4 text-2xs text-nx-text-hint">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-nx-accent inline-block" style={{ borderTop: '2px dashed #5b8dee' }} /> Predicted Path</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-nx-accent/10 inline-block" /> Confidence Band</span>
                    <span className="ml-auto">Model uses <Term>RSI</Term>, <Term>Risk:Reward</Term>, strategy type, and historical volatility</span>
                  </div>
                </div>
              )}

              {!prediction && (
                <div className="text-center py-8 text-nx-text-muted">No live price data available for prediction generation.</div>
              )}
            </div>

            {/* CHART */}
            <div ref={setSectionRef('chart')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Price Chart</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-1 p-0.5 rounded-lg w-fit" style={{ background: 'rgb(var(--nx-void) / 0.4)' }}>
                  {Object.keys(rangeMap).map(r => (
                    <button
                      key={r}
                      onClick={() => setChartRange(r)}
                      className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all duration-200 ${chartRange === r ? 'bg-nx-accent-muted text-nx-accent' : 'text-nx-text-muted hover:text-nx-text-strong'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="nx-card p-4" style={{ height: 400 }}>
                  {chartLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-5 h-5 border-2 border-nx-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="date" {...CHART_AXIS} interval="preserveStartEnd" />
                        <YAxis domain={['auto', 'auto']} {...CHART_YAXIS} />
                        <Tooltip {...CHART_TOOLTIP_STYLE} />
                        <Area type="monotone" dataKey="close" fill="rgba(91, 141, 238, 0.06)" stroke="none" />
                        <Line type="monotone" dataKey="close" stroke="#5b8dee" strokeWidth={2} dot={false} />
                        {idea.entryHigh && <ReferenceLine y={idea.entryHigh} stroke="#5b8dee" strokeDasharray="4 4" label={{ value: `Entry ${idea.entryHigh}`, fill: '#5b8dee', fontSize: 10, position: 'right' }} />}
                        {idea.entryLow && <ReferenceLine y={idea.entryLow} stroke="#5b8dee" strokeDasharray="4 4" label={{ value: `Entry ${idea.entryLow}`, fill: '#5b8dee', fontSize: 10, position: 'right' }} />}
                        {idea.target && <ReferenceLine y={idea.target} stroke="#34d399" strokeDasharray="4 4" label={{ value: `Target ${idea.target}`, fill: '#34d399', fontSize: 10, position: 'right' }} />}
                        {idea.stopLoss && <ReferenceLine y={idea.stopLoss} stroke="#f87171" strokeDasharray="4 4" label={{ value: `Stop ${idea.stopLoss}`, fill: '#f87171', fontSize: 10, position: 'right' }} />}
                        <Bar dataKey="volume" fill="rgba(91, 141, 238, 0.1)" yAxisId="volume" />
                        <YAxis yAxisId="volume" orientation="right" hide domain={[0, d => d * 5]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* AI INTELLIGENCE LAYERS */}
            <div ref={setSectionRef('ai-intel')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">AI Intelligence Layers</span>
              </div>
              <div className="space-y-4">

                {/* HMM Regime Detection */}
                {idea.regimeAnalysis && (
                  <div className="glass-solid p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: idea.regimeAnalysis.currentRegime === 'trending-bull' ? 'rgb(var(--nx-green))' : idea.regimeAnalysis.currentRegime === 'trending-bear' ? 'rgb(var(--nx-red))' : 'rgb(var(--nx-accent))' }} />
                      <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider">HMM Regime Detection</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Current Regime</div>
                        <div className="text-sm font-semibold text-nx-accent capitalize">{idea.regimeAnalysis.currentRegime?.replace(/-/g, ' ')}</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Confidence</div>
                        <div className="text-sm font-semibold text-nx-text-strong">{Math.round(idea.regimeAnalysis.confidence)}%</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Transition Risk</div>
                        <div className={`text-sm font-semibold ${idea.regimeAnalysis.transitionRisk > 50 ? 'text-nx-red' : 'text-nx-green'}`}>{Math.round(idea.regimeAnalysis.transitionRisk)}%</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Rec. Strategy</div>
                        <div className="text-sm font-semibold text-nx-text-strong capitalize">{idea.regimeAnalysis.recommendedStrategy?.replace(/-/g, ' ')}</div>
                      </div>
                    </div>
                    {idea.regimeAnalysis.regimeProbabilities && (
                      <div className="flex gap-1 h-3 rounded-full overflow-hidden mt-2">
                        {Object.entries(idea.regimeAnalysis.regimeProbabilities).map(([regime, prob]) => (
                          <div key={regime} className="h-full transition-all" title={`${regime}: ${Math.round(prob)}%`} style={{
                            width: `${prob}%`,
                            background: regime === 'trending-bull' ? 'rgb(var(--nx-green))' : regime === 'trending-bear' ? 'rgb(var(--nx-red))' : regime === 'mean-reverting' ? 'rgb(var(--nx-accent))' : 'rgb(var(--nx-text-muted))',
                            opacity: 0.7,
                          }} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Ensemble Strategy Engine */}
                {idea.ensemble && (
                  <div className="glass-solid p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider">Ensemble Strategy Engine</h4>
                      {idea.ensemble.conflictDetected && (
                        <span className="text-2xs px-2 py-0.5 rounded-md bg-nx-red-muted text-nx-red font-semibold">CONFLICT</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Ensemble Direction</div>
                        <div className={`text-sm font-semibold ${idea.ensemble.direction === 'long' ? 'text-nx-green' : 'text-nx-red'} uppercase`}>{idea.ensemble.direction}</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Consensus</div>
                        <div className="text-sm font-semibold text-nx-text-strong">{Math.round(idea.ensemble.confidence)}%</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Dominant Strategy</div>
                        <div className="text-sm font-semibold text-nx-accent capitalize">{idea.ensemble.dominantStrategy?.replace(/-/g, ' ')}</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Score</div>
                        <div className="text-sm font-semibold text-nx-text-strong">{idea.ensemble.ensembleScore}</div>
                      </div>
                    </div>
                    {idea.ensemble.weights && (
                      <div className="flex gap-2 flex-wrap mt-1">
                        {Object.entries(idea.ensemble.weights).filter(([, w]) => w > 0).map(([strat, weight]) => (
                          <span key={strat} className="text-2xs px-2 py-1 rounded-md bg-nx-accent-muted/30 text-nx-text-muted font-medium">
                            {strat}: {(weight * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Alpha Factors */}
                {idea.alphaFactors && (
                  <div className="glass-solid p-5">
                    <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider mb-3">Alpha Factor Library</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Composite</div>
                        <div className={`text-lg font-bold font-mono ${(idea.alphaFactors.composite?.alpha_composite ?? 0) > 0 ? 'text-nx-green' : (idea.alphaFactors.composite?.alpha_composite ?? 0) < 0 ? 'text-nx-red' : 'text-nx-text-muted'}`}>{(idea.alphaFactors.composite?.alpha_composite ?? 0) > 0 ? '+' : ''}{(idea.alphaFactors.composite?.alpha_composite ?? 0).toFixed(1)}</div>
                      </div>
                      {[['momentum', 'alpha_momentum'], ['meanReversion', 'alpha_meanReversion'], ['volatility', 'alpha_volatility'], ['volume', 'alpha_volume'], ['trend', 'alpha_trend']].map(([label, key]) => {
                        const val = idea.alphaFactors.composite?.[key];
                        return val != null ? (
                          <div key={label}>
                            <div className="text-2xs text-nx-text-muted uppercase">{label.replace(/([A-Z])/g, ' $1')}</div>
                            <div className={`text-sm font-semibold font-mono ${val > 0 ? 'text-nx-green' : val < 0 ? 'text-nx-red' : 'text-nx-text-muted'}`}>{val > 0 ? '+' : ''}{val.toFixed(1)}</div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Position Sizing */}
                {idea.positionSizing && (
                  <div className="glass-solid p-5">
                    <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider mb-3">Dynamic Position Sizing</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {idea.positionSizing.kellyFraction != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Kelly Criterion</div>
                          <div className="text-sm font-semibold text-nx-accent font-mono">{(idea.positionSizing.kellyFraction * 100).toFixed(1)}%</div>
                        </div>
                      )}
                      {idea.positionSizing.positionPctOfPortfolio != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Portfolio %</div>
                          <div className="text-sm font-semibold text-nx-text-strong font-mono">{idea.positionSizing.positionPctOfPortfolio}%</div>
                        </div>
                      )}
                      {idea.positionSizing.recommendedSize != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Recommended</div>
                          <div className="text-lg font-bold text-nx-accent font-mono">{idea.positionSizing.recommendedSize} shr</div>
                        </div>
                      )}
                      {idea.positionSizing.sizing != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Sizing Class</div>
                          <div className={`text-sm font-semibold font-mono capitalize ${idea.positionSizing.sizing === 'aggressive' ? 'text-nx-red' : idea.positionSizing.sizing === 'conservative' ? 'text-nx-green' : 'text-nx-text-strong'}`}>{idea.positionSizing.sizing}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sentiment Analysis */}
                {idea.sentiment && idea.sentiment.composite != null && (
                  <div className="glass-solid p-5">
                    <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider mb-3">Sentiment Engine</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Composite</div>
                        <div className={`text-lg font-bold font-mono ${idea.sentiment.composite > 0 ? 'text-nx-green' : idea.sentiment.composite < 0 ? 'text-nx-red' : 'text-nx-text-muted'}`}>{idea.sentiment.composite > 0 ? '+' : ''}{idea.sentiment.composite?.toFixed(0)}</div>
                      </div>
                      {idea.sentiment.breakdown && Object.entries(idea.sentiment.breakdown).map(([key, val]) => (
                        val != null && (
                          <div key={key}>
                            <div className="text-2xs text-nx-text-muted uppercase">{key.replace(/([A-Z])/g, ' $1')}</div>
                            <div className={`text-sm font-semibold font-mono ${val > 0 ? 'text-nx-green' : val < 0 ? 'text-nx-red' : 'text-nx-text-muted'}`}>{val > 0 ? '+' : ''}{val.toFixed(0)}</div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Cross-Asset Correlations */}
                {idea.correlations && (
                  <div className="glass-solid p-5">
                    <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider mb-3">Cross-Asset Correlations</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {idea.beta != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Beta (SPY)</div>
                          <div className="text-sm font-semibold text-nx-text-strong font-mono">{idea.beta}</div>
                        </div>
                      )}
                      {idea.diversificationScore != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Diversification</div>
                          <div className={`text-sm font-semibold font-mono ${idea.diversificationScore > 60 ? 'text-nx-green' : idea.diversificationScore < 30 ? 'text-nx-red' : 'text-nx-text-muted'}`}>{idea.diversificationScore}</div>
                        </div>
                      )}
                      {idea.correlations.riskOn != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Risk Regime</div>
                          <div className={`text-sm font-semibold ${idea.correlations.riskOn ? 'text-nx-green' : 'text-nx-red'}`}>{idea.correlations.riskOn ? 'Risk-On' : 'Risk-Off'}</div>
                        </div>
                      )}
                      {idea.correlations.bondCorrelation != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Bond Corr</div>
                          <div className="text-sm font-semibold text-nx-text-strong font-mono">{typeof idea.correlations.bondCorrelation === 'number' ? idea.correlations.bondCorrelation.toFixed(2) : idea.correlations.bondCorrelation}</div>
                        </div>
                      )}
                    </div>
                    {idea.correlations.correlations && (
                      <div className="flex gap-2 flex-wrap mt-1">
                        {Object.entries(idea.correlations.correlations).filter(([, v]) => v != null).map(([asset, corr]) => (
                          <span key={asset} className={`text-2xs px-2 py-1 rounded-md font-medium font-mono ${corr > 0.5 ? 'bg-nx-green/10 text-nx-green' : corr < -0.3 ? 'bg-nx-red/10 text-nx-red' : 'bg-nx-accent-muted/30 text-nx-text-muted'}`}>
                            {asset}: {typeof corr === 'number' ? corr.toFixed(2) : corr}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* No data fallback */}
                {!idea.regimeAnalysis && !idea.ensemble && !idea.alphaFactors && !idea.sentiment && !idea.correlations && !idea.positionSizing && (
                  <div className="glass-solid p-5 text-center">
                    <p className="text-sm text-nx-text-muted">AI intelligence layers available on single-symbol deep analysis</p>
                  </div>
                )}
              </div>
            </div>

            {/* ADAPTIVE ENGINE */}
            <div ref={setSectionRef('adaptive')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Adaptive Engine</span>
              </div>
              <div className="space-y-4">
                {/* Quality Grade & Adaptive Confidence */}
                {(idea.qualityGrade || idea.adaptiveConfidence != null || idea.expectedValue != null) ? (
                  <div className="glass-solid p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider">Signal Quality Assessment</h4>
                      {idea.qualityGrade && (
                        <span className={`px-2.5 py-0.5 rounded-md text-2xs font-bold`} style={{
                          color: idea.qualityGrade === 'A' ? '#10b981' : idea.qualityGrade === 'B' ? '#3b82f6' : idea.qualityGrade === 'C' ? '#f59e0b' : '#ef4444',
                          background: idea.qualityGrade === 'A' ? 'rgba(16, 185, 129, 0.12)' : idea.qualityGrade === 'B' ? 'rgba(59, 130, 246, 0.12)' : idea.qualityGrade === 'C' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          border: `1px solid ${idea.qualityGrade === 'A' ? 'rgba(16, 185, 129, 0.25)' : idea.qualityGrade === 'B' ? 'rgba(59, 130, 246, 0.25)' : idea.qualityGrade === 'C' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                        }}>
                          GRADE {idea.qualityGrade}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {idea.qualityGrade && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Quality Grade</div>
                          <div className={`text-2xl font-bold font-mono ${idea.qualityGrade === 'A' ? 'text-nx-green' : idea.qualityGrade === 'B' ? 'text-nx-accent' : idea.qualityGrade === 'C' ? 'text-nx-orange' : 'text-nx-red'}`}>{idea.qualityGrade}</div>
                        </div>
                      )}
                      {idea.adaptiveConfidence != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Adaptive Confidence</div>
                          <div className="text-lg font-bold text-nx-text-strong font-mono">{typeof idea.adaptiveConfidence === 'number' ? idea.adaptiveConfidence.toFixed(1) : idea.adaptiveConfidence}%</div>
                        </div>
                      )}
                      {idea.expectedValue != null && (
                        <div>
                          <div className="text-2xs text-nx-text-muted uppercase">Expected Value</div>
                          <div className={`text-lg font-bold font-mono ${idea.expectedValue > 0 ? 'text-nx-green' : 'text-nx-red'}`}>{idea.expectedValue > 0 ? '+' : ''}{typeof idea.expectedValue === 'number' ? idea.expectedValue.toFixed(2) : idea.expectedValue}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Base Confidence</div>
                        <div className="text-lg font-bold text-nx-text-strong font-mono">{idea.confidence}%</div>
                      </div>
                    </div>
                    {idea.qualityRecommendation && (
                      <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(var(--nx-accent) / 0.06)', border: '1px solid rgba(var(--nx-accent) / 0.12)' }}>
                        <div className="text-2xs text-nx-text-muted uppercase mb-1">Recommendation</div>
                        <p className="text-sm text-nx-text leading-relaxed">{idea.qualityRecommendation}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="glass-solid p-5 text-center">
                    <p className="text-sm text-nx-text-muted">Adaptive engine in learning mode — quality scoring available after 20 tracked signals</p>
                  </div>
                )}

                {/* Regime Shift & Correlation Anomaly Flags */}
                {(idea.regimeShift || idea.correlationAnomaly) && (
                  <div className="glass-solid p-5">
                    <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider mb-3">Macro Flags</h4>
                    <div className="flex gap-3 flex-wrap">
                      {idea.regimeShift && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.20)' }}>
                          <span className="text-sm">⚠️</span>
                          <div>
                            <div className="text-2xs font-semibold text-nx-orange uppercase">Regime Shift Detected</div>
                            <div className="text-2xs text-nx-text-muted">Leading indicators disagree with current HMM regime</div>
                          </div>
                        </div>
                      )}
                      {idea.correlationAnomaly && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.20)' }}>
                          <span className="text-sm">🔀</span>
                          <div>
                            <div className="text-2xs font-semibold uppercase" style={{ color: '#8b5cf6' }}>Correlation Anomaly</div>
                            <div className="text-2xs text-nx-text-muted">Asset diverging from expected market correlation</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Entry Freshness */}
                {idea.entryFreshness && (
                  <div className="glass-solid p-5">
                    <h4 className="text-sm font-semibold text-nx-text-strong uppercase tracking-wider mb-3">Entry Freshness</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Generated At</div>
                        <div className="text-sm font-semibold text-nx-text-strong">{new Date(idea.entryFreshness.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Max Entry Window</div>
                        <div className="text-sm font-semibold text-nx-accent">{idea.entryFreshness.maxEntryHours}h</div>
                      </div>
                      <div>
                        <div className="text-2xs text-nx-text-muted uppercase">Decay Rate</div>
                        <div className="text-sm font-semibold text-nx-text-muted">~2% per 6h</div>
                      </div>
                    </div>
                    {idea.entryFreshness.note && (
                      <p className="text-2xs text-nx-text-hint mt-2">{idea.entryFreshness.note}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* BOND CORRELATION */}
            <div ref={setSectionRef('bonds')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Bond & Rate Correlation</span>
              </div>
              <div className="glass-solid p-5">
                <p className="text-sm text-nx-text leading-relaxed"><TermText>{dp.bondCorrelation}</TermText></p>
              </div>
            </div>

            {/* GLOBAL MACRO */}
            <div ref={setSectionRef('macro')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Global Macro & Government</span>
              </div>
              <div className="glass-solid p-5">
                <p className="text-sm text-nx-text leading-relaxed"><TermText>{dp.globalMacro}</TermText></p>
              </div>
            </div>

            {/* NEWS & CATALYSTS */}
            <div ref={setSectionRef('news')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">News & Catalysts</span>
              </div>
              <div className="space-y-2">
                {dp.newsDrivers.map((news, i) => (
                  <div key={i} className="flex gap-3 items-start glass-solid p-3.5">
                    <span className="text-nx-accent font-bold text-sm mt-0.5 shrink-0 font-mono">{String(i + 1).padStart(2, '0')}</span>
                    <p className="text-sm text-nx-text leading-relaxed"><TermText>{news}</TermText></p>
                  </div>
                ))}
              </div>
            </div>

            {/* TECHNICALS */}
            {dp.technicalLevels && (
              <div ref={setSectionRef('technicals')}>
                <div className="nx-section-divider">
                  <span className="nx-section-title">Technical Levels</span>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="glass-solid p-4">
                      <div className="text-xs text-nx-text-muted uppercase tracking-wider mb-3 font-medium"><Term>Support</Term> Levels</div>
                      {dp.technicalLevels.support.map((s, i) => (
                        <div key={i} className="flex justify-between py-1.5 border-b border-nx-border last:border-0">
                          <span className="text-xs text-nx-text-muted">S{i + 1}</span>
                          <span className="text-sm font-medium text-nx-red font-mono tabular-nums">{s}</span>
                        </div>
                      ))}
                    </div>
                    <div className="glass-solid p-4">
                      <div className="text-xs text-nx-text-muted uppercase tracking-wider mb-3 font-medium"><Term>Resistance</Term> Levels</div>
                      {dp.technicalLevels.resistance.map((r, i) => (
                        <div key={i} className="flex justify-between py-1.5 border-b border-nx-border last:border-0">
                          <span className="text-xs text-nx-text-muted">R{i + 1}</span>
                          <span className="text-sm font-medium text-nx-green font-mono tabular-nums">{r}</span>
                        </div>
                      ))}
                    </div>
                    <div className="glass-solid p-4">
                      <div className="text-xs text-nx-text-muted uppercase tracking-wider mb-3 font-medium">Moving Averages</div>
                      {Object.entries(dp.technicalLevels.movingAverages).map(([key, val]) => (
                        <div key={key} className="flex justify-between py-1.5 border-b border-nx-border last:border-0">
                          <span className="text-xs text-nx-text-muted"><Term term={key.toUpperCase()}>{key.toUpperCase()}</Term></span>
                          <span className="text-sm font-medium text-nx-text font-mono tabular-nums">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-solid p-4">
                    <div className="text-xs text-nx-text-muted uppercase tracking-wider mb-3 font-medium"><Term>Pivot Points</Term></div>
                    <div className="grid grid-cols-4 gap-4">
                      {Object.entries(dp.technicalLevels.pivotPoints).map(([key, val]) => (
                        <div key={key} className="text-center">
                          <div className="text-xs text-nx-text-muted uppercase">{key}</div>
                          <div className={`text-md font-semibold font-mono tabular-nums ${key.startsWith('r') ? 'text-nx-green' : 'text-nx-red'}`}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RISK FACTORS */}
            <div ref={setSectionRef('risks')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Risk Factors</span>
              </div>
              <div className="space-y-2 mb-8">
                {dp.riskFactors.map((risk, i) => (
                  <div key={i} className="flex gap-3 items-start p-3.5 rounded-xl bg-nx-red-muted/50 border border-nx-red/10">
                    <span className="text-nx-red font-bold text-sm mt-0.5 shrink-0">!</span>
                    <p className="text-sm text-nx-text leading-relaxed">{risk}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
