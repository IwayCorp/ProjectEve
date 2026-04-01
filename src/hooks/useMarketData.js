'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

export function useQuotes(symbols, refreshInterval = 15000) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const prevData = useRef({})

  const fetchData = useCallback(async () => {
    try {
      const symbolList = typeof symbols === 'object' && !Array.isArray(symbols)
        ? Object.values(symbols)
        : symbols
      const res = await fetch(`/api/quotes?symbols=${symbolList.join(',')}`)
      const json = await res.json()
      const quotes = {}
      for (const q of (json.result || [])) {
        quotes[q.symbol] = {
          ...q,
          priceDirection: prevData.current[q.symbol]
            ? q.regularMarketPrice > prevData.current[q.symbol].regularMarketPrice ? 'up'
            : q.regularMarketPrice < prevData.current[q.symbol].regularMarketPrice ? 'down'
            : 'flat'
            : 'flat',
        }
      }
      prevData.current = quotes
      setData(quotes)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [symbols])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval])

  return { data, loading, error, refetch: fetchData }
}

export function useCorrelation(refreshInterval = 300000) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch('/api/correlation')
        const json = await res.json()
        setData(json.correlations || [])
      } catch (e) {
        console.error('Correlation fetch error:', e)
      } finally {
        setLoading(false)
      }
    }
    fetch_()
    const interval = setInterval(fetch_, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  return { data, loading }
}
