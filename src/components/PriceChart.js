'use client'
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export default function PriceChart({ symbol = '^GSPC', title = 'S&P 500' }) {
  const [candles, setCandles] = useState([])
  const [range, setRange] = useState('5d')
  const [loading, setLoading] = useState(true)

  const ranges = [
    { label: '1D', value: '1d', interval: '5m' },
    { label: '5D', value: '5d', interval: '15m' },
    { label: '1M', value: '1mo', interval: '1d' },
    { label: '3M', value: '3mo', interval: '1d' },
    { label: '6M', value: '6mo', interval: '1d' },
    { label: 'YTD', value: 'ytd', interval: '1d' },
    { label: '1Y', value: '1y', interval: '1wk' },
  ]

  useEffect(() => {
    setLoading(true)
    const r = ranges.find(r => r.value === range) || ranges[1]
    fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&range=${r.value}&interval=${r.interval}`)
      .then(res => res.json())
      .then(data => {
        setCandles((data.candles || []).map(c => ({
          ...c,
          date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          time_label: new Date(c.time * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [symbol, range])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="glass p-3 text-xs shadow-glass-lg" style={{ minWidth: 140 }}>
        <div className="text-nx-text-muted mb-2 font-medium">{d.date} {d.time_label}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <span className="text-nx-text-muted">O</span><span className="text-nx-text-strong font-mono tabular-nums">{d.open?.toFixed(2)}</span>
          <span className="text-nx-text-muted">H</span><span className="text-nx-green font-mono tabular-nums">{d.high?.toFixed(2)}</span>
          <span className="text-nx-text-muted">L</span><span className="text-nx-red font-mono tabular-nums">{d.low?.toFixed(2)}</span>
          <span className="text-nx-text-muted">C</span><span className="text-nx-text-strong font-bold font-mono tabular-nums">{d.close?.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="nx-card">
      <div className="flex items-center justify-between p-3.5 border-b border-nx-border">
        <h3 className="text-sm font-semibold text-nx-text-strong">{title}</h3>
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-nx-void/50">
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 ${
                range === r.value
                  ? 'bg-nx-accent-muted text-nx-accent shadow-sm'
                  : 'text-nx-text-muted hover:text-nx-text-strong'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[320px] p-3">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-nx-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey={range === '1d' || range === '5d' ? 'time_label' : 'date'}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={65}
                tickFormatter={v => v.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="close" fill="rgba(91, 141, 238, 0.06)" stroke="none" />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#5b8dee"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#5b8dee', stroke: 'rgba(91, 141, 238, 0.3)', strokeWidth: 4 }}
              />
              <Bar dataKey="volume" fill="rgba(91, 141, 238, 0.08)" yAxisId="volume" />
              <YAxis yAxisId="volume" orientation="right" hide domain={[0, d => d * 5]} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
