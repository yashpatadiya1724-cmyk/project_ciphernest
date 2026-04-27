import React from 'react'

export const RiskBadge = ({ level, size = 'sm' }) => {
  const classes = {
    low: 'risk-badge-low',
    medium: 'risk-badge-medium',
    high: 'risk-badge-high'
  }
  const labels = { low: '✓ Low Risk', medium: '⚡ Medium Risk', high: '⚠ High Risk' }
  return <span className={`${classes[level] || classes.low} ${size === 'lg' ? 'text-sm px-3 py-1' : ''}`}>{labels[level] || level}</span>
}

export const ProgressBar = ({ value, max = 100, color }) => {
  const pct = Math.round((value / max) * 100)
  const getColor = () => {
    if (color) return color
    if (pct >= 80) return '#FF3366'
    if (pct >= 50) return '#FFD700'
    return '#00FF88'
  }
  return (
    <div className="progress-bar w-full">
      <div className="progress-fill" style={{ width: `${pct}%`, background: getColor(), boxShadow: `0 0 8px ${getColor()}44` }} />
    </div>
  )
}

export const StatusDot = ({ status }) => {
  const colors = { Normal: '#00FF88', Moderate: '#FFD700', High: '#FF3366', Online: '#00FF88', Offline: '#FF3366' }
  const color = colors[status] || '#64748B'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-xs" style={{ color }}>{status}</span>
    </span>
  )
}

export const Spinner = ({ size = 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return (
    <svg className={`${s} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#1A2744" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#00D4FF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export const EmptyState = ({ icon, title, desc }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <span className="text-4xl mb-3">{icon}</span>
    <p className="text-cyber-text font-medium mb-1">{title}</p>
    <p className="text-cyber-muted text-sm">{desc}</p>
  </div>
)

export const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-lg font-semibold text-cyber-text">{title}</h2>
      {subtitle && <p className="text-cyber-muted text-sm mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
)

export const CopyButton = ({ text }) => {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-xs font-mono text-cyber-muted hover:text-cyber-accent transition-colors px-2 py-1 rounded border border-cyber hover:border-cyber-accent/40">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

export const AIExplanationBox = ({ text, loading }) => {
  if (loading) return (
    <div className="mt-4 p-4 rounded-lg bg-cyber-bg border border-cyber-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🤖</span>
        <span className="text-xs text-cyber-accent font-mono">Cipher is analyzing...</span>
      </div>
      <div className="space-y-2">
        {[100, 80, 60].map(w => (
          <div key={w} className="h-3 rounded animate-pulse bg-cyber-border" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
  if (!text) return null
  return (
    <div className="mt-4 p-4 rounded-lg bg-cyber-bg border border-cyber-accent/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🤖</span>
        <span className="text-xs text-cyber-accent font-mono font-semibold">Cipher says:</span>
      </div>
      <p className="text-cyber-text text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  )
}
