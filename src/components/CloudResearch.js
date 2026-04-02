'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

const RESEARCH_TEMPLATES = [
  { id: 'momentum', name: 'Momentum Scanner', desc: 'Scan for high-momentum setups using RSI and MACD analysis across equities.', icon: '⚡', language: 'Real API', difficulty: 'Intermediate', apiEndpoint: '/api/signals?category=long' },
  { id: 'mean-rev', name: 'Mean Reversion Detector', desc: 'Identify statistically significant deviations with Z-score and Bollinger Band filters.', icon: '↩', language: 'Real API', difficulty: 'Intermediate', apiEndpoint: '/api/signals?category=short' },
  { id: 'correlation', name: 'Cross-Asset Correlation', desc: 'Compute rolling correlations between equities, currencies, and commodities.', icon: '🔗', language: 'Real API', difficulty: 'Advanced', apiEndpoint: '/api/correlation' },
  { id: 'backtest', name: 'Strategy Backtest', desc: 'Run backtests on RSI mean-reversion strategies with real historical data.', icon: '📈', language: 'Real API', difficulty: 'Advanced', apiEndpoint: '/api/backtest' },
  { id: 'optimize', name: 'Parameter Optimizer', desc: 'Optimize strategy parameters for maximum risk-adjusted returns.', icon: '⚙', language: 'Real API', difficulty: 'Advanced', apiEndpoint: '/api/optimize' },
]

export default function CloudResearch() {
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [symbolInput, setSymbolInput] = useState('SPY')
  const [runs, setRuns] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [expandedRunId, setExpandedRunId] = useState(null)
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

  const formatDate = (date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`
  }

  const launchResearch = async () => {
    if (isRunning || !selectedTemplate) return

    setIsRunning(true)
    const startTime = Date.now()
    const runId = Date.now()
    const newRun = {
      id: runId,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      status: 'running',
      startTime,
      duration: 0,
      results: null,
      error: null,
      resultCount: 0,
    }

    setRuns((prev) => [newRun, ...prev])

    try {
      let endpoint = selectedTemplate.apiEndpoint

      if (selectedTemplate.id === 'backtest') {
        endpoint = `/api/backtest?symbol=${encodeURIComponent(symbolInput)}&strategy=rsi-mean-reversion`
      } else if (selectedTemplate.id === 'optimize') {
        endpoint = `/api/optimize?symbol=${encodeURIComponent(symbolInput)}`
      }

      const response = await fetch(endpoint)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `API error: ${response.status}`)
      }

      const duration = Date.now() - startTime

      setRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? {
                ...run,
                status: 'completed',
                duration,
                results: data,
                resultCount: Array.isArray(data.signals) ? data.signals.length : data.data ? (Array.isArray(data.data) ? data.data.length : Object.keys(data.data).length) : 0,
              }
            : run
        )
      )
    } catch (error) {
      const duration = Date.now() - startTime
      setRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? {
                ...run,
                status: 'error',
                duration,
                error: error.message,
              }
            : run
        )
      )
    } finally {
      setIsRunning(false)
    }
  }

  const filtered = searchQuery
    ? RESEARCH_TEMPLATES.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
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
          <p className="text-xs text-nx-text-muted mt-1 ml-3">
            Run quantitative research algorithms with real-time API data feeds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-nx-green animate-pulse" />
            <span className="text-2xs font-semibold text-nx-green">Cloud Active</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg text-2xs font-medium" style={{ background: 'rgba(91, 141, 238, 0.08)', border: '1px solid rgba(91, 141, 238, 0.15)', color: '#5b8dee' }}>
            5 Templates
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {filtered.map(template => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
            role="button"
            aria-label={`${template.name} — ${template.difficulty}`}
            aria-pressed={selectedTemplate?.id === template.id}
            className={`nx-card p-4 cursor-pointer group transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-nx-accent/20 hover:scale-[1.01] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${
              selectedTemplate?.id === template.id ? 'border-nx-accent/30 ring-1 ring-nx-accent/10' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xl">{template.icon}</span>
              <span
                className="text-2xs px-2 py-0.5 rounded-md font-medium"
                style={{
                  background:
                    template.difficulty === 'Advanced'
                      ? 'rgba(251, 191, 36, 0.1)'
                      : 'rgba(52, 211, 153, 0.1)',
                  color: template.difficulty === 'Advanced' ? '#fbbf24' : '#34d399',
                  border: `1px solid ${
                    template.difficulty === 'Advanced'
                      ? 'rgba(251, 191, 36, 0.2)'
                      : 'rgba(52, 211, 153, 0.2)'
                  }`,
                }}
              >
                {template.difficulty}
              </span>
            </div>
            <h4 className="text-sm font-bold text-nx-text-strong mb-1 group-hover:text-nx-accent transition-colors">{template.name}</h4>
            <p className="text-2xs text-nx-text-muted leading-relaxed mb-3 line-clamp-2">
              {template.desc}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-nx-void/60 text-nx-text-hint">
                {template.language}
              </span>
              <span className="text-2xs text-nx-accent opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                Run →
              </span>
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
            <button
              onClick={launchResearch}
              disabled={isRunning}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(91, 141, 238, 0.2), rgba(167, 139, 250, 0.2))',
                border: '1px solid rgba(91, 141, 238, 0.3)',
                color: '#5b8dee',
                boxShadow: '0 0 20px rgba(91, 141, 238, 0.1)',
              }}
            >
              {isRunning ? 'Running...' : 'Launch Research'}
            </button>
          </div>
          <div className="space-y-4">
            {(selectedTemplate.id === 'backtest' || selectedTemplate.id === 'optimize') && (
              <div>
                <label className="text-xs font-semibold text-nx-text-strong block mb-1.5">
                  Symbol
                </label>
                <input
                  type="text"
                  value={symbolInput}
                  onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                  placeholder="Enter symbol (e.g., SPY, AAPL)"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-nx-void/60 border border-nx-border text-nx-text-strong placeholder:text-nx-text-hint focus:outline-none focus:border-nx-accent/30 transition-colors"
                />
              </div>
            )}

            <div className="grid grid-cols-4 gap-3">
              <div className="bg-nx-void/40 rounded-lg p-3">
                <div className="text-2xs text-nx-text-muted">Language</div>
                <div className="text-sm font-mono font-semibold text-nx-text-strong mt-0.5">
                  {selectedTemplate.language}
                </div>
              </div>
              <div className="bg-nx-void/40 rounded-lg p-3">
                <div className="text-2xs text-nx-text-muted">Difficulty</div>
                <div className="text-sm font-semibold text-nx-text-strong mt-0.5">
                  {selectedTemplate.difficulty}
                </div>
              </div>
              <div className="bg-nx-void/40 rounded-lg p-3">
                <div className="text-2xs text-nx-text-muted">Endpoint</div>
                <div className="text-sm font-mono font-semibold text-nx-text-strong mt-0.5 text-2xs">
                  {selectedTemplate.apiEndpoint}
                </div>
              </div>
              <div className="bg-nx-void/40 rounded-lg p-3">
                <div className="text-2xs text-nx-text-muted">Data Source</div>
                <div className="text-sm font-semibold text-nx-text-strong mt-0.5">Live API</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Research Runs */}
      <div>
        <div className="nx-section-header">
          <div className="nx-accent-bar" />
          <h3>Research Runs</h3>
        </div>
        {runs.length === 0 ? (
          <div className="nx-card p-6 text-center">
            <p className="text-sm text-nx-text-muted">
              No research runs yet. Select a template and launch to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 mt-3">
            {runs.map((run) => (
              <div key={run.id}>
                <div
                  className="nx-card p-3.5 flex items-center gap-4 cursor-pointer hover:border-nx-accent/20 transition-colors"
                  onClick={() =>
                    setExpandedRunId(expandedRunId === run.id ? null : run.id)
                  }
                >
                  <div className="flex items-center gap-2 w-48">
                    {run.status === 'running' ? (
                      <div className="w-4 h-4 border-2 border-nx-accent border-t-transparent rounded-full animate-spin" />
                    ) : run.status === 'error' ? (
                      <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-nx-green/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-nx-green" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-nx-text-strong">
                      {run.templateName}
                    </span>
                  </div>
                  <span
                    className={`text-2xs px-2 py-0.5 rounded-md font-bold uppercase ${
                      run.status === 'running'
                        ? 'bg-nx-accent-muted text-nx-accent border border-nx-accent/15'
                        : run.status === 'error'
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-nx-green-muted text-nx-green border border-nx-green/15'
                    }`}
                  >
                    {run.status}
                  </span>
                  <span className="text-xs font-mono text-nx-text-muted">
                    {formatDuration(run.duration || 0)}
                  </span>
                  {run.status !== 'error' && (
                    <span className="text-xs text-nx-text-muted">
                      {run.resultCount} results
                    </span>
                  )}
                  <span className="ml-auto text-2xs text-nx-text-hint">
                    {formatDate(new Date(run.startTime))}
                  </span>
                  <span className="text-nx-text-hint">
                    {expandedRunId === run.id ? '▼' : '▶'}
                  </span>
                </div>

                {/* Expanded Results */}
                {expandedRunId === run.id && (run.results || run.error) && (
                  <div className="nx-card mx-3 mt-2 mb-2 p-4 bg-nx-void/40 space-y-3">
                    {run.error ? (
                      <div className="text-sm text-red-500">
                        <div className="font-semibold mb-1">Error</div>
                        <div className="font-mono text-2xs">{run.error}</div>
                      </div>
                    ) : (
                      <>
                        {run.results.signals && (
                          <div>
                            <div className="text-xs font-semibold text-nx-accent mb-2">
                              Signals Found: {run.results.signals.length}
                            </div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {run.results.signals.slice(0, 5).map((signal, idx) => (
                                <div
                                  key={idx}
                                  className="text-2xs bg-nx-void/60 p-2 rounded border border-nx-border/50"
                                >
                                  <div className="font-mono text-nx-text-strong">
                                    {signal.symbol || signal.name || `Signal ${idx + 1}`}
                                  </div>
                                  <div className="text-nx-text-muted mt-0.5">
                                    {signal.strength && `Strength: ${signal.strength} | `}
                                    {signal.score && `Score: ${signal.score.toFixed(2)} | `}
                                    {signal.price && `Price: $${signal.price}`}
                                  </div>
                                </div>
                              ))}
                              {run.results.signals.length > 5 && (
                                <div className="text-2xs text-nx-text-muted">
                                  ...and {run.results.signals.length - 5} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {run.results.data && !run.results.signals && (
                          <div>
                            <div className="text-xs font-semibold text-nx-accent mb-2">
                              Results
                            </div>
                            <div className="text-2xs bg-nx-void/60 p-3 rounded border border-nx-border/50 font-mono max-h-64 overflow-y-auto">
                              {typeof run.results.data === 'object' ? (
                                <pre className="whitespace-pre-wrap break-words">
                                  {JSON.stringify(run.results.data, null, 2).substring(0, 500)}
                                  {JSON.stringify(run.results.data, null, 2).length > 500 && '...'}
                                </pre>
                              ) : (
                                <div>{String(run.results.data)}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {run.results.stats && (
                          <div>
                            <div className="text-xs font-semibold text-nx-accent mb-2">
                              Statistics
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(run.results.stats).map(([key, value]) => (
                                <div
                                  key={key}
                                  className="text-2xs bg-nx-void/60 p-2 rounded border border-nx-border/50"
                                >
                                  <div className="text-nx-text-muted capitalize">
                                    {key.replace(/_/g, ' ')}
                                  </div>
                                  <div className="font-semibold text-nx-text-strong mt-0.5">
                                    {typeof value === 'number'
                                      ? value.toFixed(2)
                                      : String(value)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
