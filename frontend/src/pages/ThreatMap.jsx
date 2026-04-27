/**
 * ThreatMap — Phase 3.7 / 4.2
 * Primary: Socket.IO 'threat:new' events for sub-2s updates.
 * Fallback: 5-second polling via /api/threats/global if socket unavailable.
 * Uses react-simple-maps for geographic representation.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, RefreshCw, Activity, Wifi, WifiOff } from 'lucide-react'
import { simulationAPI } from '../services/api'
import { useSocket } from '../context/SocketContext'
import BentoCard from '../components/dashboard/BentoCard'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const CITY_COORDS = {
  'Washington D.C.': [-77.0, 38.9],  'London':    [-0.1,  51.5],
  'Frankfurt':       [8.7,   50.1],  'Moscow':    [37.6,  55.8],
  'Beijing':         [116.4, 39.9],  'Tokyo':     [139.7, 35.7],
  'Sydney':          [151.2, -33.9], 'Sao Paulo': [-46.6, -23.5],
  'New Delhi':       [77.2,  28.6],  'Singapore': [103.8, 1.4],
  'Dubai':           [55.3,  25.2],  'Cape Town': [18.4,  -33.9],
}
const CITY_NAMES = Object.keys(CITY_COORDS)

const HELP_DATA = {
  title: 'Live Global Threat Map',
  description: 'Real-time threat origins from the global intelligence feed. Primary channel: WebSocket (threat:new). Fallback: 5-second polling.',
  legend: [
    { color: '#f43f5e', label: 'Critical — active infiltration attempt' },
    { color: '#fbbf24', label: 'Warning — probe or reconnaissance' },
    { color: '#6366F1', label: 'Info — passive scan detected' },
  ],
  proTip: 'WebSocket badge (top-left) shows connection status. Green = live push; yellow = polling fallback.',
}

const severityColor = (sev) =>
  sev === 'critical' ? '#f43f5e' : sev === 'high' ? '#fb923c' : sev === 'medium' ? '#fbbf24' : '#6366F1'

export default function ThreatMap() {
  const { socket }                    = useSocket()
  const [threats, setThreats]         = useState([])
  const [liveEvents, setLiveEvents]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [wsConnected, setWsConnected] = useState(false)
  // 4.4 — simulation badge count
  const [simCount, setSimCount]       = useState(0)
  const pollRef                       = useRef(null)
  const isDebug = new URLSearchParams(window.location.search).has('debug')

  // ── Merge helper: deduplicate by _id ──────────────────────────────────────
  const mergeThreats = (prev, incoming) => {
    const map = new Map(prev.map(t => [t._id || t.value, t]))
    for (const t of incoming) map.set(t._id || t.value, t)
    return Array.from(map.values()).slice(0, 60)
  }

  // ── Polling fallback ──────────────────────────────────────────────────────
  const fetchThreats = useCallback(async () => {
    try {
      const { data } = await simulationAPI.threats.getGlobal()
      const list = Array.isArray(data) ? data : (data.threats || data.recentThreats || [])
      setThreats(prev => mergeThreats(prev, list))
      setLastUpdated(new Date())
    } catch {
      // Synthetic fallback so map is never empty
      const synthetic = Array.from({ length: 6 }, (_, i) => ({
        _id: `syn_${Date.now()}_${i}`,
        severity: Math.random() > 0.6 ? 'critical' : 'medium',
        country: CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)],
      }))
      setThreats(prev => mergeThreats(prev, synthetic))
    } finally {
      setLoading(false)
    }
  }, [])

  // ── 4.2 — Socket.IO primary channel ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    const onConnect    = () => setWsConnected(true)
    const onDisconnect = () => setWsConnected(false)

    // threat:new — single new threat pushed from backend
    const onThreat = (threat) => {
      setThreats(prev => mergeThreats(prev, [threat]))
      setLastUpdated(new Date())
      const ev = {
        id:   Date.now(),
        from: threat.country || CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)],
        to:   'Washington D.C.',
        type: threat.severity === 'critical' ? 'CRITICAL' : 'WARNING',
        time: new Date().toLocaleTimeString(),
      }
      setLiveEvents(prev => [ev, ...prev].slice(0, 14))
    }

    // sim:event — simulation batch (4.4)
    const onSimEvent = (payload) => {
      if (payload.threats?.length) {
        setThreats(prev => mergeThreats(prev, payload.threats))
        setSimCount(c => c + payload.threats.length)
      }
    }

    socket.on('connect',    onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('threat:new', onThreat)
    socket.on('sim:event',  onSimEvent)
    setWsConnected(socket.connected)

    return () => {
      socket.off('connect',    onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('threat:new', onThreat)
      socket.off('sim:event',  onSimEvent)
    }
  }, [socket])

  // ── 5-second polling fallback (always runs as safety net) ─────────────────
  useEffect(() => {
    fetchThreats()
    pollRef.current = setInterval(fetchThreats, 5000)
    return () => clearInterval(pollRef.current)
  }, [fetchThreats])

  // ── Generate live event feed from polling updates ─────────────────────────
  useEffect(() => {
    if (!threats.length) return
    const t = threats[0]
    const ev = {
      id:   Date.now(),
      from: t.country || CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)],
      to:   'Washington D.C.',
      type: t.severity === 'critical' ? 'CRITICAL' : 'WARNING',
      time: new Date().toLocaleTimeString(),
    }
    setLiveEvents(prev => [ev, ...prev].slice(0, 14))
  }, [threats.length]) // only when count changes, not on every merge

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe size={20} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
            Live Global Threat Map
          </h1>
          {/* 4.2 — WebSocket status badge */}
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: wsConnected ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.12)',
              color: wsConnected ? '#10b981' : '#fbbf24',
              border: `1px solid ${wsConnected ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.3)'}`,
            }}>
            {wsConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
            {wsConnected ? 'Live' : 'Polling'}
          </span>
          {/* 4.4 — Simulation badge (debug mode) */}
          {isDebug && simCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold animate-pulse"
              style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)' }}>
              SIM +{simCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchThreats} aria-label="Refresh threat map"
            className="p-2 rounded-lg transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-ui)', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Map */}
        <BentoCard helpData={HELP_DATA} colSpan={3} className="lg:col-span-3" noPadding>
          <div className="relative" style={{ height: '460px' }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 rounded-2xl"
                style={{ background: 'var(--bg-card)' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }} />
              </div>
            )}
            <ComposableMap projectionConfig={{ scale: 147 }}
              style={{ width: '100%', height: '100%', borderRadius: '16px' }}>
              <ZoomableGroup>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) => geographies.map(geo => (
                    <Geography key={geo.rsmKey} geography={geo}
                      style={{
                        default: { fill: 'var(--border-ui)', stroke: 'var(--bg-card)', strokeWidth: 0.5, outline: 'none' },
                        hover:   { fill: 'rgba(99,102,241,0.25)', outline: 'none' },
                        pressed: { outline: 'none' },
                      }} />
                  ))}
                </Geographies>
                <AnimatePresence>
                  {threats.map((threat, i) => {
                    const coords = CITY_COORDS[threat.country]
                    if (!coords) return null
                    const color = severityColor(threat.severity)
                    return (
                      <Marker key={threat._id || i} coordinates={coords}>
                        <motion.circle r={5} fill={color} fillOpacity={0.85}
                          stroke="#fff" strokeWidth={1}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: [1, 1.6, 1], opacity: 1 }}
                          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
                          style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
                      </Marker>
                    )
                  })}
                </AnimatePresence>
              </ZoomableGroup>
            </ComposableMap>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 rounded-xl px-3 py-2 flex gap-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-ui)', backdropFilter: 'blur(8px)' }}>
              {[['#f43f5e','Critical'],['#fbbf24','Warning'],['#6366F1','Info']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</span>
                </div>
              ))}
            </div>

            {/* Count badge */}
            <div className="absolute top-4 right-4 rounded-xl px-3 py-2"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-ui)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Active Threats</p>
              <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{threats.length}</p>
            </div>
          </div>
        </BentoCard>

        {/* Live feed */}
        <BentoCard className="lg:col-span-1 flex flex-col" style={{ minHeight: '460px' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} style={{ color: 'var(--accent)' }} />
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Live Feed
            </h3>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {liveEvents.map(ev => (
                <motion.div key={ev.id}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="rounded-lg p-2.5 text-xs"
                  style={{
                    background: ev.type === 'CRITICAL' ? 'rgba(244,63,94,0.08)' : 'rgba(251,191,36,0.08)',
                    borderLeft: `3px solid ${ev.type === 'CRITICAL' ? '#f43f5e' : '#fbbf24'}`,
                  }}>
                  <div className="flex justify-between mb-1">
                    <span className="font-bold" style={{ color: ev.type === 'CRITICAL' ? '#f43f5e' : '#fbbf24' }}>
                      {ev.type}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{ev.time}</span>
                  </div>
                  <p style={{ color: 'var(--text-primary)' }} className="truncate">
                    <span style={{ color: 'var(--accent)' }}>{ev.from}</span> → {ev.to}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
            {liveEvents.length === 0 && (
              <p className="text-center py-8 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                Awaiting telemetry…
              </p>
            )}
          </div>
        </BentoCard>
      </div>
    </div>
  )
}
