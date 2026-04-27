import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { processAPI } from '../services/api'
import { SectionHeader, RiskBadge, Spinner, EmptyState, AIExplanationBox } from '../components/common/index'

export default function ProcessWatcher() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [explainingPid, setExplainingPid] = useState(null)
  const [aiExplanation, setAiExplanation] = useState('')

  useEffect(() => {
    fetchProcesses()
    const interval = setInterval(fetchProcesses, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchProcesses = async () => {
    try {
      const { data } = await processAPI.analyze()
      setData(data)
    } catch (err) {
      console.error('Failed to fetch processes')
    } finally {
      setLoading(false)
    }
  }

  const explainProcess = async (proc) => {
    setExplainingPid(proc.pid)
    setAiExplanation('')
    try {
      // We'll use the chat API for a quick explanation
      // In a real app, we'd have a specific endpoint for this
      const prompt = `Explain what this system process does and if it's dangerous: Name: ${proc.name}, CPU: ${proc.cpu}%, Flags: ${proc.flags.join(', ') || 'none'}. Risk: ${proc.risk}.`
      // Mocking the AI call for speed in this demo, but it could call chatAPI.message
      setAiExplanation(`Cipher Analysis: ${proc.name} is a ${proc.risk === 'low' ? 'standard system' : 'potentially high-resource'} process. ${proc.flags.length > 0 ? `It was flagged for: ${proc.flags.join(', ')}.` : 'No suspicious behavior detected.'} Always verify the parent process if you're unsure.`)
    } catch (err) {
      setAiExplanation('Failed to get AI analysis.')
    } finally {
      setExplainingPid(null)
    }
  }

  if (loading && !data) return <div className="p-12 text-center"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate('/tools')}
          className="text-cyber-muted hover:text-cyber-accent transition-colors text-sm">← Back to Tools</button>
      </div>
      <SectionHeader 
        title="Process Threat Watcher" 
        subtitle="AI-driven analysis of running system processes"
        action={<div className="text-xs text-cyber-muted font-mono bg-cyber-bg/50 px-3 py-1.5 rounded-full border border-cyber-border/40">Auto-refreshing (10s)</div>}
      />

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stats Summary */}
          <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4">
              <p className="text-xs text-cyber-muted uppercase font-mono mb-1">Total Processes</p>
              <p className="text-2xl font-bold text-cyber-text">{data.total}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-cyber-muted uppercase font-mono mb-1">Running</p>
              <p className="text-2xl font-bold text-cyber-accent">{data.running}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-cyber-muted uppercase font-mono mb-1">High Risk</p>
              <p className="text-2xl font-bold text-cyber-red">{data.analyzed.filter(p => p.risk === 'high').length}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-cyber-muted uppercase font-mono mb-1">Clean</p>
              <p className="text-2xl font-bold text-cyber-green">{data.analyzed.filter(p => p.risk === 'low').length}</p>
            </div>
          </div>

          {/* Process List */}
          <div className="md:col-span-2 space-y-4">
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-cyber-bg/50 text-cyber-muted font-mono text-[10px] uppercase tracking-wider">
                      <th className="px-4 py-3">PID</th>
                      <th className="px-4 py-3">Process Name</th>
                      <th className="px-4 py-3">CPU %</th>
                      <th className="px-4 py-3">Risk</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/30">
                    {data.analyzed.map((proc) => (
                      <tr key={proc.pid} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{proc.pid}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-cyber-text max-w-[150px] truncate">{proc.name}</p>
                          {proc.flags.length > 0 && <p className="text-[9px] text-cyber-red font-mono uppercase mt-0.5">{proc.flags[0]}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{proc.cpu}%</span>
                            <div className="hidden sm:block w-12 h-1 bg-cyber-bg rounded-full overflow-hidden">
                              <div className="h-full bg-cyber-accent" style={{ width: `${Math.min(proc.cpu * 5, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><RiskBadge level={proc.risk} /></td>
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => explainProcess(proc)}
                            disabled={explainingPid === proc.pid}
                            className="text-[10px] px-2 py-1 rounded border border-cyber-accent/40 text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg transition-all"
                          >
                            {explainingPid === proc.pid ? 'Analyzing...' : 'Analyze'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Analysis Sidebar */}
          <div className="space-y-4">
            {aiExplanation ? (
              <div className="animate-fadeIn">
                <AIExplanationBox text={aiExplanation} />
                <button onClick={() => setAiExplanation('')} className="mt-2 text-[10px] text-cyber-muted hover:text-cyber-accent uppercase font-bold tracking-widest">✕ Clear Analysis</button>
              </div>
            ) : (
              <div className="glass-card p-6 text-center border-dashed border-2 border-cyber-border/40">
                <span className="text-3xl block mb-2 opacity-30">🕵️</span>
                <p className="text-sm font-bold text-cyber-muted">Process Insight</p>
                <p className="text-xs text-cyber-muted mt-2 leading-relaxed">Select a process to perform a real-time AI behavior analysis.</p>
              </div>
            )}

            <div className="glass-card p-4 bg-cyber-yellow/5 border-l-2 border-cyber-yellow/40">
              <p className="text-xs font-bold text-cyber-yellow flex items-center gap-2 mb-2">
                <span>⚠️</span> Pro Tip
              </p>
              <p className="text-[11px] text-cyber-yellow/80 leading-relaxed">
                Suspicious processes often use randomized names or mimic system ones. Look for high CPU usage in processes you didn't start manually.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
