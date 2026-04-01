import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 0

// Fetch a single symbol with timeout
async function fetchSymbol(symbol, timeoutMs = 4000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d&includePrePost=false`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    const meta = data.chart?.result?.[0]?.meta
    const quote = data.chart?.result?.[0]?.indicators?.quote?.[0]
    const timestamps = data.chart?.result?.[0]?.timestamp || []
    if (!meta) return null

    const prevClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice
    const price = meta.regularMarketPrice
    const change = price - prevClose
    const changePercent = prevClose ? (change / prevClose) * 100 : 0

    let dayHigh = null, dayLow = null, dayOpen = null, volume = null
    if (quote && timestamps.length > 0) {
      const lastIdx = timestamps.length - 1
      dayHigh = quote.high?.[lastIdx]
      dayLow = quote.low?.[lastIdx]
      dayOpen = quote.open?.[lastIdx]
      volume = quote.volume?.[lastIdx]
    }

    return {
      symbol: meta.symbol,
      shortName: meta.shortName || meta.symbol,
      regularMarketPrice: price,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      regularMarketPreviousClose: prevClose,
      regularMarketOpen: dayOpen,
      regularMarketDayHigh: dayHigh,
      regularMarketDayLow: dayLow,
      regularMarketVolume: volume,
      currency: meta.currency,
      exchangeName: meta.exchangeName,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      fiftyDayAverage: meta.fiftyDayAverage,
      twoHundredDayAverage: meta.twoHundredDayAverage,
    }
  } catch (e) {
    clearTimeout(timeout)
    return null
  }
}

// Process symbols in batches to avoid rate limiting
async function fetchBatch(symbols, batchSize = 8) {
  const results = []
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map(symbol => fetchSymbol(symbol))
    )
    results.push(...batchResults)
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(r => setTimeout(r, 100))
    }
  }
  return results
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbols = searchParams.get('symbols')
  if (!symbols) {
    return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 })
  }

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean)

  try {
    const results = await fetchBatch(symbolList)

    const quotes = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value)

    return NextResponse.json({ result: quotes })
  } catch (error) {
    // Even on error, return partial results if possible
    return NextResponse.json({ error: error.message, result: [] }, { status: 500 })
  }
}
