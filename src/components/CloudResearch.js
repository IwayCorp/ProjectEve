'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

const RESEARCH_TEMPLATES = [
  { id: 'momentum', name: 'Momentum Scanner', desc: 'Scan for high-momentum setups across equities, futures, and forex using RSI, MACD, and volume confirmation.', icon: '⚡', language: 'Python', difficulty: 'Intermediate', runtime: '~2min' },
  { id: 'mean-rev', name: 'Mean Reversion Detector', desc: 'Identify statistically significant deviations from historical means with Z-score and Bollinger Band analysis.', icon: '↩', language: 'Python', difficulty: 'Intermediate', runtime: '~3min' },
  { id: 'correlation', name: 'Cross-Asset Correlation', desc: 'Compute rolling correlations between bonds, currencies, equities, and commodities to find regime changes.', icon: '🔗', language: 'Python', difficulty: 'Advanced', runtime: '~5min' },
  { id: 'sentiment', name: 'News Sentiment Analyzer', desc: 'NLP-powered sentiment extraction from financial news, earnings calls, and Fed speeches.', icon: '📰', language: 'Python', difficulty: 'Advanced', runtime: '~4min' },
  { id: 'volatility', name: 'Volatility Surface Builder', desc: 'Construct implied volatility surfaces from options chains for term structure analysis.', icon: '📊', language: 'Python', difficulty: 'Expert', runtime: '~6min' },
  { id: 'macro', name: 'Macro Regime Classifier', desc: 'Machine learning model to classify current macro regime (risk-on, risk-off, stagflation, goldilocks).', icon: '🌍', language: 'Python', difficulty: 'Expert', runtime: '~8min' },
  { id: 'pairs', name: 'Pairs Trading Scanner', desc: 'Cointegration analysis across sector pairs to identify mean-reverting spread trades.', icon: '⚖', language: 'Python', difficulty: 'Intermediate', runtime: '~3min' },
  { id: 'flow', name: 'Options Flow Analyzer', desc: 'Track unusual options activity and dark pool prints for institutional positioning signals.', icon: '🏦', language: 'Python', difficulty: 'Intermediate', runtime: '~2min' },
]

const RECENT_RUNS = [
  { id: 1, template: 'Momentum Scanner', status: 'completed', runtime: '1m 42s', signals: 8, date: '2026-03-31' },
  { id: 2, template: 'Cross-Asset Correlation', status: 'completed', runtime: '4m 18s', signals: 3, date: '2026-03-31' },
  { id: 3, template: 'Macro Regime Classifier', status: 'completed', runtime: '7m 55s', signals: 1, date: '2026-03-30' },
  { id: 4, template: 'Options Flow Analyzer', status: 'running', runtime: '0m 45s', signals: null, date: '2026-04-01' },
]

export default function CloudResearch() {
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef(null)

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      searchRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const filtered = searchQuery
    ? RESEARCH_TEMPLATES.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase()))
    : RESEARCH_TEMPLATES

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="nx-section-header">
            <div className="nx-accent-bar" />
            <h3>Cloud Research</h3>
          </div>
          <p className="text-xs text-nx-text-muted mt-1 ml-3">Run quantitative research algorithms on cloud infrastructure with institutional-grade data feeds.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-nx-green animate-pulse" />
            <span className="text-2xs font-semibold text-nx-green">Cloud Active</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-2xs font-medium" style={{ background: 'rgba(91, 141, 238, 0.08)', border: '1px solid rgba(91, 141, 238, 0.15)', color: '#5b8dee' }}>
            8 Nodes Available
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search research templates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 text-sm rounded-xl bg-nx-void/60 border border-nx-border text-nx-text-strong placeholder:text-nx-text-hint focus:outline-none focus:border-nx-accent/30 transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-nx-text-hint text-xs">⌘K</span>
      </div>

      {/* Research Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {filtered.map(template => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
            role="button"
            aria-label={`${template.name} — ${template.difficulty}, ${template.runtime}`}
            aria-pressed={selectedTemplate?.id === template.id}
            className={`nx-card p-4 cursor-pointer group transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-nx-accent/20 hover:scale-[1.01] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${
              selectedTemplate?.id === template.id ? 'border-nx-accent/30 ring-1 ring-nx-accent/10' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xl">{template.icon}</span>
              <span className="text-2xs px-2 py-0.5 rounded-md font-medium" style={{
                background: template.difficulty === 'Expert' ? 'rgba(248, 113, 113, 0.1)' : template.difficulty === 'Advanced' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(52, 211, 153, 0.1)',
                color: template.difficulty === 'Expert' ? '#f87171' : template.difficulty === 'Advanced' ? '#fbbf24' : '#34d399',
                border: `1px solid ${template.difficulty === 'Expert' ? 'rgba(248, 113, 113, 0.2)' : template.difficulty === 'Advanced' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(52, 211, 153, 0.2)'}`,
              }}>
                {template.difficulty}
              </span>
            </div>
            <h4 className="text-sm font-bold text-nx-text-strong mb-1 group-hover:text-nx-accent transition-colors">{template.name}</h4>
            <p className="text-2xs text-nx-text-muted leading-relaxed mb-3 line-clamp-2">{template.desc}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-nx-void/60 text-nx-text-hint">{template.language}</span>
                <span className="text-2xs text-nx-text-hint">{template.runtime}</span>
              </div>
              <span className="text-2xs text-nx-accent opacity-0 group-hover:opacity-100 transition-opacity font-medium">Run &rarr;</span>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Template Detail */}
      {selectedTemplate && (
        <div className="nx-card p-5 animate-fade-in" style={{ borderColor: 'rgba(91, 141, 238, 0.15)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedTemplate.icon}</span>
              <div>
                <h4 className="text-md font-bold text-nx-text-strong">{selectedTemplate.name}</h4>
                <p className="text-xs text-nx-text-muted">{selectedTemplate.desc}</p>
              </div>
            </div>
            <button className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200" style={{
              background: 'linear-gradient(135deg, rgba(91, 141, 238, 0.2), rgba(167, 139, 250, 0.2))',
              border: '1px solid rgba(91, 141, 238, 0.3)',
              color: '#5b8dee',
              boxShadow: '0 0 20px rgba(91, 141, 238, 0.1)',
            }}>
              Launch Research
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-nx-void/40 rounded-lg p-3">
              <div className="text-2xs text-nx-text-muted">Language</div>
              <div className="text-sm font-mono font-semibold text-nx-text-strong mt-0.5">{selectedTemplate.language}</div>
            </div>
            <div className="bg-nx-void/40 rounded-lg p-3">
              <div className="text-2xs text-nx-text-muted">Est. Runtime</div>
              <div className="text-sm font-mono font-semibold text-nx-text-strong mt-0.5">{selectedTemplate.runtime}</div>
            </div>
            <div className="bg-nx-void/40 rounded-lg p-3">
              <div className="text-2xs text-nx-text-muted">Difficulty</div>
              <div className="text-sm font-semibold text-nx-text-strong mt-0.5">{selectedTemplate.difficulty}</div>
            </div>
            <div className="bg-nx-void/40 rounded-lg p-3">
              <div className="text-2xs text-nx-text-muted">Data Sources</div>
              <div className="text-sm font-semibold text-nx-text-strong mt-0.5">Yahoo, FRED, BLS</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Research Runs */}
      <div>
        <div className="nx-section-header">
          <div className="nx-accent-bar" />
          <h3>Recent Research Runs</h3>
        </div>
        <div className="space-y-1.5 mt-3">
          {RECENT_RUNS.map(run => (
            <div key={run.id} className="nx-card p-3.5 flex items-center gap-4">
              <div className="flex items-center gap-2 w-48">
                {run.status === 'running' ? (
                  <div className="w-4 h-4 border-2 border-nx-accent border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-nx-green/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-nx-green" />
                  </div>
                )}
                <span className="text-sm font-semibold text-nx-text-strong">{run.template}</span>
              </div>
              <span className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${
                run.status === 'running' ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/15' : 'bg-nx-green-muted text-nx-green border border-nx-green/15'
              }`}>
                {run.status}
              </span>
              <span className="text-xs font-mono text-nx-text-muted">{run.runtime}</span>
              <span className="text-xs text-nx-text-muted">{run.signals != null ? `${run.signals} signals` : 'Processing...'}</span>
              <span className="ml-auto text-2xs text-nx-text-hint">{run.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
