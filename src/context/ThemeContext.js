'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const [mounted, setMounted] = useState(false)

  // Read saved theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('noctis-theme')
      const initial = saved === 'light' ? 'light' : 'dark'
      setTheme(initial)
      document.documentElement.classList.toggle('dark', initial === 'dark')
      document.documentElement.classList.toggle('light', initial === 'light')
    } catch {
      document.documentElement.classList.add('dark')
    }
    setMounted(true)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('noctis-theme', next) } catch {}
      document.documentElement.classList.toggle('dark', next === 'dark')
      document.documentElement.classList.toggle('light', next === 'light')
      return next
    })
  }, [])

  // Prevent flash — don't render until theme is resolved
  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
