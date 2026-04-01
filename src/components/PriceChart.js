'use client'
import { useState, useEffect, useRef } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

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
          color: c.close >= c.open ? '#10b981' : '#ef4444',
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [symbol, range])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-eve-card border border-eve-border rounded-lg p-3 text-xs shadow-xl">
        <div className="text-eve-muted mb-1">{d.date} {d.time_label}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-eve-muted">Open</span><span className="text-white font-mono">{d.open?.toFixed(2)}</span>
          <span className="text-eve-muted">High</span><span className="text-eve-green font-mono">{d.high?.toFixed(2)}</span>
          <span className="text-eve-muted">Low</span><span className="text-eve-red font-mono">{d.low?.toFixed(2)}</span>
          <span className="text-eve-muted">Close</span><span className="text-white font-bold font-mono">{d.close?.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <div className="flex gap-1">
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                range === r.value
                  ? 'bg-eve-accent text-white'
                  : 'text-eve-muted hover:text-white hover:bg-eve-border'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px]">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-eve-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey={range === '1d' || range === '5d' ? 'time_label' : 'date'}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
              />
              <Bar
                dataKey="volume"
                fill="#1f2937"
                opacity={0.3}
                yAxisId="volume"
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                tick={false}
                axisLine={false}
                domain={[0, d => d * 4]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
