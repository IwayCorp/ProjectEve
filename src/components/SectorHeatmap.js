'use client'
import { formatChange } from '@/lib/marketData'
import { SYMBOLS } from '@/lib/marketData'

function getHeatColor(pct) {
  if (pct == null) return '#1f2937'
  if (pct > 2) return '#065f46'
  if (pct > 1) return '#047857'
  if (pct > 0) return '#10b98130'
  if (pct > -1) return '#ef444430'
  if (pct > -2) return '#b91c1c'
  return '#7f1d1d'
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
    <div className="card">
      <h3 className="text-sm font-bold text-white mb-4">Sector Performance</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sectors.map(s => (
          <div
            key={s.symbol}
            className="rounded-lg p-3 text-center transition-all hover:scale-105 cursor-default"
            style={{ backgroundColor: getHeatColor(s.change) }}
          >
            <div className="text-xs font-bold text-white/90 mb-1 truncate">{s.label}</div>
            <div className={`text-sm font-bold font-mono ${(s.change || 0) >= 0 ? 'text-eve-green' : 'text-eve-red'}`}>
              {s.change != null ? formatChange(s.change) : '--'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
