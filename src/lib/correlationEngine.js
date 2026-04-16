// correlationEngine.js - Cross-asset correlation analysis engine
// Edge Runtime compatible, no external dependencies

const SECTOR_ETF_MAP = {
  tech: 'XLK',
  defense: 'ITA',
  pharma: 'XLV',
  finance: 'XLF',
  energy: 'XLE',
  consumer: 'XLY',
  industrial: 'XLI',
  materials: 'XLB',
  utilities: 'XLU',
  'real-estate': 'XLRE',
  communication: 'XLC',
  crypto: 'BITO'
};

const CORRELATION_BASKET = ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD', 'UUP', 'VIXY'];

async function fetchYahooData(symbol, range = '3mo') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000
    });

    if (!res.ok) {
      console.warn(`[Yahoo] ${symbol} HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data?.chart?.result?.[0] || null;
  } catch (err) {
    console.warn(`[Yahoo] ${symbol} Error: ${err.message}`);
    return null;
  }
}

function extractCloses(chartData) {
  if (!chartData || !chartData.timestamp || !chartData.indicators?.quote?.[0]) {
    return [];
  }

  const quotes = chartData.indicators.quote[0];
  return chartData.timestamp.map((ts, idx) => ({
    date: new Date(ts * 1000),
    close: quotes.close?.[idx] || null
  })).filter(d => d.close !== null);
}

function computeReturns(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    const ret = (closes[i].close - closes[i - 1].close) / closes[i - 1].close;
    returns.push(ret);
  }
  return returns;
}

function computePearson(returns1, returns2) {
  if (returns1.length < 2 || returns2.length < 2) return 0;

  const n = Math.min(returns1.length, returns2.length);
  const r1 = returns1.slice(-n);
  const r2 = returns2.slice(-n);

  const mean1 = r1.reduce((a, b) => a + b, 0) / n;
  const mean2 = r2.reduce((a, b) => a + b, 0) / n;

  let sumProd = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < n; i++) {
    const dev1 = r1[i] - mean1;
    const dev2 = r2[i] - mean2;
    sumProd += dev1 * dev2;
    sumSq1 += dev1 * dev1;
    sumSq2 += dev2 * dev2;
  }

  const denom = Math.sqrt(sumSq1 * sumSq2);
  return denom > 0 ? sumProd / denom : 0;
}

function computeRollingCorrelation(returns1, returns2, window = 20) {
  const correlations = [];

  for (let i = window; i <= Math.min(returns1.length, returns2.length); i++) {
    const r1Window = returns1.slice(i - window, i);
    const r2Window = returns2.slice(i - window, i);
    const corr = computePearson(r1Window, r2Window);
    correlations.push(corr);
  }

  return correlations.length > 0 ? correlations[correlations.length - 1] : 0;
}

function computeBeta(assetReturns, benchmarkReturns) {
  if (assetReturns.length < 2 || benchmarkReturns.length < 2) return 1;

  const n = Math.min(assetReturns.length, benchmarkReturns.length);
  const asset = assetReturns.slice(-n);
  const bench = benchmarkReturns.slice(-n);

  const meanAsset = asset.reduce((a, b) => a + b, 0) / n;
  const meanBench = bench.reduce((a, b) => a + b, 0) / n;

  let covariance = 0;
  let benchVariance = 0;

  for (let i = 0; i < n; i++) {
    const devAsset = asset[i] - meanAsset;
    const devBench = bench[i] - meanBench;
    covariance += devAsset * devBench;
    benchVariance += devBench * devBench;
  }

  return benchVariance > 0 ? covariance / benchVariance : 1;
}

export async function computeCorrelations(symbol, assetType = 'stock') {
  if (!symbol) throw new Error('Symbol required');

  // Determine sector ETF
  let sectorETF = null;
  if (assetType && SECTOR_ETF_MAP[assetType.toLowerCase()]) {
    sectorETF = SECTOR_ETF_MAP[assetType.toLowerCase()];
  }

  const allSymbols = [symbol, ...CORRELATION_BASKET];
  if (sectorETF && !allSymbols.includes(sectorETF)) {
    allSymbols.push(sectorETF);
  }

  // Fetch all data in parallel
  const dataMap = {};
  const fetchResults = await Promise.all(
    allSymbols.map(sym => fetchYahooData(sym).then(data => ({ sym, data })))
  );

  fetchResults.forEach(({ sym, data }) => {
    if (data) {
      dataMap[sym] = extractCloses(data);
    }
  });

  // Get target symbol returns
  const targetCloses = dataMap[symbol] || [];
  if (targetCloses.length < 2) {
    throw new Error(`Insufficient data for ${symbol}`);
  }

  const targetReturns = computeReturns(targetCloses);

  // Compute correlations for all basket assets
  const correlations = {};
  const rolling20d = {};
  const rollingSamples = {};

  CORRELATION_BASKET.forEach(basketSymbol => {
    const basketCloses = dataMap[basketSymbol];
    if (basketCloses && basketCloses.length >= 2) {
      const basketReturns = computeReturns(basketCloses);
      correlations[basketSymbol] = Math.round(computePearson(targetReturns, basketReturns) * 10000) / 10000;
      rolling20d[basketSymbol] = Math.round(computeRollingCorrelation(targetReturns, basketReturns, 20) * 10000) / 10000;

      // For correlation regime detection: collect 60d rolling samples
      const rolling60d = computeRollingCorrelation(targetReturns, basketReturns, 60);
      rollingSamples[basketSymbol] = { current: rolling20d[basketSymbol], previous: rolling60d };
    } else {
      correlations[basketSymbol] = 0;
      rolling20d[basketSymbol] = 0;
    }
  });

  // Sector ETF correlation
  if (sectorETF) {
    const sectorCloses = dataMap[sectorETF];
    if (sectorCloses && sectorCloses.length >= 2) {
      const sectorReturns = computeReturns(sectorCloses);
      correlations[sectorETF] = Math.round(computePearson(targetReturns, sectorReturns) * 10000) / 10000;
      rolling20d[sectorETF] = Math.round(computeRollingCorrelation(targetReturns, sectorReturns, 20) * 10000) / 10000;
    } else {
      correlations[sectorETF] = 0;
      rolling20d[sectorETF] = 0;
    }
  }

  // Compute beta vs SPY
  const spyCloses = dataMap['SPY'];
  let beta = 1;
  if (spyCloses && spyCloses.length >= 2) {
    const spyReturns = computeReturns(spyCloses);
    beta = Math.round(computeBeta(targetReturns, spyReturns) * 10000) / 10000;
  }

  // Derive insights
  const riskOn = (correlations['SPY'] || 0) > 0.3 && (correlations['TLT'] || 0) < -0.2;
  const bondCorrelation = correlations['TLT'] || 0;
  const dollarSensitivity = correlations['UUP'] || 0;

  // Detect correlation regime
  let correlationRegime = 'normal';
  const avgCorr = Object.values(rolling20d).reduce((a, b) => a + b, 0) / Object.keys(rolling20d).length;
  const corrBreakdowns = Object.entries(rollingSamples).filter(
    ([, samples]) => samples && Math.abs(samples.current - samples.previous) > 0.3
  ).length;

  if (corrBreakdowns > CORRELATION_BASKET.length * 0.5) {
    correlationRegime = 'crisis'; // Most correlations converging
  } else if (avgCorr < 0.1) {
    correlationRegime = 'decorrelated'; // Low avg correlation
  }

  // Diversification score: lower avg absolute correlation = better diversifier
  const avgAbsCorr = Object.values(correlations).reduce((sum, c) => sum + Math.abs(c), 0) / Object.keys(correlations).length;
  const diversificationScore = Math.round((1 - avgAbsCorr) * 100);

  // Generate insights and anomalies
  const insights = [];
  const anomalies = [];

  if (riskOn) {
    insights.push('Risk-on characteristics: high SPY correlation, negative bond correlation');
  } else {
    insights.push('Risk-off characteristics: hedging properties detected');
  }

  if (Math.abs(bondCorrelation) > 0.5) {
    insights.push(bondCorrelation < -0.5 ? 'Strong negative bond correlation (defensive risk asset)' : 'Strong positive bond correlation (bonds moving together)');
  }

  if (Math.abs(dollarSensitivity) > 0.4) {
    insights.push(`High USD sensitivity: ${dollarSensitivity > 0 ? 'strengthens with dollar' : 'weakens with dollar'}`);
  }

  if (diversificationScore > 70) {
    insights.push('Excellent diversification potential');
  } else if (diversificationScore < 30) {
    insights.push('Limited diversification value; high correlation with basket');
  }

  if (correlationRegime === 'crisis') {
    anomalies.push('WARNING: Correlation structure breaking down - potential crisis regime');
  }

  if (corrBreakdowns > 0) {
    anomalies.push(`${corrBreakdowns} assets showing 20d/60d correlation breakdown`);
  }

  if (Math.abs(beta) > 2) {
    anomalies.push(`High beta (${beta.toFixed(2)}): amplified market moves`);
  } else if (beta < 0.3) {
    anomalies.push(`Low beta (${beta.toFixed(2)}): dampened market sensitivity`);
  }

  return {
    correlations,
    rolling20d,
    beta,
    riskOn,
    bondCorrelation: Math.round(bondCorrelation * 10000) / 10000,
    dollarSensitivity: Math.round(dollarSensitivity * 10000) / 10000,
    correlationRegime,
    diversificationScore,
    insights,
    anomalies
  };
}
