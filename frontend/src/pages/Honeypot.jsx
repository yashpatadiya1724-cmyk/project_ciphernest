import React from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionHeader, AIExplanationBox } from '../components/common/index'

export default function Honeypot() {
  const navigate = useNavigate()
  return (
    <div className="max-w-4xl mx-auto animate-fadeIn space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate('/tools')}
          className="text-cyber-muted hover:text-cyber-accent transition-colors text-sm">← Back to Tools</button>
      </div>
      <SectionHeader 
        title="Local Honeypot" 
        subtitle="Active intrusion detection decoy system"
        action={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyber-green/10 border border-cyber-green/30">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
            <span className="text-[10px] text-cyber-green font-mono font-bold uppercase tracking-wider">System Active</span>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 border-l-2 border-cyber-accent">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-cyber-accent/10 flex items-center justify-center text-3xl">🪤</div>
            <div>
              <h3 className="text-lg font-bold text-cyber-text">Decoy Configuration</h3>
              <p className="text-sm text-cyber-muted">Configured to intercept unauthorized probes</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-cyber-bg/50 p-4 rounded-lg border border-cyber-border/40">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-cyber-muted font-mono uppercase">Decoy Port</span>
                <span className="text-sm font-mono text-cyber-accent">1024</span>
              </div>
              <p className="text-[10px] text-cyber-muted leading-relaxed">This port is frequently scanned by network reconnaissance tools. Any attempt to connect will trigger a critical security alert.</p>
            </div>

            <div className="bg-cyber-bg/50 p-4 rounded-lg border border-cyber-border/40">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-cyber-muted font-mono uppercase">Detection Mode</span>
                <span className="text-sm font-mono text-cyber-green font-bold">SILENT ECHO</span>
              </div>
              <p className="text-[10px] text-cyber-muted leading-relaxed">The system identifies and logs the source IP address before immediately severing the connection attempt.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-cyber-text uppercase tracking-widest mb-4">How it works</h3>
            <div className="space-y-4">
              {[
                { step: '01', title: 'Deployment', desc: 'CipherNest opens a high-entropy decoy port on your local machine.' },
                { step: '02', title: 'Surveillance', desc: 'The system monitors all incoming packets for this specific port.' },
                { step: '03', title: 'Triangulation', desc: 'When a probe is detected, the source IP is analyzed by the Risk Engine.' },
                { step: '04', title: 'Alerting', desc: 'A critical event is pushed to your dashboard and logged permanently.' },
              ].map(item => (
                <div key={item.step} className="flex gap-4">
                  <span className="text-xs font-mono text-cyber-accent bg-cyber-accent/10 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">{item.step}</span>
                  <div>
                    <p className="text-xs font-bold text-cyber-text">{item.title}</p>
                    <p className="text-[10px] text-cyber-muted mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AIExplanationBox text="Cipher's Insight: A Local Honeypot is a 'deceptive defense' mechanism. In a clean environment, nothing should ever touch port 1024. If an alert triggers, it's a 99% certain sign of an unauthorized lateral movement attempt on your network." />
        </div>
      </div>

      <div className="glass-card p-6 bg-cyber-yellow/5 border border-cyber-yellow/20">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl">🛡️</span>
          <h3 className="text-sm font-bold text-cyber-yellow">Autonomous Protection Active</h3>
        </div>
        <p className="text-xs text-cyber-yellow/80 leading-relaxed mb-4">
          The Honeypot service runs directly on your backend instance. It is currently protecting your localhost environment. Alerts will appear in your notification bell and activity timeline.
        </p>
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded bg-cyber-yellow/10 text-[9px] font-mono text-cyber-yellow uppercase tracking-tighter border border-cyber-yellow/20">Anti-Port Scan</div>
          <div className="px-3 py-1 rounded bg-cyber-yellow/10 text-[9px] font-mono text-cyber-yellow uppercase tracking-tighter border border-cyber-yellow/20">IP Logging</div>
          <div className="px-3 py-1 rounded bg-cyber-yellow/10 text-[9px] font-mono text-cyber-yellow uppercase tracking-tighter border border-cyber-yellow/20">Low Latency</div>
        </div>
      </div>
    </div>
  )
}
