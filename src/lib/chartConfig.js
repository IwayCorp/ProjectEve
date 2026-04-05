// Shared chart configuration for consistent styling across all Recharts components

export const CHART_AXIS = {
  tick: { fontSize: 10, fill: '#64748b', fontWeight: 500 },
  tickLine: false,
  axisLine: { stroke: 'rgba(128, 128, 128, 0.15)' },
}

export const CHART_YAXIS = {
  ...CHART_AXIS,
  axisLine: false,
  width: 65,
}

export const CHART_GRID = {
  strokeDasharray: '3 3',
  stroke: 'rgba(128, 128, 128, 0.1)',
  vertical: false,
}

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'rgba(15, 21, 32, 0.95)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: 10,
    fontSize: 11,
    padding: '8px 12px',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  labelStyle: { color: '#94a3b8', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: '#e2e8f0', padding: '1px 0' },
  cursor: { stroke: 'rgba(91, 141, 238, 0.3)', strokeWidth: 1 },
}

// Color constants for chart series
export const CHART_COLORS = {
  primary: '#5b8dee',
  green: '#34d399',
  red: '#f87171',
  orange: '#fbbf24',
  purple: '#a78bfa',
  cyan: '#22d3ee',
  muted: '#64748b',
}
