'use client'
import { useState, useRef, useEffect } from 'react'
import DemoBanner from '@/components/DemoBanner'

const AI_CAPABILITIES = [
  { id: 'strategy', icon: '🧠', name: 'Strategy Builder', desc: 'Describe a trading idea in plain English and let AI generate a quantitative strategy with entry/exit rules, position sizing, and risk management.' },
  { id: 'debug', icon: '🔍', name: 'Strategy Debugger', desc: 'AI analyzes your strategy for logical errors, overfitting risks, survivorship bias, and look-ahead bias.' },
  { id: 'optimize', icon: '⚡', name: 'Auto-Optimizer', desc: 'Automatically tune strategy parameters using walk-forward optimization with out-of-sample validation.' },
  { id: 'explain', icon: '📊', name: 'Trade Explainer', desc: 'Get detailed AI explanations for why each trade was triggered, including the confluence of signals and market context.' },
  { id: 'risk', icon: '🛡', name: 'Risk Analyzer', desc: 'AI evaluates portfolio risk across dimensions: correlation, concentration, tail risk, and liquidity risk.' },
  { id: 'market', icon: '🌍', name: 'Market Regime Detection', desc: 'ML-powered regime classification to adapt strategy parameters to current market conditions (trending, mean-reverting, volatile).' },
]

const EXAMPLE_PROMPTS = [
  'Build a momentum strategy that buys when RSI crosses above 30 with volume confirmation and holds for 5-10 days',
  'Why is my mean-reversion strategy underperforming in the current market regime?',
  'Analyze the correlation risk in my current portfolio of NVDA, MSFT, and AAPL',
  'Generate a hedging strategy for my long tech positions using VIX futures',
  'What macro factors should I monitor for my USD/JPY carry trade?',
]

const AI_INSIGHTS = [
  { type: 'warning', title: 'Correlation Risk Detected', desc: 'Your long positions (NVDA, MSFT, AAPL) have a 0.87 average pairwise correlation. Consider adding uncorrelated assets like GC=F or short positions.', time: '2 min ago' },
  { type: 'opportunity', title: 'Regime Shift Signal', desc: 'VIX term structure has inverted — historically precedes a 3-5% pullback within 10 trading days. Your momentum strategies may underperform.', time: '15 min ago' },
  { type: 'info', title: 'Optimization Complete', desc: 'Walk-forward optimization of your mean-reversion strategy improved Sharpe from 1.8 to 2.4 with optimal RSI lookback of 7 days.', time: '1 hr ago' },
  { type: 'warning', title: 'Liquidity Alert', desc: 'BYND average daily volume has dropped 40% in the past week. Position sizing should be reduced to avoid slippage impact.', time: '3 hr ago' },
]

const MAX_CHAT_HISTORY = 50

export default function AIAssistant() {
  const [prompt, setPrompt] = useState('')
  const [selectedCap, setSelectedCap] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim() || isProcessing) return
    setIsProcessing(true)
    setChatHistory(prev => [...prev, { role: 'user', content: prompt }].slice(-MAX_CHAT_HISTORY))
    const userPrompt = prompt
    setPrompt('')

    // Simulate AI processing delay
    setTimeout(() => {
      setChatHistory(prev => [...prev, {
        role: 'ai',
        content: `Processing your request... AI analysis would appear here with actionable insights based on your portfolio data, market conditions, and strategy parameters.`
      }].slice(-MAX_CHAT_HISTORY))
      setIsProcessing(false)
    }, 1200)
  }

  return (
    <div className="space-y-5">
      <DemoBanner
        type="demo"
        message="The AI assistant is a UI preview. Chat responses are placeholder text — no LLM or analysis engine is connected. Insights shown are static examples."
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>AI Research Assistant</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">Natural language interface for strategy development, debugging, and market analysis.</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(91, 141, 238, 0.1), rgba(167, 139, 250, 0.1))', border: '1px solid rgba(91, 141, 238, 0.2)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-nx-accent animate-pulse" />
          <span className="text-2xs font-semibold text-nx-accent">AI Online</span>
        </div>
      </div>

      {/* AI Capabilities */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {AI_CAPABILITIES.map(cap => (
          <div
            key={cap.id}
            onClick={() => setSelectedCap(selectedCap?.id === cap.id ? null : cap)}
            aria-label={`${cap.name}: ${cap.desc.slice(0, 60)}...`}
            aria-pressed={selectedCap?.id === cap.id}
            role="button"
            className={`nx-card p-3.5 cursor-pointer group transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-nx-accent/20 hover:scale-[1.01] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-center ${
              selectedCap?.id === cap.id ? 'border-nx-accent/30 ring-1 ring-nx-accent/10' : ''
            }`}
          >
            <div className="text-2xl mb-2">{cap.icon}</div>
            <div className="text-xs font-bold text-nx-text-strong group-hover:text-nx-accent transition-colors">{cap.name}</div>
          </div>
        ))}
      </div>

      {/* Selected Capability Detail */}
      {selectedCap && (
        <div className="nx-card p-4 animate-fade-in" style={{ borderColor: 'rgba(91, 141, 238, 0.15)' }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{selectedCap.icon}</span>
            <h4 className="text-sm font-bold text-nx-text-strong">{selectedCap.name}</h4>
          </div>
          <p className="text-xs text-nx-text-muted leading-relaxed">{selectedCap.desc}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Chat Interface */}
        <div className="xl:col-span-2">
          <div className="nx-card overflow-hidden" style={{ minHeight: 420 }}>
            <div className="p-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h4 className="text-sm font-bold text-nx-text-strong">AI Chat</h4>
            </div>

            {/* Chat Messages */}
            <div className="p-4 space-y-3" style={{ minHeight: 280, maxHeight: 340, overflowY: 'auto' }} role="log" aria-live="polite" aria-label="Chat messages">
              {chatHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">🧠</div>
                  <p className="text-sm text-nx-text-muted mb-4">Ask me anything about your trading strategies, market conditions, or portfolio risk.</p>
                  <div className="space-y-2">
                    {EXAMPLE_PROMPTS.slice(0, 3).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setPrompt(p)}
                        className="block w-full text-left px-4 py-2.5 rounded-lg text-xs text-nx-text-muted hover:text-nx-accent hover:bg-nx-accent/5 transition-all duration-200"
                        style={{ border: '1px solid rgba(255, 255, 255, 0.04)' }}
                      >
                        &ldquo;{p}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-nx-accent/15 text-nx-text-strong border border-nx-accent/20'
                          : 'bg-nx-void/60 text-nx-text border border-nx-border'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-xl px-4 py-3 text-xs bg-nx-void/60 border border-nx-border flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-nx-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-nx-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-nx-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-nx-text-muted">Analyzing...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Ask AI about strategies, risk, or market analysis..."
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-nx-void/60 border border-nx-border text-nx-text-strong placeholder:text-nx-text-hint focus:outline-none focus:border-nx-accent/30 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isProcessing ? 'opacity-40 cursor-not-allowed' : ''}`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(91, 141, 238, 0.2), rgba(167, 139, 250, 0.2))',
                    border: '1px solid rgba(91, 141, 238, 0.3)',
                    color: '#5b8dee',
                  }}
                >
                  {isProcessing ? 'Analyzing...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div>
          <div className="nx-card overflow-hidden" style={{ minHeight: 420 }}>
            <div className="p-4" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h4 className="text-sm font-bold text-nx-text-strong">Live AI Insights</h4>
            </div>
            <div className="p-3 space-y-2">
              {AI_INSIGHTS.map((insight, i) => (
                <div key={i} className="p-3 rounded-lg transition-colors hover:bg-nx-glass-hover" style={{
                  background: insight.type === 'warning' ? 'rgba(251, 191, 36, 0.04)' : insight.type === 'opportunity' ? 'rgba(52, 211, 153, 0.04)' : 'rgba(91, 141, 238, 0.04)',
                  border: `1px solid ${insight.type === 'warning' ? 'rgba(251, 191, 36, 0.1)' : insight.type === 'opportunity' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(91, 141, 238, 0.1)'}`,
                }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-2xs font-bold uppercase ${
                      insight.type === 'warning' ? 'text-nx-orange' : insight.type === 'opportunity' ? 'text-nx-green' : 'text-nx-accent'
                    }`}>{insight.title}</span>
                    <span className="text-2xs text-nx-text-hint">{insight.time}</span>
                  </div>
                  <p className="text-2xs text-nx-text-muted leading-relaxed">{insight.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
