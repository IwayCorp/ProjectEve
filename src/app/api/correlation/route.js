import { NextResponse } from 'next/server'

export const runtime = 'edge'

async function fetchClosePrices(symbol, range = '3mo', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 300 }
  })
  if (!res.ok) return []
  const data = await res.json()
  const result = data.chart?.result?.[0]
  if (!result) return []
  return (result.indicators?.quote?.[0]?.close || []).filter(v => v != null)
}

function correlate(x, y) {
  const n = Math.min(x.length, y.length)
  if (n < 5) return null
  const xs = x.slice(-n), ys = y.slice(-n)
  const xm = xs.reduce((a, b) => a + b, 0) / n
  const ym = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xm, dy = ys[i] - ym
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  const den = Math.sqrt(dx2 * dy2)
  return den === 0 ? 0 : Math.round((num / den) * 100) / 100
}

// Correlation pairs we track
const PAIRS = [
  { label: 'JGB 10Y vs USD/JPY', a: '^TNX', b: 'JPY=X' },  // proxy using US 10Y
  { label: 'US 10Y vs DXY', a: '^TNX', b: 'DX-Y.NYB' },
  { label: 'US 10Y vs S&P 500', a: '^TNX', b: '^GSPC' },
  { label: 'WTI vs US 10Y', a: 'CL=F', b: '^TNX' },
  { label: 'Gold vs VIX', a: 'GC=F', b: '^VIX' },
  { label: 'DXY vs EUR/USD', a: 'DX-Y.NYB', b: 'EURUSD=X' },
  { label: 'Oil vs Energy (XLE)', a: 'CL=F', b: 'XLE' },
  { label: 'S&P 500 vs Nasdaq', a: '^GSPC', b: '^IXIC' },
  { label: 'Gold vs USD/JPY', a: 'GC=F', b: 'JPY=X' },
  { label: 'VIX vs S&P 500', a: '^VIX', b: '^GSPC' },
]

export async function GET() {
  try {
    // Collect unique symbols
    const symbolSet = new Set()
    PAIRS.forEach(p => { symbolSet.add(p.a); symbolSet.add(p.b) })
    const symbols = [...symbolSet]

    // Fetch all price series in parallel
    const priceMap = {}
    const results = await Promise.allSettled(
      symbols.map(async (sym) => {
        priceMap[sym] = await fetchClosePrices(sym)
      })
    )

    // Compute correlations
    const correlations = PAIRS.map(pair => ({
      label: pair.label,
      symbolA: pair.a,
      symbolB: pair.b,
      correlation: correlate(priceMap[pair.a] || [], priceMap[pair.b] || []),
    }))

    return NextResponse.json({ correlations, timestamp: Date.now() })
  } catch (error) {
    return NextResponse.json({ error: error.message, correlations: [] }, { status: 500 })
  }
}
