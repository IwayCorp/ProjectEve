'use client'
import { formatChange } from '@/lib/marketData'
import { SYMBOLS } from '@/lib/marketData'

function getHeatColor(pct) {
  if (pct == null) return '#2a2e39'
  if (pct > 2) return 'rgba(38, 166, 154, 0.45)'
  if (pct > 1) return 'rgba(38, 166, 154, 0.30)'
  if (pct > 0) return 'rgba(38, 166, 154, 0.15)'
  if (pct > -1) return 'rgba(239, 83, 80, 0.15)'
  if (pct > -2) return 'rgba(239, 83, 80, 0.30)'
  return 'rgba(239, 83, 80, 0.45)'
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
    <div className="bg-tv-pane border border-tv-border rounded-md">
      <div className="p-3 border-b border-tv-border">
        <h3 className="text-sm font-semibold text-tv-text-strong">Sector Performance</h3>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {sectors.map(s => (
          <div
            key={s.symbol}
            className="rounded p-2.5 text-center transition-all hover:scale-[1.03] cursor-default border border-tv-border/50"
            style={{ backgroundColor: getHeatColor(s.change) }}
          >
            <div className="text-2xs font-semibold text-tv-text truncate mb-0.5">{s.label}</div>
            <div className={`text-sm font-bold font-mono ${(s.change || 0) >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
              {s.change != null ? formatChange(s.change) : '--'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
