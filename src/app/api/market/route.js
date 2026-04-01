import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || '^GSPC'
  const range = searchParams.get('range') || '5d'
  const interval = searchParams.get('interval') || '15m'

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 30 }
    })

    if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`)

    const data = await res.json()
    const result = data.chart?.result?.[0]

    if (!result) {
      return NextResponse.json({ error: 'No data found', candles: [] })
    }

    const timestamps = result.timestamp || []
    const quote = result.indicators?.quote?.[0] || {}
    const candles = timestamps.map((t, i) => ({
      time: t,
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
      volume: quote.volume?.[i],
    })).filter(c => c.close != null)

    return NextResponse.json({
      symbol: result.meta?.symbol,
      currency: result.meta?.currency,
      exchangeName: result.meta?.exchangeName,
      regularMarketPrice: result.meta?.regularMarketPrice,
      candles,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message, candles: [] }, { status: 500 })
  }
}
