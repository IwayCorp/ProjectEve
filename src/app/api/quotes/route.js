import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 0

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbols = searchParams.get('symbols')
  if (!symbols) {
    return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 })
  }

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=symbol,shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow,fiftyDayAverage,twoHundredDayAverage`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 15 }
    })

    if (!res.ok) {
      // Fallback: try v6 endpoint
      const v6Url = `https://query2.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(symbols)}`
      const v6Res = await fetch(v6Url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 15 }
      })
      if (!v6Res.ok) throw new Error(`Yahoo API error: ${res.status}`)
      const v6Data = await v6Res.json()
      return NextResponse.json(v6Data.quoteResponse || { result: [] })
    }

    const data = await res.json()
    return NextResponse.json(data.quoteResponse || { result: [] })
  } catch (error) {
    return NextResponse.json({ error: error.message, result: [] }, { status: 500 })
  }
}
