'use client'
import { useState, useMemo } from 'react'

// Base positions — currentPrice/P&L will be computed from live quotes
const BASE_POSITIONS = [
  { id: 1, symbol: 'NVDA', quoteKey: 'NVDA', direction: 'LONG', qty: 15, entryPrice: 842.50, holdDays: 2, stopLoss: 780, target: 920 },
  { id: 2, symbol: 'RTX', quoteKey: 'RTX', direction: 'LONG', qty: 50, entryPrice: 141.20, holdDays: 3, stopLoss: 132, target: 158 },
  { id: 3, symbol: 'USDJPY', quoteKey: 'JPY=X', direction: 'SHORT', qty: 100000, entryPrice: 151.20, holdDays: 1, stopLoss: 153.50, target: 148.00 },
  { id: 4, symbol: 'GC=F', quoteKey: 'GC=F', direction: 'LONG', qty: 3, entryPrice: 2305.00, holdDays: 4, stopLoss: 2220, target: 2450 },
  { id: 5, symbol: 'XOM', quoteKey: 'XOM', direction: 'LONG', qty: 40, entryPrice: 137.50, holdDays: 1, stopLoss: 128, target: 155 },
]

const PENDING_ORDERS = [
  { id: 1, symbol: 'MSFT', type: 'LIMIT BUY', price: 382.00, qty: 25, status: 'waiting', timeframe: '5-10 days' },
  { id: 2, symbol: 'CL=F', type: 'LIMIT BUY', price: 83.50, qty: 5, status: 'waiting', timeframe: '3-7 days' },
  { id: 3, symbol: 'BYND', type: 'LIMIT SELL', price: 8.80, qty: 200, status: 'waiting', timeframe: '14-30 days' },
]

const EXECUTION_LOG = [
  { time: '09:31:42', symbol: 'NVDA', action: 'BUY', qty: 15, price: 842.50, type: 'LIMIT', status: 'FILLED' },
  { time: '09:32:15', symbol: 'RTX', action: 'BUY', qty: 50, price: 141.20, type: 'MARKET', status: 'FILLED' },
  { time: '10:15:33', symbol: 'USDJPY', action: 'SELL', qty: 100000, price: 151.20, type: 'LIMIT', status: 'FILLED' },
  { time: '11:02:18', symbol: 'GC=F', action: 'BUY', qty: 3, price: 2305.00, type: 'LIMIT', status: 'FILLED' },
  { time: '14:45:22', symbol: 'XOM', action: 'BUY', qty: 40, price: 137.50, type: 'MARKET', status: 'FILLED' },
  { time: '15:30:00', symbol: 'MSFT', action: 'BUY', qty: 25, price: 382.00, type: 'LIMIT', status: 'PENDING' },
]

export default function LiveTrading({ quotes = {} }) {
  const [view, setView] = useState('positions')

  // Compute live positions from real-time quotes
  const positions = useMemo(() => {
    return BASE_POSITIONS.map(pos => {
      const q = quotes[pos.quoteKey]
      const livePrice = q?.regularMarketPrice || pos.entryPrice
      const pnl = pos.direction === 'LONG'
        ? (livePrice - pos.entryPrice) * pos.qty
        : (pos.entryPrice - livePrice) * pos.qty
      const pct = (pnl / (pos.entryPrice * pos.qty)) * 100
      return { ...pos, currentPrice: livePrice, unrealizedPnl: pnl, unrealizedPct: pct }
    })
  }, [quotes])

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
  const totalExposure = positions.reduce((sum, p) => sum + (p.currentPrice * p.qty), 0)
  const portfolioValue = 100000 + totalUnrealized

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Live Trading Dashboard</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">Real-time position monitoring, order management, and execution tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-nx-green animate-pulse" />
            <span className="text-2xs font-semibold text-nx-green">Market Open</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-2xs font-mono font-bold" style={{ background: 'rgba(91, 141, 238, 0.08)', border: '1px solid rgba(91, 141, 238, 0.15)', color: '#5b8dee' }}>
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Portfolio Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-0 rounded-xl overflow-hidden" style={{ background: 'rgba(15, 21, 35, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        {[
          { label: 'Portfolio Value', value: `$${portfolioValue.toLocaleString()}`, color: 'text-nx-text-strong' },
          { label: 'Unrealized P&L', value: `${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`, color: totalUnrealized >= 0 ? 'text-nx-green' : 'text-nx-red' },
          { label: 'Total Exposure', value: `$${totalExposure.toLocaleString()}`, color: 'text-nx-accent' },
          { label: 'Active Positions', value: positions.length, color: 'text-nx-text-strong' },
          { label: 'Pending Orders', value: PENDING_ORDERS.length, color: 'text-nx-orange' },
        ].map((item, i) => (
          <div key={i} className="p-3.5 text-center" style={{ borderRight: i < 4 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none' }}>
            <div className="text-2xs text-nx-text-muted uppercase tracking-wider font-medium">{item.label}</div>
            <div className={`text-lg font-bold font-mono tabular-nums mt-1 ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 p-0.5">
        {['positions', 'orders', 'executions'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-label={`View ${v}`}
            aria-pressed={view === v}
            className={`px-3 py-1.5 text-2xs rounded-lg font-semibold transition-all duration-200 capitalize ${
              view === v ? 'text-nx-accent border border-nx-accent/20' : 'text-nx-text-muted hover:text-nx-text-strong'
            }`}
            style={view === v ? { background: 'rgba(91, 141, 238, 0.12)' } : {}}
          >
            {v === 'positions' ? `Positions (${positions.length})` : v === 'orders' ? `Orders (${PENDING_ORDERS.length})` : `Executions (${EXECUTION_LOG.length})`}
          </button>
        ))}
      </div>

      {/* Active Positions */}
      {view === 'positions' && (
        <div>
          <div className="space-y-1">
            <div className="grid grid-cols-9 gap-2 px-4 py-2 text-2xs text-nx-text-muted uppercase tracking-wider font-medium">
              <span>Symbol</span><span>Side</span><span>Qty</span><span>Entry</span><span>Current</span><span>Stop</span><span>Target</span><span className="text-right">P&L</span><span className="text-right">Hold</span>
            </div>
            {positions.map(pos => {
              const targetDist = pos.direction === 'LONG'
                ? ((pos.target - pos.currentPrice) / (pos.target - pos.entryPrice)) * 100
                : ((pos.currentPrice - pos.target) / (pos.entryPrice - pos.target)) * 100
              const progress = 100 - Math.max(0, Math.min(100, targetDist))

              return (
                <div key={pos.id} className="nx-card p-4">
                  <div className="grid grid-cols-9 gap-2 items-center">
                    <span className="text-sm font-bold text-nx-text-strong">{pos.symbol}</span>
                    <span className={`text-2xs px-2 py-0.5 rounded-md font-bold inline-block w-fit ${
                      pos.direction === 'LONG' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'
                    }`}>{pos.direction}</span>
                    <span className="text-xs font-mono text-nx-text-muted">{pos.qty.toLocaleString()}</span>
                    <span className="text-xs font-mono text-nx-text">{pos.entryPrice}</span>
                    <span className={`text-xs font-bold font-mono ${pos.unrealizedPnl >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>{pos.currentPrice}</span>
                    <span className="text-xs font-mono text-nx-red">{pos.stopLoss}</span>
                    <span className="text-xs font-mono text-nx-green">{pos.target}</span>
                    <div className="text-right">
                      <div className={`text-xs font-bold font-mono ${pos.unrealizedPnl >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
                        {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                      </div>
                      <div className={`text-2xs font-mono ${pos.unrealizedPct >= 0 ? 'text-nx-green' : 'text-nx-red'}`}>
                        {pos.unrealizedPct >= 0 ? '+' : ''}{pos.unrealizedPct}%
                      </div>
                    </div>
                    <span className="text-xs text-nx-text-muted text-right">{pos.holdDays}d</span>
                  </div>

                  {/* Progress bar toward target */}
                  <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${Math.max(2, progress)}%`,
                      background: progress > 50
                        ? 'linear-gradient(90deg, rgba(91, 141, 238, 0.5), rgba(52, 211, 153, 0.7))'
                        : 'linear-gradient(90deg, rgba(91, 141, 238, 0.3), rgba(91, 141, 238, 0.5))',
                      boxShadow: progress > 50 ? '0 0 8px rgba(52, 211, 153, 0.3)' : '0 0 6px rgba(91, 141, 238, 0.2)',
                    }} />
                  </div>
                  <div className="flex justify-between mt-1 text-2xs text-nx-text-hint">
                    <span>Entry</span>
                    <span>{Math.round(progress)}% to target</span>
                    <span>Target</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending Orders */}
      {view === 'orders' && (
        <div className="space-y-1">
          <div className="grid grid-cols-6 gap-2 px-4 py-2 text-2xs text-nx-text-muted uppercase tracking-wider font-medium">
            <span>Symbol</span><span>Type</span><span>Price</span><span>Qty</span><span>Timeframe</span><span>Status</span>
          </div>
          {PENDING_ORDERS.map(order => (
            <div key={order.id} className="nx-card grid grid-cols-6 gap-2 px-4 py-3.5 items-center">
              <span className="text-sm font-bold text-nx-text-strong">{order.symbol}</span>
              <span className={`text-2xs px-2 py-0.5 rounded-md font-bold inline-block w-fit ${
                order.type.includes('BUY') ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'
              }`}>{order.type}</span>
              <span className="text-xs font-mono font-bold text-nx-accent">{order.price}</span>
              <span className="text-xs font-mono text-nx-text-muted">{order.qty}</span>
              <span className="text-xs text-nx-text-muted">{order.timeframe}</span>
              <span className="text-2xs px-2 py-0.5 rounded-md font-bold uppercase bg-nx-orange-muted text-nx-orange border border-nx-orange/15 inline-block w-fit">
                {order.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Execution Log */}
      {view === 'executions' && (
        <div className="space-y-1">
          <div className="grid grid-cols-7 gap-2 px-4 py-2 text-2xs text-nx-text-muted uppercase tracking-wider font-medium">
            <span>Time</span><span>Symbol</span><span>Action</span><span>Qty</span><span>Price</span><span>Type</span><span>Status</span>
          </div>
          {EXECUTION_LOG.map((exec, i) => (
            <div key={i} className="nx-card grid grid-cols-7 gap-2 px-4 py-3 items-center">
              <span className="text-xs font-mono text-nx-text-muted">{exec.time}</span>
              <span className="text-xs font-bold text-nx-text-strong">{exec.symbol}</span>
              <span className={`text-2xs px-2 py-0.5 rounded-md font-bold inline-block w-fit ${
                exec.action === 'BUY' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-red-muted text-nx-red border border-nx-red/15'
              }`}>{exec.action}</span>
              <span className="text-xs font-mono text-nx-text-muted">{exec.qty.toLocaleString()}</span>
              <span className="text-xs font-mono text-nx-text-strong">{exec.price}</span>
              <span className="text-xs text-nx-text-muted">{exec.type}</span>
              <span className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase inline-block w-fit ${
                exec.status === 'FILLED' ? 'bg-nx-green-muted text-nx-green border border-nx-green/15' : 'bg-nx-orange-muted text-nx-orange border border-nx-orange/15'
              }`}>{exec.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
