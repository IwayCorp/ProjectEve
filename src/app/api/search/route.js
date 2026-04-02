import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] })
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=false`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ results: [] })
    }

    const data = await res.json()
    const results = (data.quotes || [])
      .filter(q => q.symbol && q.quoteType && !q.symbol.includes('.') || q.symbol.includes('=') || q.symbol.includes('-') || q.symbol.startsWith('^'))
      .map(q => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType, // EQUITY, INDEX, CURRENCY, CRYPTOCURRENCY, ETF, FUTURE
        exchange: q.exchange,
      }))

    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ results: [] })
  }
}
