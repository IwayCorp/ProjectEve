'use client'
import { SCENARIOS } from '@/lib/tradeIdeas'
import DemoBanner from '@/components/DemoBanner'

export default function ScenarioAnalysis({ showBanner = false }) {
  return (
    <div className="space-y-3">
      {showBanner && (
        <DemoBanner
          type="demo"
          message="Scenario probabilities and market impact estimates are illustrative examples, not derived from any quantitative model."
        />
      )}
      <div className="nx-card">
        <div className="p-3.5 border-b border-nx-border">
          <h3 className="text-sm font-semibold text-nx-text-strong">Iran Deadline &mdash; Scenario Analysis</h3>
        </div>
        <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {SCENARIOS.map((scenario, i) => {
            const styles = [
              { bg: 'bg-nx-green-muted/50', border: 'border-nx-green/15', text: 'text-nx-green', glow: 'rgba(52, 211, 153, 0.06)' },
              { bg: 'bg-nx-orange-muted/50', border: 'border-nx-orange/15', text: 'text-nx-orange', glow: 'rgba(251, 191, 36, 0.06)' },
              { bg: 'bg-nx-red-muted/50', border: 'border-nx-red/15', text: 'text-nx-red', glow: 'rgba(248, 113, 113, 0.06)' },
            ]
            const s = styles[i % styles.length]
            return (
              <div key={i} className={`rounded-xl p-4 border ${s.bg} ${s.border}`} style={{ boxShadow: `0 0 30px ${s.glow}` }} aria-label={`${scenario.name} scenario, ${scenario.probability}% probability`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-bold ${s.text}`}>{scenario.name}</span>
                  <span className="text-xs font-bold text-nx-text-strong bg-nx-border/40 px-2.5 py-0.5 rounded-md font-mono">
                    {scenario.probability}%
                  </span>
                </div>
                <div className="space-y-1.5 mb-3">
                  {Object.entries(scenario.impacts).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-nx-text-muted capitalize">{key === 'usdjpy' ? 'USD/JPY' : key}</span>
                      <span className={`font-mono tabular-nums ${val.startsWith('+') ? 'text-nx-green' : val.startsWith('-') ? 'text-nx-red' : 'text-nx-text-muted'}`}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2.5 border-t border-nx-border/30">
                  <span className="text-2xs text-nx-text-muted">Best Position: </span>
                  <span className="text-2xs font-medium text-nx-text-strong">{scenario.bestPosition}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
