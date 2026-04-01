'use client'
import { useState } from 'react'
import { TRADE_IDEAS, calcRR, isInEntryZone, checkAlerts } from '@/lib/tradeIdeas'
import { formatPrice } from '@/lib/marketData'

function AlertBadge({ alert }) {
  if (!alert) return null
  if (alert === 'TARGET_HIT') return <span className="badge-green animate-pulse">TARGET HIT</span>
  if (alert === 'STOP_HIT') return <span className="badge-red animate-pulse">STOP HIT</span>
  return null
}

function TradeCard({ trade, quote, direction }) {
  const price = quote?.regularMarketPrice
  const inZone = price ? isInEntryZone(price, trade.entryLow, trade.entryHigh) : false
  const alert = price ? checkAlerts(price, trade.target, trade.stopLoss, direction) : null
  const midEntry = (trade.entryLow + trade.entryHigh) / 2
  const rr = calcRR(midEntry, trade.target, trade.stopLoss, direction)
  const isUp = quote?.regularMarketChangePercent >= 0

  return (
    <div className={`card hover:border-eve-accent/30 transition-all ${alert === 'TARGET_HIT' ? 'glow-green border-eve-green/50' : alert === 'STOP_HIT' ? 'glow-red border-eve-red/50' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-eve-accent">{trade.ticker}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${direction === 'long' ? 'bg-emerald-900/30 text-eve-green' : 'bg-red-900/30 text-eve-red'}`}>
              {direction.toUpperCase()}
            </span>
            {inZone && <span className="badge-blue animate-pulse">IN ZONE</span>}
            <AlertBadge alert={alert} />
          </div>
          <span className="text-xs text-eve-muted">{trade.name}</span>
        </div>
        <div className="text-right">
          {price && (
            <div className={`text-lg font-bold font-mono ${isUp ? 'text-eve-green' : 'text-eve-red'}`}>
              {formatPrice(price)}
            </div>
          )}
          <span className={`text-xs ${trade.risk === 'HIGH' ? 'badge-red' : 'badge-orange'}`}>
            {trade.risk} RISK
          </span>
        </div>
      </div>

      {/* Entry/Target/Stop visual */}
      <div className="bg-eve-bg rounded-lg p-3 mb-3">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-eve-red">Stop: {formatPrice(trade.stopLoss)}</span>
          <span className="text-eve-accent">Entry: {formatPrice(trade.entryLow)}-{formatPrice(trade.entryHigh)}</span>
          <span className="text-eve-green">Target: {formatPrice(trade.target)}</span>
        </div>
        {/* Price position bar */}
        {price && (
          <div className="relative h-2 bg-eve-border rounded-full">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-eve-red via-eve-accent to-eve-green rounded-full opacity-30 w-full" />
            {(() => {
              const min = direction === 'long' ? trade.stopLoss * 0.98 : trade.target * 0.98
              const max = direction === 'long' ? trade.target * 1.02 : trade.stopLoss * 1.02
              const pct = Math.min(100, Math.max(0, ((price - min) / (max - min)) * 100))
              return (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-eve-accent shadow-lg"
                  style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
                />
              )
            })()}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-eve-muted">R:R</span>
          <span className="text-sm font-bold text-eve-accent">{rr}x</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-eve-muted">RSI</span>
          <span className={`text-sm font-bold ${trade.rsi < 30 ? 'text-eve-green' : trade.rsi > 70 ? 'text-eve-red' : 'text-eve-orange'}`}>
            {trade.rsi}
          </span>
        </div>
      </div>

      <p className="text-xs text-eve-muted leading-relaxed mb-2">{trade.thesis}</p>
      <div className="flex items-center gap-1">
        <span className="text-xs text-eve-purple font-medium">Catalyst:</span>
        <span className="text-xs text-eve-muted">{trade.catalyst}</span>
      </div>
    </div>
  )
}

export default function TradeIdeas({ quotes }) {
  const [tab, setTab] = useState('long')

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-bold text-white mr-4">4-Day Trade Ideas</h3>
        <button
          onClick={() => setTab('long')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            tab === 'long' ? 'bg-eve-green/20 text-eve-green border border-eve-green/30' : 'text-eve-muted hover:text-white'
          }`}
        >
          LONG ({TRADE_IDEAS.long.length})
        </button>
        <button
          onClick={() => setTab('short')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            tab === 'short' ? 'bg-eve-red/20 text-eve-red border border-eve-red/30' : 'text-eve-muted hover:text-white'
          }`}
        >
          SHORT ({TRADE_IDEAS.short.length})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {TRADE_IDEAS[tab].map(trade => (
          <TradeCard
            key={trade.ticker}
            trade={trade}
            quote={quotes[trade.ticker]}
            direction={tab}
          />
        ))}
      </div>
    </div>
  )
}
