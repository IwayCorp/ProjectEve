/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        tv: {
          bg: '#131722',
          pane: '#1e222d',
          card: '#1c2030',
          border: '#2a2e39',
          'border-light': '#363a45',
          blue: '#2962FF',
          'blue-hover': '#1e53e5',
          'blue-muted': 'rgba(41, 98, 255, 0.15)',
          green: '#26a69a',
          'green-bright': '#089981',
          'green-bg': 'rgba(38, 166, 154, 0.12)',
          red: '#ef5350',
          'red-bright': '#f23645',
          'red-bg': 'rgba(239, 83, 80, 0.12)',
          orange: '#ff9800',
          'orange-bg': 'rgba(255, 152, 0, 0.12)',
          purple: '#ab47bc',
          'purple-bg': 'rgba(171, 71, 188, 0.12)',
          yellow: '#ffeb3b',
          text: '#d1d4dc',
          'text-strong': '#e8eaed',
          'text-muted': '#787b86',
          'text-hint': '#5d606b',
          popup: '#1e222d',
          toolbar: '#1e222d',
          divider: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Trebuchet MS', 'Roboto', 'Ubuntu', 'sans-serif'],
      },
      fontSize: {
        '2xs': '10px',
        xs: '11px',
        sm: '12px',
        base: '13px',
        md: '14px',
        lg: '16px',
        xl: '18px',
        '2xl': '20px',
        '3xl': '24px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'ticker': 'ticker 0.3s ease-in-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        ticker: {
          '0%': { opacity: '0.5', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
