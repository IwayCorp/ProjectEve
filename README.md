# Noctis - Quantitative Market Intelligence

Real-time quantitative analysis and trade intelligence platform built with Next.js, Tailwind CSS, and Recharts. Dark Glass aesthetic with glassmorphism UI.

## Features

- **Live Price Tickers** - 15-second auto-refresh across indices, bonds, commodities, forex
- **Interactive Charts** - Line/area charts with 7 timeframe options (1D to 1Y)
- **Sector Heatmap** - Visual sector rotation tracking with performance colors
- **Correlation Matrix** - 10-pair bond-currency-equity correlation engine with anomaly detection
- **Trade Ideas** - Long/short/forex setups with entry zones, targets, stops, R:R ratios, and live alerts
- **Trade Packets** - Deep analysis modals with thesis, bond correlation, macro context, technicals
- **Price Predictions** - Customizable position lengths (30min to 30+ days) with confidence bands
- **Performance Dashboard** - Historical trade tracking with win rate, Sharpe ratio, profit factor, equity curve
- **Risk Calendar** - Upcoming catalysts with volatility estimates and prep actions
- **Scenario Analysis** - Probability-weighted outcome modeling

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Framework preset: Next.js (auto-detected)
4. Deploy

## Data Sources

- **Yahoo Finance API** (free, no key required) - Quotes and historical data
- **Supabase** (optional) - Trade persistence

## Project Structure

```
src/
  app/
    api/
      quotes/      - Real-time quote proxy
      market/      - Historical chart data proxy
      correlation/ - Correlation matrix computation
    page.js        - Main dashboard
    layout.js      - Root layout
    globals.css    - Noctis Dark Glass design system
  components/
    Header.js            - Top bar with brand, market status, clock
    TickerBar.js         - Scrolling price ticker
    MarketOverview.js    - Index/bond/commodity/forex glass cards
    PriceChart.js        - Interactive price charts
    SectorHeatmap.js     - Sector rotation visualization
    CorrelationHeatmap.js- Correlation matrix with anomaly flags
    TradeIdeas.js        - Trade setup cards with live tracking
    TradePacket.js       - Deep analysis modal with predictions
    HistoricalData.js    - Performance dashboard and trade log
    RiskCalendar.js      - Event calendar
    ScenarioAnalysis.js  - Scenario probability cards
  hooks/
    useMarketData.js     - Data fetching hooks
  lib/
    marketData.js        - Symbol mapping and utilities
    tradeIdeas.js        - Trade data and helpers
    predictions.js       - Prediction engine and historical tracking
```
