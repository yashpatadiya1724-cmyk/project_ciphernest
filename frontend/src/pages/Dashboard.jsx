/**
 * Dashboard — Phase 3.2 / 4.4 / 4.5 / 4.6 / 4.7 / 4.8
 * Bento-Grid layout with:
 *   - Global Threat Feed card (4.5) with "Mark Reviewed" + analyst feedback (4.6)
 *   - Latency Gauge card (4.7) driven by Socket.IO latency:update events
 *   - Simulation overlay (4.4) activated by ?debug in URL
 *   - Socket.IO wiring for real-time updates (4.8)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, AlertTriangle, Activity, Globe,
  RefreshCw, Zap, Target, TrendingUp,
  Gauge, MessageSquare, CheckCircle, X
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip as RechartsTooltip
} from 'recharts'
import { dashAPI, simulationAPI } from '../services/api'
import api from '../services/api'
import { useSocket } from '../context/SocketContext'
import BentoCard from '../components/dashboard/BentoCard'
import ActionCenter from '../components/dashboard/ActionCenter'
import ThreatTimeline from '../components/ThreatTimeline'
import SimulationToggle from '../components/SimulationToggle'

// ── Help data ────────────────────────────────────────────────────────────────
const HELP = {
  score: {
    title: 'Network Health Index',
    description: 'Composite score (0–100) from open ports, weak passwords, unknown devices, breach exposure, and global threat matches.',
    legend: [
      { color: '#10b981', label: '80–100: Excellent' },
      { color: '#fbbf24', label: '50–79: Vulnerable' },
      { color: '#f43f5e', label: '0–49: Critical' },
    ],
    proTip: 'Run a full port scan and password audit weekly to keep your score above 80.',
  },
  intel: {
    title: 'Intelligence Correlation',
    description: 'Cross-references local scan results against the global threat feed.',
    legend: [
      { color: '#6366F1', label: 'No match — environment clean' },
      { color: '#f43f5e', label: 'Match — investigate immediately' },
    ],
    proTip: 'Enable simulation mode to see correlations generated in real time.',
  },
  actions: {
    title: 'Action Center',
    description: 'Prioritised remediation recommendations from the Risk Engine.',
    legend: [
      { color: '#f43f5e', label: 'Critical — resolve within 24h' },
      { color: '#fbbf24', label: 'High — resolve within 72h' },
      { color: '#10b981', label: 'Low — next maintenance window' },
    ],
    proTip: 'Resolving a critical action can increase your score by up to 15 points.',
  },
  timeline: {
    title: 'Live Threat Timeline',
    description: 'Real-time feed of security events from honeypot, port scanner, and network monitor.',
    legend: [
      { color: '#f43f5e', label: 'Critical — active intrusion attempt' },
      { color: '#fbbf24', label: 'Warning — suspicious activity' },
      { color: '#6366F1', label: 'Info — routine scan' },
    ],
    proTip: 'CRITICAL events should be cross-referenced with the Threat Map.',
  },
  trend: {
    title: 'Security Stability Trend',
    description: 'Security score over the last 8 hours.',
    legend: [{ color: '#6366F1', label: 'Score line — higher is better' }],
    proTip: 'A sudden drop usually correlates with a new open port or failed login burst.',
  },
  feed: {
    title: 'Global Threat Intel Feed',
    description: 'Latest deduplicated indicators from external threat-intel sources (VirusTotal, AbuseIPDB, simulation).',
    legend: [
      { color: '#f43f5e', label: 'Critical / High severity' },
      { color: '#fbbf24', label: 'Medium severity' },
      { color: '#6366F1', label: 'Low severity' },
    ],
    proTip: 'Mark threats as reviewed to keep the feed focused on unactioned items.',
  },
  latency: {
    title: 'API Latency Gauge',
    description: 'Rolling average and P95 response time for the last 100 API requests.',
    legend: [
      { color: '#10b981', label: '≤100ms — Excellent' },
      { color: '#fbbf24', label: '≤500ms — Acceptable' },
      { color: '#f43f5e', label: '>500ms — Degraded' },
    ],
    proTip: 'Latency spikes often coincide with heavy simulation runs or DB query bottlenecks.',
  },
}

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

// ── 4.6 — Analyst Feedback Dropdown ─────────────────────────────────────────
const FeedbackDropdown = ({ threatId, toolType, onSubmit }) => {
  const [open, setOpen]   = useState(false)
  const [sent, setSent]   = useState(false)
  const decisions = ['false_positive', 'true_positive', 'unclear']

  const submit = async (decision) => {
    try {
      await api.post('/feedback/analyst', { threatId, toolType: toolType || 'threat_card', decision })
      setSent(true)
      setOpen(false)
      onSubmit?.(decision)
    } catch { /* non-blocking */ }
  }

  if (sent) return <span className="text-xs" style={{ color: '#10b981' }}>✓ Logged</span>

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Submit analyst feedback"
        className="p-1 rounded transition-colors"
        style={{ color: 'var(--text-muted)' }}>
        <MessageSquare size={12} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute right-0 top-6 z-30 rounded-xl shadow-xl py-1 min-w-[140px]"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-ui)' }}>
            {decisions.map(d => (
              <button key={d} onClick={() => submit(d)}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:opacity-80 capitalize"
                style={{ color: d === 'false_positive' ? '#10b981' : d === 'true_positive' ? '#f43f5e' : 'var(--text-muted)' }}>
                {d.replace('_', ' ')}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── 4.7 — Latency Gauge ──────────────────────────────────────────────────────
const LatencyGauge = ({ avg, p95 }) => {
  const color = avg <= 100 ? '#10b981' : avg <= 500 ? '#fbbf24' : '#f43f5e'
  const label = avg <= 100 ? 'Excellent' : avg <= 500 ? 'Acceptable' : 'Degraded'
  const pct   = Math.min(100, (avg / 1000) * 100)
  return (
    <div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-black font-mono" style={{ color }}>{avg}</span>
        <span className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ms avg</span>
        <span className="text-xs mb-1 ml-auto font-semibold" style={{ color }}>{label}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-ui)' }}>
        <motion.div className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }} />
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>P95: {p95}ms</p>
    </div>
  )
}

// ── Severity color helper ─────────────────────────────────────────────────────
const sevColor = (s) => s === 'critical' ? '#f43f5e' : s === 'high' ? '#fb923c' : s === 'medium' ? '#fbbf24' : '#6366F1'

export default function Dashboard() {
  const { socket }                      = useSocket()
  const [stats, setStats]               = useState(null)
  const [timeline, setTimeline]         = useState([])
  const [actionsData, setActionsData]   = useState({ actions: [], breakdown: null })
  const [correlation, setCorrelation]   = useState(null)
  const [feed, setFeed]                 = useState([])          // 4.5
  const [reviewed, setReviewed]         = useState(new Set())   // 4.5
  const [latency, setLatency]           = useState({ avg: 0, p95: 0, count: 0 }) // 4.7
  const [simCount, setSimCount]         = useState(0)           // 4.4
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const isDebug = new URLSearchParams(window.location.search).has('debug')

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, timelineRes, actionsRes, correlationRes, feedRes] = await Promise.all([
        dashAPI.overview(),
        dashAPI.timeline(),
        simulationAPI.actions.getAll(),
        simulationAPI.threats.getCorrelations(),
        api.get('/threats/feed'),                                // 4.5
      ])
      setStats(statsRes.data)
      setTimeline(timelineRes.data)
      setActionsData(actionsRes.data)
      setCorrelation(correlationRes.data)
      setFeed(feedRes.data?.slice?.(0, 10) || [])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // ── 4.7 / 4.8 — Socket.IO listeners ─────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const onLatency  = (stats) => setLatency(stats)
    const onSimEvent = (payload) => {
      if (payload.threats?.length) {
        setFeed(prev => [...payload.threats.slice(0, 3), ...prev].slice(0, 10))
        setSimCount(c => c + payload.threats.length)
      }
    }
    const onAlert = () => fetchData()   // 4.8 — re-fetch on new alert
    socket.on('latency:update', onLatency)
    socket.on('sim:event',      onSimEvent)
    socket.on('alert-new',      onAlert)
    return () => {
      socket.off('latency:update', onLatency)
      socket.off('sim:event',      onSimEvent)
      socket.off('alert-new',      onAlert)
    }
  }, [socket, fetchData])

  // ── 4.4 — One-shot simulate button ───────────────────────────────────────
  const triggerSimulate = async () => {
    try {
      await api.post('/simulation/simulate')
      setTimeout(fetchData, 1500)
    } catch {}
  }

  const handleResolveAction = async (id) => {
    try { await simulationAPI.actions.update(id, 'resolved'); fetchData() } catch {}
  }
  const handleIgnoreAction = async (id) => {
    try { await simulationAPI.actions.update(id, 'ignored'); fetchData() } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>Synchronizing command center…</p>
        </div>
      </div>
    )
  }

  const securityScore = stats?.securityScore || 0
  const scoreColor    = securityScore > 80 ? '#10b981' : securityScore > 50 ? '#fbbf24' : '#f43f5e'
  const scoreLabel    = securityScore >= 80 ? 'Excellent' : securityScore >= 50 ? 'Vulnerable' : 'Critical'
  const trendData     = [
    { time: '08:00', score: 85 }, { time: '10:00', score: 82 },
    { time: '12:00', score: 88 }, { time: '14:00', score: 75 },
    { time: '16:00', score: securityScore },
  ]

  return (
    <div className="p-6">
      {/* ── 4.4 — Simulation overlay (debug mode) ──────────────────────── */}
      {isDebug && (
        <div className="mb-4 rounded-xl px-4 py-3 flex items-center justify-between animate-pulse"
          style={{ background: 'rgba(99,102,241,0.08)', border: '2px solid rgba(99,102,241,0.40)' }}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
              ☣️ SIMULATION OVERLAY
            </span>
            {simCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(99,102,241,0.20)', color: 'var(--accent)' }}>
                +{simCount} simulated
              </span>
            )}
          </div>
          <button onClick={triggerSimulate}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            Simulate Threat
          </button>
        </div>
      )}

      {/* Page header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Shield size={24} style={{ color: 'var(--accent)' }} />
            Security Command Center
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Real-time status: <span className="font-semibold" style={{ color: '#10b981' }}>Operational</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SimulationToggle onToggle={fetchData} />
          <button onClick={() => { setRefreshing(true); fetchData() }}
            aria-label="Refresh dashboard"
            className={`p-2 rounded-lg transition-all ${refreshing ? 'animate-spin' : ''}`}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-ui)', color: 'var(--text-muted)' }}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* ── Bento Grid ───────────────────────────────────────────────────── */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        variants={containerVariants} initial="hidden" animate="show">

        {/* 1 — Security Score */}
        <BentoCard helpData={HELP.score} rowSpan={2} className="lg:row-span-2">
          <div className="flex items-center gap-2 mb-5">
            <Target size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Network Health Index
            </h2>
          </div>
          <div className="flex items-center gap-6 mb-6">
            <div className="relative flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="var(--border-ui)" strokeWidth="8" fill="transparent" />
                <circle cx="48" cy="48" r="40" stroke={scoreColor} strokeWidth="8" fill="transparent"
                  strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - securityScore / 100)}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black" style={{ color: scoreColor }}>{securityScore}</span>
              </div>
            </div>
            <div>
              <p className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>{scoreLabel}</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                System is <strong>{securityScore}%</strong> protected.
              </p>
            </div>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border-ui)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Risk Breakdown
            </p>
            {actionsData.breakdown?.deductions
              ? Object.entries(actionsData.breakdown.deductions).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center text-xs py-1">
                  <span className="capitalize" style={{ color: 'var(--text-muted)' }}>{key}</span>
                  <span className="font-mono font-bold" style={{ color: val < 0 ? '#f43f5e' : 'var(--text-muted)' }}>
                    {val < 0 ? val : '+0'} pts
                  </span>
                </div>
              ))
              : <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No significant deductions.</p>
            }
          </div>
        </BentoCard>

        {/* 2 — Intelligence Correlation */}
        <BentoCard helpData={HELP.intel}>
          <div className="flex items-center gap-2 mb-4">
            <Globe size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Intelligence Correlation
            </h2>
          </div>
          <p className="text-sm leading-relaxed italic mb-4" style={{ color: 'var(--text-muted)' }}>
            "{correlation?.summary || 'Scanning global threat patterns…'}"
          </p>
          {correlation?.count > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest rounded-lg p-2 animate-pulse"
              style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.25)', color: '#f43f5e' }}>
              <AlertTriangle size={12} />
              {correlation.count} Global Match Detected
            </div>
          )}
        </BentoCard>

        {/* 3 — Security Stability Trend */}
        <BentoCard helpData={HELP.trend}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Security Stability Trend
            </h2>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <RechartsTooltip
                  contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-ui)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-muted)' }} />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={[0, 100]} />
                <Area type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>

        {/* 4 — Action Center */}
        <BentoCard helpData={HELP.actions} colSpan={2} className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} style={{ color: '#fbbf24' }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Action Center
            </h2>
          </div>
          <ActionCenter actions={actionsData.actions} onResolve={handleResolveAction} onIgnore={handleIgnoreAction} />
        </BentoCard>

        {/* 5 — 4.5 Global Threat Intel Feed */}
        <BentoCard helpData={HELP.feed} colSpan={2} className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Global Threat Intel Feed
            </h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(99,102,241,0.10)', color: 'var(--accent)' }}>
              {feed.filter(t => !reviewed.has(t._id || t.value)).length} unreviewed
            </span>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            <AnimatePresence>
              {feed.filter(t => !reviewed.has(t._id || t.value)).map((threat, i) => (
                <motion.div key={threat._id || threat.value || i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border-ui)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sevColor(threat.severity) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                      {threat.value || threat.ip || '—'}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {threat.category} · {threat.country || '?'}
                    </p>
                  </div>
                  {/* 4.6 — Analyst feedback */}
                  <FeedbackDropdown threatId={threat._id || threat.value} toolType={threat.type} />
                  {/* Mark reviewed */}
                  <button onClick={() => setReviewed(s => new Set([...s, threat._id || threat.value]))}
                    aria-label="Mark as reviewed"
                    className="p-1 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}>
                    <CheckCircle size={12} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {feed.filter(t => !reviewed.has(t._id || t.value)).length === 0 && (
              <p className="text-center py-6 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                All threats reviewed ✓
              </p>
            )}
          </div>
        </BentoCard>

        {/* 6 — 4.7 Latency Gauge */}
        <BentoCard helpData={HELP.latency}>
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              API Latency
            </h2>
          </div>
          <LatencyGauge avg={latency.avg} p95={latency.p95} />
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Samples: {latency.count} requests
          </p>
        </BentoCard>

        {/* 7 — Live Threat Timeline */}
        <BentoCard helpData={HELP.timeline} colSpan={3} className="lg:col-span-3" style={{ minHeight: '320px' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} style={{ color: 'var(--accent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Live Threat Timeline
            </h2>
          </div>
          <div className="h-64 overflow-hidden">
            <ThreatTimeline events={timeline} />
          </div>
        </BentoCard>
      </motion.div>
    </div>
  )
}
