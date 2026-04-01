'use client'
import { formatChange } from '@/lib/marketData'
import { SYMBOLS } from '@/lib/marketData'

function getHeatColor(pct) {
  if (pct == null) return 'rgba(255, 255, 255, 0.02)'
  if (pct > 2) return 'rgba(52, 211, 153, 0.22)'
  if (pct > 1) return 'rgba(52, 211, 153, 0.14)'
  if (pct > 0) return 'rgba(52, 211, 153, 0.07)'
  if (pct > -1) return 'rgba(248, 113, 113, 0.07)'
  if (pct > -2) return 'rgba(248, 113, 113, 0.14)'
  return 'rgba(248, 113, 113, 0.22)'
}

function getHeatBorder(pct) {
  if (pct == null) return 'rgba(255, 255, 255, 0.04)'
  if (pct > 1) return 'rgba(52, 211, 153, 0.15)'
  if (pct > 0) return 'rgba(52, 211, 153, 0.08)'
  if (pct > -1) return 'rgba(248, 113, 113, 0.08)'
  return 'rgba(248, 113, 113, 0.15)'
}

export default function SectorHeatmap({ quotes }) {
  const sectors = Object.entries(SYMBOLS.sectors).map(([label, sym]) => {
    const q = quotes[sym]
    return {
      label,
      symbol: sym,
      change: q?.regularMarketChangePercent,
      price: q?.regularMarketPrice,
    }
  }).sort((a, b) => (b.change || 0) - (a.change || 0))

  return (
    <div className="nx-card">
      <div className="p-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h3 className="text-sm font-bold" style={{ color: '#f1f5f9' }}>Sector Performance</h3>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sectors.map(s => (
          <div
            key={s.symbol}
            className="rounded-lg p-3 text-center transition-all duration-300 hover:scale-[1.03] cursor-default"
            style={{
              backgroundColor: getHeatColor(s.change),
              border: `1px solid ${getHeatBorder(s.change)}`,
            }}
          >
            <div className="text-2xs font-bold truncate mb-1" style={{ color: '#cbd5e1' }}>{s.label}</div>
            <div className={`text-sm font-bold font-mono tabular-nums ${(s.change || 0) >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
              {s.change != null ? formatChange(s.change) : '--'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
