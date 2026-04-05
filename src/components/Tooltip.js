'use client'
import { useState, useRef, useEffect } from 'react'

// Dictionary of financial terms and their explanations
const TERMS = {
  'RSI': 'Relative Strength Index — a momentum oscillator (0-100) measuring speed of price changes. Below 30 = oversold (buy signal), above 70 = overbought (sell signal).',
  'MACD': 'Moving Average Convergence Divergence — trend-following indicator showing relationship between two moving averages. Crossovers signal buy/sell opportunities.',
  'ATR': 'Average True Range — measures market volatility by calculating the average range between high and low prices over a period. Higher ATR = more volatile.',
  'R:R': 'Risk-to-Reward ratio — compares potential loss (stop distance) to potential gain (target distance). A 1:3 R:R means risking $1 to potentially make $3.',
  'Risk:Reward': 'Risk-to-Reward ratio — compares potential loss to potential gain. Higher ratios (1:2+) indicate favorable trade setups.',
  'Entry Zone': 'The price range where entering a trade offers the best risk/reward. Entering within this zone maximizes potential profit while limiting downside.',
  'Stop Loss': 'A predetermined price level where a losing trade is automatically closed to limit losses. Essential for risk management.',
  'Target': 'The price level where profits are taken. Set based on technical analysis (resistance/support) and risk/reward calculations.',
  'Confidence': 'Signal confidence score (30-92%) based on how many technical factors align: RSI, MACD, moving averages, support/resistance, and momentum.',
  'Breakout': 'When price moves decisively above resistance or below support with increased volume, signaling a potential new trend direction.',
  'Mean Reversion': 'Strategy based on the idea that prices tend to return to their average. Buys oversold assets and sells overbought ones.',
  'Momentum': 'Trading strategy that rides existing trends. Buys assets moving up and shorts assets moving down, following the direction of price movement.',
  'Carry Trade': 'Strategy exploiting interest rate differences between currencies. Borrow in low-rate currency, invest in high-rate currency for the spread.',
  'Bollinger Bands': 'Volatility bands placed above and below a moving average. Price touching upper band = potentially overbought, lower band = potentially oversold.',
  'MA50': '50-day Moving Average — the average closing price over the last 50 trading days. Acts as dynamic support/resistance.',
  'MA200': '200-day Moving Average — long-term trend indicator. Price above MA200 = bullish trend, below = bearish trend.',
  'Support': 'A price level where buying pressure historically prevents further decline. Acts as a "floor" for the price.',
  'Resistance': 'A price level where selling pressure historically prevents further advance. Acts as a "ceiling" for the price.',
  'VIX': 'CBOE Volatility Index — measures expected S&P 500 volatility over 30 days. Known as the "fear gauge." Above 20 = elevated fear, above 30 = high anxiety.',
  'DXY': 'US Dollar Index — measures the dollar against a basket of 6 major currencies (EUR, JPY, GBP, CAD, SEK, CHF). Rising DXY = stronger dollar.',
  'Sharpe': 'Sharpe Ratio — measures risk-adjusted return. Calculated as (return - risk-free rate) / volatility. Above 1.0 = good, above 2.0 = excellent.',
  'Profit Factor': 'Total gross profit divided by total gross loss. Above 1.0 = profitable system, above 2.0 = strong system.',
  'Max DD': 'Maximum Drawdown — the largest peak-to-trough decline in portfolio value. Measures worst-case historical loss.',
  'Win Rate': 'Percentage of trades that were profitable. A 60% win rate with good R:R is considered strong performance.',
  'P/L': 'Profit and Loss — the net financial result of a trade or portfolio, usually expressed as a percentage or dollar amount.',
  'Long': 'Buying an asset expecting it to increase in value. You profit when the price goes up.',
  'Short': 'Selling a borrowed asset expecting it to decrease in value. You profit when the price goes down.',
  'Correlation': 'Statistical measure (-1 to +1) of how two assets move together. +1 = move together, -1 = move opposite, 0 = no relationship.',
  'Anomaly': 'When a correlation deviates significantly from its historical norm, potentially signaling a market shift or trading opportunity.',
  'PCE': 'Personal Consumption Expenditures — the Federal Reserve\'s preferred inflation measure. Core PCE excludes food and energy for a cleaner read.',
  'CPI': 'Consumer Price Index — measures inflation by tracking price changes in a basket of consumer goods and services.',
  'NFP': 'Non-Farm Payrolls — monthly US jobs report measuring employment changes. One of the most market-moving economic releases.',
  'FOMC': 'Federal Open Market Committee — the Fed body that sets interest rates. Their decisions move all financial markets globally.',
  'PMI': 'Purchasing Managers\' Index — survey-based indicator of economic health. Above 50 = expansion, below 50 = contraction.',
  'GDP': 'Gross Domestic Product — total value of goods and services produced. The broadest measure of economic health.',
  'YCC': 'Yield Curve Control — Bank of Japan policy of targeting specific bond yields to control interest rates across maturities.',
  'BoJ': 'Bank of Japan — Japan\'s central bank. Their monetary policy decisions directly impact JPY and global carry trades.',
  'ECB': 'European Central Bank — sets monetary policy for the eurozone. Rate decisions impact EUR and European bond markets.',
  'Pivot Points': 'Calculated price levels used to identify potential support/resistance. Based on previous period\'s high, low, and close.',
  'ETF': 'Exchange-Traded Fund — a basket of securities that trades like a stock. Offers diversification in a single trade.',
}

// The Tooltip wrapper component
export function Term({ children, term }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef(null)
  const tooltipRef = useRef(null)

  const definition = TERMS[term || children] || TERMS[children]
  if (!definition) return children

  const handleMouseEnter = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 8,
      left: Math.max(12, Math.min(rect.left + rect.width / 2, window.innerWidth - 180)),
    })
    setShow(true)
  }

  return (
    <span className="relative inline" ref={ref}>
      <span
        className="border-b border-dotted border-nx-accent/40 cursor-help text-nx-accent hover:border-nx-accent transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </span>
      {show && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] max-w-xs px-3 py-2.5 rounded-lg text-xs leading-relaxed shadow-lg animate-fade-in pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
            transform: 'translateX(-50%)',
            background: 'rgb(var(--nx-elevated))',
            border: '1px solid var(--nx-border)',
            color: 'rgb(var(--nx-text))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <div className="text-2xs font-bold text-nx-accent uppercase tracking-wider mb-1">{term || children}</div>
          <div>{definition}</div>
        </div>
      )}
    </span>
  )
}

// Helper: auto-detect and wrap known terms in text
export function TermText({ children }) {
  if (typeof children !== 'string') return children

  // Sort terms by length (longest first) to avoid partial matches
  const termKeys = Object.keys(TERMS).sort((a, b) => b.length - a.length)
  const regex = new RegExp(`\\b(${termKeys.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g')

  const parts = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index))
    }
    parts.push(<Term key={match.index} term={match[1]}>{match[1]}</Term>)
    lastIndex = regex.lastIndex
  }

  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex))
  }

  return parts.length > 0 ? <>{parts}</> : children
}

export { TERMS }
