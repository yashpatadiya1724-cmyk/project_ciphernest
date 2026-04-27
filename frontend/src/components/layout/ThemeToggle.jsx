/**
 * ThemeToggle — Phase 3.6
 * Light/dark toggle for the top-right navigation bar.
 * Reads/writes via ThemeContext (persisted to localStorage).
 */
import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const ThemeToggle = () => {
  const { isDark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative w-14 h-7 rounded-full transition-all duration-300 flex items-center px-1"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #1A2744, #0D1422)'
          : 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
        border: isDark ? '1px solid #1A2744' : '1px solid #C7D2FE',
      }}
    >
      {/* Track icons */}
      <Sun  size={11} className="absolute left-1.5"  style={{ color: isDark ? '#64748B' : '#6366F1' }} />
      <Moon size={11} className="absolute right-1.5" style={{ color: isDark ? '#00D4FF' : '#94A3B8' }} />

      {/* Thumb */}
      <span
        className="w-5 h-5 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center"
        style={{
          transform: isDark ? 'translateX(28px)' : 'translateX(0)',
          background: isDark ? '#00D4FF' : '#6366F1',
        }}
      />
    </button>
  )
}

export default ThemeToggle
