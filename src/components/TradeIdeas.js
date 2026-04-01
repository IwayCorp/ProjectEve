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
      className={`bg-tv-pane border border-tv-border rounded-md p-4 cursor-pointer transition-all hover:border-tv-blue/40 hover:bg-tv-card group ${
        alert === 'TARGET_HIT' ? 'glow-green border-tv-green/40' : alert === 'STOP_HIT' ? 'glow-red border-tv-red/40' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-tv-text-strong group-hover:text-tv-blue transition-colors">{trade.ticker}</span>
            <span className={`text-2xs px-1.5 py-0.5 rounded font-bold uppercase ${direction === 'long' ? 'bg-tv-green-bg text-tv-green' : 'bg-tv-red-bg text-tv-red'}`}>
              {direction}
            </span>
            <span className={`text-2xs px-1.5 py-0.5 rounded font-semibold ${trade.strategy ? `strat-${trade.strategy}` : ''}`}>
              {STRATEGIES[trade.strategy]?.icon} {trade.strategy?.replace('-', ' ')}
            </span>
            {inZone && <span className="badge-blue animate-pulse text-2xs">IN ZONE</span>}
            {alert === 'TARGET_HIT' && <span className="badge-green animate-pulse text-2xs">TARGET</span>}
            {alert === 'STOP_HIT' && <span className="badge-red animate-pulse text-2xs">STOP</span>}
          </div>
          <span className="text-xs text-tv-text-muted">{trade.name}</span>
        </div>
        <div className="text-right">
          {price ? (
            <div className={`text-lg font-bold font-mono ${isUp ? 'text-tv-green' : 'text-tv-red'}`}>
              {formatPrice(price, fmtType)}
            </div>
          ) : (
            <div className="text-sm text-tv-text-muted">--</div>
          )}
          <span className={`text-2xs px-1.5 py-0.5 rounded font-bold ${
            trade.risk === 'HIGH' ? 'bg-tv-red-bg text-tv-red' : trade.risk === 'LOW' ? 'bg-tv-green-bg text-tv-green' : 'bg-tv-orange-bg text-tv-orange'
          }`}>
            {trade.risk}
          </span>
        </div>
      </div>

      {/* Price bar */}
      <div className="bg-tv-bg rounded p-2.5 mb-3">
        <div className="flex justify-between text-2xs mb-1.5">
          <span className="text-tv-red">Stop {trade.stopLoss}</span>
          <span className="text-tv-blue">Entry {trade.entryLow}–{trade.entryHigh}</span>
          <span className="text-tv-green">Target {trade.target}</span>
        </div>
        {price && (
          <div className="relative h-1.5 bg-tv-border rounded-full">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-tv-red/30 via-tv-blue/30 to-tv-green/30 rounded-full w-full" />
            {(() => {
              const min = direction === 'long' ? trade.stopLoss * 0.98 : trade.target * 0.98
              const max = direction === 'long' ? trade.target * 1.02 : trade.stopLoss * 1.02
              const pct = Math.min(100, Math.max(0, ((price - min) / (max - min)) * 100))
              return (
                <div
                  className="absolute top-1/2 w-2.5 h-2.5 bg-white rounded-full border-2 border-tv-blue shadow-lg"
                  style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
                />
              )
            })()}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1">
          <span className="text-2xs text-tv-text-muted">R:R</span>
          <span className={`text-sm font-bold ${parseFloat(rr) >= 2 ? 'text-tv-green' : 'text-tv-orange'}`}>{rr}:1</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-2xs text-tv-text-muted">RSI</span>
          <span className={`text-sm font-bold ${trade.rsi < 30 ? 'text-tv-green' : trade.rsi > 70 ? 'text-tv-red' : 'text-tv-orange'}`}>{trade.rsi}</span>
        </div>
        <div className="ml-auto text-2xs text-tv-text-hint">{trade.timeframe || '4-day'}</div>
      </div>

      <p className="text-xs text-tv-text-muted leading-relaxed mb-1.5 line-clamp-2">{trade.thesis}</p>
      <div className="flex items-center justify-between">
        <div className="text-2xs text-tv-purple truncate max-w-[80%]">{trade.catalyst}</div>
        <span className="text-2xs text-tv-blue opacity-0 group-hover:opacity-100 transition-opacity">View Packet →</span>
      </div>
    </div>
  )
}

export default function TradeIdeas({ quotes }) {
  const [tab, setTab] = useState('long')
  const [selectedStrategy, setSelectedStrategy] = useState('all')
  const [openPacket, setOpenPacket] = useState(null) // { idea, direction }

  const allStrategies = ['all', ...Object.keys(STRATEGIES)]
  const ideasMap = {
    long: LONG_IDEAS,
    short: SHORT_IDEAS,
    forex: FOREX_IDEAS,
  }

  const ideas = ideasMap[tab] || []
  const filtered = selectedStrategy === 'all' ? ideas : ideas.filter(i => i.strategy === selectedStrategy)

  // For forex, infer direction from the idea itself
  const getDirection = (idea) => {
    if (tab === 'forex') return idea.direction || 'long'
    return tab
  }

  // Map ticker to Yahoo symbol for quote lookup
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
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="text-md font-bold text-tv-text-strong mr-2">Trade Ideas</h3>
        {[
          { id: 'long', label: `LONG (${LONG_IDEAS.length})`, color: 'green' },
          { id: 'short', label: `SHORT (${SHORT_IDEAS.length})`, color: 'red' },
          { id: 'forex', label: `FOREX (${FOREX_IDEAS.length})`, color: 'blue' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedStrategy('all') }}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
              tab === t.id
                ? t.color === 'green' ? 'bg-tv-green-bg text-tv-green border border-tv-green/30'
                  : t.color === 'red' ? 'bg-tv-red-bg text-tv-red border border-tv-red/30'
                  : 'bg-tv-blue-muted text-tv-blue border border-tv-blue/30'
                : 'text-tv-text-muted hover:text-tv-text-strong bg-tv-pane border border-tv-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Strategy filter */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="text-xs text-tv-text-muted mr-1">Strategy:</span>
        {allStrategies.map(s => (
          <button
            key={s}
            onClick={() => setSelectedStrategy(s)}
            className={`px-2 py-1 text-2xs rounded transition-colors ${
              selectedStrategy === s
                ? 'bg-tv-blue-muted text-tv-blue border border-tv-blue/30'
                : 'text-tv-text-hint hover:text-tv-text-muted bg-tv-bg border border-tv-border'
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
        <div className="text-center py-12 text-tv-text-muted">
          No trade ideas match the selected strategy filter.
        </div>
      )}

      {/* Trade Packet Modal */}
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
