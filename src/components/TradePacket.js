'use client'
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Area } from 'recharts'

export default function TradePacket({ idea, direction, onClose, currentPrice }) {
  const [chartData, setChartData] = useState([])
  const [chartRange, setChartRange] = useState('3mo')
  const [chartLoading, setChartLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview')
  const dp = idea.dataPacket

  const rangeMap = {
    '1M': { range: '1mo', interval: '1d' },
    '3M': { range: '3mo', interval: '1d' },
    '6M': { range: '6mo', interval: '1d' },
    '1Y': { range: '1y', interval: '1wk' },
  }

  // Determine the Yahoo symbol for this idea
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
    { id: 'chart', label: 'Chart' },
    { id: 'bonds', label: 'Bond Correlation' },
    { id: 'macro', label: 'Global Macro' },
    { id: 'news', label: 'News & Catalysts' },
    { id: 'technicals', label: 'Technicals' },
    { id: 'risks', label: 'Risk Factors' },
  ]

  const isLong = direction === 'long'
  const rr = idea.stopLoss && idea.target && idea.entryHigh
    ? (isLong
      ? ((idea.target - idea.entryHigh) / (idea.entryHigh - idea.stopLoss))
      : ((idea.entryLow - idea.target) / (idea.stopLoss - idea.entryLow))
    ).toFixed(1)
    : '--'

  const priceInZone = currentPrice >= idea.entryLow && currentPrice <= idea.entryHigh
  const alert = currentPrice
    ? (isLong
      ? (currentPrice >= idea.target ? 'TARGET_HIT' : currentPrice <= idea.stopLoss ? 'STOP_HIT' : null)
      : (currentPrice <= idea.target ? 'TARGET_HIT' : currentPrice >= idea.stopLoss ? 'STOP_HIT' : null))
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-5xl mx-4 bg-tv-bg border border-tv-border rounded-lg shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-tv-pane border-b border-tv-border rounded-t-lg">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${isLong ? 'text-tv-green' : 'text-tv-red'}`}>
                {idea.ticker}
              </span>
              <span className="text-tv-text-muted text-md">{idea.name}</span>
              <span className={`px-2 py-0.5 rounded text-2xs font-bold uppercase ${isLong ? 'bg-tv-green-bg text-tv-green' : 'bg-tv-red-bg text-tv-red'}`}>
                {isLong ? 'LONG' : 'SHORT'}
              </span>
              <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${idea.strategy ? `strat-${idea.strategy}` : 'badge-blue'}`}>
                {idea.strategy?.replace('-', ' ').toUpperCase() || 'STRATEGY'}
              </span>
              {priceInZone && <span className="badge-blue animate-pulse">IN ZONE</span>}
              {alert === 'TARGET_HIT' && <span className="badge-green animate-pulse">TARGET HIT</span>}
              {alert === 'STOP_HIT' && <span className="badge-red animate-pulse">STOP HIT</span>}
            </div>
            <button onClick={onClose} className="text-tv-text-muted hover:text-white text-xl px-2">✕</button>
          </div>

          {/* Section tabs */}
          <div className="flex gap-0 px-4 overflow-x-auto">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeSection === s.id
                    ? 'text-tv-blue border-tv-blue'
                    : 'text-tv-text-muted border-transparent hover:text-tv-text-strong'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key metrics bar — always visible */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Entry Zone', value: `${idea.entryLow} – ${idea.entryHigh}`, color: 'text-tv-blue' },
              { label: 'Target', value: idea.target, color: 'text-tv-green' },
              { label: 'Stop Loss', value: idea.stopLoss, color: 'text-tv-red' },
              { label: 'R:R', value: `${rr}:1`, color: parseFloat(rr) >= 2 ? 'text-tv-green' : 'text-tv-orange' },
              { label: 'RSI', value: idea.rsi, color: idea.rsi < 30 ? 'text-tv-green' : idea.rsi > 70 ? 'text-tv-red' : 'text-tv-orange' },
              { label: 'Risk', value: idea.risk, color: idea.risk === 'LOW' ? 'text-tv-green' : idea.risk === 'HIGH' ? 'text-tv-red' : 'text-tv-orange' },
              { label: 'Timeframe', value: idea.timeframe || '4-day', color: 'text-tv-text' },
            ].map((m, i) => (
              <div key={i} className="bg-tv-pane rounded p-3 border border-tv-border">
                <div className="text-2xs text-tv-text-muted uppercase tracking-wider">{m.label}</div>
                <div className={`text-md font-semibold mt-1 ${m.color}`}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h3 className="text-md font-semibold text-tv-text-strong mb-2">Thesis</h3>
                <p className="text-sm text-tv-text leading-relaxed">{idea.thesis}</p>
              </div>
              <div>
                <h3 className="text-md font-semibold text-tv-text-strong mb-2">Catalyst</h3>
                <p className="text-sm text-tv-text leading-relaxed">{idea.catalyst}</p>
              </div>
              <div>
                <h3 className="text-md font-semibold text-tv-text-strong mb-2">Historical Context</h3>
                <p className="text-sm text-tv-text leading-relaxed">{dp.historicalContext}</p>
              </div>
              <div>
                <h3 className="text-md font-semibold text-tv-text-strong mb-2">Sector Context</h3>
                <p className="text-sm text-tv-text leading-relaxed">{dp.sectorContext}</p>
              </div>
            </div>
          )}

          {/* CHART */}
          {activeSection === 'chart' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2">
                {Object.keys(rangeMap).map(r => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`tv-btn text-xs ${chartRange === r ? 'tv-btn-active' : ''}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="bg-tv-pane border border-tv-border rounded-md p-4" style={{ height: 400 }}>
                {chartLoading ? (
                  <div className="flex items-center justify-center h-full text-tv-text-muted">Loading chart data...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fill: '#787b86', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2a2e39' }} interval="preserveStartEnd" />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#787b86', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2a2e39' }} width={65} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e222d', border: '1px solid #2a2e39', borderRadius: 4, fontSize: 11 }}
                        labelStyle={{ color: '#787b86' }}
                      />
                      <Area type="monotone" dataKey="close" fill="rgba(41, 98, 255, 0.08)" stroke="none" />
                      <Line type="monotone" dataKey="close" stroke="#2962FF" strokeWidth={2} dot={false} />
                      {idea.entryHigh && <ReferenceLine y={idea.entryHigh} stroke="#2962FF" strokeDasharray="4 4" label={{ value: `Entry High ${idea.entryHigh}`, fill: '#2962FF', fontSize: 10, position: 'right' }} />}
                      {idea.entryLow && <ReferenceLine y={idea.entryLow} stroke="#2962FF" strokeDasharray="4 4" label={{ value: `Entry Low ${idea.entryLow}`, fill: '#2962FF', fontSize: 10, position: 'right' }} />}
                      {idea.target && <ReferenceLine y={idea.target} stroke="#26a69a" strokeDasharray="4 4" label={{ value: `Target ${idea.target}`, fill: '#26a69a', fontSize: 10, position: 'right' }} />}
                      {idea.stopLoss && <ReferenceLine y={idea.stopLoss} stroke="#ef5350" strokeDasharray="4 4" label={{ value: `Stop ${idea.stopLoss}`, fill: '#ef5350', fontSize: 10, position: 'right' }} />}
                      <Bar dataKey="volume" fill="rgba(41, 98, 255, 0.15)" yAxisId="volume" />
                      <YAxis yAxisId="volume" orientation="right" hide domain={[0, d => d * 5]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* BOND CORRELATION */}
          {activeSection === 'bonds' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-md font-semibold text-tv-text-strong">Bond & Rate Correlation Analysis</h3>
              <p className="text-sm text-tv-text leading-relaxed">{dp.bondCorrelation}</p>
            </div>
          )}

          {/* GLOBAL MACRO */}
          {activeSection === 'macro' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-md font-semibold text-tv-text-strong">Global Macro & Government Correlation</h3>
              <p className="text-sm text-tv-text leading-relaxed">{dp.globalMacro}</p>
            </div>
          )}

          {/* NEWS & CATALYSTS */}
          {activeSection === 'news' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-md font-semibold text-tv-text-strong">Key News & Catalysts</h3>
              <div className="space-y-2">
                {dp.newsDrivers.map((news, i) => (
                  <div key={i} className="flex gap-3 items-start bg-tv-pane border border-tv-border rounded p-3">
                    <span className="text-tv-blue font-bold text-sm mt-0.5">{i + 1}</span>
                    <p className="text-sm text-tv-text leading-relaxed">{news}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TECHNICALS */}
          {activeSection === 'technicals' && dp.technicalLevels && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-md font-semibold text-tv-text-strong">Technical Levels</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-tv-pane border border-tv-border rounded p-4">
                  <div className="text-xs text-tv-text-muted uppercase mb-3">Support Levels</div>
                  {dp.technicalLevels.support.map((s, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-tv-border last:border-0">
                      <span className="text-xs text-tv-text-muted">S{i + 1}</span>
                      <span className="text-sm font-medium text-tv-red">{s}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-tv-pane border border-tv-border rounded p-4">
                  <div className="text-xs text-tv-text-muted uppercase mb-3">Resistance Levels</div>
                  {dp.technicalLevels.resistance.map((r, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-tv-border last:border-0">
                      <span className="text-xs text-tv-text-muted">R{i + 1}</span>
                      <span className="text-sm font-medium text-tv-green">{r}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-tv-pane border border-tv-border rounded p-4">
                  <div className="text-xs text-tv-text-muted uppercase mb-3">Moving Averages</div>
                  {Object.entries(dp.technicalLevels.movingAverages).map(([key, val]) => (
                    <div key={key} className="flex justify-between py-1.5 border-b border-tv-border last:border-0">
                      <span className="text-xs text-tv-text-muted">{key.toUpperCase()}</span>
                      <span className="text-sm font-medium text-tv-text">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-tv-pane border border-tv-border rounded p-4">
                <div className="text-xs text-tv-text-muted uppercase mb-3">Pivot Points</div>
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(dp.technicalLevels.pivotPoints).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <div className="text-xs text-tv-text-muted">{key.toUpperCase()}</div>
                      <div className={`text-md font-semibold ${key.startsWith('r') ? 'text-tv-green' : 'text-tv-red'}`}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RISKS */}
          {activeSection === 'risks' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-md font-semibold text-tv-text-strong">Risk Factors</h3>
              <div className="space-y-2">
                {dp.riskFactors.map((risk, i) => (
                  <div key={i} className="flex gap-3 items-start bg-tv-red-bg border border-tv-border rounded p-3">
                    <span className="text-tv-red font-bold text-sm mt-0.5">⚠</span>
                    <p className="text-sm text-tv-text leading-relaxed">{risk}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
