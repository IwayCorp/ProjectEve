'use client'
import { useEffect, useRef } from 'react'
import { useTheme } from '@/context/ThemeContext'

export default function SettingsModal({ open, onClose }) {
  const { theme, toggleTheme } = useTheme()
  const panelRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const isDark = theme === 'dark'

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-end pt-14 pr-5">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" />

      {/* Settings panel */}
      <div
        ref={panelRef}
        className="relative w-80 rounded-xl overflow-hidden animate-slide-up"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--nx-border)',
          boxShadow: isDark
            ? '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)'
            : '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--nx-border)' }}>
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'rgb(var(--nx-text-strong))' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200 hover:bg-[var(--nx-glass-hover)]"
            style={{ color: 'rgb(var(--nx-text-muted))' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Settings content */}
        <div className="px-5 py-4 space-y-5">
          {/* Theme toggle */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'rgb(var(--nx-text-strong))' }}>
                  Appearance
                </p>
                <p className="text-2xs mt-0.5" style={{ color: 'rgb(var(--nx-text-muted))' }}>
                  {isDark ? 'Dark mode' : 'Light mode'}
                </p>
              </div>

              {/* Toggle switch */}
              <button
                onClick={toggleTheme}
                className="relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none"
                style={{
                  background: isDark
                    ? 'rgba(var(--nx-accent) / 0.25)'
                    : 'rgba(var(--nx-accent) / 0.15)',
                  border: `1px solid ${isDark ? 'rgba(var(--nx-accent) / 0.3)' : 'rgba(var(--nx-accent) / 0.2)'}`,
                }}
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                <div
                  className="absolute top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    left: isDark ? '28px' : '2px',
                    background: isDark ? 'rgb(var(--nx-accent))' : 'rgb(var(--nx-accent))',
                    boxShadow: `0 2px 8px rgba(var(--nx-accent) / 0.3)`,
                  }}
                >
                  {isDark ? (
                    /* Moon icon */
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                      <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
                    </svg>
                  ) : (
                    /* Sun icon */
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                      <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/>
                    </svg>
                  )}
                </div>
              </button>
            </div>

            {/* Theme preview cards */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => { if (isDark) toggleTheme() }}
                className="rounded-lg p-3 text-left transition-all duration-200"
                style={{
                  background: !isDark ? 'rgba(var(--nx-accent) / 0.08)' : 'var(--nx-glass-hover)',
                  border: `1px solid ${!isDark ? 'rgba(var(--nx-accent) / 0.2)' : 'var(--nx-border)'}`,
                }}
              >
                {/* Light mode mini preview */}
                <div className="w-full h-10 rounded-md mb-2 overflow-hidden" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ background: '#f1f5f9', height: '3px' }} />
                  <div className="flex gap-1 p-1.5">
                    <div style={{ background: '#e2e8f0', width: '60%', height: '3px', borderRadius: '2px' }} />
                    <div style={{ background: '#3b82f6', width: '20%', height: '3px', borderRadius: '2px' }} />
                  </div>
                </div>
                <p className="text-2xs font-semibold" style={{ color: !isDark ? 'rgb(var(--nx-accent))' : 'rgb(var(--nx-text-muted))' }}>
                  Light
                </p>
              </button>

              <button
                onClick={() => { if (!isDark) toggleTheme() }}
                className="rounded-lg p-3 text-left transition-all duration-200"
                style={{
                  background: isDark ? 'rgba(var(--nx-accent) / 0.08)' : 'var(--nx-glass-hover)',
                  border: `1px solid ${isDark ? 'rgba(var(--nx-accent) / 0.2)' : 'var(--nx-border)'}`,
                }}
              >
                {/* Dark mode mini preview */}
                <div className="w-full h-10 rounded-md mb-2 overflow-hidden" style={{ background: '#0a0e17', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ background: '#141c2b', height: '3px' }} />
                  <div className="flex gap-1 p-1.5">
                    <div style={{ background: '#182034', width: '60%', height: '3px', borderRadius: '2px' }} />
                    <div style={{ background: '#5b8dee', width: '20%', height: '3px', borderRadius: '2px' }} />
                  </div>
                </div>
                <p className="text-2xs font-semibold" style={{ color: isDark ? 'rgb(var(--nx-accent))' : 'rgb(var(--nx-text-muted))' }}>
                  Dark
                </p>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--nx-border)' }} />

          {/* Version info */}
          <div className="flex items-center justify-between">
            <p className="text-2xs" style={{ color: 'rgb(var(--nx-text-muted))' }}>Version</p>
            <p className="text-2xs font-mono" style={{ color: 'rgb(var(--nx-text-hint))' }}>Noctis v1.0</p>
          </div>
        </div>
      </div>
    </div>
  )
}
