/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nx: {
          // Core surfaces — CSS variable driven
          void: 'rgb(var(--nx-void) / <alpha-value>)',
          base: 'rgb(var(--nx-base) / <alpha-value>)',
          surface: 'rgb(var(--nx-surface) / <alpha-value>)',
          elevated: 'rgb(var(--nx-elevated) / <alpha-value>)',
          glass: 'rgb(var(--nx-glass-solid) / <alpha-value>)',

          // Borders — full values (already include opacity)
          border: 'var(--nx-border)',
          'border-hover': 'var(--nx-border-hover)',
          'border-active': 'var(--nx-border-active)',
          'border-glow': 'var(--nx-border-glow)',

          // Accent — icy blue
          accent: 'rgb(var(--nx-accent) / <alpha-value>)',
          'accent-bright': 'rgb(var(--nx-accent-bright) / <alpha-value>)',
          'accent-dim': 'rgb(var(--nx-accent-dim) / <alpha-value>)',
          'accent-muted': 'var(--nx-accent-muted)',
          'accent-glow': 'var(--nx-accent-glow)',

          // Semantic — green
          green: 'rgb(var(--nx-green) / <alpha-value>)',
          'green-bright': 'rgb(var(--nx-green-bright) / <alpha-value>)',
          'green-muted': 'var(--nx-green-muted)',
          'green-glow': 'var(--nx-green-glow)',

          // Semantic — red
          red: 'rgb(var(--nx-red) / <alpha-value>)',
          'red-bright': 'rgb(var(--nx-red-bright) / <alpha-value>)',
          'red-muted': 'var(--nx-red-muted)',
          'red-glow': 'var(--nx-red-glow)',

          // Semantic — orange
          orange: 'rgb(var(--nx-orange) / <alpha-value>)',
          'orange-muted': 'var(--nx-orange-muted)',

          // Semantic — purple
          purple: 'rgb(var(--nx-purple) / <alpha-value>)',
          'purple-muted': 'var(--nx-purple-muted)',

          // Semantic — cyan
          cyan: 'rgb(var(--nx-cyan) / <alpha-value>)',
          'cyan-muted': 'var(--nx-cyan-muted)',

          // Text hierarchy
          text: 'rgb(var(--nx-text) / <alpha-value>)',
          'text-strong': 'rgb(var(--nx-text-strong) / <alpha-value>)',
          'text-muted': 'rgb(var(--nx-text-muted) / <alpha-value>)',
          'text-hint': 'rgb(var(--nx-text-hint) / <alpha-value>)',

          // Glass surface colors
          'glass-bg': 'var(--nx-glass-bg)',
          'glass-border': 'var(--nx-glass-border)',
          'glass-hover': 'var(--nx-glass-hover)',
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
        'glow-accent': '0 0 20px rgba(var(--nx-accent) / 0.15)',
        'glow-green': '0 0 20px rgba(var(--nx-green) / 0.12)',
        'glow-red': '0 0 20px rgba(var(--nx-red) / 0.12)',
        'inner-glow': 'inset 0 1px 0 var(--inner-glow)',
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
          '0%': { boxShadow: '0 0 5px rgba(var(--nx-accent) / 0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(var(--nx-accent) / 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
