// Free market data fetcher using Yahoo Finance v8 API (no key required)
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance'

// Symbol mapping for our dashboard
export const SYMBOLS = {
  indices: {
    'S&P 500': '^GSPC',
    'Nasdaq': '^IXIC',
    'Dow Jones': '^DJI',
    'VIX': '^VIX',
    'Russell 2000': '^RUT',
  },
  bonds: {
    'US 10Y': '^TNX',
    'US 2Y': '^IRX',
    'US 30Y': '^TYX',
  },
  commodities: {
    'Gold': 'GC=F',
    'WTI Crude': 'CL=F',
    'Silver': 'SI=F',
    'Nat Gas': 'NG=F',
  },
  forex: {
    'USD/JPY': 'JPY=X',
    'EUR/USD': 'EURUSD=X',
    'GBP/USD': 'GBPUSD=X',
    'DXY': 'DX-Y.NYB',
  },
  sectors: {
    'Energy (XLE)': 'XLE',
    'Technology (XLK)': 'XLK',
    'Financials (XLF)': 'XLF',
    'Healthcare (XLV)': 'XLV',
    'Industrials (XLI)': 'XLI',
    'Cons. Staples (XLP)': 'XLP',
    'Cons. Disc. (XLY)': 'XLY',
    'Materials (XLB)': 'XLB',
    'Utilities (XLU)': 'XLU',
    'Comm. Svc (XLC)': 'XLC',
    'Real Estate (XLRE)': 'XLRE',
  },
  watchlist: {
    'MSFT': 'MSFT',
    'AAPL': 'AAPL',
    'RTX': 'RTX',
    'XOM': 'XOM',
    'CAT': 'CAT',
    'TSLA': 'TSLA',
    'NVDA': 'NVDA',
    'CVX': 'CVX',
  },
}

// Flatten all symbols for bulk fetch
export function getAllSymbols() {
  const all = {}
  for (const group of Object.values(SYMBOLS)) {
    Object.assign(all, group)
  }
  return all
}

// Fetch quotes for multiple symbols via our API route
export async function fetchQuotes(symbols) {
  const symbolList = Array.isArray(symbols) ? symbols : Object.values(symbols)
  const res = await fetch(`/api/quotes?symbols=${symbolList.join(',')}`)
  if (!res.ok) throw new Error('Failed to fetch quotes')
  return res.json()
}

// Fetch historical data for charts
export async function fetchHistory(symbol, range = '5d', interval = '15m') {
  const res = await fetch(`/api/market?symbol=${symbol}&range=${range}&interval=${interval}`)
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

// Calculate simple correlation between two price arrays
export function calculateCorrelation(x, y) {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  const xSlice = x.slice(-n)
  const ySlice = y.slice(-n)
  const xMean = xSlice.reduce((a, b) => a + b, 0) / n
  const yMean = ySlice.reduce((a, b) => a + b, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - xMean
    const dy = ySlice[i] - yMean
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return den === 0 ? 0 : num / den
}

// Format price with appropriate decimals
export function formatPrice(value, type = 'stock') {
  if (value == null) return '--'
  if (type === 'forex') return value.toFixed(4)
  if (type === 'yield') return value.toFixed(2) + '%'
  if (type === 'index') return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Format change percent
export function formatChange(value) {
  if (value == null) return '--'
  const sign = value >= 0 ? '+' : ''
  return sign + value.toFixed(2) + '%'
}
