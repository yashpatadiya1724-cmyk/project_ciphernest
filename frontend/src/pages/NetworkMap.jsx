import React, { useState, useEffect } from 'react'
import { networkAPI } from '../services/api'
import socket from '../services/socket'
import { SectionHeader, RiskBadge, Spinner, EmptyState } from '../components/common/index'

export default function NetworkMap() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    // Listen for real-time network updates from background scanner
    socket.on('network-update', (update) => {
      setData(prev => ({
        ...prev,
        devices: update.devices,
        subnet: prev?.subnet || 'Local Subnet',
        interface: prev?.interface || 'eth0'
      }))
      setLastUpdate(new Date(update.timestamp))
    })

    return () => {
      socket.off('network-update')
    }
  }, [])

  const handleScan = async () => {
    setScanning(true)
    setLoading(true)
    try {
      const res = await networkAPI.scan()
      // Simulate real scan time for UX
      setTimeout(() => {
        setData(res.data)
        setScanning(false)
        setLoading(false)
        setLastUpdate(new Date())
      }, 2500)
    } catch (err) {
      console.error('Network scan failed', err)
      setScanning(false)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <SectionHeader 
        title="Network Map" 
        subtitle="Discover and analyze all devices on your local network"
        action={
          <button 
            onClick={handleScan} 
            disabled={scanning}
            className={`cyber-btn flex items-center gap-2 ${scanning ? 'opacity-50' : ''}`}
          >
            {scanning ? <Spinner size="sm" /> : '📡'} {scanning ? 'Scanning...' : 'Scan Subnet'}
          </button>
        }
      />

      {scanning && (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center space-y-6 bg-cyber-accent/5">
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full border-2 border-cyber-accent animate-ping opacity-20"></div>
            <div className="absolute inset-4 rounded-full border-2 border-cyber-accent animate-ping opacity-40" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute inset-8 rounded-full border-2 border-cyber-accent animate-ping opacity-60" style={{ animationDelay: '1s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-3xl">📡</div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-cyber-accent animate-pulse">Mapping Subnet...</h3>
            <p className="text-sm text-cyber-muted mt-2">Sending ARP requests and analyzing responses</p>
          </div>
        </div>
      )}

      {!scanning && !data && (
        <EmptyState 
          icon="🌐" 
          title="No Network Data" 
          desc="Run a subnet scan to discover devices connected to your LAN."
        />
      )}

      {!scanning && data && (
        <div className="space-y-6">
          {/* Subnet Info */}
          <div className="glass-card p-4 flex items-center justify-between border-l-2 border-cyber-accent">
            <div className="flex items-center gap-4">
              <div className="text-2xl">🌐</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-cyber-muted font-mono uppercase tracking-widest">Active Subnet</p>
                  <span className="flex h-2 w-2 rounded-full bg-cyber-green animate-pulse"></span>
                  <span className="text-[10px] text-cyber-green font-bold uppercase">Live</span>
                </div>
                <p className="text-sm font-bold font-mono">{data.subnet}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-cyber-muted font-mono uppercase">Last Data Update</p>
              <p className="text-sm font-medium font-mono text-cyber-accent">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'}
              </p>
            </div>
          </div>

          {/* Device Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.devices.map((device, idx) => (
              <div key={idx} className={`glass-card p-4 transition-all hover:border-cyber-accent/40 ${device.isSelf ? 'ring-1 ring-cyber-accent/30' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyber-bg border border-cyber-border/40 text-xl shadow-lg">
                    {device.type === 'Router' ? '📟' : device.type === 'PC' ? '💻' : device.type === 'Mobile' ? '📱' : '🔌'}
                  </div>
                  <RiskBadge level={device.risk} />
                </div>
                
                <div className="space-y-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-cyber-text truncate">{device.name}</h3>
                    <p className="text-[10px] text-cyber-accent font-mono uppercase tracking-tighter">{device.vendor}</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-cyber/30">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-cyber-muted uppercase">IP Address</span>
                      <span className="font-mono text-cyber-text">{device.ip}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-cyber-muted uppercase">MAC Address</span>
                      <span className="font-mono text-cyber-text truncate ml-2">{device.mac}</span>
                    </div>
                  </div>

                  {device.isSelf && (
                    <div className="mt-2 py-1 px-2 bg-cyber-accent/10 rounded text-[9px] text-cyber-accent font-bold text-center uppercase tracking-widest">
                      Local Host
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-cyber-yellow/5 border border-cyber-yellow/20 rounded-lg flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <p className="text-xs text-cyber-yellow/80 leading-relaxed">
              <strong>Security Note:</strong> Always verify unknown devices on your network. 
              Unrecognized IoT devices or guest mobiles can be potential entry points for lateral movement attacks.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
