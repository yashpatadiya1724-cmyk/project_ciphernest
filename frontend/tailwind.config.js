/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // 3.6 — class-based dark mode so ThemeProvider can toggle via <html class="dark">
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Light-Luxury palette (Phase 3.1) ──────────────────────────────
        luxury: {
          light:  '#F8F9FA',   // page background
          slate:  '#1E293B',   // primary text
          muted:  '#64748B',   // secondary text
          border: '#E2E8F0',   // card borders
          card:   '#FFFFFF',   // card surface
          accent: '#6366F1',   // indigo accent
          hover:  '#EEF2FF',   // hover state
        },
        glass: {
          white:  'rgba(255,255,255,0.70)',  // glassmorphism card bg
          border: 'rgba(255,255,255,0.40)',  // glassmorphism border
        },
        // ── Legacy cyber palette (dark mode) ──────────────────────────────
        cyber: {
          bg:     '#070B14',
          panel:  '#0D1422',
          border: '#1A2744',
          accent: '#00D4FF',
          green:  '#00FF88',
          yellow: '#FFD700',
          red:    '#FF3366',
          purple: '#8B5CF6',
          text:   '#E2E8F0',
          muted:  '#64748B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],   // 3.4 — Inter as primary
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        base: ['16px', { lineHeight: '1.5' }],        // 3.4 — 16px / 1.5 body
      },
      boxShadow: {
        'luxury-sm':  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'luxury-md':  '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'luxury-lg':  '0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)',
        'luxury-glow':'0 0 24px rgba(99,102,241,0.25)',
        'cyber-glow': '0 0 20px rgba(0,212,255,0.2)',
      },
      backdropBlur: { xs: '2px', sm: '8px', md: '12px', lg: '20px' },
      animation: {
        'pulse-slow':   'pulse 3s ease-in-out infinite',
        'glow':         'glow 2s ease-in-out infinite alternate',
        'scan':         'scan 2s linear infinite',
        'fadeIn':       'fadeIn 0.3s ease-in',
        'slideUp':      'slideUp 0.3s ease-out',
        'float':        'float 4s ease-in-out infinite',
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        glow:          { '0%': { opacity: '0.6' }, '100%': { opacity: '1' } },
        scan:          { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
        fadeIn:        { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:       { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        float:         { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        'pulse-subtle':{ '0%,100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    }
  },
  plugins: []
}
