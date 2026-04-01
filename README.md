# Project Eve - Market Intelligence Dashboard

Real-time quantitative market analysis dashboard built with Next.js, Tailwind CSS, Supabase, and Recharts.

## Features

- **Live Price Tickers** - 15-second auto-refresh across indices, bonds, commodities, forex
- **Interactive Charts** - Candlestick/line charts with 7 timeframe options (1D to 1Y)
- **Sector Heatmap** - Visual sector rotation tracking with performance colors
- **Correlation Matrix** - 10-pair bond-currency-equity correlation engine with anomaly detection
- **Trade Ideas** - Long/short setups with entry zones, targets, stops, R:R ratios, and live alerts
- **Risk Calendar** - Upcoming catalysts with volatility estimates and prep actions
- **Scenario Analysis** - Probability-weighted outcome modeling

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

### 1. Push to GitHub

```bash
# Create repo on GitHub
gh repo create ProjectEve --public --source=. --remote=origin --push

# Or manually:
git remote add origin https://github.com/YOUR_USERNAME/ProjectEve.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your `ProjectEve` repository
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy**

### 3. Set up Supabase (Optional - app works without it)

1. Create project at [app.supabase.com](https://app.supabase.com)
2. Go to SQL Editor, paste contents of `supabase-schema.sql`, run
3. Go to Settings > API, copy the URL and anon key
4. In Vercel, add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Data Sources

- **Yahoo Finance API** (free, no key required) - Quotes and historical data
- **Supabase** (optional) - Trade persistence, alerts, correlation history

## Project Structure

```
src/
  app/
    api/
      quotes/     - Real-time quote proxy
      market/     - Historical chart data proxy
      correlation/- Correlation matrix computation
    page.js       - Main dashboard
    layout.js     - Root layout
  components/
    Header.js           - Top bar with market status
    TickerBar.js         - Scrolling price ticker
    MarketOverview.js    - Index/bond/commodity/forex cards
    PriceChart.js        - Interactive price charts
    SectorHeatmap.js     - Sector rotation visualization
    CorrelationHeatmap.js- Correlation matrix with anomaly flags
    TradeIdeas.js        - Trade setup cards with live tracking
    RiskCalendar.js      - Event calendar
    ScenarioAnalysis.js  - Scenario probability cards
  hooks/
    useMarketData.js     - Data fetching hooks
  lib/
    marketData.js        - Symbol mapping and utilities
    tradeIdeas.js        - Trade data and helpers
    supabase.js          - Supabase client
```
