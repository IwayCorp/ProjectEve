'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Area } from 'recharts'
import { TIMEFRAMES, generatePrediction } from '@/lib/predictions'
import { calcRR, getTradeUrgency, formatCountdown } from '@/lib/tradeIdeas'
import { CHART_AXIS, CHART_YAXIS, CHART_TOOLTIP_STYLE } from '@/lib/chartConfig'

// Map a trade's timeframe string (e.g. "5-14 days") to the best matching TIMEFRAMES id
function getDefaultTimeframe(tradeTimeframe) {
  if (!tradeTimeframe) return '4d'
  // Parse the first number from the timeframe string
  const match = tradeTimeframe.match(/(\d+)/)
  if (!match) return '4d'
  const days = parseInt(match[1])
  // For ranges like "5-14 days", use the midpoint
  const rangeMatch = tradeTimeframe.match(/(\d+)\s*-\s*(\d+)/)
  const midDays = rangeMatch ? Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2) : days
  // Map to closest TIMEFRAMES id
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
  const dp = idea.dataPacket

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
      <div className="absolute inset-0 bg-nx-void/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-5xl mx-4 mt-4 mb-4 rounded-2xl shadow-glass-lg animate-slide-up flex flex-col border border-nx-border"
        style={{ maxHeight: 'calc(100vh - 32px)', background: 'rgba(10, 14, 23, 0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Sticky Header + Nav */}
        <div className="sticky top-0 z-10 rounded-t-2xl shrink-0 border-b border-nx-border" style={{ background: 'rgba(15, 21, 32, 0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
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
                      {idea.entryBy && !isExpired && (
                        <div className="text-nx-text-hint text-2xs">
                          {new Date(idea.entryBy).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                { label: 'Entry Zone', value: `${idea.entryLow} \u2013 ${idea.entryHigh}`, color: 'text-nx-accent' },
                { label: 'Target', value: idea.target, color: 'text-nx-green' },
                { label: 'Stop Loss', value: idea.stopLoss, color: 'text-nx-red' },
                { label: 'Risk:Reward', value: `1:${rr}`, color: parseFloat(rr) >= 2 ? 'text-nx-green' : 'text-nx-orange' },
                { label: 'RSI', value: idea.rsi, color: idea.rsi < 30 ? 'text-nx-green' : idea.rsi > 70 ? 'text-nx-red' : 'text-nx-orange' },
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
                <div>
                  <h4 className="text-md font-semibold text-nx-text-strong mb-2">Thesis</h4>
                  <p className="text-sm text-nx-text leading-relaxed">{idea.thesis}</p>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-nx-text-strong mb-2">Catalyst</h4>
                  <p className="text-sm text-nx-text leading-relaxed">{idea.catalyst}</p>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-nx-text-strong mb-2">Historical Context</h4>
                  <p className="text-sm text-nx-text leading-relaxed">{dp.historicalContext}</p>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-nx-text-strong mb-2">Sector Context</h4>
                  <p className="text-sm text-nx-text leading-relaxed">{dp.sectorContext}</p>
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
                <div className="flex gap-1 p-0.5 rounded-lg bg-nx-void/40">
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
                      <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">Confidence</div>
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
                        {currentPrice && <ReferenceLine y={currentPrice} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 4" label={{ value: `Now $${currentPrice.toFixed(2)}`, fill: '#6b7280', fontSize: 10, position: 'left' }} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center gap-4 text-2xs text-nx-text-hint">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-nx-accent inline-block" style={{ borderTop: '2px dashed #5b8dee' }} /> Predicted Path</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-nx-accent/10 inline-block" /> Confidence Band</span>
                    <span className="ml-auto">Model uses RSI, Risk:Reward, strategy type, and historical volatility</span>
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
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-nx-void/40 w-fit">
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
                        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} interval="preserveStartEnd" />
                        <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} width={65} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(15, 21, 32, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, backdropFilter: 'blur(12px)' }}
                          labelStyle={{ color: '#6b7280' }}
                        />
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

            {/* BOND CORRELATION */}
            <div ref={setSectionRef('bonds')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Bond & Rate Correlation</span>
              </div>
              <div className="glass-solid p-5">
                <p className="text-sm text-nx-text leading-relaxed">{dp.bondCorrelation}</p>
              </div>
            </div>

            {/* GLOBAL MACRO */}
            <div ref={setSectionRef('macro')}>
              <div className="nx-section-divider">
                <span className="nx-section-title">Global Macro & Government</span>
              </div>
              <div className="glass-solid p-5">
                <p className="text-sm text-nx-text leading-relaxed">{dp.globalMacro}</p>
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
                    <p className="text-sm text-nx-text leading-relaxed">{news}</p>
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
                      <div className="text-xs text-nx-text-muted uppercase tracking-wider mb-3 font-medium">Support Levels</div>
                      {dp.technicalLevels.support.map((s, i) => (
                        <div key={i} className="flex justify-between py-1.5 border-b border-nx-border last:border-0">
                          <span className="text-xs text-nx-text-muted">S{i + 1}</span>
                          <span className="text-sm font-medium text-nx-red font-mono tabular-nums">{s}</span>
                        </div>
                      ))}
                    </div>
                    <div className="glass-solid p-4">
                      <div className="text-xs text-nx-text-muted uppercase tracking-wider mb-3 font-medium">Resistance Levels</div>
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
                          <span className="text-xs text-nx-text-muted">{key.toUpperCase()}</span>
                          <span className="text-sm font-medium text-nx-text font-mono tabular-nums">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-solid p-4">
                    <div className="text-xs text-nx-text-muted uppercase tracking-wider mb-3 font-medium">Pivot Points</div>
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
