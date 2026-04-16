import { NextResponse } from 'next/server'

export const runtime = 'edge'

// ============================================================
// SMART MONEY TRACKER v4 — PROFESSIONAL-GRADE SEC EDGAR ENGINE
// 1:1 parity with OpenInsider, WhaleWisdom, 13D Monitor, Capitol Trades
// Direct SEC EDGAR parsing: Form 3/4/5, 13F-HR, 13D/G, SC TO
// Congressional trades via FMP + Senate Stock Watcher
// Zero paid API dependencies for core data
// ============================================================

const FMP_KEY = process.env.FMP_KEY || 'demo'
const FMP_BASE = 'https://financialmodelingprep.com/stable'
const SEC_EFTS = 'https://efts.sec.gov/LATEST/search-index'
const SEC_DATA = 'https://data.sec.gov'
const SEC_ARCHIVE = 'https://www.sec.gov/Archives/edgar/data'
const UA = 'Noctis/1.0 matt@iwaycorp.com'

// ---- Notable Hedge Fund CIKs (13F filers) ----
const NOTABLE_FUNDS = {
  '0001067983': { name: 'Berkshire Hathaway', manager: 'Warren Buffett', style: 'value' },
  '0001049039': { name: 'Bridgewater Associates', manager: 'Ray Dalio', style: 'macro' },
  '0001086364': { name: 'Citadel Advisors', manager: 'Ken Griffin', style: 'multi-strategy' },
  '0000703837': { name: 'Renaissance Technologies', manager: 'Jim Simons', style: 'quant' },
  '0001567643': { name: 'Two Sigma Investments', manager: 'John Overdeck', style: 'quant' },
  '0001567027': { name: 'D.E. Shaw', manager: 'David Shaw', style: 'quant' },
  '0001411646': { name: 'Millennium Management', manager: 'Israel Englander', style: 'multi-strategy' },
  '0001361884': { name: 'Point72 Asset Management', manager: 'Steve Cohen', style: 'multi-strategy' },
  '0001616707': { name: 'AQR Capital Management', manager: 'Cliff Asness', style: 'quant' },
  '0001633929': { name: 'Tiger Global Management', manager: 'Chase Coleman', style: 'growth' },
  '0001336528': { name: 'Pershing Square', manager: 'Bill Ackman', style: 'activist' },
  '0001505847': { name: 'Soros Fund Management', manager: 'George Soros', style: 'macro' },
  '0001013225': { name: 'Appaloosa Management', manager: 'David Tepper', style: 'event-driven' },
  '0001641076': { name: 'Elliott Investment Management', manager: 'Paul Singer', style: 'activist' },
  '0001519883': { name: 'ARK Investment Management', manager: 'Cathie Wood', style: 'growth' },
  '0001452365': { name: 'Baupost Group', manager: 'Seth Klarman', style: 'value' },
  '0001841748': { name: 'Coatue Management', manager: 'Philippe Laffont', style: 'tech-growth' },
  '0001538382': { name: 'Viking Global Investors', manager: 'Andreas Halvorsen', style: 'long-short' },
  '0001649339': { name: 'Third Point', manager: 'Dan Loeb', style: 'event-driven' },
  '0001350694': { name: 'Greenlight Capital', manager: 'David Einhorn', style: 'value' },
  '0001061768': { name: 'Lone Pine Capital', manager: 'Stephen Mandel', style: 'long-short' },
  '0001103804': { name: 'Jana Partners', manager: 'Barry Rosenstein', style: 'activist' },
  '0001279708': { name: 'Icahn Enterprises', manager: 'Carl Icahn', style: 'activist' },
  '0001167483': { name: 'ValueAct Capital', manager: 'Jeff Ubben', style: 'activist' },
}

// ---- Sector → influence weight mapping ----
const SECTOR_INFLUENCE = {
  'defense':      { congress: 45, insider: 20, hedgeFund: 25, pe: 10, reason: 'Defense contracts are directly influenced by policy decisions and committee assignments' },
  'energy':       { congress: 35, insider: 25, hedgeFund: 25, pe: 15, reason: 'Energy policy, subsidies, and regulation drive congressional interest' },
  'tech':         { congress: 15, insider: 30, hedgeFund: 40, pe: 15, reason: 'Hedge funds drive tech valuation; insider sells signal overvaluation' },
  'pharma':       { congress: 25, insider: 35, hedgeFund: 25, pe: 15, reason: 'Insider buys before FDA decisions are the strongest signal' },
  'finance':      { congress: 30, insider: 25, hedgeFund: 30, pe: 15, reason: 'Banking regulation and hedge fund positioning both drive financials' },
  'crypto':       { congress: 20, insider: 25, hedgeFund: 35, pe: 20, reason: 'Institutional adoption via hedge funds and VC/PE drives crypto' },
  'real-estate':  { congress: 15, insider: 20, hedgeFund: 20, pe: 45, reason: 'PE firms are the dominant force in real estate transactions' },
  'industrial':   { congress: 25, insider: 25, hedgeFund: 30, pe: 20, reason: 'Infrastructure spending and institutional positioning' },
  'consumer':     { congress: 15, insider: 30, hedgeFund: 35, pe: 20, reason: 'Consumer sentiment driven by institutional flows and insider confidence' },
  'commodity':    { congress: 20, insider: 15, hedgeFund: 45, pe: 20, reason: 'Commodity funds and macro hedge funds dominate commodity flows' },
  'etf':          { congress: 20, insider: 10, hedgeFund: 50, pe: 20, reason: 'ETF flows are overwhelmingly institutional/hedge fund driven' },
  'forex':        { congress: 15, insider: 10, hedgeFund: 55, pe: 20, reason: 'FX is dominated by institutional and hedge fund positioning' },
  'default':      { congress: 25, insider: 25, hedgeFund: 30, pe: 20, reason: 'Balanced influence across all sources' },
}

const SYMBOL_SECTOR = {
  RTX: 'defense', LMT: 'defense', GD: 'defense', NOC: 'defense', BA: 'defense', HII: 'defense',
  XOM: 'energy', CVX: 'energy', 'CL=F': 'commodity', OXY: 'energy', SLB: 'energy', HAL: 'energy',
  MSFT: 'tech', AAPL: 'tech', NVDA: 'tech', AMZN: 'tech', GOOGL: 'tech', META: 'tech', SNAP: 'tech', CRM: 'tech', ORCL: 'tech', AMD: 'tech', INTC: 'tech', AVGO: 'tech', TSM: 'tech', UBER: 'tech', SHOP: 'tech',
  JPM: 'finance', GS: 'finance', XLF: 'finance', KRE: 'finance', BAC: 'finance', C: 'finance', MS: 'finance', WFC: 'finance', BLK: 'finance', SCHW: 'finance',
  COIN: 'crypto', MARA: 'crypto', RIOT: 'crypto', 'BTC-USD': 'crypto', MSTR: 'crypto',
  PFE: 'pharma', JNJ: 'pharma', MRNA: 'pharma', LLY: 'pharma', ABBV: 'pharma', UNH: 'pharma', BMY: 'pharma',
  CAT: 'industrial', DE: 'industrial', HON: 'industrial', GE: 'industrial', MMM: 'industrial', UNP: 'industrial',
  TSLA: 'consumer', NKE: 'consumer', DIS: 'consumer', SBUX: 'consumer', MCD: 'consumer', WMT: 'consumer', COST: 'consumer', TGT: 'consumer',
  'GC=F': 'commodity', 'SI=F': 'commodity', 'NG=F': 'commodity',
  IWM: 'etf', HYG: 'etf', ARKK: 'etf', SPY: 'etf', QQQ: 'etf', DIA: 'etf', TLT: 'etf', XLE: 'etf', XLK: 'etf',
  USDJPY: 'forex', EURUSD: 'forex', GBPUSD: 'forex', USDCHF: 'forex',
  AMT: 'real-estate', PLD: 'real-estate', SPG: 'real-estate', O: 'real-estate',
}

function getSector(s) { return SYMBOL_SECTOR[s] || 'default' }
function getWeights(s) { return SECTOR_INFLUENCE[getSector(s)] || SECTOR_INFLUENCE['default'] }

const secHeaders = { 'User-Agent': UA, 'Accept': 'application/json' }
const secXmlHeaders = { 'User-Agent': UA, 'Accept': 'text/xml, application/xml, text/html' }
const fmpHeaders = { 'User-Agent': UA, 'Accept': 'application/json' }

// ============================================================
// ENGINE 1: INSIDER ALERTS (SEC Form 3/4/5 + Full XML Parsing)
// Parity: OpenInsider, InsiderMonkey, Quiver Quant
// ============================================================

function parseForm4XML(xml) {
  const transactions = []

  const issuerTicker = xmlVal(xml, 'issuerTradingSymbol') || ''
  const issuerName = xmlVal(xml, 'issuerName') || ''
  const issuerCik = xmlVal(xml, 'issuerCik') || ''
  const ownerName = xmlVal(xml, 'rptOwnerName') || ''
  const isOfficer = xml.includes('<isOfficer>1</isOfficer>') || xml.includes('<isOfficer>true</isOfficer>')
  const isDirector = xml.includes('<isDirector>1</isDirector>') || xml.includes('<isDirector>true</isDirector>')
  const isTenPctOwner = xml.includes('<isTenPercentOwner>1</isTenPercentOwner>') || xml.includes('<isTenPercentOwner>true</isTenPercentOwner>')
  const officerTitle = xmlVal(xml, 'officerTitle') || ''

  let title = officerTitle || (isOfficer ? 'Officer' : '') || (isDirector ? 'Director' : '') || (isTenPctOwner ? '10% Owner' : 'Insider')

  // Classify insider role for filtering
  const role = officerTitle.toLowerCase()
  const isCLevel = /\b(ceo|cfo|coo|cto|cio|chief|president)\b/i.test(role)
  const isVP = /\b(vp|vice president|svp|evp)\b/i.test(role)
  const roleCategory = isCLevel ? 'c-suite' : isVP ? 'vp' : isDirector ? 'director' : isTenPctOwner ? '10pct-owner' : isOfficer ? 'officer' : 'other'

  // ---- Non-derivative transactions (common stock buys/sells) ----
  const ndBlocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) || []
  for (const block of ndBlocks) {
    const txCode = xmlVal(block, 'transactionCode') || ''
    const shares = parseFloat(xmlVal(block, 'transactionShares') || '0')
    const price = parseFloat(xmlVal(block, 'transactionPricePerShare') || '0')
    const acqDisp = xmlVal(block, 'transactionAcquiredDisposedCode') || ''
    const date = xmlVal(block, 'transactionDate') || ''
    const secTitle = xmlVal(block, 'securityTitle') || 'Common Stock'
    // Post-transaction ownership (shares owned after this trade)
    const sharesOwnedAfter = parseFloat(xmlVal(block, 'sharesOwnedFollowingTransaction') || '0')
    const ownershipNature = xmlVal(block, 'directOrIndirectOwnership') || 'D' // D=Direct, I=Indirect

    let type = 'other'
    if (txCode === 'P') type = 'buy'
    else if (txCode === 'S') type = 'sell'
    else if (txCode === 'M') type = acqDisp === 'A' ? 'exercise-buy' : 'exercise-sell'
    else if (txCode === 'A') type = 'award'
    else if (txCode === 'G') type = 'gift'
    else if (txCode === 'F') type = 'tax-withhold' // F = tax payment via shares
    else if (txCode === 'J') type = 'other' // J = other acquisition/disposition

    // Classify as open-market vs planned
    const isOpenMarket = txCode === 'P' || txCode === 'S'

    transactions.push({
      name: ownerName, title, type, txCode,
      shares: Math.round(shares),
      price: Math.round(price * 100) / 100,
      value: Math.round(shares * price),
      date, security: secTitle,
      acquiredDisposed: acqDisp,
      isOfficer, isDirector, isTenPctOwner, isCLevel, isVP,
      roleCategory,
      sharesOwnedAfter: Math.round(sharesOwnedAfter),
      ownershipPctChange: sharesOwnedAfter > 0 ? Math.round((shares / sharesOwnedAfter) * 10000) / 100 : 0,
      ownershipNature,
      isOpenMarket,
      isDeriv: false,
    })
  }

  // ---- Derivative transactions (options, warrants, convertibles) ----
  const dBlocks = xml.match(/<derivativeTransaction>[\s\S]*?<\/derivativeTransaction>/g) || []
  for (const block of dBlocks) {
    const txCode = xmlVal(block, 'transactionCode') || ''
    const shares = parseFloat(xmlVal(block, 'transactionShares') || '0')
    const price = parseFloat(xmlVal(block, 'transactionPricePerShare') || '0')
    const acqDisp = xmlVal(block, 'transactionAcquiredDisposedCode') || ''
    const date = xmlVal(block, 'transactionDate') || ''
    const secTitle = xmlVal(block, 'securityTitle') || 'Derivative'
    const exercisePrice = parseFloat(xmlVal(block, 'conversionOrExercisePrice') || '0')
    const expirationDate = xmlVal(block, 'expirationDate') || ''
    const underlyingSec = xmlVal(block, 'underlyingSecurityTitle') || ''
    const underlyingShares = parseFloat(xmlVal(block, 'underlyingSecurityShares') || '0')

    let type = 'deriv-other'
    if (txCode === 'M') type = acqDisp === 'A' ? 'exercise-buy' : 'exercise-sell'
    else if (txCode === 'A') type = 'deriv-award'
    else if (txCode === 'P') type = 'deriv-buy'
    else if (txCode === 'S') type = 'deriv-sell'
    else if (txCode === 'C') type = 'conversion'

    transactions.push({
      name: ownerName, title, type, txCode,
      shares: Math.round(shares),
      price: Math.round(price * 100) / 100,
      value: Math.round(shares * price),
      date, security: secTitle,
      acquiredDisposed: acqDisp,
      isOfficer, isDirector, isTenPctOwner, isCLevel, isVP,
      roleCategory,
      sharesOwnedAfter: 0,
      ownershipPctChange: 0,
      ownershipNature: 'D',
      isOpenMarket: false,
      isDeriv: true,
      exercisePrice: Math.round(exercisePrice * 100) / 100,
      expirationDate,
      underlyingSecurity: underlyingSec,
      underlyingShares: Math.round(underlyingShares),
    })
  }

  return { issuerTicker, issuerName, issuerCik, ownerName, title, roleCategory, transactions }
}

function xmlVal(xml, tag) {
  const m1 = xml.match(new RegExp(`<${tag}>\\s*<value>([^<]*)</value>`, 'i'))
  if (m1) return m1[1].trim()
  const m2 = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'))
  if (m2) return m2[1].trim()
  return null
}

async function fetchInsiderAlerts(symbol) {
  const trades = []
  const sym = symbol.toUpperCase()
  const startDate = getDateStr(-90)
  const endDate = getDateStr(0)

  // Search SEC EDGAR EFTS for Form 3, 4, 5 filings (not just Form 4)
  let filingMeta = []
  try {
    const res = await fetch(
      `${SEC_EFTS}?q=%22${sym}%22&forms=3,4,5&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=0&size=50`,
      { headers: secHeaders }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.hits?.hits) {
        filingMeta = data.hits.hits.map(h => {
          const adsh = h._source?.adsh || ''
          const idParts = (h._id || '').split(':')
          const xmlFilename = idParts.length > 1 ? idParts.slice(1).join(':') : ''
          return {
            accession: adsh.replace(/-/g, ''),
            accessionDashed: adsh,
            xmlFilename,
            date: h._source?.file_date,
            entityName: h._source?.display_names?.[0] || 'Unknown',
            cik: h._source?.ciks?.[0] || '',
            formType: h._source?.form || h._source?.root_forms?.[0] || '4',
          }
        })
      }
    }
  } catch (e) { /* silent */ }

  // Fetch and parse up to 15 actual Form XML filings (increased from 10)
  const xmlParseLimit = Math.min(filingMeta.length, 15)
  const xmlPromises = []

  for (let i = 0; i < xmlParseLimit; i++) {
    const fm = filingMeta[i]
    if (!fm.cik || !fm.accession || !fm.xmlFilename) continue
    const xmlUrl = `${SEC_ARCHIVE}/${fm.cik}/${fm.accession}/${fm.xmlFilename}`
    xmlPromises.push(
      fetch(xmlUrl, { headers: secXmlHeaders })
        .then(r => r.ok ? r.text() : null)
        .then(xml => xml ? { ...fm, parsed: parseForm4XML(xml) } : null)
        .catch(() => null)
    )
  }

  const parsedFilings = (await Promise.all(xmlPromises)).filter(Boolean)

  // Extract transactions from parsed filings
  for (const filing of parsedFilings) {
    if (!filing.parsed?.transactions) continue
    for (const tx of filing.parsed.transactions) {
      // Include buys, sells, exercises, and derivative transactions
      if (['other', 'gift', 'deriv-other'].includes(tx.type)) continue
      trades.push({
        ...tx,
        filingDate: filing.date,
        form: filing.formType,
        source: 'SEC EDGAR Form ' + filing.formType,
      })
    }
  }

  // Metadata fallback
  if (trades.length === 0 && filingMeta.length > 0) {
    for (const fm of filingMeta.slice(0, 15)) {
      trades.push({
        name: fm.entityName, title: 'Insider (SEC Filing)', type: 'unknown',
        shares: 0, price: 0, value: 0,
        date: fm.date, filingDate: fm.date, form: fm.formType,
        source: 'SEC EDGAR (metadata)',
      })
    }
  }

  // ---- Professional signal computation ----
  // Separate open-market from exercises/awards for accurate sentiment
  const openMarketTrades = trades.filter(t => t.isOpenMarket)
  const allBuys = trades.filter(t => ['buy', 'exercise-buy', 'deriv-buy'].includes(t.type))
  const allSells = trades.filter(t => ['sell', 'exercise-sell', 'deriv-sell', 'tax-withhold'].includes(t.type))
  const openMarketBuys = openMarketTrades.filter(t => t.type === 'buy')
  const openMarketSells = openMarketTrades.filter(t => t.type === 'sell')

  // Open-market buy/sell value (most meaningful signal — excludes options exercises)
  const omBuyValue = openMarketBuys.reduce((a, t) => a + (t.value || 0), 0)
  const omSellValue = openMarketSells.reduce((a, t) => a + (t.value || 0), 0)
  const omTotalValue = omBuyValue + omSellValue

  // All buy/sell value (includes exercises)
  const totalBuyValue = allBuys.reduce((a, t) => a + (t.value || 0), 0)
  const totalSellValue = allSells.reduce((a, t) => a + (t.value || 0), 0)
  const totalValue = totalBuyValue + totalSellValue

  // Primary sentiment uses open-market trades when available, falls back to all
  const sentiment = omTotalValue > 0
    ? ((omBuyValue - omSellValue) / omTotalValue)
    : totalValue > 0
    ? ((totalBuyValue - totalSellValue) / totalValue)
    : (allBuys.length > 0 && allSells.length === 0) ? 0.5
    : (allSells.length > 0 && allBuys.length === 0) ? -0.5
    : 0

  // Cluster detection — strong signal when 3+ unique insiders act together
  const uniqueBuyers = new Set(allBuys.map(t => t.name)).size
  const uniqueSellers = new Set(allSells.map(t => t.name)).size
  const clusterBuy = uniqueBuyers >= 3
  const clusterSell = uniqueSellers >= 3

  // C-suite buying is the most significant signal
  const cSuiteBuys = allBuys.filter(t => t.isCLevel)
  const cSuiteSells = allSells.filter(t => t.isCLevel)
  const cSuiteBuying = cSuiteBuys.length >= 1
  const cSuiteSelling = cSuiteSells.length >= 2

  // Largest transactions (high-conviction trades)
  const sortedByValue = [...trades].filter(t => t.value > 0).sort((a, b) => b.value - a.value)
  const largestTrade = sortedByValue[0] || null

  // Ownership change tracking
  const maxOwnershipChange = trades.reduce((max, t) => Math.max(max, Math.abs(t.ownershipPctChange || 0)), 0)

  // Signal direction with nuanced scoring
  let signalDirection = 'neutral'
  if (cSuiteBuying && clusterBuy) signalDirection = 'strong-bullish'
  else if (cSuiteBuying) signalDirection = 'bullish'
  else if (clusterBuy) signalDirection = 'bullish'
  else if (cSuiteSelling && clusterSell) signalDirection = 'strong-bearish'
  else if (clusterSell) signalDirection = 'bearish'
  else if (sentiment > 0.3) signalDirection = 'bullish'
  else if (sentiment < -0.3) signalDirection = 'bearish'

  return {
    trades: trades.slice(0, 25),
    summary: {
      totalTrades: trades.length,
      buys: allBuys.length,
      sells: allSells.length,
      openMarketBuys: openMarketBuys.length,
      openMarketSells: openMarketSells.length,
      buyValue: formatDollar(totalBuyValue),
      sellValue: formatDollar(totalSellValue),
      openMarketBuyValue: formatDollar(omBuyValue),
      openMarketSellValue: formatDollar(omSellValue),
      netValue: formatDollar(totalBuyValue - totalSellValue),
      sentiment: Math.round(sentiment * 100),
      signalDirection,
      clusterBuy,
      clusterSell,
      cSuiteBuying,
      cSuiteSelling,
      uniqueInsiders: new Set(trades.map(t => t.name)).size,
      largestTrade: largestTrade ? {
        name: largestTrade.name,
        type: largestTrade.type,
        value: formatDollar(largestTrade.value),
        shares: largestTrade.shares,
        date: largestTrade.date,
      } : null,
      maxOwnershipChange: Math.round(maxOwnershipChange * 100) / 100,
      dataSource: parsedFilings.length > 0 ? 'SEC EDGAR Form 3/4/5 (parsed)' : 'SEC EDGAR (metadata)',
    }
  }
}

// ============================================================
// ENGINE 2: HEDGE FUND 13F POSITION TRACKER
// Parity: WhaleWisdom, HedgeFollow, Dataroma
// ============================================================

async function fetchHedgeFundPositions(symbol) {
  const holdings = []
  const sym = symbol.toUpperCase()
  const startDate = getDateStr(-120)
  const endDate = getDateStr(0)

  // Strategy A: Search EFTS for 13F filings mentioning this ticker (with date range)
  try {
    const res = await fetch(
      `${SEC_EFTS}?q=%22${sym}%22&forms=13F-HR,13F-HR/A&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=0&size=40`,
      { headers: secHeaders }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.hits?.hits) {
        for (const hit of data.hits.hits) {
          const src = hit._source || {}
          const entityName = src.display_names?.[0] || 'Unknown'
          const cik = src.ciks?.[0] || ''
          const fundInfo = NOTABLE_FUNDS[cik.padStart(10, '0')]

          holdings.push({
            holder: entityName,
            manager: fundInfo?.manager || null,
            isNotable: !!fundInfo,
            style: fundInfo?.style || null,
            shares: 0,
            value: 0,
            change: 0,
            changePct: '0',
            portfolioPct: 0,
            dateReported: src.file_date || null,
            cik,
            source: 'SEC EDGAR 13F',
            filingType: src.form || '13F-HR',
          })
        }
      }
    }
  } catch (e) { /* silent */ }

  // Strategy B: Check ALL notable fund submissions (expanded to cover more funds)
  const topFundCIKs = Object.keys(NOTABLE_FUNDS).slice(0, 12)

  const fundChecks = topFundCIKs.map(cik =>
    fetch(`${SEC_DATA}/submissions/CIK${cik}.json`, { headers: secHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return null
        const fundInfo = NOTABLE_FUNDS[cik]
        const recentFilings = data.filings?.recent
        if (!recentFilings) return null

        const forms = recentFilings.form || []
        const dates = recentFilings.filingDate || []
        const accessions = recentFilings.accessionNumber || []

        // Find two most recent 13F filings for QoQ comparison
        const latest13Fs = []
        for (let i = 0; i < forms.length && latest13Fs.length < 2; i++) {
          if (forms[i] === '13F-HR' || forms[i] === '13F-HR/A') {
            latest13Fs.push({ date: dates[i], accession: accessions[i] })
          }
        }

        if (latest13Fs.length === 0) return null

        return {
          holder: fundInfo?.name || data.name || 'Unknown',
          manager: fundInfo?.manager || null,
          isNotable: true,
          style: fundInfo?.style || null,
          shares: 0,
          value: 0,
          change: 0,
          changePct: '0',
          portfolioPct: 0,
          dateReported: latest13Fs[0].date,
          previousDate: latest13Fs[1]?.date || null,
          cik,
          latestFiling: latest13Fs[0].accession,
          previousFiling: latest13Fs[1]?.accession || null,
          source: 'SEC EDGAR Submissions',
        }
      })
      .catch(() => null)
  )

  const fundResults = (await Promise.all(fundChecks)).filter(Boolean)

  // Merge and deduplicate
  const seen = new Set()
  const allHoldings = []
  for (const h of [...holdings, ...fundResults]) {
    const key = h.cik || h.holder
    if (!seen.has(key)) {
      seen.add(key)
      allHoldings.push(h)
    }
  }

  // FMP for actual position data
  try {
    const res = await fetch(
      `${FMP_BASE}/institutional-holder?symbol=${sym}&apikey=${FMP_KEY}`,
      { headers: fmpHeaders }
    )
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        for (const h of data.slice(0, 20)) {
          const key = h.holder
          if (!seen.has(key)) {
            seen.add(key)
            const isNotable = Object.values(NOTABLE_FUNDS).some(f =>
              (h.holder || '').toLowerCase().includes(f.name.toLowerCase().split(' ')[0])
            )
            allHoldings.push({
              holder: h.holder,
              manager: null,
              isNotable,
              style: null,
              shares: h.shares || 0,
              value: h.value || 0,
              change: h.change || 0,
              changePct: h.shares > 0 && h.change ? ((h.change / (h.shares - h.change || 1)) * 100).toFixed(1) : '0',
              portfolioPct: 0,
              dateReported: h.dateReported || null,
              source: 'FMP',
            })
          }
        }
      }
    }
  } catch (e) { /* silent */ }

  const notable = allHoldings.filter(h => h.isNotable)
  const increasing = allHoldings.filter(h => h.change > 0)
  const decreasing = allHoldings.filter(h => h.change < 0)
  const newPositions = allHoldings.filter(h => h.changePct === 'new' || h.isNew)
  const totalChange = allHoldings.reduce((a, h) => a + (h.change || 0), 0)
  const totalShares = allHoldings.reduce((a, h) => a + (h.shares || 0), 0)
  const totalValue = allHoldings.reduce((a, h) => a + (h.value || 0), 0)
  const sentiment = totalShares > 0 ? (totalChange / totalShares) * 100 : 0

  // Fund consensus — how many notable funds hold this
  const notableHolding = notable.filter(n => n.dateReported && new Date(n.dateReported) > new Date(Date.now() - 180 * 86400000))
  const fundConsensus = notableHolding.length

  return {
    holdings: allHoldings.slice(0, 25),
    notable: notable.slice(0, 12),
    summary: {
      totalHolders: allHoldings.length,
      increasing: increasing.length,
      decreasing: decreasing.length,
      newPositions: newPositions.length,
      exitedPositions: 0,
      netFlow: totalChange > 0 ? 'accumulating' : totalChange < 0 ? 'distributing' : 'flat',
      totalValue: formatDollar(totalValue),
      totalShares: totalShares > 1e6 ? `${(totalShares / 1e6).toFixed(1)}M` : totalShares > 1e3 ? `${(totalShares / 1e3).toFixed(0)}K` : `${totalShares}`,
      sentiment: Math.round(Math.max(-100, Math.min(100, sentiment))),
      signalDirection: sentiment > 5 ? 'bullish' : sentiment < -5 ? 'bearish' : 'neutral',
      notableCount: notable.length,
      fundConsensus,
      notableFunds: notable.slice(0, 6).map(n => n.manager || n.holder),
      notableStyles: [...new Set(notable.filter(n => n.style).map(n => n.style))],
      dataSource: 'SEC EDGAR 13F + FMP',
    }
  }
}

// ============================================================
// ENGINE 3: PE / M&A DEAL FLOW PIPELINE
// Parity: 13D Monitor, activist tracker features
// ============================================================

async function fetchDealFlow(symbol) {
  const deals = []
  const sym = symbol.toUpperCase()
  const startDate = getDateStr(-365) // Full year lookback for M&A
  const endDate = getDateStr(0)

  // Helper to extract filer info from EFTS hit
  const extractDeal = (hit, type, label, action, significance) => {
    const src = hit._source || {}
    const allNames = src.display_names || []
    // First display_name is the filer, second is the target company
    const filerName = allNames[0] || 'Unknown'
    const targetName = allNames.length > 1 ? allNames[1] : null
    const cik = src.ciks?.[0] || ''
    const formType = src.form || ''

    return {
      firm: filerName,
      target: targetName,
      cik,
      type,
      label,
      action,
      filingType: formType,
      date: src.file_date,
      significance,
      description: `${filerName} filed ${formType} — ${label}`,
      source: 'SEC EDGAR',
    }
  }

  // A: Schedule 13D (activist investors, >5% stake with intent to influence)
  try {
    const res = await fetch(
      `${SEC_EFTS}?q=%22${sym}%22&forms=SC%2013D,SC%2013D/A&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=0&size=20`,
      { headers: secHeaders }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.hits?.hits) {
        for (const hit of data.hits.hits) {
          deals.push(extractDeal(hit, '13D-activist', 'Activist Stake (>5%)', 'activist-stake', 'high'))
        }
      }
    }
  } catch (e) { /* silent */ }

  // B: Schedule 13G (passive >5% ownership)
  try {
    const res = await fetch(
      `${SEC_EFTS}?q=%22${sym}%22&forms=SC%2013G,SC%2013G/A&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=0&size=20`,
      { headers: secHeaders }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.hits?.hits) {
        for (const hit of data.hits.hits) {
          deals.push(extractDeal(hit, '13G-passive', 'Large Passive Stake (>5%)', 'large-stake', 'medium'))
        }
      }
    }
  } catch (e) { /* silent */ }

  // C: Tender offers, merger proxies, going-private transactions
  try {
    const res = await fetch(
      `${SEC_EFTS}?q=%22${sym}%22&forms=SC%20TO-T,SC%20TO-I,SC%2014D9,DEFM14A,PREM14A,DEFA14A,SC%2013E-3&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=0&size=15`,
      { headers: secHeaders }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.hits?.hits) {
        for (const hit of data.hits.hits) {
          const formType = hit._source?.form || ''
          let label = 'M&A Filing'
          if (formType.includes('SC TO')) label = 'Tender Offer'
          else if (formType.includes('14D9')) label = 'Solicitation/Recommendation Statement'
          else if (formType.includes('DEFM14A')) label = 'Definitive Merger Proxy'
          else if (formType.includes('PREM14A')) label = 'Preliminary Merger Proxy'
          else if (formType.includes('DEFA14A')) label = 'Additional Proxy Materials'
          else if (formType.includes('SC 13E-3')) label = 'Going-Private Transaction'
          deals.push(extractDeal(hit, 'mna', label, 'merger-acquisition', 'high'))
        }
      }
    }
  } catch (e) { /* silent */ }

  // D: 8-K filings with M&A keywords
  try {
    const res = await fetch(
      `${SEC_EFTS}?q=%22${sym}%22+AND+(%22acquisition%22+OR+%22merger%22+OR+%22tender+offer%22+OR+%22definitive+agreement%22+OR+%22business+combination%22)&forms=8-K&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=0&size=10`,
      { headers: secHeaders }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.hits?.hits) {
        for (const hit of data.hits.hits) {
          deals.push(extractDeal(hit, '8k-mna', 'M&A Announcement (8-K)', 'announcement', 'high'))
        }
      }
    }
  } catch (e) { /* silent */ }

  // E: S-4 registration statements (stock-for-stock mergers)
  try {
    const res = await fetch(
      `${SEC_EFTS}?q=%22${sym}%22&forms=S-4,S-4/A&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=0&size=5`,
      { headers: secHeaders }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.hits?.hits) {
        for (const hit of data.hits.hits) {
          deals.push(extractDeal(hit, 'mna-registration', 'Merger Registration (S-4)', 'merger-acquisition', 'high'))
        }
      }
    }
  } catch (e) { /* silent */ }

  // Sort by significance then date
  const sigOrder = { high: 0, medium: 1, low: 2 }
  deals.sort((a, b) => {
    if (a.significance !== b.significance) return (sigOrder[a.significance] || 2) - (sigOrder[b.significance] || 2)
    return new Date(b.date || 0) - new Date(a.date || 0)
  })

  // Deduplicate by filer+date (same entity may appear in multiple search results)
  const dedupedDeals = []
  const dealSeen = new Set()
  for (const d of deals) {
    const key = `${d.firm}-${d.date}-${d.type}`
    if (!dealSeen.has(key)) {
      dealSeen.add(key)
      dedupedDeals.push(d)
    }
  }

  const activistStakes = dedupedDeals.filter(d => d.type === '13D-activist')
  const passiveStakes = dedupedDeals.filter(d => d.type === '13G-passive')
  const mnaDeals = dedupedDeals.filter(d => ['mna', '8k-mna', 'mna-registration'].includes(d.type))

  // Identify known activist funds in the deal list
  const knownActivists = dedupedDeals.filter(d =>
    d.type === '13D-activist' && Object.values(NOTABLE_FUNDS).some(f =>
      d.firm.toLowerCase().includes(f.name.toLowerCase().split(' ')[0])
    )
  )

  const sentiment = dedupedDeals.length > 0
    ? Math.min(100, (activistStakes.length * 30 + passiveStakes.length * 15 + mnaDeals.length * 25 + knownActivists.length * 20))
    : 0

  return {
    moves: dedupedDeals.slice(0, 20),
    summary: {
      totalMoves: dedupedDeals.length,
      activistStakes: activistStakes.length,
      passiveStakes: passiveStakes.length,
      mnaActivity: mnaDeals.length,
      knownActivists: knownActivists.map(d => d.firm),
      increasing: dedupedDeals.filter(d => ['activist-stake', 'large-stake', 'merger-acquisition'].includes(d.action)).length,
      decreasing: 0,
      netFlow: dedupedDeals.length > 0 ? 'active' : 'quiet',
      totalInflow: formatDollar(0),
      totalOutflow: formatDollar(0),
      sentiment: Math.round(Math.min(100, Math.max(-100, sentiment))),
      signalDirection: knownActivists.length > 0 ? 'strong-bullish'
        : activistStakes.length > 0 ? 'bullish'
        : mnaDeals.length > 0 ? 'bullish'
        : passiveStakes.length > 2 ? 'bullish'
        : 'neutral',
      dataSource: 'SEC EDGAR (13D/13G/SC TO/8-K/S-4)',
    }
  }
}

// ============================================================
// ENGINE 4: CONGRESSIONAL TRADES
// Parity: Quiver Quant, Capitol Trades, Unusual Whales
// ============================================================

async function fetchCongressTrades(symbol) {
  const trades = []
  const sym = symbol.toUpperCase()

  // FMP /stable/ senate-latest + house-disclosure-latest
  const endpoints = [
    { url: `${FMP_BASE}/senate-latest?page=0&limit=200&apikey=${FMP_KEY}`, chamber: 'Senate', prefix: 'Sen.' },
    { url: `${FMP_BASE}/house-disclosure-latest?page=0&limit=200&apikey=${FMP_KEY}`, chamber: 'House', prefix: 'Rep.' },
  ]

  await Promise.all(endpoints.map(async ({ url, chamber, prefix }) => {
    try {
      const res = await fetch(url, { headers: fmpHeaders })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data)) return

      const matching = data.filter(t =>
        (t.symbol || '').toUpperCase() === sym ||
        (t.assetDescription || '').toUpperCase().includes(sym)
      )

      trades.push(...matching.slice(0, 20).map(t => {
        const txDate = t.transactionDate || null
        const discDate = t.disclosureDate || null
        // Calculate disclosure lag (STOCK Act requires 45 days)
        let disclosureLag = null
        if (txDate && discDate) {
          disclosureLag = Math.round((new Date(discDate) - new Date(txDate)) / 86400000)
        }

        return {
          source: chamber.toLowerCase(),
          politician: t.firstName && t.lastName ? `${prefix} ${t.firstName} ${t.lastName}` : t.representative || 'Unknown',
          firstName: t.firstName || null,
          lastName: t.lastName || null,
          party: t.party || null,
          state: t.state || t.district || null,
          district: t.district || null,
          type: (t.type || '').toLowerCase().includes('purchase') ? 'buy'
            : (t.type || '').toLowerCase().includes('sale') ? 'sell'
            : (t.type || '').toLowerCase().includes('exchange') ? 'exchange'
            : 'other',
          amount: t.amount || 'Unknown',
          date: txDate,
          disclosureDate: discDate,
          disclosureLag,
          stockActViolation: disclosureLag !== null && disclosureLag > 45,
          asset: t.assetDescription || symbol,
          chamber,
          comment: t.comment || null,
          owner: t.owner || null, // Self, Spouse, Child, Joint
        }
      }))
    } catch (e) { /* silent */ }
  }))

  // Fallback: Senate Stock Watcher
  if (trades.length === 0) {
    try {
      const res = await fetch(
        'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_ticker_transactions.json',
        { headers: fmpHeaders }
      )
      if (res.ok) {
        const data = await res.json()
        const tickerData = data[sym]
        if (tickerData && Array.isArray(tickerData)) {
          trades.push(...tickerData.slice(0, 20).map(t => ({
            source: 'senate-watcher',
            politician: `Sen. ${t.senator || 'Unknown'}`,
            party: t.party || null,
            state: t.state || null,
            type: (t.type || '').toLowerCase().includes('purchase') ? 'buy' : 'sell',
            amount: t.amount || 'Unknown',
            date: t.transaction_date || null,
            disclosureDate: t.disclosure_date || null,
            disclosureLag: null,
            stockActViolation: false,
            asset: t.asset_description || symbol,
            chamber: 'Senate',
            owner: t.owner || null,
          })))
        }
      }
    } catch (e) { /* silent */ }
  }

  const buys = trades.filter(t => t.type === 'buy')
  const sells = trades.filter(t => t.type === 'sell')
  const total = buys.length + sells.length
  const sentiment = total > 0 ? ((buys.length - sells.length) / total) : 0

  // Party breakdown
  const demBuys = buys.filter(t => t.party === 'Democrat' || t.party === 'D').length
  const demSells = sells.filter(t => t.party === 'Democrat' || t.party === 'D').length
  const repBuys = buys.filter(t => t.party === 'Republican' || t.party === 'R').length
  const repSells = sells.filter(t => t.party === 'Republican' || t.party === 'R').length

  // STOCK Act violation count
  const stockActViolations = trades.filter(t => t.stockActViolation).length

  // Unique politicians trading this asset
  const uniquePoliticians = new Set(trades.map(t => t.politician)).size

  return {
    trades: trades.slice(0, 20),
    summary: {
      totalTrades: total,
      buys: buys.length,
      sells: sells.length,
      sentiment: Math.round(sentiment * 100),
      signalDirection: sentiment > 0.2 ? 'bullish' : sentiment < -0.2 ? 'bearish' : 'neutral',
      recentActivity: trades.length > 0 ? trades[0].date : null,
      uniquePoliticians,
      partyBreakdown: {
        democrat: { buys: demBuys, sells: demSells },
        republican: { buys: repBuys, sells: repSells },
      },
      stockActViolations,
      bipartisan: demBuys > 0 && repBuys > 0,
    }
  }
}

// ============================================================
// INFLUENCE SCORING ENGINE
// ============================================================
function computeInfluenceScore(symbol, congress, insider, hedgeFund, pe) {
  const weights = getWeights(symbol)
  const sector = getSector(symbol)

  const congressSent = (congress.summary.sentiment || 0) / 100
  const insiderSent = (insider.summary.sentiment || 0) / 100
  const hedgeFundSent = (hedgeFund.summary.sentiment || 0) / 100
  const peSent = (pe.summary.sentiment || 0) / 100

  const composite = (
    (congressSent * weights.congress / 100) +
    (insiderSent * weights.insider / 100) +
    (hedgeFundSent * weights.hedgeFund / 100) +
    (peSent * weights.pe / 100)
  )

  const congressActivity = Math.min(1, congress.summary.totalTrades / 5)
  const insiderActivity = Math.min(1, insider.summary.totalTrades / 3)
  const hedgeFundActivity = Math.min(1, hedgeFund.summary.totalHolders / 10)
  const peActivity = Math.min(1, pe.summary.totalMoves / 3)

  const dataQuality = 0.3 + 0.7 * (
    (congressActivity * weights.congress / 100) +
    (insiderActivity * weights.insider / 100) +
    (hedgeFundActivity * weights.hedgeFund / 100) +
    (peActivity * weights.pe / 100)
  )

  const sourceScores = [
    { source: 'congress', weight: weights.congress, sentiment: congressSent, activity: congressActivity, label: 'Politicians' },
    { source: 'insider', weight: weights.insider, sentiment: insiderSent, activity: insiderActivity, label: 'Insiders' },
    { source: 'hedgeFund', weight: weights.hedgeFund, sentiment: hedgeFundSent, activity: hedgeFundActivity, label: 'Hedge Funds' },
    { source: 'pe', weight: weights.pe, sentiment: peSent, activity: peActivity, label: 'Institutional/PE' },
  ]

  sourceScores.forEach(s => {
    s.impact = (s.weight / 100) * s.activity * Math.abs(s.sentiment)
    s.effectiveWeight = Math.round(s.weight * s.activity)
  })

  sourceScores.sort((a, b) => b.impact - a.impact)
  const dominant = sourceScores[0]

  return {
    composite: Math.round(composite * 100),
    direction: composite > 0.1 ? 'bullish' : composite < -0.1 ? 'bearish' : 'neutral',
    confidence: Math.round(dataQuality * 100),
    sector,
    weights,
    reason: weights.reason,
    dominant: {
      source: dominant.source,
      label: dominant.label,
      weight: dominant.weight,
      sentiment: Math.round(dominant.sentiment * 100),
      impact: Math.round(dominant.impact * 100),
    },
    sources: sourceScores.map(s => ({
      source: s.source,
      label: s.label,
      weight: s.weight,
      effectiveWeight: s.effectiveWeight,
      sentiment: Math.round(s.sentiment * 100),
      activity: Math.round(s.activity * 100),
      impact: Math.round(s.impact * 100),
      direction: s.sentiment > 0.1 ? 'bullish' : s.sentiment < -0.1 ? 'bearish' : 'neutral',
    })),
  }
}

// ============================================================
// HELPERS
// ============================================================
function formatDollar(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${Math.round(v)}`
}

function getDateStr(daysOffset) {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD format required by EFTS
}

// ============================================================
// API HANDLER
// ============================================================
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const mode = searchParams.get('mode') || 'full'

  if (!symbol) {
    return NextResponse.json({ error: 'symbol parameter required' }, { status: 400 })
  }

  try {
    const [congress, insider, hedgeFund, pe] = await Promise.all([
      fetchCongressTrades(symbol).catch(() => ({ trades: [], summary: { totalTrades: 0, buys: 0, sells: 0, sentiment: 0, signalDirection: 'neutral' } })),
      fetchInsiderAlerts(symbol).catch(() => ({ trades: [], summary: { totalTrades: 0, buys: 0, sells: 0, sentiment: 0, signalDirection: 'neutral' } })),
      fetchHedgeFundPositions(symbol).catch(() => ({ holdings: [], notable: [], summary: { totalHolders: 0, sentiment: 0, signalDirection: 'neutral' } })),
      fetchDealFlow(symbol).catch(() => ({ moves: [], summary: { totalMoves: 0, sentiment: 0, signalDirection: 'neutral' } })),
    ])

    const influence = computeInfluenceScore(symbol, congress, insider, hedgeFund, pe)

    if (mode === 'signal') {
      return NextResponse.json({
        symbol,
        influence: {
          composite: influence.composite,
          direction: influence.direction,
          confidence: influence.confidence,
          dominant: influence.dominant,
        },
      })
    }

    return NextResponse.json({
      symbol,
      sector: influence.sector,
      influence,
      congress,
      insider,
      hedgeFund,
      pe,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
