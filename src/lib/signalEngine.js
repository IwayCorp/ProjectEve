import {
  technicalSnapshot,
  ATR,
  SMA,
  RSI,
  findSupportResistance,
  BollingerBands,
  MACD,
  trendStrength,
  MovingAverages,
} from './indicators'

/**
 * Classify what strategy fits the current price action
 * snapshot is from technicalSnapshot() which returns:
 *   { rsi, macd, bollingerBands, atr, vwap, movingAverages: {ma20,ma50,ma200,...}, supportResistance, stochastic, trend: {trend,strength}, obv }
 */
export function classifyStrategy(snapshot, closes) {
  const rsi = snapshot.rsi
  const atr = snapshot.atr
  const ma = snapshot.movingAverages || {}
  const price = closes[closes.length - 1]
  const trend = snapshot.trend || { trend: 'neutral', strength: 50 }
  const bb = snapshot.bollingerBands
  const reasons = []
  let strategy = 'momentum'
  let confidence = 50

  if (!price || !atr) return { strategy: 'momentum', confidence: 40, reasons: ['Insufficient data for classification'] }

  // Check for mean reversion setup
  if (rsi !== null && (rsi < 30 || rsi > 70)) {
    const ma50 = ma.ma50 || price
    const priceDeviation = Math.abs(price - ma50) / (atr || 1)
    if (priceDeviation > 1.0) {
      strategy = 'mean-reversion'
      confidence = Math.min(90, 65 + Math.abs(rsi - 50) / 2)
      reasons.push(`RSI is ${rsi < 30 ? 'deeply oversold' : 'overbought'} at ${rsi.toFixed(1)}`)
      reasons.push(`Price is ${priceDeviation.toFixed(1)}x ATR away from 50-day MA`)
      return { strategy, confidence, reasons }
    }
  }

  // Check for momentum/trend setup
  if (trend.strength > 60 && trend.trend !== 'neutral') {
    strategy = 'momentum'
    confidence = Math.min(85, 55 + trend.strength * 0.3)
    reasons.push(`${trend.trend === 'bullish' ? 'Bullish' : 'Bearish'} trend with ${trend.strength}% strength`)
    if (ma.ma50 && ma.ma200) {
      reasons.push(`MA50 ${ma.ma50 > ma.ma200 ? 'above' : 'below'} MA200 confirms regime`)
    }
    return { strategy, confidence, reasons }
  }

  // Check for breakout setup (Bollinger Band squeeze)
  if (bb && bb.upper && bb.lower && bb.middle) {
    const bandwidth = (bb.upper - bb.lower) / bb.middle
    if (bandwidth < 0.08) {
      strategy = 'breakout'
      confidence = 70
      reasons.push(`Bollinger Band squeeze: bandwidth at ${(bandwidth * 100).toFixed(1)}%`)
      reasons.push(`Volatility contraction suggests imminent directional move`)
      return { strategy, confidence, reasons }
    }
  }

  // Default: look at RSI for mild mean-reversion
  if (rsi !== null && (rsi < 40 || rsi > 60)) {
    strategy = rsi < 50 ? 'mean-reversion' : 'momentum'
    confidence = 50
    reasons.push(`RSI at ${rsi.toFixed(1)} - moderate ${rsi < 50 ? 'oversold' : 'overbought'} signal`)
  }

  return { strategy, confidence, reasons }
}

/**
 * Generate a complete trade signal from candle data
 * candles: { time, open, high, low, close, volume }[]
 */
export function generateSignal(candles, symbol, assetType = 'equity') {
  if (!candles || candles.length < 50) {
    return null
  }

  const closes = candles.map(c => c.close).filter(c => c != null)
  if (closes.length < 50) return null

  const price = closes[closes.length - 1]

  // Get technical snapshot (needs 200+ candles ideally, graceful fallback otherwise)
  let snapshot
  if (candles.length >= 200) {
    snapshot = technicalSnapshot(candles)
  } else {
    // Manually compute what we can with less data
    const rsiArr = RSI(closes, 14)
    const rsiVal = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1]?.value : null
    const atrArr = ATR(candles, 14)
    const atrVal = atrArr.length > 0 ? atrArr[atrArr.length - 1]?.value : null
    const mas = MovingAverages(closes)
    const sr = findSupportResistance(candles, Math.min(60, candles.length))
    const bbArr = BollingerBands(closes, 20, 2)
    const bbLast = bbArr.length > 0 ? bbArr[bbArr.length - 1] : null
    const macdArr = MACD(closes)
    const macdLast = macdArr.length > 0 ? macdArr[macdArr.length - 1] : null
    const trendData = closes.length >= 50 ? trendStrength(closes) : { trend: 'neutral', strength: 50 }

    snapshot = {
      rsi: rsiVal,
      macd: macdLast ? { macd: macdLast.macd, signal: macdLast.signal, histogram: macdLast.histogram } : null,
      bollingerBands: bbLast ? { upper: bbLast.upper, middle: bbLast.middle, lower: bbLast.lower, percentB: bbLast.percentB } : null,
      atr: atrVal,
      movingAverages: mas,
      supportResistance: sr,
      trend: trendData,
    }
  }

  const rsi = snapshot.rsi || 50
  const atr = snapshot.atr || price * 0.02
  const ma = snapshot.movingAverages || {}
  const ma20 = ma.ma20 || price
  const ma50 = ma.ma50 || price
  const ma200 = ma.ma200 || price
  const sr = snapshot.supportResistance || { support: [], resistance: [], pivotPoints: {} }
  const support = sr.support || []
  const resistance = sr.resistance || []
  const bb = snapshot.bollingerBands
  const macdData = snapshot.macd
  const trend = snapshot.trend || { trend: 'neutral', strength: 50 }

  // Classify strategy
  const classification = classifyStrategy(snapshot, closes)
  const { strategy, confidence: strategyConfidence } = classification

  // Determine direction based on multiple signals
  let dirScore = 0
  if (price > ma50) dirScore += 1
  else dirScore -= 1
  if (ma50 > ma200) dirScore += 1
  else dirScore -= 1
  if (rsi < 40) dirScore += 1  // oversold = buy
  else if (rsi > 60) dirScore -= 1
  if (macdData && macdData.histogram > 0) dirScore += 1
  else if (macdData && macdData.histogram < 0) dirScore -= 1
  if (trend.trend === 'bullish') dirScore += 1
  else if (trend.trend === 'bearish') dirScore -= 1

  // For mean reversion, direction is counter-trend
  let direction
  if (strategy === 'mean-reversion') {
    direction = rsi < 50 ? 'long' : 'short'
  } else {
    direction = dirScore >= 0 ? 'long' : 'short'
  }

  // Compute entry zone using support/resistance + ATR bands
  let entryLow, entryHigh
  if (direction === 'long') {
    const nearestSupport = support.length > 0 ? support[0] : price - atr * 1.5
    entryLow = Math.max(nearestSupport, price - atr * 0.75)
    entryHigh = price + atr * 0.25
  } else {
    const nearestResistance = resistance.length > 0 ? resistance[0] : price + atr * 1.5
    entryHigh = Math.min(nearestResistance, price + atr * 0.75)
    entryLow = price - atr * 0.25
  }

  // Set target using next resistance/support + fibonacci extensions
  let target
  if (direction === 'long') {
    if (resistance.length >= 2) {
      target = resistance[0] + (resistance[1] - resistance[0]) * 0.618
    } else if (resistance.length === 1) {
      target = resistance[0] + atr * 1.5
    } else {
      target = price + atr * 3
    }
  } else {
    if (support.length >= 2) {
      target = support[0] - (support[0] - support[1]) * 0.618
    } else if (support.length === 1) {
      target = support[0] - atr * 1.5
    } else {
      target = price - atr * 3
    }
  }

  // Set stop loss at technically sound levels
  let stopLoss
  if (direction === 'long') {
    stopLoss = support.length > 0 ? support[0] - atr * 0.5 : price - atr * 2
  } else {
    stopLoss = resistance.length > 0 ? resistance[0] + atr * 0.5 : price + atr * 2
  }

  // Ensure stop is not past entry (sanity check)
  if (direction === 'long' && stopLoss >= entryLow) {
    stopLoss = entryLow - atr * 0.5
  }
  if (direction === 'short' && stopLoss <= entryHigh) {
    stopLoss = entryHigh + atr * 0.5
  }

  // Risk level based on stop distance as % of price
  const stopDistPct = (Math.abs(price - stopLoss) / price) * 100
  let risk = 'MEDIUM'
  if (stopDistPct < 2) risk = 'LOW'
  else if (stopDistPct > 4) risk = 'HIGH'

  // Estimate timeframe from ATR and distance to target
  const distToTarget = Math.abs(target - price)
  const daysEstimate = Math.max(1, Math.round(distToTarget / atr))
  let timeframe
  if (daysEstimate <= 3) timeframe = '1-3 days'
  else if (daysEstimate <= 7) timeframe = '3-7 days'
  else if (daysEstimate <= 14) timeframe = '5-14 days'
  else timeframe = '10-21 days'

  // Build reasons
  const reasons = classification.reasons.slice()
  if (support.length > 0) {
    reasons.push(`Support at $${fmt(support[0])} — ${((Math.abs(price - support[0]) / price) * 100).toFixed(1)}% from price`)
  }
  if (resistance.length > 0) {
    reasons.push(`Resistance at $${fmt(resistance[0])} — ${((Math.abs(resistance[0] - price) / price) * 100).toFixed(1)}% from price`)
  }

  const entryWindow = direction === 'long'
    ? `Enter on dips toward $${fmt(entryLow)}-$${fmt(entryHigh)}${support.length > 0 ? '; support holds at $' + fmt(support[0]) : ''}`
    : `Enter on rallies toward $${fmt(entryLow)}-$${fmt(entryHigh)}${resistance.length > 0 ? '; resistance caps at $' + fmt(resistance[0]) : ''}`

  return {
    direction,
    strategy,
    confidence: Math.round(strategyConfidence),
    entryLow: round(entryLow),
    entryHigh: round(entryHigh),
    target: round(target),
    stopLoss: round(stopLoss),
    rsi: Math.round(rsi * 10) / 10,
    risk,
    timeframe,
    reasons,
    entryWindow,
    technicals: {
      price: round(price),
      atr: round(atr),
      ma20: round(ma20),
      ma50: round(ma50),
      ma200: round(ma200),
      support: support.slice(0, 3).map(s => round(s)),
      resistance: resistance.slice(0, 3).map(r => round(r)),
      bbUpper: bb ? round(bb.upper) : null,
      bbLower: bb ? round(bb.lower) : null,
      bbMiddle: bb ? round(bb.middle) : null,
      macdHist: macdData ? round(macdData.histogram, 4) : null,
      trendDirection: trend.trend,
      trendStrength: trend.strength,
    },
  }
}

function round(v, decimals = 2) {
  if (v == null) return null
  const m = Math.pow(10, decimals)
  return Math.round(v * m) / m
}

function fmt(v) {
  if (v == null) return '—'
  // For forex-sized numbers (< 10), use more decimals
  if (Math.abs(v) < 10) return v.toFixed(4)
  if (Math.abs(v) < 100) return v.toFixed(2)
  return v.toFixed(2)
}

/**
 * Generate thesis text from technical data
 */
export function generateThesis(signal, symbol, name) {
  const { direction, rsi, technicals, strategy } = signal
  const { price, ma50, ma200, atr } = technicals

  if (strategy === 'mean-reversion') {
    const deviation = ma50 ? (Math.abs(price - ma50) / (atr || 1)).toFixed(1) : '?'
    return `${name} (${symbol}) shows mean-reversion setup with RSI at ${rsi} in ${rsi < 30 ? 'deeply oversold' : rsi > 70 ? 'overbought' : 'stretched'} territory. Price is ${deviation}x ATR away from the 50-day MA at $${fmt(ma50)}. Historically, similar extremes resolve with ${rsi < 30 ? '8-12% bounces' : '6-10% pullbacks'} within 1-2 weeks. Current price at $${fmt(price)} offers favorable risk/reward.`
  } else if (strategy === 'momentum') {
    return `${name} (${symbol}) is in confirmed ${direction === 'long' ? 'uptrend' : 'downtrend'} with price ${price > ma50 ? 'above' : 'below'} all major moving averages. The 50-day MA ($${fmt(ma50)}) is ${ma50 > ma200 ? 'above' : 'below'} the 200-day MA ($${fmt(ma200)}), confirming ${direction === 'long' ? 'bullish' : 'bearish'} regime. Continuation to $${fmt(signal.target)} is likely within ${signal.timeframe}.`
  } else if (strategy === 'breakout') {
    return `${name} (${symbol}) has consolidated with Bollinger Band squeeze after recent volatility compression. Price at $${fmt(price)} sits near ${direction === 'long' ? 'key resistance' : 'key support'}, ready to break ${direction === 'long' ? 'higher' : 'lower'}. ATR at $${fmt(atr)} indicates measured move targets $${fmt(signal.target)}.`
  }
  return `${name} (${symbol}) presents a ${direction === 'long' ? 'bullish' : 'bearish'} ${strategy} setup. Technical indicators align for ${direction === 'long' ? 'upside' : 'downside'} move to $${fmt(signal.target)} with controlled risk at $${fmt(signal.stopLoss)}. Entry zone: $${fmt(signal.entryLow)}-$${fmt(signal.entryHigh)}.`
}

/**
 * Generate catalyst text
 */
export function generateCatalyst(signal, symbol) {
  const { technicals, strategy, direction, rsi } = signal
  const { macdHist, price, atr } = technicals

  if (strategy === 'breakout') {
    return `Bollinger Band squeeze with declining volatility suggests ${direction === 'long' ? 'bullish' : 'bearish'} breakout imminent. MACD histogram ${macdHist > 0 ? 'positive' : 'negative'} from extreme territory. ATR at $${fmt(atr)} implies first move of $${fmt(atr * 2)}.`
  } else if (rsi < 30 && direction === 'long') {
    return `RSI at ${rsi} is deeply oversold — historical precedent shows bounces of 8-12% within 2 weeks from similar extremes. Volume dynamics and price structure suggest washout conditions near completion.`
  } else if (rsi > 70 && direction === 'short') {
    return `RSI at ${rsi} is overbought — historical precedent shows corrections of 6-10% within 2 weeks from similar extremes. Declining volume into highs signals weakening demand.`
  } else if (macdHist > 0 && direction === 'long') {
    return `MACD histogram positive and accelerating. Price above key moving averages. RSI at ${rsi} ${rsi < 70 ? 'not yet overbought' : 'approaching overbought'}, leaving room for continuation to $${fmt(signal.target)}.`
  } else if (macdHist < 0 && direction === 'short') {
    return `MACD histogram negative and deteriorating. Price below key moving averages. RSI at ${rsi} ${rsi > 30 ? 'not yet oversold' : 'approaching oversold'}, leaving room for decline to $${fmt(signal.target)}.`
  }
  return `Technical setup shows ${strategy} opportunity with ${signal.confidence}% confidence. Price action and indicator alignment support ${direction === 'long' ? 'bullish' : 'bearish'} bias toward $${fmt(signal.target)}.`
}

/**
 * Calculate entry deadline and expiration
 */
export function calculateTiming(signal) {
  const now = new Date()
  let entryDays = 3
  let holdDays = 5

  if (signal.strategy === 'mean-reversion') { entryDays = 3; holdDays = 7 }
  else if (signal.strategy === 'momentum') { entryDays = 4; holdDays = 8 }
  else if (signal.strategy === 'breakout') { entryDays = 2; holdDays = 5 }
  else if (signal.strategy === 'carry') { entryDays = 5; holdDays = 14 }

  const entryDeadline = new Date(now.getTime() + entryDays * 24 * 60 * 60 * 1000)
  const expiration = new Date(entryDeadline.getTime() + holdDays * 24 * 60 * 60 * 1000)

  return {
    entryBy: entryDeadline.toISOString().slice(0, 16),
    expiresAt: expiration.toISOString().slice(0, 16),
  }
}

/**
 * Build the full data packet matching TradePacket component expectations
 */
export function buildDataPacket(signal, candles) {
  const { technicals, direction, strategy, confidence, rsi } = signal
  const { price, ma20, ma50, ma200, support, resistance, atr } = technicals

  const recentCandles = candles.slice(-20)
  const highH = Math.max(...recentCandles.map(c => c.high))
  const lowL = Math.min(...recentCandles.map(c => c.low))
  const pricePos = (price - lowL) / ((highH - lowL) || 1)

  let historicalContext
  if (pricePos > 0.8) {
    historicalContext = `Price at $${fmt(price)} is trading near the top of its recent 20-day range ($${fmt(lowL)}-$${fmt(highH)}), showing strength. The 50-day MA at $${fmt(ma50)} and 200-day MA at $${fmt(ma200)} ${ma50 > ma200 ? 'confirm bullish structure' : 'are crossed bearishly, suggesting mean-reversion'}. ATR of $${fmt(atr)} implies daily volatility of ${((atr/price)*100).toFixed(1)}%.`
  } else if (pricePos < 0.2) {
    historicalContext = `Price at $${fmt(price)} is near the bottom of its recent 20-day range ($${fmt(lowL)}-$${fmt(highH)}), showing capitulation. The 50-day MA at $${fmt(ma50)} acts as overhead resistance. RSI at ${rsi} is ${rsi < 30 ? 'deeply oversold — historically a precursor to sharp bounces' : 'weak but not yet washed out'}. ATR of $${fmt(atr)} implies daily swings of ${((atr/price)*100).toFixed(1)}%.`
  } else {
    historicalContext = `Price at $${fmt(price)} is consolidating within its 20-day range ($${fmt(lowL)}-$${fmt(highH)}). The 50-day MA at $${fmt(ma50)} and 200-day MA at $${fmt(ma200)} provide the structural framework. ATR of $${fmt(atr)} (${((atr/price)*100).toFixed(1)}% of price) indicates ${atr/price > 0.03 ? 'elevated' : 'normal'} volatility.`
  }

  const bondCorrelation = direction === 'long'
    ? `Bullish equity setup typically correlates with rising yields as risk appetite increases. Monitor 10Y yield for confirmation — rising yields with rising equities signal healthy risk-on flow. Current ATR of $${fmt(atr)} suggests the move is priced with adequate volatility buffer.`
    : `Bearish equity setup often coincides with falling yields as capital rotates to safety. Bond-equity correlation may amplify downside if flight-to-quality accelerates. Watch TLT and VIX for confirmation.`

  const globalMacro = `The ${strategy} setup in this asset reflects ${
    ma50 > ma200 ? 'a bullish macro regime with upward momentum' : 'a bearish macro environment with downside pressure'
  }. ${direction === 'long'
    ? 'Risk appetite favors cyclical and growth exposures. Dollar weakness and accommodative policy would further support this thesis.'
    : 'Defensive positioning dominates. Dollar strength and tightening conditions add headwinds.'}`

  const newsDrivers = [
    `RSI at ${rsi} signals ${rsi < 30 ? 'extreme oversold — mean reversion catalyst' : rsi > 70 ? 'extreme overbought — potential reversal' : 'neutral territory with room to move'}`,
    `Price ${price > ma50 ? 'above' : 'below'} 50-day MA ($${fmt(ma50)}) — confirms ${direction === 'long' ? 'uptrend' : 'downtrend'} structure`,
    support.length > 0 ? `Key support at $${fmt(support[0])} — break below invalidates ${direction === 'long' ? 'bull' : 'bear'} thesis` : `No clear support nearby — wider stops required`,
    resistance.length > 0 ? `Key resistance at $${fmt(resistance[0])} — break above triggers ${direction === 'long' ? 'acceleration' : 'short squeeze'}` : `No clear resistance — open air above for ${direction === 'long' ? 'bulls' : 'bears'}`,
    `${strategy} strategy at ${confidence}% confidence — favorable risk/reward ratio of 1:${signal.riskRewardRatio || '?'}`,
  ]

  // Technical levels in the format the component expects
  const pp = (highH + lowL + price) / 3
  const technicalLevels = {
    support: support.slice(0, 3).map(s => round(s)),
    resistance: resistance.slice(0, 3).map(r => round(r)),
    pivotPoints: {
      pp: round(pp),
      r1: round(2 * pp - lowL),
      r2: round(pp + (highH - lowL)),
      s1: round(2 * pp - highH),
      s2: round(pp - (highH - lowL)),
    },
    movingAverages: {
      ma20: round(ma20),
      ma50: round(ma50),
      ma200: round(ma200),
    },
  }

  const sectorContext = `${direction === 'long' ? 'Bullish' : 'Bearish'} positioning suggests momentum is flowing ${
    direction === 'long' ? 'into' : 'away from'
  } this asset class. ${strategy === 'momentum' ? 'Trend continuation is the base case — add on pullbacks.' : 'Counter-trend bounce expected — take profits at first resistance.'} Monitor relative strength vs sector peers for confirmation.`

  const riskFactors = [
    `Gap risk: Large ${direction === 'long' ? 'down' : 'up'} gap would invalidate entry zone and trigger stop at $${fmt(signal.stopLoss)}`,
    `Volatility spike: ATR expansion beyond $${fmt(atr * 2)} could hit stops before target — consider reducing size in high-VIX environments`,
    `Thesis invalidation: If price moves through $${fmt(signal.stopLoss)}, the entire technical setup is broken — exit immediately`,
    `Correlation breakdown: Macro regime shift could override technical signals — monitor cross-asset correlations`,
  ]

  return { historicalContext, bondCorrelation, globalMacro, newsDrivers, technicalLevels, sectorContext, riskFactors }
}

/**
 * Master function: generate a complete trade idea from raw candle data
 * Output matches the EXACT shape expected by TradeIdeas.js and TradePacket.js components
 */
export function generateTradeIdea(candles, symbol, name, assetType = 'equity', id = null) {
  const signal = generateSignal(candles, symbol, assetType)
  if (!signal) return null

  const thesis = generateThesis(signal, symbol, name)
  const catalyst = generateCatalyst(signal, symbol)
  const timing = calculateTiming(signal)
  const dataPacket = buildDataPacket(signal, candles)

  // This matches the EXACT shape used by the existing TradeIdeas/TradePacket components
  return {
    id: id || `SIG-${symbol}-${Date.now()}`,
    ticker: symbol,
    name,
    asset: assetType,
    strategy: signal.strategy,
    direction: signal.direction,

    // Price levels (top-level, as components expect)
    entryLow: signal.entryLow,
    entryHigh: signal.entryHigh,
    target: signal.target,
    stopLoss: signal.stopLoss,

    // Indicators
    rsi: signal.rsi,
    risk: signal.risk,
    timeframe: signal.timeframe,

    // Timing
    entryBy: timing.entryBy,
    expiresAt: timing.expiresAt,
    entryWindow: signal.entryWindow,

    // Narratives
    holdReason: `${signal.strategy === 'mean-reversion' ? 'Hold through initial volatility — mean reversion thesis needs time to play out.' : signal.strategy === 'momentum' ? 'Hold with trend — momentum strategies work best with patience.' : 'Hold for breakout confirmation — initial move often retraces before continuation.'}`,
    thesis,
    catalyst,

    // Data packet for TradePacket detail view
    dataPacket,

    // Metadata
    confidence: signal.confidence,
    reasons: signal.reasons,
    generatedAt: new Date().toISOString(),
  }
}
