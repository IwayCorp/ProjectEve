/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        eve: {
          bg: '#0a0e1a',
          card: '#111827',
          border: '#1f2937',
          accent: '#3b82f6',
          green: '#10b981',
          red: '#ef4444',
          orange: '#f59e0b',
          purple: '#8b5cf6',
          text: '#e5e7eb',
          muted: '#6b7280',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ticker': 'ticker 0.3s ease-in-out',
      },
      keyframes: {
        ticker: {
          '0%': { opacity: '0.5', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      }
    },
  },
  plugins: [],
}
