'use client'
import { formatChange } from '@/lib/marketData'
import { SYMBOLS } from '@/lib/marketData'

function getHeatColor(pct) {
  if (pct == null) return 'rgba(255, 255, 255, 0.02)'
  if (pct > 2) return 'rgba(52, 211, 153, 0.25)'
  if (pct > 1) return 'rgba(52, 211, 153, 0.16)'
  if (pct > 0) return 'rgba(52, 211, 153, 0.08)'
  if (pct > -1) return 'rgba(248, 113, 113, 0.08)'
  if (pct > -2) return 'rgba(248, 113, 113, 0.16)'
  return 'rgba(248, 113, 113, 0.25)'
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
      <div className="p-3.5 border-b border-nx-border">
        <h3 className="text-sm font-semibold text-nx-text-strong">Sector Performance</h3>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {sectors.map(s => (
          <div
            key={s.symbol}
            className="rounded-lg p-2.5 text-center transition-all duration-300 hover:scale-[1.03] cursor-default border border-nx-border/50"
            style={{ backgroundColor: getHeatColor(s.change) }}
          >
            <div className="text-2xs font-semibold text-nx-text truncate mb-0.5">{s.label}</div>
            <div className={`text-sm font-bold font-mono tabular-nums ${(s.change || 0) >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
              {s.change != null ? formatChange(s.change) : '--'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
