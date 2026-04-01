'use client'
import { useState } from 'react'
import { LONG_IDEAS, SHORT_IDEAS, FOREX_IDEAS, STRATEGIES, calcRR, isInEntryZone, checkAlerts } from '@/lib/tradeIdeas'
import { formatPrice } from '@/lib/marketData'
import TradePacket from './TradePacket'

function TradeCard({ trade, quote, direction, onOpen }) {
  const price = quote?.regularMarketPrice
  const inZone = price ? isInEntryZone(price, trade.entryLow, trade.entryHigh) : false
  const midEntry = (trade.entryLow + trade.entryHigh) / 2
  const rr = calcRR(midEntry, trade.target, trade.stopLoss, direction)
  const isUp = quote?.regularMarketChangePercent >= 0
  const alert = price ? checkAlerts(price, trade.target, trade.stopLoss, direction) : null
  const fmtType = trade.asset === 'forex' ? 'forex' : trade.asset === 'commodity' ? 'stock' : 'stock'

  return (
    <div
      onClick={() => onOpen(trade, direction)}
      className={`nx-card p-4 cursor-pointer group transition-all duration-300 ${
        alert === 'TARGET_HIT' ? 'glow-green border-nx-green/20' : alert === 'STOP_HIT' ? 'glow-red border-nx-red/20' : ''
      } hover:border-nx-accent/20`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-nx-text-strong group-hover:text-nx-accent transition-colors">{trade.ticker}</span>
            <span className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${direction === 'long' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'}`}>
              {direction}
            </span>
            <span className={`text-2xs px-2 py-0.5 rounded-md font-semibold ${trade.strategy ? `strat-${trade.strategy}` : ''}`}>
              {STRATEGIES[trade.strategy]?.icon} {trade.strategy?.replace('-', ' ')}
            </span>
            {inZone && <span className="badge-blue animate-pulse-gentle text-2xs">IN ZONE</span>}
            {alert === 'TARGET_HIT' && <span className="badge-green animate-pulse-gentle text-2xs">TARGET</span>}
            {alert === 'STOP_HIT' && <span className="badge-red animate-pulse-gentle text-2xs">STOP</span>}
          </div>
          <span className="text-xs text-nx-text-muted mt-0.5 block">{trade.name}</span>
        </div>
        <div className="text-right">
          {price ? (
            <div className={`text-lg font-bold font-mono tabular-nums ${isUp ? 'text-nx-green' : 'text-nx-red'}`}>
              {formatPrice(price, fmtType)}
            </div>
          ) : (
            <div className="text-sm text-nx-text-muted">--</div>
          )}
          <span className={`text-2xs px-2 py-0.5 rounded-md font-bold ${
            trade.risk === 'HIGH' ? 'bg-nx-red-muted text-nx-red border border-nx-red/15' : trade.risk === 'LOW' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-orange-muted text-nx-orange border border-nx-orange/15'
          }`}>
            {trade.risk}
          </span>
        </div>
      </div>

      {/* Price bar */}
      <div className="bg-nx-void/60 rounded-lg p-2.5 mb-3 border border-nx-border/30">
        <div className="flex justify-between text-2xs mb-1.5">
          <span className="text-nx-red font-medium">Stop {trade.stopLoss}</span>
          <span className="text-nx-accent font-medium">Entry {trade.entryLow}\u2013{trade.entryHigh}</span>
          <span className="text-nx-green font-medium">Target {trade.target}</span>
        </div>
        {price && (
          <div className="relative h-1.5 bg-nx-border/30 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full rounded-full w-full" style={{ background: 'linear-gradient(90deg, rgba(248,113,113,0.15), rgba(91,141,238,0.15), rgba(52,211,153,0.15))' }} />
            {(() => {
              const min = direction === 'long' ? trade.stopLoss * 0.98 : trade.target * 0.98
              const max = direction === 'long' ? trade.target * 1.02 : trade.stopLoss * 1.02
              const pct = Math.min(100, Math.max(0, ((price - min) / (max - min)) * 100))
              return (
                <div
                  className="absolute top-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg"
                  style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 8px rgba(255,255,255,0.3)' }}
                />
              )
            })()}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-nx-text-muted">R:R</span>
          <span className={`text-sm font-bold font-mono ${parseFloat(rr) >= 2 ? 'text-nx-green' : 'text-nx-orange'}`}>{rr}:1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-nx-text-muted">RSI</span>
          <span className={`text-sm font-bold font-mono ${trade.rsi < 30 ? 'text-nx-green' : trade.rsi > 70 ? 'text-nx-red' : 'text-nx-orange'}`}>{trade.rsi}</span>
        </div>
        <div className="ml-auto text-2xs text-nx-text-hint">{trade.timeframe || '4-day'}</div>
      </div>

      <p className="text-xs text-nx-text-muted leading-relaxed mb-2 line-clamp-2">{trade.thesis}</p>
      <div className="flex items-center justify-between">
        <div className="text-2xs text-nx-purple truncate max-w-[80%]">{trade.catalyst}</div>
        <span className="text-2xs text-nx-accent opacity-0 group-hover:opacity-100 transition-opacity font-medium">View Packet &rarr;</span>
      </div>
    </div>
  )
}

export default function TradeIdeas({ quotes }) {
  const [tab, setTab] = useState('long')
  const [selectedStrategy, setSelectedStrategy] = useState('all')
  const [openPacket, setOpenPacket] = useState(null)

  const allStrategies = ['all', ...Object.keys(STRATEGIES)]
  const ideasMap = {
    long: LONG_IDEAS,
    short: SHORT_IDEAS,
    forex: FOREX_IDEAS,
  }

  const ideas = ideasMap[tab] || []
  const filtered = selectedStrategy === 'all' ? ideas : ideas.filter(i => i.strategy === selectedStrategy)

  const getDirection = (idea) => {
    if (tab === 'forex') return idea.direction || 'long'
    return tab
  }

  const getQuote = (idea) => {
    const tickerMap = {
      'USDJPY': 'JPY=X',
      'EURUSD': 'EURUSD=X',
      'GBPUSD': 'GBPUSD=X',
      'USDCHF': 'CHF=X',
      'AUDUSD': 'AUDUSD=X',
      'USDMXN': 'MXN=X',
      'EURGBP': 'EURGBP=X',
      'NZDUSD': 'NZDUSD=X',
    }
    const sym = tickerMap[idea.ticker] || idea.ticker
    return quotes[sym]
  }

  return (
    <div>
      {/* Tab row */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <h3 className="text-md font-bold text-nx-text-strong mr-2">Trade Ideas</h3>
        {[
          { id: 'long', label: `LONG (${LONG_IDEAS.length})`, color: 'green' },
          { id: 'short', label: `SHORT (${SHORT_IDEAS.length})`, color: 'red' },
          { id: 'forex', label: `FOREX (${FOREX_IDEAS.length})`, color: 'blue' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedStrategy('all') }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
              tab === t.id
                ? t.color === 'green' ? 'bg-nx-green-muted text-nx-green border border-nx-green/20'
                  : t.color === 'red' ? 'bg-nx-red-muted text-nx-red border border-nx-red/20'
                  : 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20'
                : 'text-nx-text-muted hover:text-nx-text-strong bg-nx-surface border border-nx-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Strategy filter */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="text-xs text-nx-text-muted mr-1 font-medium">Strategy:</span>
        {allStrategies.map(s => (
          <button
            key={s}
            onClick={() => setSelectedStrategy(s)}
            className={`px-2.5 py-1 text-2xs rounded-md font-medium transition-all duration-200 ${
              selectedStrategy === s
                ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/20'
                : 'text-nx-text-hint hover:text-nx-text-muted bg-nx-void/40 border border-nx-border'
            }`}
          >
            {s === 'all' ? 'All' : `${STRATEGIES[s]?.icon || ''} ${s.replace('-', ' ')}`}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(idea => (
          <TradeCard
            key={idea.id}
            trade={idea}
            quote={getQuote(idea)}
            direction={getDirection(idea)}
            onOpen={(idea, dir) => setOpenPacket({ idea, direction: dir })}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-nx-text-muted">
          No trade ideas match the selected strategy filter.
        </div>
      )}

      {openPacket && (
        <TradePacket
          idea={openPacket.idea}
          direction={openPacket.direction}
          currentPrice={getQuote(openPacket.idea)?.regularMarketPrice}
          onClose={() => setOpenPacket(null)}
        />
      )}
    </div>
  )
}
