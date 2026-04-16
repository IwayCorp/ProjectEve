// sentimentEngine.js - Sentiment scoring engine for cross-asset analysis
// Edge Runtime compatible, no external dependencies

const BULLISH_KEYWORDS = ['buy', 'upgrade', 'beat', 'surge', 'rally', 'growth', 'bullish', 'outperform', 'strong', 'record', 'breakthrough', 'approve', 'win', 'profit', 'exceed', 'positive', 'gains', 'soar', 'jump', 'raise'];
const BEARISH_KEYWORDS = ['sell', 'downgrade', 'miss', 'crash', 'decline', 'bearish', 'underperform', 'weak', 'warning', 'layoff', 'lawsuit', 'loss', 'risk', 'cut', 'negative', 'fall', 'drop', 'plunge', 'concern', 'worry', 'fear', 'recession'];

function scoreKeywords(text) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  let bullishCount = 0;
  let bearishCount = 0;

  BULLISH_KEYWORDS.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) {
      bullishCount += matches.length;
      score += matches.length * 10;
    }
  });

  BEARISH_KEYWORDS.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) {
      bearishCount += matches.length;
      score -= matches.length * 10;
    }
  });

  return Math.max(-100, Math.min(100, score));
}

function getRecencyWeight(publishedDate) {
  if (!publishedDate) return 0.5;
  const now = new Date();
  const published = new Date(publishedDate);
  const daysDiff = (now - published) / (1000 * 60 * 60 * 24);

  // Exponential decay over 7 days: weight = e^(-decay * days)
  const decay = Math.log(2) / 7; // half-life of 7 days
  return Math.exp(-decay * daysDiff);
}

async function fetchWithFallback(url, sourceName) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000
    });

    if (!res.ok) {
      console.warn(`[${sourceName}] HTTP ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn(`[${sourceName}] Error: ${err.message}`);
    return null;
  }
}

export async function analyzeSentiment(symbol, sector) {
  if (!symbol) throw new Error('Symbol required');

  const baseUrl = 'https://financialmodelingprep.com/stable';
  const apiKey = 'BlZ54heOyotLlIIGqFqi9wAj2kRVMYFW';

  // Fetch all data sources in parallel
  const [newsData, socialData, analystData, upgradesData] = await Promise.all([
    fetchWithFallback(`${baseUrl}/news/stock?symbol=${symbol}&limit=20&apikey=${apiKey}`, 'FMP News'),
    fetchWithFallback(`${baseUrl}/social-sentiment?symbol=${symbol}&limit=50&apikey=${apiKey}`, 'FMP Social'),
    fetchWithFallback(`${baseUrl}/analyst-estimates?symbol=${symbol}&limit=1&apikey=${apiKey}`, 'FMP Analyst'),
    fetchWithFallback(`${baseUrl}/upgrades-downgrades?symbol=${symbol}&apikey=${apiKey}`, 'FMP UpDownGrades')
  ]);

  // Process news sentiment with recency weighting
  let newsSentimentScore = 0;
  let newsWeightSum = 0;
  let newsCount = 0;
  const topHeadlines = [];

  if (newsData && Array.isArray(newsData)) {
    newsData.forEach(article => {
      const titleScore = scoreKeywords(article.title || '');
      const textScore = scoreKeywords(article.text || '');
      const combined = titleScore * 0.6 + textScore * 0.4; // Title weighted higher
      const weight = getRecencyWeight(article.publishedDate);

      newsSentimentScore += combined * weight;
      newsWeightSum += weight;
      newsCount++;

      topHeadlines.push({
        title: article.title,
        sentiment: combined > 20 ? 'bullish' : combined < -20 ? 'bearish' : 'neutral',
        date: article.publishedDate
      });
    });

    if (newsWeightSum > 0) {
      newsSentimentScore = newsSentimentScore / newsWeightSum;
    }
  }

  // Process social sentiment
  let socialSentimentScore = 0;
  let socialVolume = 0;

  if (socialData && Array.isArray(socialData)) {
    let totalSentiment = 0;
    socialData.forEach(item => {
      totalSentiment += parseFloat(item.sentiment || 0);
      socialVolume += parseFloat(item.stocktwitsSentiment || 0);
    });
    socialSentimentScore = socialData.length > 0 ? (totalSentiment / socialData.length) * 100 : 0;
  }

  // Process analyst estimates
  let analystSentimentScore = 0;
  let revisionTrend = 'flat';

  if (analystData && Array.isArray(analystData) && analystData.length > 0) {
    const latest = analystData[0];
    // Positive revision trend = analyst sentiment positive
    if (latest.revenueEstimateChange && latest.revenueEstimateChange > 0) {
      analystSentimentScore += 30;
      revisionTrend = 'up';
    } else if (latest.revenueEstimateChange && latest.revenueEstimateChange < 0) {
      analystSentimentScore -= 30;
      revisionTrend = 'down';
    }

    if (latest.epsEstimate && parseFloat(latest.epsEstimate) > 0) {
      analystSentimentScore += 20;
    }

    analystSentimentScore = Math.max(-100, Math.min(100, analystSentimentScore));
  }

  // Process upgrades/downgrades
  let upgradeScore = 0;
  let recentUpgrades = 0;
  let recentDowngrades = 0;

  if (upgradesData && Array.isArray(upgradesData)) {
    const now = new Date();
    upgradesData.forEach(item => {
      const itemDate = new Date(item.gradeDate || item.date);
      const daysOld = (now - itemDate) / (1000 * 60 * 60 * 24);

      if (daysOld <= 30) {
        if (item.grade === 'Upgrade' || item.action === 'up') {
          upgradeScore += 15;
          recentUpgrades++;
        } else if (item.grade === 'Downgrade' || item.action === 'down') {
          upgradeScore -= 15;
          recentDowngrades++;
        }
      }
    });

    upgradeScore = Math.max(-100, Math.min(100, upgradeScore));
  }

  // Composite weighted score
  const weights = { news: 0.40, social: 0.20, analyst: 0.25, upgrades: 0.15 };
  const compositeScore =
    (newsSentimentScore * weights.news) +
    (socialSentimentScore * weights.social) +
    (analystSentimentScore * weights.analyst) +
    (upgradeScore * weights.upgrades);

  // Normalize to -100 to +100
  const finalScore = Math.max(-100, Math.min(100, compositeScore));

  // Label based on score
  let label = 'neutral';
  if (finalScore > 50) label = 'very-bullish';
  else if (finalScore > 20) label = 'bullish';
  else if (finalScore < -50) label = 'very-bearish';
  else if (finalScore < -20) label = 'bearish';

  // Confidence: higher when more data sources agree
  const sourceCount = [newsData, socialData, analystData, upgradesData].filter(d => d).length;
  const confidence = Math.min(100, (sourceCount / 4) * 100 * (newsCount > 0 ? 1 : 0.7));

  // Generate catalysts from headline themes
  const catalysts = [];
  const bullishHeadlines = topHeadlines.filter(h => h.sentiment === 'bullish').length;
  const bearishHeadlines = topHeadlines.filter(h => h.sentiment === 'bearish').length;

  if (bullishHeadlines > bearishHeadlines) {
    catalysts.push('Bullish news flow outweighs bearish');
  } else if (bearishHeadlines > bullishHeadlines) {
    catalysts.push('Bearish news flow outweighs bullish');
  }

  if (recentUpgrades > 0) {
    catalysts.push(`${recentUpgrades} recent analyst upgrade(s)`);
  }
  if (recentDowngrades > 0) {
    catalysts.push(`${recentDowngrades} recent analyst downgrade(s)`);
  }

  if (revisionTrend === 'up') {
    catalysts.push('Analyst estimates being revised upward');
  } else if (revisionTrend === 'down') {
    catalysts.push('Analyst estimates being revised downward');
  }

  return {
    score: Math.round(finalScore * 100) / 100,
    label,
    confidence: Math.round(confidence),
    breakdown: {
      news: {
        score: Math.round(newsSentimentScore * 100) / 100,
        count: newsCount,
        recentBias: newsCount > 0 ? 'applied' : 'N/A'
      },
      social: {
        score: Math.round(socialSentimentScore * 100) / 100,
        volume: socialVolume
      },
      analyst: {
        score: Math.round(analystSentimentScore * 100) / 100,
        revisionTrend
      },
      upgrades: {
        score: Math.round(upgradeScore * 100) / 100,
        recentCount: recentUpgrades + recentDowngrades,
        netDirection: recentUpgrades > recentDowngrades ? 'bullish' : recentDowngrades > recentUpgrades ? 'bearish' : 'neutral'
      }
    },
    topHeadlines: topHeadlines.slice(0, 5),
    catalysts
  };
}
