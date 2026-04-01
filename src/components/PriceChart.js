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
      <div className="p-3 text-xs" style={{
        background: 'linear-gradient(145deg, rgba(15, 21, 35, 0.95), rgba(10, 14, 23, 0.98))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(91, 141, 238, 0.05)',
        minWidth: 150,
      }}>
        <div className="mb-2 font-medium" style={{ color: '#94a3b8' }}>{d.date} {d.time_label}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <span style={{ color: '#64748b' }}>O</span><span className="font-mono tabular-nums" style={{ color: '#e2e8f0' }}>{d.open?.toFixed(2)}</span>
          <span style={{ color: '#64748b' }}>H</span><span className="font-mono tabular-nums text-nx-green">{d.high?.toFixed(2)}</span>
          <span style={{ color: '#64748b' }}>L</span><span className="font-mono tabular-nums text-nx-red">{d.low?.toFixed(2)}</span>
          <span style={{ color: '#64748b' }}>C</span><span className="font-mono tabular-nums font-bold" style={{ color: '#f1f5f9' }}>{d.close?.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="nx-chart-panel">
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h3 className="text-sm font-bold" style={{ color: '#f1f5f9' }}>{title}</h3>
        <div className="flex gap-0.5 p-1 rounded-lg" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="px-3 py-1.5 text-2xs rounded-md font-semibold transition-all duration-200"
              style={range === r.value
                ? { background: 'rgba(91, 141, 238, 0.15)', color: '#5b8dee', boxShadow: '0 0 8px rgba(91, 141, 238, 0.1)' }
                : { color: '#64748b' }
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[340px] p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-nx-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey={range === '1d' || range === '5d' ? 'time_label' : 'date'}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={65}
                tickFormatter={v => v.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b8dee" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#5b8dee" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="close" fill="url(#chartFill)" stroke="none" />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#5b8dee"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#5b8dee', stroke: 'rgba(91, 141, 238, 0.4)', strokeWidth: 6 }}
                style={{ filter: 'drop-shadow(0 0 4px rgba(91, 141, 238, 0.3))' }}
              />
              <Bar dataKey="volume" fill="rgba(91, 141, 238, 0.06)" yAxisId="volume" />
              <YAxis yAxisId="volume" orientation="right" hide domain={[0, d => d * 5]} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
