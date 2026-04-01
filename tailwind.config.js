/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        nx: {
          // Core surfaces — deep charcoal with blue undertone
          void: '#06080d',
          base: '#0a0e17',
          surface: '#0f1520',
          elevated: '#141c2b',
          glass: '#182034',

          // Borders — whisper-thin luminous edges
          border: 'rgba(255, 255, 255, 0.06)',
          'border-hover': 'rgba(255, 255, 255, 0.12)',
          'border-active': 'rgba(255, 255, 255, 0.18)',
          'border-glow': 'rgba(120, 160, 255, 0.15)',

          // Accent — icy refined blue
          accent: '#5b8dee',
          'accent-bright': '#7aa3ff',
          'accent-dim': '#3d6fd4',
          'accent-muted': 'rgba(91, 141, 238, 0.12)',
          'accent-glow': 'rgba(91, 141, 238, 0.20)',

          // Semantic — softer, more refined
          green: '#34d399',
          'green-bright': '#6ee7b7',
          'green-muted': 'rgba(52, 211, 153, 0.10)',
          'green-glow': 'rgba(52, 211, 153, 0.18)',

          red: '#f87171',
          'red-bright': '#fca5a5',
          'red-muted': 'rgba(248, 113, 113, 0.10)',
          'red-glow': 'rgba(248, 113, 113, 0.18)',

          orange: '#fbbf24',
          'orange-muted': 'rgba(251, 191, 36, 0.10)',

          purple: '#a78bfa',
          'purple-muted': 'rgba(167, 139, 250, 0.10)',

          cyan: '#22d3ee',
          'cyan-muted': 'rgba(34, 211, 238, 0.10)',

          // Text — platinum hierarchy
          text: '#c8cdd8',
          'text-strong': '#edf0f7',
          'text-muted': '#6b7280',
          'text-hint': '#3b4252',

          // Glass surface colors
          'glass-bg': 'rgba(15, 21, 32, 0.65)',
          'glass-border': 'rgba(255, 255, 255, 0.08)',
          'glass-hover': 'rgba(255, 255, 255, 0.04)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['12px', { lineHeight: '18px' }],
        base: ['13px', { lineHeight: '20px' }],
        md: ['14px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '28px' }],
        '2xl': ['20px', { lineHeight: '30px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
        '4xl': ['32px', { lineHeight: '40px' }],
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px',
        heavy: '24px',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.3)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.4)',
        'glow-accent': '0 0 20px rgba(91, 141, 238, 0.15)',
        'glow-green': '0 0 20px rgba(52, 211, 153, 0.12)',
        'glow-red': '0 0 20px rgba(248, 113, 113, 0.12)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-gentle': 'pulseGentle 2.5s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.3s ease-out',
        'ticker': 'ticker 0.3s ease-in-out',
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        ticker: {
          '0%': { opacity: '0.5', transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGentle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(91, 141, 238, 0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(91, 141, 238, 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
