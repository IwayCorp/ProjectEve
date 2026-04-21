export const runtime = 'edge'

import { initEvolutionEngine, evolve, getEvolutionReport } from '@/lib/evolutionEngine'

// ============ IN-MEMORY BRIEF STORE ============
// Persists per edge instance between requests. Not globally durable,
// but good enough for the "latest brief" pattern where the cron
// generates and the client reads within the same instance.

const briefStore = new Map()

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// ============ MARKET DATA ============

async function fetchYahooQuote(symbol, timeoutMs = 5000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=true`
    const res = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    const result = data.chart?.result?.[0]
    if (!result) return null
    const meta = result.meta || {}
    const quotes = result.indicators?.quote?.[0] || {}
    const closes = (quotes.close || []).filter(c => c != null)
    const highs = (quotes.high || []).filter(h => h != null)
    const lows = (quotes.low || []).filter(l => l != null)
    const volumes = (quotes.volume || []).filter(v => v != null)
    const prevClose = meta.chartPreviousClose || meta.previousClose || closes[closes.length - 2] || 0
    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1] || 0
    const change = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0
    return {
      symbol: meta.symbol || symbol,
      price: currentPrice,
      previousClose: prevClose,
      change,
      dayHigh: highs.length > 0 ? highs[highs.length - 1] : (meta.regularMarketDayHigh || 0),
      dayLow: lows.length > 0 ? lows[lows.length - 1] : (meta.regularMarketDayLow || 0),
      volume: volumes.length > 0 ? volumes[volumes.length - 1] : (meta.regularMarketVolume || 0),
      fiftyDayAvg: meta.fiftyDayAverage || 0,
      twoHundredDayAvg: meta.twoHundredDayAverage || 0,
    }
  } catch {
    clearTimeout(timeout)
    return null
  }
}

async function fetchMarketSnapshot() {
  const symbols = {
    SPY: 'SPY', QQQ: 'QQQ', IWM: 'IWM',
    VIX: '^VIX', TNX: '^TNX', DXY: 'DX-Y.NYB',
    XLK: 'XLK', XLF: 'XLF', XLE: 'XLE',
    XLV: 'XLV', XLI: 'XLI', XLP: 'XLP',
    XLU: 'XLU', XLRE: 'XLRE', XLB: 'XLB',
    XLC: 'XLC', XLY: 'XLY',
    GLD: 'GLD', TLT: 'TLT', HYG: 'HYG',
    BTC: 'BTC-USD', ETH: 'ETH-USD',
  }
  const entries = Object.entries(symbols)
  const results = await Promise.allSettled(
    entries.map(([, sym]) => fetchYahooQuote(sym))
  )
  const snapshot = {}
  entries.forEach(([key], i) => {
    const r = results[i]
    snapshot[key] = r.status === 'fulfilled' && r.value
      ? r.value
      : { symbol: key, price: 0, change: 0, error: true }
  })
  return snapshot
}

// ============ REGIME DETECTION ============

function detectRegime(snapshot) {
  const vix = snapshot.VIX?.price || 0
  const spyChange = snapshot.SPY?.change || 0
  const qqqChange = snapshot.QQQ?.change || 0
  const iwmChange = snapshot.IWM?.change || 0
  const avgChange = (spyChange + qqqChange + iwmChange) / 3

  if (vix > 30) return { regime: 'volatile-transition', confidence: 90, reason: `VIX at ${vix.toFixed(1)} signals extreme fear` }
  if (vix > 22) {
    if (avgChange < -0.5) return { regime: 'trending-bear', confidence: 75, reason: `Elevated VIX (${vix.toFixed(1)}) with broad selling` }
    return { regime: 'volatile-transition', confidence: 70, reason: `VIX elevated at ${vix.toFixed(1)} — choppy conditions likely` }
  }
  if (avgChange > 0.8) return { regime: 'trending-bull', confidence: 80, reason: `Strong breadth: SPY ${spyChange > 0 ? '+' : ''}${spyChange.toFixed(2)}%, QQQ ${qqqChange > 0 ? '+' : ''}${qqqChange.toFixed(2)}%` }
  if (avgChange < -0.8) return { regime: 'trending-bear', confidence: 80, reason: `Broad weakness: SPY ${spyChange.toFixed(2)}%, IWM ${iwmChange.toFixed(2)}%` }
  if (avgChange > 0.3) return { regime: 'trending-bull', confidence: 60, reason: 'Mildly positive session with low volatility' }
  if (avgChange < -0.3) return { regime: 'trending-bear', confidence: 60, reason: 'Mildly negative session with low volatility' }
  return { regime: 'mean-reverting', confidence: 65, reason: `Low VIX (${vix.toFixed(1)}), flat price action — range-bound conditions` }
}

// ============ SECTOR ANALYSIS ============

function analyzeSectors(snapshot) {
  const sectorMap = {
    XLK: 'Technology', XLF: 'Financials', XLE: 'Energy',
    XLV: 'Healthcare', XLI: 'Industrials', XLP: 'Staples',
    XLU: 'Utilities', XLRE: 'Real Estate', XLB: 'Materials',
    XLC: 'Communications', XLY: 'Discretionary',
  }
  const sectors = {}
  for (const [sym, name] of Object.entries(sectorMap)) {
    const d = snapshot[sym]
    if (d && !d.error) {
      sectors[name] = { change: d.change, price: d.price }
    }
  }
  const sorted = Object.entries(sectors).sort((a, b) => (b[1].change || 0) - (a[1].change || 0))
  return {
    sectors,
    leaders: sorted.slice(0, 3).map(([n, d]) => ({ name: n, change: d.change })),
    laggards: sorted.slice(-3).reverse().map(([n, d]) => ({ name: n, change: d.change })),
    breadth: sorted.filter(([, d]) => d.change > 0).length,
    totalSectors: sorted.length,
  }
}

// ============ INTER-MARKET ANALYSIS ============

function interMarketAnalysis(snapshot) {
  const insights = []
  const gld = snapshot.GLD
  const tlt = snapshot.TLT
  const hyg = snapshot.HYG
  const btc = snapshot.BTC
  const dxy = snapshot.DXY
  const tnx = snapshot.TNX
  const spy = snapshot.SPY

  // Gold vs Dollar
  if (gld && dxy && !gld.error && !dxy.error) {
    if (gld.change > 0.5 && dxy.change < -0.2) {
      insights.push('Gold rallying as dollar weakens — classic risk-off / inflation hedge rotation')
    } else if (gld.change > 0.5 && dxy.change > 0.2) {
      insights.push('Gold and dollar both rising — unusual, may signal geopolitical risk premium')
    }
  }

  // Bonds vs Equities
  if (tlt && spy && !tlt.error && !spy.error) {
    if (tlt.change > 0.3 && spy.change < -0.3) {
      insights.push('Flight to safety: treasuries bid while equities sell off')
    } else if (tlt.change < -0.3 && spy.change > 0.3) {
      insights.push('Risk-on: equities up, bonds selling off — growth optimism')
    } else if (tlt.change < -0.5 && spy.change < -0.3) {
      insights.push('Both bonds and stocks selling off — potential liquidity stress')
    }
  }

  // Credit spreads proxy
  if (hyg && tlt && !hyg.error && !tlt.error) {
    const spreadProxy = hyg.change - tlt.change
    if (spreadProxy < -0.5) {
      insights.push('Credit stress: high-yield underperforming treasuries')
    } else if (spreadProxy > 0.5) {
      insights.push('Credit optimism: high-yield outperforming treasuries')
    }
  }

  // Crypto correlation
  if (btc && spy && !btc.error && !spy.error) {
    if (Math.abs(btc.change) > 3) {
      insights.push(`BTC ${btc.change > 0 ? 'surging' : 'plunging'} ${Math.abs(btc.change).toFixed(1)}% — ${Math.sign(btc.change) === Math.sign(spy.change) ? 'correlating with' : 'diverging from'} equities`)
    }
  }

  // Yield dynamics
  if (tnx && !tnx.error) {
    if (tnx.price > 4.5) {
      insights.push(`10Y yield at ${tnx.price.toFixed(3)}% — approaching restrictive levels for rate-sensitive sectors`)
    } else if (tnx.price < 3.5) {
      insights.push(`10Y yield at ${tnx.price.toFixed(3)}% — accommodative for growth/tech`)
    }
  }

  return insights
}

// ============ BRIEF GENERATION ============

function getETTime() {
  const now = new Date()
  try {
    const str = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false })
    const etDate = new Date(str)
    return { hour: etDate.getHours(), minute: etDate.getMinutes(), dateStr: now.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }
  } catch {
    return { hour: now.getHours(), minute: now.getMinutes(), dateStr: now.toLocaleString() }
  }
}

function fmt(val, decimals = 2) {
  if (val == null || isNaN(val)) return '--'
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(decimals)}%`
}

function generateBrief(type, snapshot) {
  const now = new Date()
  const et = getETTime()
  const regimeInfo = detectRegime(snapshot)
  const sectorInfo = analyzeSectors(snapshot)
  const interMarket = interMarketAnalysis(snapshot)

  const spy = snapshot.SPY || {}
  const qqq = snapshot.QQQ || {}
  const iwm = snapshot.IWM || {}
  const vix = snapshot.VIX || {}
  const tnx = snapshot.TNX || {}
  const dxy = snapshot.DXY || {}
  const gld = snapshot.GLD || {}
  const tlt = snapshot.TLT || {}
  const btc = snapshot.BTC || {}

  const brief = {
    type,
    generatedAt: now.toISOString(),
    dateET: et.dateStr,
    marketSnapshot: {
      SPY: { price: spy.price, change: spy.change, dayHigh: spy.dayHigh, dayLow: spy.dayLow },
      QQQ: { price: qqq.price, change: qqq.change, dayHigh: qqq.dayHigh, dayLow: qqq.dayLow },
      IWM: { price: iwm.price, change: iwm.change, dayHigh: iwm.dayHigh, dayLow: iwm.dayLow },
      VIX: { price: vix.price, change: vix.change },
      '10Y': { price: tnx.price, change: tnx.change },
      DXY: { price: dxy.price, change: dxy.change },
    },
    sectors: sectorInfo.sectors,
    regime: regimeInfo.regime,
    regimeConfidence: regimeInfo.confidence,
    regimeReason: regimeInfo.reason,
    insights: [],
    actionItems: [],
    interMarketSignals: interMarket,
    sectorLeaders: sectorInfo.leaders,
    sectorLaggards: sectorInfo.laggards,
    sectorBreadth: `${sectorInfo.breadth}/${sectorInfo.totalSectors} sectors positive`,
    additionalAssets: {
      GLD: { price: gld.price, change: gld.change },
      TLT: { price: tlt.price, change: tlt.change },
      BTC: { price: btc.price, change: btc.change },
    },
  }

  // ---- Type-specific content ----

  if (type === 'pre-market') {
    brief.title = 'Pre-Market Intelligence Brief'

    // Gap analysis
    const gapPct = spy.change || 0
    const gapDir = gapPct > 0.3 ? 'gap up' : gapPct < -0.3 ? 'gap down' : 'flat open'
    brief.insights.push(`SPY indicating ${gapDir} ${Math.abs(gapPct).toFixed(2)}% from prior close`)

    // Breadth check
    if (sectorInfo.breadth >= 9) {
      brief.insights.push(`Strong breadth: ${sectorInfo.breadth}/${sectorInfo.totalSectors} sectors positive — broad-based move`)
    } else if (sectorInfo.breadth <= 3) {
      brief.insights.push(`Weak breadth: only ${sectorInfo.breadth}/${sectorInfo.totalSectors} sectors positive — narrow/defensive action`)
    } else {
      brief.insights.push(`Mixed breadth: ${sectorInfo.breadth}/${sectorInfo.totalSectors} sectors positive`)
    }

    // VIX context
    if (vix.price > 25) {
      brief.insights.push(`Elevated VIX at ${vix.price.toFixed(1)} — expect wide ranges and stop-runs; reduce size`)
    } else if (vix.price > 18) {
      brief.insights.push(`VIX at ${vix.price.toFixed(1)} — moderate volatility, standard position sizing`)
    } else {
      brief.insights.push(`Low VIX at ${vix.price.toFixed(1)} — compressed ranges, watch for breakout setups`)
    }

    // Regime
    brief.insights.push(`Regime assessment: ${regimeInfo.regime.replace(/-/g, ' ')} (${regimeInfo.confidence}% confidence)`)
    brief.insights.push(`Rationale: ${regimeInfo.reason}`)

    // Key levels
    if (spy.dayHigh && spy.dayLow && spy.price) {
      brief.insights.push(`SPY levels: ${spy.dayLow.toFixed(2)} (low) / ${spy.price.toFixed(2)} (current) / ${spy.dayHigh.toFixed(2)} (high)`)
    }

    // Yields and dollar
    if (tnx.price) brief.insights.push(`10Y yield: ${tnx.price.toFixed(3)}% (${fmt(tnx.change)})`)
    if (dxy.price) brief.insights.push(`Dollar index: ${dxy.price.toFixed(2)} (${fmt(dxy.change)})`)

    // Inter-market
    for (const im of interMarket) brief.insights.push(im)

    // Sector leaders/laggards
    if (sectorInfo.leaders.length > 0) {
      brief.insights.push(`Leading sectors: ${sectorInfo.leaders.map(s => `${s.name} (${fmt(s.change)})`).join(', ')}`)
    }
    if (sectorInfo.laggards.length > 0) {
      brief.insights.push(`Lagging sectors: ${sectorInfo.laggards.map(s => `${s.name} (${fmt(s.change)})`).join(', ')}`)
    }

    // Action items
    const stratMap = {
      'trending-bull': 'momentum',
      'trending-bear': 'momentum (short bias) or mean-reversion on oversold bounces',
      'mean-reverting': 'mean-reversion at range extremes',
      'volatile-transition': 'breakout with tight stops; reduce overall size 25-50%',
    }
    brief.actionItems.push(`Primary strategy: ${stratMap[regimeInfo.regime] || 'momentum'}`)
    if (gapPct > 0.5) brief.actionItems.push('Large gap up — watch for gap fill reversion or continuation above prior high')
    if (gapPct < -0.5) brief.actionItems.push('Large gap down — watch for gap fill bounce or breakdown below prior low')
    if (vix.price > 25) brief.actionItems.push('CRITICAL: Reduce position sizes in elevated VIX environment')
    brief.actionItems.push(`Key watchlist: ${sectorInfo.leaders.slice(0, 2).map(s => s.name).join(', ')} (strength) and ${sectorInfo.laggards.slice(0, 2).map(s => s.name).join(', ')} (weakness)`)

  } else if (type === 'midday') {
    brief.title = 'Midday Session Recap'

    brief.insights.push(`SPY ${fmt(spy.change)} at ${(spy.price || 0).toFixed(2)} at midday`)
    brief.insights.push(`QQQ ${fmt(qqq.change)} | IWM ${fmt(iwm.change)} — ${Math.sign(qqq.change || 0) === Math.sign(iwm.change || 0) ? 'correlated' : 'divergent'} action`)

    // Intraday regime
    brief.insights.push(`Intraday regime: ${regimeInfo.regime.replace(/-/g, ' ')} (${regimeInfo.confidence}%)`)
    brief.insights.push(regimeInfo.reason)

    // Sector rotation
    brief.insights.push(`Sector breadth: ${sectorInfo.breadth}/${sectorInfo.totalSectors} positive`)
    if (sectorInfo.leaders.length > 0) {
      brief.insights.push(`Leaders: ${sectorInfo.leaders.map(s => `${s.name} ${fmt(s.change)}`).join(' | ')}`)
    }
    if (sectorInfo.laggards.length > 0) {
      brief.insights.push(`Laggards: ${sectorInfo.laggards.map(s => `${s.name} ${fmt(s.change)}`).join(' | ')}`)
    }

    // VIX intraday
    if (vix.price) {
      brief.insights.push(`VIX at ${vix.price.toFixed(1)} (${fmt(vix.change)}) — ${vix.change > 5 ? 'spiking, risk-off' : vix.change < -5 ? 'collapsing, risk-on' : 'stable'}`)
    }

    // Inter-market
    for (const im of interMarket) brief.insights.push(im)

    // Afternoon outlook
    brief.actionItems.push(`Afternoon regime: ${regimeInfo.regime.replace(/-/g, ' ')} — ${regimeInfo.regime === 'mean-reverting' ? 'look for fades at extremes' : regimeInfo.regime.includes('trending') ? 'stay with the trend into close' : 'reduce size, tighten stops'}`)
    if (Math.abs(spy.change || 0) > 1) {
      brief.actionItems.push(`Big move day (SPY ${fmt(spy.change)}) — profit-taking likely into close; trail stops`)
    }
    brief.actionItems.push(`Key sectors to watch: ${sectorInfo.leaders[0]?.name || 'N/A'} (strong) vs ${sectorInfo.laggards[0]?.name || 'N/A'} (weak)`)

  } else {
    // post-close
    brief.title = 'Post-Close Audit & Tomorrow Outlook'

    brief.insights.push(`SPY closed ${fmt(spy.change)} at ${(spy.price || 0).toFixed(2)}`)
    brief.insights.push(`QQQ ${fmt(qqq.change)} | IWM ${fmt(iwm.change)}`)

    // Full day summary
    brief.insights.push(`Closing regime: ${regimeInfo.regime.replace(/-/g, ' ')} (${regimeInfo.confidence}%)`)
    brief.insights.push(regimeInfo.reason)

    // Sector performance
    brief.insights.push(`Sector breadth: ${sectorInfo.breadth}/${sectorInfo.totalSectors} closed positive`)
    if (sectorInfo.leaders.length > 0) {
      brief.insights.push(`Day leaders: ${sectorInfo.leaders.map(s => `${s.name} ${fmt(s.change)}`).join(' | ')}`)
    }
    if (sectorInfo.laggards.length > 0) {
      brief.insights.push(`Day laggards: ${sectorInfo.laggards.map(s => `${s.name} ${fmt(s.change)}`).join(' | ')}`)
    }

    // Cross-asset close
    if (gld.price) brief.insights.push(`Gold: $${gld.price.toFixed(2)} (${fmt(gld.change)})`)
    if (tlt.price) brief.insights.push(`Bonds (TLT): $${tlt.price.toFixed(2)} (${fmt(tlt.change)})`)
    if (btc.price) brief.insights.push(`Bitcoin: $${btc.price.toFixed(0)} (${fmt(btc.change)})`)

    // Inter-market
    for (const im of interMarket) brief.insights.push(im)

    // Tomorrow outlook
    const tomorrowRegime = regimeInfo.regime
    const stratMap = {
      'trending-bull': 'Continuation longs on pullbacks; momentum entries on breakouts',
      'trending-bear': 'Short setups on rallies; mean-reversion only on deep oversold',
      'mean-reverting': 'Fade moves at range extremes; tighter profit targets',
      'volatile-transition': 'Reduce size; breakout entries only with confirmation; wider stops',
    }
    brief.actionItems.push(`Tomorrow regime outlook: ${tomorrowRegime.replace(/-/g, ' ')}`)
    brief.actionItems.push(`Strategy: ${stratMap[tomorrowRegime] || 'Standard approach'}`)
    if (vix.price > 22) {
      brief.actionItems.push(`VIX still elevated at ${vix.price.toFixed(1)} — keep size reduced until volatility normalizes`)
    }
    if (Math.abs(spy.change || 0) > 1.5) {
      brief.actionItems.push(`Today was a ${Math.abs(spy.change).toFixed(1)}% move — watch for mean reversion or continuation gap tomorrow`)
    }
    brief.actionItems.push(`Watch: ${sectorInfo.leaders[0]?.name || 'N/A'} for continued strength, ${sectorInfo.laggards[0]?.name || 'N/A'} for potential bounce`)
  }

  return brief
}

// ============ HANDLER ============

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'pre-market'
  const action = searchParams.get('action')

  // Client read: return stored brief without regenerating
  if (action === 'get') {
    const stored = briefStore.get(type)
    if (stored) {
      return new Response(JSON.stringify({ success: true, brief: stored }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }
    return new Response(JSON.stringify({ success: true, brief: null, message: 'No brief generated yet for this slot' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  // Vercel Cron auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = typeof process !== 'undefined' && process.env ? process.env.CRON_SECRET : undefined
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Validate type
  if (!['pre-market', 'midday', 'post-close'].includes(type)) {
    return new Response(JSON.stringify({ error: `Invalid brief type: ${type}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const snapshot = await fetchMarketSnapshot()
    const brief = generateBrief(type, snapshot)

    // On post-close brief: trigger evolution cycle to learn from today's outcomes
    let evolutionResult = null
    if (type === 'post-close') {
      try {
        initEvolutionEngine()
        evolutionResult = evolve([]) // Evolve using accumulated trade outcomes
        brief.evolution = {
          generation: evolutionResult.generation,
          mutationsApplied: evolutionResult.mutationsApplied,
          fitnessScore: evolutionResult.fitnessScore,
          topFailures: evolutionResult.topFailures?.slice(0, 3),
          log: evolutionResult.log?.slice(0, 5),
        }
      } catch (e) {
        brief.evolution = { error: e.message }
      }
    }

    // Store for client retrieval
    briefStore.set(type, brief)

    return new Response(JSON.stringify({
      success: true,
      brief,
      evolutionResult: type === 'post-close' ? evolutionResult : undefined,
      generatedAt: brief.generatedAt,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to generate brief' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// POST handler for manual triggers from the dashboard
export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'pre-market'

  if (!['pre-market', 'midday', 'post-close'].includes(type)) {
    return new Response(JSON.stringify({ error: `Invalid brief type: ${type}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const snapshot = await fetchMarketSnapshot()
    const brief = generateBrief(type, snapshot)
    briefStore.set(type, brief)

    return new Response(JSON.stringify({
      success: true,
      brief,
      generatedAt: brief.generatedAt,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to generate brief' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
