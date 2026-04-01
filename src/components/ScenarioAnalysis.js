'use client'
import { SCENARIOS } from '@/lib/tradeIdeas'

export default function ScenarioAnalysis() {
  return (
    <div className="card">
      <h3 className="text-sm font-bold text-white mb-4">Iran Deadline Scenario Analysis</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {SCENARIOS.map((scenario, i) => {
          const colors = [
            { bg: 'bg-emerald-900/20', border: 'border-eve-green/30', text: 'text-eve-green' },
            { bg: 'bg-amber-900/20', border: 'border-eve-orange/30', text: 'text-eve-orange' },
            { bg: 'bg-red-900/20', border: 'border-eve-red/30', text: 'text-eve-red' },
          ]
          const c = colors[i]
          return (
            <div key={i} className={`rounded-xl p-4 border ${c.bg} ${c.border}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-bold ${c.text}`}>{scenario.name}</span>
                <span className="text-xs font-bold text-white bg-eve-border/50 px-2 py-1 rounded-full">
                  {scenario.probability}%
                </span>
              </div>
              <div className="space-y-1.5 mb-3">
                {Object.entries(scenario.impacts).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-eve-muted capitalize">{key}</span>
                    <span className={`font-mono ${val.startsWith('+') ? 'text-eve-green' : val.startsWith('-') ? 'text-eve-red' : 'text-eve-muted'}`}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-eve-border/30">
                <span className="text-xs text-eve-muted">Best Position: </span>
                <span className="text-xs font-medium text-white">{scenario.bestPosition}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
