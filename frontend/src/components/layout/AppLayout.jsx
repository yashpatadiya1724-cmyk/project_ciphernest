import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { alertsAPI } from '../../services/api'
import CipherChat from '../chat/CipherChat'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { path: '/dashboard', icon: '⬡', label: 'Dashboard' },
  { path: '/global-intel', icon: '🌍', label: 'Global Intel' },
  { path: '/tools', icon: '⚙', label: 'Security Tools' },
  { path: '/wifi', icon: '📡', label: 'WiFi Guard' },
  { path: '/network', icon: '🌐', label: 'Network Map' },
  { path: '/threats', icon: '🗺️', label: 'Live Threat Map' },
  { path: '/processes', icon: '🕵️', label: 'Process Watcher' },
  { path: '/vault', icon: '🔐', label: 'Secure Vault' },
  { path: '/cipher', icon: '🤖', label: 'Ask Cipher' },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [showAlertDrop, setShowAlertDrop] = useState(false)
  const [showUserDrop, setShowUserDrop] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const { data } = await alertsAPI.list()
        setAlerts(data.filter(a => !a.dismissed))
      } catch {}
    }
    fetchAlerts()
  }, [])

  useEffect(() => {
    if (!socket) return;
    
    const handleNewAlert = (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
    };
    
    socket.on('new_alert', handleNewAlert);
    return () => socket.off('new_alert', handleNewAlert);
  }, [socket]);

  const criticalCount = alerts.filter(a => a.type === 'critical').length
  const totalUnread = alerts.length

  const handleDismiss = async (id) => {
    await alertsAPI.dismiss(id)
    setAlerts(prev => prev.filter(a => a._id !== id))
  }

  const handleDismissAll = async () => {
    await alertsAPI.dismissAll()
    setAlerts([])
    setShowAlertDrop(false)
  }

  const alertIcon = (type) => type === 'critical' ? '🔴' : type === 'warning' ? '🟡' : '🔵'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 flex flex-col transition-all duration-300 border-r`}
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-ui)' }}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-cyber gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #00D4FF22, #8B5CF622)', border: '1px solid #00D4FF44' }}>
            <span className="text-base">🛡️</span>
          </div>
          {sidebarOpen && <span className="font-semibold text-sm text-gradient truncate">CipherNest</span>}
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarOpen && <p className="text-cyber-muted text-xs font-mono uppercase tracking-wider px-3 mb-3 mt-1">Navigation</p>}
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center' : ''}`}>
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}

          {sidebarOpen && (
            <>
              <p className="text-cyber-muted text-xs font-mono uppercase tracking-wider px-3 mb-2 mt-5">Quick Chat</p>
              <button onClick={() => setChatOpen(true)}
                className="sidebar-link w-full text-left" style={{ color: '#8B5CF6' }}>
                <span className="text-lg">💬</span>
                <span className="font-medium">Open Chat</span>
              </button>
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-cyber">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-cyber-muted hover:text-cyber-accent hover:bg-cyber-accent/5 transition-all">
            <span className="text-sm">{sidebarOpen ? '◀' : '▶'}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-ui)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-cyber-muted hover:text-cyber-accent transition-colors md:hidden">☰</button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyber/50 bg-cyber-bg/50">
              <span className="text-xs text-cyber-muted font-mono">Security Score:</span>
              <span className="text-sm font-semibold font-mono" style={{ color: user?.securityScore >= 70 ? '#00FF88' : user?.securityScore >= 40 ? '#FFD700' : '#FF3366' }}>
                {user?.securityScore ?? 50}/100
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 3.6 — Theme toggle */}
            <ThemeToggle />

            {/* Alerts bell */}
            <div className="relative">
              <button onClick={() => { setShowAlertDrop(!showAlertDrop); setShowUserDrop(false) }}
                className="relative p-2 rounded-lg border border-cyber hover:border-cyber-accent/40 text-cyber-muted hover:text-cyber-accent transition-all">
                <span className="text-base">🔔</span>
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
                    style={{ background: criticalCount > 0 ? '#FF3366' : '#FFD700', color: '#070B14', fontSize: '10px' }}>
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </button>

              {showAlertDrop && (
                <div className="absolute right-0 top-12 w-80 glass-card p-3 z-50 shadow-2xl" style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold">Alerts ({totalUnread})</span>
                    {totalUnread > 0 && (
                      <button onClick={handleDismissAll} className="text-xs text-cyber-muted hover:text-cyber-accent transition-colors">Dismiss all</button>
                    )}
                  </div>
                  {alerts.length === 0 ? (
                    <p className="text-cyber-muted text-xs text-center py-4">No active alerts 🎉</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {alerts.slice(0, 8).map(alert => (
                        <div key={alert._id} className={`alert-${alert.type} p-2.5 flex items-start gap-2`}>
                          <span className="text-sm flex-shrink-0 mt-0.5">{alertIcon(alert.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-cyber-text truncate">{alert.title}</p>
                            <p className="text-xs text-cyber-muted mt-0.5 line-clamp-2">{alert.message}</p>
                          </div>
                          <button onClick={() => handleDismiss(alert._id)} className="text-cyber-muted hover:text-cyber-accent text-xs flex-shrink-0">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button onClick={() => { setShowUserDrop(!showUserDrop); setShowAlertDrop(false) }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyber hover:border-cyber-accent/40 transition-all">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)', color: '#070B14' }}>
                  {user?.username?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-cyber-text hidden sm:block max-w-24 truncate">{user?.username}</span>
                <span className="text-cyber-muted text-xs">▾</span>
              </button>
              {showUserDrop && (
                <div className="absolute right-0 top-12 w-44 glass-card p-2 z-50 shadow-2xl">
                  <p className="text-xs text-cyber-muted px-2 py-1 truncate">{user?.email}</p>
                  <hr className="border-cyber my-1" />
                  <button onClick={() => { logout(); navigate('/login') }}
                    className="w-full text-left px-2 py-2 rounded text-sm text-cyber-red hover:bg-cyber-red/10 transition-colors">
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Floating Cipher Chat Button */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)', boxShadow: '0 4px 24px rgba(0,212,255,0.4)' }}>
          <span className="text-xl">🤖</span>
        </button>
      )}

      {/* Cipher Chat Panel */}
      {chatOpen && <CipherChat onClose={() => setChatOpen(false)} />}

      {/* Click outside handler */}
      {(showAlertDrop || showUserDrop) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowAlertDrop(false); setShowUserDrop(false) }} />
      )}
    </div>
  )
}
