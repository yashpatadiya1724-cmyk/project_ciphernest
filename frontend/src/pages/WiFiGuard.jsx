import React, { useState, useEffect, useRef, useCallback } from 'react'
import { wifiAPI } from '../services/api'

// ── Helpers ─────────────────────────────────────────────────────────
const riskColor = (lvl) =>
  lvl === 'HIGH' ? '#ff4d4d' : lvl === 'MEDIUM' ? '#ffc107' : lvl === 'LOW' ? '#00c853' : '#3a6070'

const riskBg = (lvl) =>
  lvl === 'HIGH' ? 'rgba(255,77,77,.08)' : lvl === 'MEDIUM' ? 'rgba(255,193,7,.08)'
  : lvl === 'LOW' ? 'rgba(0,200,83,.06)' : 'rgba(255,255,255,.03)'

const riskBorder = (lvl) =>
  lvl === 'HIGH' ? 'rgba(255,77,77,.3)' : lvl === 'MEDIUM' ? 'rgba(255,193,7,.28)'
  : lvl === 'LOW' ? 'rgba(0,200,83,.2)' : 'rgba(255,255,255,.06)'

const authColor = (auth = '') => {
  if (!auth || auth === 'Open' || auth === 'None') return '#ff4d4d'
  if (auth.includes('WEP')) return '#ff4d4d'
  if (auth.includes('WPA3') || auth.includes('WPA2')) return '#00c853'
  if (auth.includes('WPA')) return '#ffc107'
  return '#3a6070'
}
const authIcon = (auth = '') => {
  if (!auth || ['Open', 'None', 'Unknown'].includes(auth)) return '🔓'
  if (auth.includes('WEP')) return '⚠️'
  if (auth.includes('WPA3')) return '🔒'
  return '🔐'
}

// ── Signal Bars ──────────────────────────────────────────────────────
const SignalBars = ({ pct, color }) => {
  const filled = pct >= 75 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : 1
  return (
    <span className="inline-flex items-end gap-[2px]">
      {[7, 10, 13, 16].map((h, i) => (
        <span key={i} className="w-[3px] rounded-[1px] block"
          style={{ height: h, background: i < filled ? (color || '#00e5ff') : 'rgba(255,255,255,.07)' }} />
      ))}
    </span>
  )
}

// ── Risk Gauge ───────────────────────────────────────────────────────
const RiskGauge = ({ score, level }) => {
  const r = 40, circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const col = riskColor(level)
  return (
    <div className="text-center flex-shrink-0">
      <svg width="88" height="88" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="7" strokeLinecap="round" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)', transition: 'stroke-dashoffset .8s ease', filter: `drop-shadow(0 0 6px ${col})` }} />
        <text x="50" y="46" textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, fill: col }}>{score}</text>
        <text x="50" y="62" textAnchor="middle"
          style={{ fontSize: 8, letterSpacing: '1.5px', fill: 'rgba(255,255,255,.25)', fontFamily: 'monospace' }}>RISK</text>
      </svg>
      <div style={{ color: col, fontSize: 9, fontFamily: 'monospace', marginTop: -2 }}>{level}</div>
    </div>
  )
}

// ── Signal History Graph ─────────────────────────────────────────────
const SignalGraph = ({ history, level }) => {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || history.length < 2) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = canvas.offsetWidth || 220
    const H = canvas.height = 48
    ctx.clearRect(0, 0, W, H)
    const vals = history.map(h => h.sig)
    const mn = Math.max(0, Math.min(...vals) - 10)
    const mx = Math.min(100, Math.max(...vals) + 10)
    const pts = vals.map((v, i) => ({
      x: (i / (vals.length - 1)) * W,
      y: H - ((v - mn) / (mx - mn || 1)) * (H - 8) - 4
    }))
    const col = level === 'HIGH' ? '255,77,77' : level === 'MEDIUM' ? '255,193,7' : '0,229,255'
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, `rgba(${col},.25)`)
    grad.addColorStop(1, `rgba(${col},.02)`)
    ctx.beginPath(); ctx.moveTo(pts[0].x, H)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, H)
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = 1.5; ctx.stroke()
    const last = pts[pts.length - 1]
    ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = `rgb(${col})`; ctx.fill()
  }, [history, level])

  if (history.length < 2) return (
    <div className="flex items-center justify-center rounded text-[9px] font-mono"
      style={{ background: 'rgba(0,0,0,.3)', height: 48, color: '#3a6070' }}>
      Waiting for signal history...
    </div>
  )
  return (
    <div className="relative rounded overflow-hidden" style={{ background: 'rgba(0,0,0,.3)', height: 48 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <span className="absolute top-1 left-1.5 flex items-center gap-1" style={{ fontSize: 7, fontFamily: 'monospace', color: '#3a6070' }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00c853' }} />LIVE SIGNAL
      </span>
    </div>
  )
}

// ── Channel Heatmap ──────────────────────────────────────────────────
const ChannelHeatmap = ({ networks }) => {
  const chs = Array.from({ length: 14 }, (_, i) => i + 1)
  const cnt = {}; chs.forEach(c => cnt[c] = 0)
  networks.forEach(n => { if (n.channel >= 1 && n.channel <= 14) cnt[n.channel]++ })
  const mx = Math.max(1, ...Object.values(cnt))
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-3.5 py-2.5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,.06)' }}>
        <p style={{ fontSize: 8, fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, color: '#3a6070' }}>CHANNEL CONGESTION</p>
        <p className="mt-0.5 text-[10px]" style={{ color: '#3a6070' }}>Channels 1–14 (2.4 GHz)</p>
      </div>
      <div className="flex-1 flex items-end gap-[2px] px-2.5 pb-2 pt-3 min-h-0">
        {chs.map(c => {
          const v = cnt[c]
          const h = v ? Math.max(8, (v / mx) * 100) : 3
          const crowded = v > 2
          const active = v > 0
          return (
            <div key={c} className="flex-1 flex flex-col items-center justify-end gap-[3px]">
              <div className="w-full rounded-t-[2px] transition-all duration-500"
                style={{ height: `${h}%`, minHeight: 2, background: crowded ? '#ff4d4d' : active ? 'rgba(0,229,255,.4)' : 'rgba(255,255,255,.04)', boxShadow: crowded ? '0 0 5px rgba(255,77,77,.25)' : 'none' }} />
              <div style={{ fontSize: 7, fontFamily: 'monospace', color: '#3a6070' }}>{c}</div>
              {v > 0 && <div style={{ fontSize: 7, fontFamily: 'monospace', color: crowded ? '#ff4d4d' : '#0097a7' }}>{v}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Network Card ─────────────────────────────────────────────────────
const NetworkCard = ({ net, selected, onClick }) => {
  const lvl = net.analysis?.riskLevel || 'UNKNOWN'
  const col = riskColor(lvl)
  return (
    <div onClick={onClick} className="relative rounded-[9px] cursor-pointer mb-[5px] transition-all overflow-hidden"
      style={{ background: selected ? '#132030' : '#0d1a26', border: `1px solid ${selected ? 'rgba(0,229,255,.3)' : 'rgba(255,255,255,.06)'}`, boxShadow: selected ? '0 0 0 1px rgba(0,229,255,.08)' : 'none' }}>
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: col }} />
      <div className="pl-3 pr-3 py-[11px]">
        <div className="flex items-center justify-between mb-[7px]">
          <div className="flex items-center gap-1.5 overflow-hidden mr-2 flex-1">
            {net.is_evil_twin_candidate && <span style={{ fontSize: 10, flexShrink: 0 }}>⚡</span>}
            <span className="font-semibold text-white truncate" style={{ fontSize: 12 }}>{net.ssid}</span>
          </div>
          <span className="font-mono font-bold flex-shrink-0 px-[7px] py-[2px] rounded-[3px]"
            style={{ fontSize: 8, color: col, background: riskBg(lvl), border: `1px solid ${riskBorder(lvl)}` }}>{lvl}</span>
        </div>
        {net.is_evil_twin_candidate && (
          <div className="inline-block font-mono mb-1.5 px-[5px] py-[1px] rounded-[3px]"
            style={{ fontSize: 7.5, color: '#ff4d4d', background: 'rgba(255,77,77,.08)', border: '1px solid rgba(255,77,77,.25)' }}>
            ⚡ EVIL TWIN SUSPECT
          </div>
        )}
        <div className="flex items-center justify-between mt-1">
          <div className="flex flex-col gap-[2px]">
            <span style={{ fontSize: 9, color: authColor(net.authentication) }}>{authIcon(net.authentication)} {net.authentication || 'Open'}</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#0097a7' }}>{net.vendor}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#3a6070' }}>{net.frequency}</span>
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#152030' }}>CH{net.channel}</span>
            <SignalBars pct={net.signal_pct} color={col} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Detail Panel ─────────────────────────────────────────────────────
const DetailPanel = ({ net, history }) => {
  if (!net) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2.5 p-4">
      <span className="opacity-10 text-[46px]">🛡</span>
      <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '3px', color: '#3a6070', textAlign: 'center' }}>SELECT A NETWORK TO ANALYZE</div>
      <div style={{ fontSize: 9, color: '#152030', letterSpacing: '1px', textAlign: 'center' }}>EVIL TWIN DETECTION · RISK SCORING · VENDOR CHECK</div>
    </div>
  )
  const a = net.analysis || {}
  const lvl = a.riskLevel || 'UNKNOWN'
  const col = riskColor(lvl)
  const netHist = history[net.bssid] || []
  const boxStyles = {
    danger: { bg: 'rgba(255,77,77,.04)', border: 'rgba(255,77,77,.25)', tc: '#ff4d4d' },
    warn: { bg: 'rgba(255,193,7,.04)', border: 'rgba(255,193,7,.22)', tc: '#ffc107' },
    ok: { bg: 'rgba(0,200,83,.04)', border: 'rgba(0,200,83,.2)', tc: '#00c853' },
  }
  const infoBoxes = [
    lvl === 'HIGH' && { t: 'danger', icon: '🚨', title: 'HIGH RISK NETWORK', desc: a.threatSummary },
    lvl === 'MEDIUM' && { t: 'warn', icon: '⚠️', title: 'MEDIUM RISK NETWORK', desc: a.threatSummary },
    lvl === 'LOW' && { t: 'ok', icon: '✅', title: 'LOW RISK NETWORK', desc: a.threatSummary },
    a.isEvilTwin && { t: 'danger', icon: '⚡', title: 'EVIL TWIN DETECTED', desc: `Multiple APs share '${net.ssid}' on the same frequency band — a rogue access point may be intercepting your traffic.` },
  ].filter(Boolean)
  const techFields = [
    ['VENDOR', net.vendor], ['BSSID', net.bssid], ['AUTH', net.authentication || 'Open'], ['CIPHER', net.encryption || 'None'],
    ['SIGNAL', `${net.signal_pct}% (${net.signal_dbm}dBm)`], ['CHANNEL', net.channel], ['BAND', net.frequency], ['APs', net.ssid_ap_count || 1]
  ]
  const btn = lvl === 'HIGH'
    ? { bg: 'rgba(255,77,77,.07)', border: 'rgba(255,77,77,.35)', col: '#ff4d4d', label: '⛔  CONNECTION BLOCKED — HIGH RISK', cursor: 'not-allowed' }
    : lvl === 'MEDIUM'
    ? { bg: 'rgba(255,193,7,.07)', border: 'rgba(255,193,7,.35)', col: '#ffc107', label: '⚠️  CONNECT WITH CAUTION', cursor: 'pointer' }
    : { bg: 'rgba(0,200,83,.08)', border: 'rgba(0,200,83,.35)', col: '#00c853', label: '🛡  SAFE TO CONNECT', cursor: 'pointer' }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
      {/* Hero */}
      <div className="rounded-[10px] p-4 flex justify-between items-start gap-2.5"
        style={{ background: riskBg(lvl), border: `1px solid ${riskBorder(lvl)}` }}>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white truncate mb-0.5" style={{ fontSize: 18 }}>{net.ssid}</div>
          <div className="font-mono break-all mb-2" style={{ fontSize: 8, color: '#3a6070' }}>{net.bssid}</div>
          <p className="leading-[1.55] max-w-[360px]" style={{ fontSize: 11, color: '#bdd0dc' }}>{a.verdict}</p>
          <div className="flex gap-1.5 flex-wrap mt-2">
            <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 8, color: col, background: riskBg(lvl), border: `1px solid ${riskBorder(lvl)}` }}>{lvl}</span>
            <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 8, color: '#00e5ff', background: 'rgba(0,229,255,.05)', border: '1px solid rgba(0,229,255,.18)' }}>{net.authentication || 'OPEN'}</span>
            {a.isEvilTwin && <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 8, color: '#ff4d4d', background: 'rgba(255,77,77,.08)', border: '1px solid rgba(255,77,77,.3)' }}>⚡ EVIL TWIN</span>}
          </div>
        </div>
        <RiskGauge score={a.riskScore || 0} level={lvl} />
      </div>

      {/* Info boxes */}
      {infoBoxes.map((box, i) => {
        const s = boxStyles[box.t]
        return (
          <div key={i} className="rounded-[9px] p-3 flex items-start gap-2.5"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <span className="flex-shrink-0 mt-0.5" style={{ fontSize: 17 }}>{box.icon}</span>
            <div>
              <div className="font-bold mb-0.5" style={{ fontSize: 11, color: s.tc }}>{box.title}</div>
              <div className="leading-[1.5]" style={{ fontSize: 10, color: 'rgba(189,208,220,.6)' }}>{box.desc}</div>
            </div>
          </div>
        )
      })}

      {/* Why risky */}
      {a.whyRisky && (
        <div className="rounded-[9px] p-3" style={{ background: '#0d1a26', border: '1px solid rgba(255,255,255,.06)' }}>
          <div className="font-mono font-bold mb-2" style={{ fontSize: 8, letterSpacing: '2px', color: '#ffc107' }}>◈ WHY THIS NETWORK IS RISKY</div>
          <div className="leading-[1.65]" style={{ fontSize: 11, color: '#bdd0dc' }}>{a.whyRisky}</div>
        </div>
      )}

      {/* Technical details */}
      <div className="rounded-[9px] p-3" style={{ background: '#0d1a26', border: '1px solid rgba(255,255,255,.06)' }}>
        <div className="font-mono font-bold mb-2.5" style={{ fontSize: 8, letterSpacing: '2px', color: '#00e5ff' }}>◈ TECHNICAL DETAILS</div>
        <div className="grid grid-cols-4 gap-[9px] mb-3">
          {techFields.map(([k, v]) => (
            <div key={k}>
              <div className="font-mono mb-[3px]" style={{ fontSize: 7, letterSpacing: '1px', color: '#3a6070' }}>{k}</div>
              <div className="break-all" style={{ fontSize: 10, color: '#0097a7' }}>{String(v)}</div>
            </div>
          ))}
        </div>
        <div className="font-mono mb-1.5" style={{ fontSize: 7, letterSpacing: '1px', color: '#3a6070' }}>SIGNAL HISTORY</div>
        <SignalGraph history={netHist} level={lvl} />
      </div>

      {/* Threats & Recommendations */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: '◈ THREAT INDICATORS', col: '#ff4d4d', items: a.technicalIndicators || a.threats || [] },
          { label: '◈ RECOMMENDATIONS', col: '#00c853', items: a.recommendations || [] },
        ].map(({ label, col: lc, items }) => (
          <div key={label} className="rounded-[9px] p-3" style={{ background: '#0d1a26', border: '1px solid rgba(255,255,255,.06)' }}>
            <div className="font-mono font-bold mb-2" style={{ fontSize: 8, letterSpacing: '2px', color: lc }}>{ label}</div>
            {items.length ? items.map((item, i) => (
              <div key={i} className="flex gap-[7px] mb-[7px] leading-[1.5]" style={{ fontSize: 10, color: 'rgba(189,208,220,.7)' }}>
                <span className="flex-shrink-0 mt-0.5" style={{ color: lc }}>›</span><span>{item}</span>
              </div>
            )) : <div style={{ fontSize: 10, color: '#3a6070' }}>None</div>}
          </div>
        ))}
      </div>

      {/* Connect button */}
      <button className="w-full py-3 rounded-[9px] font-mono font-bold tracking-[1.5px] transition-all"
        style={{ fontSize: 10, background: btn.bg, border: `1px solid ${btn.border}`, color: btn.col, cursor: btn.cursor }}>
        {btn.label}
      </button>
    </div>
  )
}

// ── Terminal ─────────────────────────────────────────────────────────
const Terminal = ({ logs }) => {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
  const cols = { sy: '#0097a7', hi: '#ff4d4d', md: '#ffc107', lo: '#00c853', sc: '#5a8a80' }
  return (
    <div className="flex-shrink-0 border-t" style={{ height: 108, borderColor: 'rgba(255,255,255,.06)', background: '#030810' }}>
      <div className="flex items-center px-3 border-b" style={{ height: 20, background: 'rgba(0,229,255,.04)', borderColor: 'rgba(0,229,255,.09)', fontSize: 8, fontFamily: 'monospace', letterSpacing: '2px', color: '#0097a7' }}>◈ SECURITY TERMINAL</div>
      <div ref={ref} className="overflow-y-auto px-3 py-1.5" style={{ height: 82, fontSize: 9, fontFamily: 'monospace', lineHeight: 1.7, color: 'rgba(255,255,255,.38)' }}>
        {logs.map((l, i) => <div key={i} style={{ color: cols[l.type] || cols.sc, wordWrap: 'break-word', marginBottom: 1 }}>{l.text}</div>)}
        <div style={{ color: '#0097a7' }}>{'> '}<span className="inline-block w-1.5 h-2.5 align-middle animate-pulse" style={{ background: '#0097a7' }} /></div>
      </div>
    </div>
  )
}

// ── Toasts ───────────────────────────────────────────────────────────
const Toasts = ({ toasts }) => {
  const tc = { danger: '#ff4d4d', warn: '#ffc107', success: '#00c853', info: '#00e5ff' }
  return (
    <div className="fixed right-3 z-50 flex flex-col gap-1.5 pointer-events-none" style={{ top: 72 }}>
      {toasts.map(t => (
        <div key={t.id} className="px-3 py-2 rounded-lg max-w-[290px] animate-slideUp"
          style={{ background: 'rgba(6,12,18,.97)', boxShadow: '0 4px 24px rgba(0,0,0,.7)', fontSize: 10, color: '#bdd0dc', borderLeft: `3px solid ${tc[t.type] || tc.info}`, border: `1px solid ${tc[t.type] || tc.info}33` }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────
export default function WiFiGuard() {
  const [networks, setNetworks] = useState([])
  const [selected, setSelected] = useState(null)
  const [globalStatus, setGlobalStatus] = useState('UNKNOWN')
  const [stats, setStats] = useState({ total: 0, open: 0, wep: 0, evil: 0, secure: 0 })
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [logs, setLogs] = useState([
    { text: '> CipherNest WiFi Guard v2.0 — Enhanced Edition', type: 'sy' },
    { text: '> Real OS scanning · Evil Twin detection · Risk scoring', type: 'sy' },
    { text: '> Ready. Press SCAN to discover nearby networks.', type: 'sy' },
  ])
  const [toasts, setToasts] = useState([])
  const [signalHistory, setSignalHistory] = useState({})
  const [prevBSSIDs, setPrevBSSIDs] = useState(new Set())
  const [newCount, setNewCount] = useState(0)
  const [goneCount, setGoneCount] = useState(0)
  const [activeTab, setActiveTab] = useState('networks')
  const toastId = useRef(0)
  const scanning = useRef(false)

  const addLog = useCallback((text, type = 'sy') => {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(prev => [...prev.slice(-60), { text: `[${t}] ${text}`, type }])
  }, [])

  const addToast = useCallback((msg, type = 'info') => {
    const id = ++toastId.current
    setToasts(prev => [{ id, msg, type }, ...prev.slice(0, 4)])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const doScan = useCallback(async () => {
    if (scanning.current) return
    scanning.current = true
    setLoading(true)
    addLog('Initiating wide-spectrum WiFi scan...', 'sy')
    try {
      const { data } = await wifiAPI.scan()
      const newNets = data.networks || []
      
      setNetworks(prev => {
        const now = Date.now()
        // Map existing by BSSID for quick lookup
        const merged = new Map(prev.map(n => [n.bssid, { ...n, isCurrent: false }]))
        
        // Update with new data
        newNets.forEach(n => {
          const existing = merged.get(n.bssid)
          merged.set(n.bssid, {
            ...n,
            lastSeen: now,
            isCurrent: true,
            // Preserve history if desired or just overwrite
          })
        })

        // Filter out networks not seen in the last 5 minutes
        const FIVE_MINS = 5 * 60 * 1000
        return Array.from(merged.values())
          .filter(n => (now - (n.lastSeen || 0)) < FIVE_MINS)
          .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0)) // Current ones first
      })

      setGlobalStatus(data.globalStatus || 'UNKNOWN')
      setStats(data.stats || {})
      setScanned(true)

      const newBSSIDs = new Set(newNets.map(n => n.bssid))
      const appeared = [...newBSSIDs].filter(b => !prevBSSIDs.has(b))
      const disappeared = [...prevBSSIDs].filter(b => !newBSSIDs.has(b))
      
      if (appeared.length > 0) {
        setNewCount(p => p + appeared.length)
        setPrevBSSIDs(p => new Set([...p, ...appeared]))
      }

      setSignalHistory(prev => {
        const up = { ...prev }
        newNets.forEach(n => {
          if (!up[n.bssid]) up[n.bssid] = []
          up[n.bssid] = [...up[n.bssid].slice(-19), { sig: n.signal_pct, ts: Date.now() }]
        })
        return up
      })

      const s = data.stats || {}
      addLog(`Scan complete — found ${newNets.length} active network(s). Total in cache: ${networks.length}`, 'sc')
      
      if (newNets.length === 0 && networks.length > 0) {
        addLog('Background scan returned 0 results. Maintaining discovery cache.', 'md')
      }

      setCountdown(30)
    } catch (err) {
      addLog(`Scan error: ${err.message}`, 'hi')
    } finally {
      setLoading(false)
      scanning.current = false
    }
  }, [prevBSSIDs, networks.length, addLog])

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(p => { if (p <= 1) { doScan(); return 30 } return p - 1 })
    }, 1000)
    return () => clearInterval(iv)
  }, [doScan])

  const statusPill = {
    SAFE: { col: '#00c853', border: 'rgba(0,200,83,.28)', bg: 'rgba(0,200,83,.08)' },
    CAUTION: { col: '#ffc107', border: 'rgba(255,193,7,.28)', bg: 'rgba(255,193,7,.08)' },
    THREAT: { col: '#ff4d4d', border: 'rgba(255,77,77,.28)', bg: 'rgba(255,77,77,.08)' },
    UNKNOWN: { col: '#3a6070', border: 'rgba(255,255,255,.08)', bg: 'rgba(255,255,255,.04)' },
  }[globalStatus] || { col: '#3a6070', border: 'rgba(255,255,255,.08)', bg: 'rgba(255,255,255,.04)' }

  const sorted = [...networks].sort((a, b) => {
    const o = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 3 }
    return (o[a.analysis?.riskLevel] ?? 3) - (o[b.analysis?.riskLevel] ?? 3)
  })

  const strongest = sorted.reduce((a, b) => !a || b.signal_pct > a.signal_pct ? b : a, null)
  const weakest = sorted.reduce((a, b) => !a || b.signal_pct < a.signal_pct ? b : a, null)
  const avgSig = networks.length ? Math.round(networks.reduce((s, n) => s + n.signal_pct, 0) / networks.length) : 0
  const channels = [...new Set(networks.map(n => n.channel).filter(Boolean))].sort((a, b) => a - b)

  return (
    <div className="flex flex-col overflow-hidden animate-fadeIn" style={{ background: '#060c12', height: 'calc(100vh - 8rem)', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)' }}>

      {/* Stats bar */}
      <div className="flex flex-shrink-0 border-b" style={{ background: '#0d1a26', borderColor: 'rgba(255,255,255,.06)' }}>
        {[
          { v: stats.total || 0, l: 'NETWORKS', c: '#00e5ff' },
          { v: stats.open || 0, l: 'OPEN', c: '#ff4d4d' },
          { v: stats.evil || 0, l: 'EVIL TWIN', c: '#ffc107' },
          { v: stats.wep || 0, l: 'WEP', c: '#ffc107' },
          { v: stats.secure || 0, l: 'SECURE', c: '#00c853' },
        ].map((s, i, arr) => (
          <div key={s.l} className="flex-1 text-center py-2" style={{ borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 7, letterSpacing: '1.5px', color: '#3a6070', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Ticker */}
      <div className="flex flex-shrink-0 items-center gap-3.5 px-3.5 py-1.5 border-b overflow-x-auto" style={{ background: 'rgba(0,229,255,.03)', borderColor: 'rgba(255,255,255,.06)', whiteSpace: 'nowrap' }}>
        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ fontSize: 8, fontFamily: 'monospace', color: '#3a6070' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#00c853', boxShadow: '0 0 4px #00c853' }} />LIVE
        </div>
        {[['SCAN IN', `${countdown}s`], ['STRONGEST', strongest ? `${strongest.ssid} (${strongest.signal_pct}%)` : '—'], ['WEAKEST', weakest ? `${weakest.ssid} (${weakest.signal_pct}%)` : '—'], ['CHANNELS', channels.length ? channels.join(',') : '—'], ['NEW', newCount], ['GONE', goneCount], ['AVG', networks.length ? `${avgSig}%` : '—']].map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 flex-shrink-0" style={{ fontSize: 8, fontFamily: 'monospace', color: '#3a6070' }}>
            {k}: <span style={{ color: '#00e5ff' }}>{v}</span>
          </div>
        ))}
        <div className="ml-auto flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, background: statusPill.bg, border: `1px solid ${statusPill.border}`, color: statusPill.col }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusPill.col, boxShadow: `0 0 5px ${statusPill.col}` }} />{globalStatus}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex flex-shrink-0 border-b lg:hidden" style={{ background: '#0d1a26', borderColor: 'rgba(255,255,255,.06)' }}>
        {[['networks', '📡 Networks'], ['detail', '🔍 Analysis'], ['channels', '📊 Channels']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} className="flex-1 py-2.5 border-b-2 transition-all"
            style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '1px', color: activeTab === id ? '#00e5ff' : '#3a6070', borderColor: activeTab === id ? '#00e5ff' : 'transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* 3-column layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[300px_1fr_260px] overflow-hidden">

        {/* LEFT — Network list */}
        <div className={`flex flex-col border-r overflow-hidden ${activeTab !== 'networks' ? 'hidden lg:flex' : 'flex'}`}
          style={{ borderColor: 'rgba(255,255,255,.06)' }}>
          <div className="flex-shrink-0 px-3.5 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,.06)' }}>
            <div>
              <p style={{ fontSize: 8, fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700, color: '#3a6070' }}>NETWORK DISCOVERY</p>
              <p className="mt-0.5" style={{ fontSize: 10, color: '#3a6070' }}>{scanned ? `${networks.length} network(s) found` : 'Press SCAN to start'}</p>
            </div>
            <button onClick={doScan} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
              style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '1.2px', background: 'rgba(0,229,255,.08)', border: '1px solid rgba(0,229,255,.3)', color: '#00e5ff' }}>
              <span className={loading ? 'animate-spin' : ''}>⟳</span>{loading ? 'SCAN' : `SCAN ${countdown}s`}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-[7px]">
            {!scanned && !loading && (
              <div className="py-7 text-center" style={{ fontSize: 10, fontFamily: 'monospace', lineHeight: 2.4, color: '#3a6070' }}>
                📡<br />Press SCAN to discover<br />nearby Wi-Fi networks
              </div>
            )}
            {loading && !scanned && (
              <div className="py-7 text-center">
                <div className="w-8 h-8 mx-auto rounded-full border-2 border-transparent animate-spin mb-3" style={{ borderTopColor: '#00e5ff' }} />
                <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#0097a7' }} className="animate-pulse">Scanning for networks...</p>
              </div>
            )}
            {sorted.map(net => (
              <NetworkCard key={net.bssid} net={net} selected={selected?.bssid === net.bssid}
                onClick={() => { setSelected(net); setActiveTab('detail') }} />
            ))}
          </div>
        </div>

        {/* CENTER — Detail + Terminal */}
        <div className={`flex flex-col overflow-hidden ${activeTab !== 'detail' ? 'hidden lg:flex' : 'flex'}`}>
          <DetailPanel net={selected} history={signalHistory} />
          <Terminal logs={logs} />
        </div>

        {/* RIGHT — Channel heatmap */}
        <div className={`flex flex-col border-l overflow-hidden ${activeTab !== 'channels' ? 'hidden lg:flex' : 'flex'}`}
          style={{ borderColor: 'rgba(255,255,255,.06)' }}>
          <ChannelHeatmap networks={networks} />
          <div className="flex-shrink-0 px-3 py-2 border-t" style={{ borderColor: 'rgba(255,255,255,.06)', fontSize: 8, fontFamily: 'monospace', color: '#3a6070' }}>
            LAST SCAN: {scanned ? new Date().toLocaleTimeString() : '—'}
          </div>
        </div>
      </div>

      <Toasts toasts={toasts} />
    </div>
  )
}
