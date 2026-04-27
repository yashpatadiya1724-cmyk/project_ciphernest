import React from 'react'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-cyber-bg flex items-center justify-center z-50">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <svg viewBox="0 0 64 64" className="w-full h-full animate-spin" style={{ animationDuration: '3s' }}>
            <circle cx="32" cy="32" r="28" fill="none" stroke="#1A2744" strokeWidth="3" />
            <circle cx="32" cy="32" r="28" fill="none" stroke="#00D4FF" strokeWidth="3"
              strokeDasharray="44 132" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🛡️</span>
          </div>
        </div>
        <h2 className="text-cyber-accent font-mono text-sm tracking-widest uppercase">CipherNest</h2>
        <p className="text-cyber-muted text-xs mt-1 font-mono">Initializing secure environment...</p>
      </div>
    </div>
  )
}
