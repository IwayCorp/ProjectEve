'use client'
import { SCENARIOS } from '@/lib/tradeIdeas'

export default function ScenarioAnalysis() {
  return (
    <div className="bg-tv-pane border border-tv-border rounded-md">
      <div className="p-3 border-b border-tv-border">
        <h3 className="text-sm font-semibold text-tv-text-strong">Iran Deadline — Scenario Analysis</h3>
      </div>
      <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {SCENARIOS.map((scenario, i) => {
          const styles = [
            { bg: 'bg-tv-green-bg', border: 'border-tv-green/20', text: 'text-tv-green' },
            { bg: 'bg-tv-orange-bg', border: 'border-tv-orange/20', text: 'text-tv-orange' },
            { bg: 'bg-tv-red-bg', border: 'border-tv-red/20', text: 'text-tv-red' },
          ]
          const s = styles[i]
          return (
            <div key={i} className={`rounded-md p-4 border ${s.bg} ${s.border}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-bold ${s.text}`}>{scenario.name}</span>
                <span className="text-xs font-bold text-tv-text-strong bg-tv-border/50 px-2 py-0.5 rounded">
                  {scenario.probability}%
                </span>
              </div>
              <div className="space-y-1.5 mb-3">
                {Object.entries(scenario.impacts).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-tv-text-muted capitalize">{key === 'usdjpy' ? 'USD/JPY' : key}</span>
                    <span className={`font-mono ${val.startsWith('+') ? 'text-tv-green' : val.startsWith('-') ? 'text-tv-red' : 'text-tv-text-muted'}`}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-tv-border/30">
                <span className="text-2xs text-tv-text-muted">Best Position: </span>
                <span className="text-2xs font-medium text-tv-text-strong">{scenario.bestPosition}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
