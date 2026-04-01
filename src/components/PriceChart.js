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
      <div className="bg-tv-popup border border-tv-border rounded p-2.5 text-xs shadow-xl">
        <div className="text-tv-text-muted mb-1.5">{d.date} {d.time_label}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-tv-text-muted">O</span><span className="text-tv-text-strong font-mono">{d.open?.toFixed(2)}</span>
          <span className="text-tv-text-muted">H</span><span className="text-tv-green font-mono">{d.high?.toFixed(2)}</span>
          <span className="text-tv-text-muted">L</span><span className="text-tv-red font-mono">{d.low?.toFixed(2)}</span>
          <span className="text-tv-text-muted">C</span><span className="text-tv-text-strong font-bold font-mono">{d.close?.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-tv-pane border border-tv-border rounded-md">
      <div className="flex items-center justify-between p-3 border-b border-tv-border">
        <h3 className="text-sm font-semibold text-tv-text-strong">{title}</h3>
        <div className="flex gap-0.5">
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2 py-1 text-2xs rounded transition-colors ${
                range === r.value
                  ? 'bg-tv-blue-muted text-tv-blue'
                  : 'text-tv-text-muted hover:text-tv-text-strong hover:bg-white/5'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[320px] p-2">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-tv-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e39" />
              <XAxis
                dataKey={range === '1d' || range === '5d' ? 'time_label' : 'date'}
                tick={{ fontSize: 10, fill: '#787b86' }}
                tickLine={false}
                axisLine={{ stroke: '#2a2e39' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#787b86' }}
                tickLine={false}
                axisLine={false}
                width={65}
                tickFormatter={v => v.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="close" fill="rgba(41, 98, 255, 0.06)" stroke="none" />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#2962FF"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#2962FF' }}
              />
              <Bar dataKey="volume" fill="rgba(41, 98, 255, 0.12)" yAxisId="volume" />
              <YAxis yAxisId="volume" orientation="right" hide domain={[0, d => d * 5]} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
