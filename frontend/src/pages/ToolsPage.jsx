import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toolsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { RiskBadge, Spinner, AIExplanationBox, CopyButton, SectionHeader } from '../components/common/index'

// Tool definitions
const TOOLS = [
  { id: 'phishing', icon: '🎣', label: 'Phishing Detector', desc: 'Check if a URL is a phishing attempt', category: 'scanner' },
  { id: 'password', icon: '🔑', label: 'Password Analyzer', desc: 'Test your password strength', category: 'scanner' },
  { id: 'breach', icon: '📧', label: 'Breach Checker', desc: 'See if your email was leaked', category: 'scanner' },
  { id: 'domain', icon: '🌐', label: 'Domain Reputation', desc: 'Check domain trust score', category: 'scanner' },
  { id: 'web-scan', icon: '🔍', label: 'Web Vulnerability Scanner', desc: 'Scan URL for security headers & SSL', category: 'scanner' },
  { id: 'threat-map', icon: '🗺️', label: 'Live Threat Map', desc: 'Real-time global attack visualization', category: 'scanner' },
  { id: 'recon', icon: '🎯', label: 'Subdomain Recon', desc: 'Find hidden subdomains of a domain', category: 'scanner' },
  { id: 'port', icon: '🔌', label: 'Port Scanner', desc: 'Scan for open ports (localhost)', category: 'scanner' },
  { id: 'ip', icon: '📍', label: 'IP Analyzer', desc: 'Lookup IP location & risk', category: 'scanner' },
  { id: 'honeypot', icon: '🪤', label: 'Local Honeypot', desc: 'Active intrusion detection decoy', category: 'scanner' },
  { id: 'processes', icon: '🕵️', label: 'Process Watcher', desc: 'AI analysis of running processes', category: 'scanner' },
  { id: 'dark-web', icon: '🕵️‍♂️', label: 'Dark Web Monitor', desc: 'Check if your data is on the dark web', category: 'scanner' },
  { id: 'sandbox', icon: '🧪', label: 'AI File Sandbox', desc: 'Safe AI-driven file behavior analysis', category: 'scanner' },
  { id: 'encrypt', icon: '🔒', label: 'Text Encrypt/Decrypt', desc: 'AES encryption for text', category: 'utility' },
  { id: 'hash', icon: '#️⃣', label: 'Hash Generator', desc: 'Generate MD5, SHA-256 hashes', category: 'utility' },
  { id: 'hash-decode', icon: '🔓', label: 'Smart Hash Decoder', desc: 'Identify and crack common hashes', category: 'utility' },
  { id: 'metadata-strip', icon: '🖼️', label: 'Metadata Stripper', desc: 'Remove EXIF/hidden data from files', category: 'utility' },
  { id: '2fa', icon: '🛡️', label: '2FA Manager', desc: 'Secure your account with MFA', category: 'utility' },
  { id: 'base64', icon: '📝', label: 'Base64 Encoder', desc: 'Encode or decode Base64', category: 'utility' },
  { id: 'binary', icon: '01', label: 'Binary Converter', desc: 'Text ↔ binary conversion', category: 'utility' },
  { id: 'jwt', icon: '🪙', label: 'JWT Decoder', desc: 'Decode and inspect JWT tokens', category: 'utility' },
]

// Individual tool forms
const ToolForm = ({ tool, onResult }) => {
  const { refreshProfile } = useAuth()
  const [inputs, setInputs] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }))

  const run = async () => {
    setLoading(true); setError('')
    try {
      let res
      switch (tool.id) {
        case 'phishing': res = await toolsAPI.phishing(inputs.url); break
        case 'password': res = await toolsAPI.password(inputs.password); break
        case 'breach': res = await toolsAPI.breach(inputs.email); break
        case 'domain': res = await toolsAPI.domain(inputs.domain); break
        case 'web-scan': res = await toolsAPI.webScan(inputs.url); break
        case 'port': res = await toolsAPI.portScan(inputs.target || 'localhost'); break
        case 'ip': res = await toolsAPI.ip(inputs.ip); break
        case 'encrypt': res = await toolsAPI.encrypt(inputs.text, inputs.key, inputs.mode || 'encrypt'); break
        case 'hash': res = await toolsAPI.hash(inputs.text, inputs.algo || 'sha256'); break
        case 'base64': res = await toolsAPI.base64(inputs.text, inputs.mode || 'encode'); break
        case 'binary': res = await toolsAPI.binary(inputs.text, inputs.mode || 'toBinary'); break
        case 'jwt': res = await toolsAPI.jwtDecode(inputs.token); break
        case 'recon': res = await toolsAPI.recon(inputs.domain); break
        case 'dark-web': res = await toolsAPI.darkWebScan(inputs.email); break
        case 'sandbox': res = await toolsAPI.sandbox(inputs.filename); break
        case 'hash-decode': res = await toolsAPI.hashDecode(inputs.hash); break
        case 'metadata-strip': res = await toolsAPI.stripMetadata(inputs.text); break
        default: throw new Error('Unknown tool')
      }
      onResult(res.data)
      // Sync security score after tool run
      refreshProfile()
    } catch (err) {
      setError(err.response?.data?.message || 'Tool execution failed')
    } finally { setLoading(false) }
  }

  const inputClass = "cyber-input"
  const labelClass = "text-xs text-cyber-muted font-mono uppercase tracking-wider block mb-1.5"

  const renderInputs = () => {
    switch (tool.id) {
      case 'phishing': return (
        <div><label className={labelClass}>URL to check</label>
          <input className={inputClass} placeholder="https://example.com" value={inputs.url||''} onChange={e=>set('url',e.target.value)} onKeyDown={e=>e.key==='Enter'&&run()} /></div>
      )
      case 'web-scan': return (
        <div><label className={labelClass}>Website URL</label>
          <input className={inputClass} placeholder="https://example.com" value={inputs.url||''} onChange={e=>set('url',e.target.value)} onKeyDown={e=>e.key==='Enter'&&run()} /></div>
      )
      case 'password': return (
        <div><label className={labelClass}>Password</label>
          <input type="password" className={inputClass} placeholder="Enter password to test" value={inputs.password||''} onChange={e=>set('password',e.target.value)} /></div>
      )
      case 'breach': return (
        <div><label className={labelClass}>Email address</label>
          <input type="email" className={inputClass} placeholder="you@example.com" value={inputs.email||''} onChange={e=>set('email',e.target.value)} /></div>
      )
      case 'domain': return (
        <div><label className={labelClass}>Domain name</label>
          <input className={inputClass} placeholder="example.com" value={inputs.domain||''} onChange={e=>set('domain',e.target.value)} /></div>
      )
      case 'port': return (
        <div><label className={labelClass}>Target (localhost only)</label>
          <input className={inputClass} placeholder="localhost" value={inputs.target||'localhost'} onChange={e=>set('target',e.target.value)} /></div>
      )
      case 'ip': return (
        <div><label className={labelClass}>IP Address</label>
          <input className={inputClass} placeholder="8.8.8.8" value={inputs.ip||''} onChange={e=>set('ip',e.target.value)} /></div>
      )
      case 'encrypt': return (
        <div className="space-y-3">
          <div className="flex gap-2">
            {['encrypt','decrypt'].map(m=>(
              <button key={m} onClick={()=>set('mode',m)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${(inputs.mode||'encrypt')===m ? 'text-cyber-bg' : 'text-cyber-muted border border-cyber'}`}
                style={(inputs.mode||'encrypt')===m ? {background:'linear-gradient(135deg,#00D4FF,#8B5CF6)'} : {}}>
                {m==='encrypt'?'🔒 Encrypt':'🔓 Decrypt'}
              </button>
            ))}
          </div>
          <div><label className={labelClass}>Text</label>
            <textarea className={inputClass} rows="3" placeholder="Enter text..." value={inputs.text||''} onChange={e=>set('text',e.target.value)} /></div>
          <div><label className={labelClass}>Secret Key</label>
            <input type="password" className={inputClass} placeholder="Your secret key" value={inputs.key||''} onChange={e=>set('key',e.target.value)} /></div>
        </div>
      )
      case 'hash': return (
        <div className="space-y-3">
          <div><label className={labelClass}>Algorithm</label>
            <select className={inputClass} value={inputs.algo||'sha256'} onChange={e=>set('algo',e.target.value)}>
              {['md5','sha1','sha256','sha512'].map(a=><option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select></div>
          <div><label className={labelClass}>Text to hash</label>
            <textarea className={inputClass} rows="3" placeholder="Enter text..." value={inputs.text||''} onChange={e=>set('text',e.target.value)} /></div>
        </div>
      )
      case 'base64': return (
        <div className="space-y-3">
          <div className="flex gap-2">
            {['encode','decode'].map(m=>(
              <button key={m} onClick={()=>set('mode',m)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${(inputs.mode||'encode')===m ? 'text-cyber-bg' : 'text-cyber-muted border border-cyber'}`}
                style={(inputs.mode||'encode')===m ? {background:'linear-gradient(135deg,#00D4FF,#8B5CF6)'} : {}}>
                {m==='encode'?'📤 Encode':'📥 Decode'}
              </button>
            ))}
          </div>
          <div><label className={labelClass}>Input</label>
            <textarea className={inputClass} rows="3" placeholder="Enter text..." value={inputs.text||''} onChange={e=>set('text',e.target.value)} /></div>
        </div>
      )
      case 'binary': return (
        <div className="space-y-3">
          <div className="flex gap-2">
            {[{v:'toBinary',l:'Text → Binary'},{v:'fromBinary',l:'Binary → Text'}].map(m=>(
              <button key={m.v} onClick={()=>set('mode',m.v)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${(inputs.mode||'toBinary')===m.v ? 'text-cyber-bg' : 'text-cyber-muted border border-cyber'}`}
                style={(inputs.mode||'toBinary')===m.v ? {background:'linear-gradient(135deg,#00D4FF,#8B5CF6)'} : {}}>
                {m.l}
              </button>
            ))}
          </div>
          <div><label className={labelClass}>Input</label>
            <textarea className={inputClass} rows="3" placeholder="Enter text or binary..." value={inputs.text||''} onChange={e=>set('text',e.target.value)} /></div>
        </div>
      )
      case 'jwt': return (
        <div><label className={labelClass}>JWT Token</label>
          <textarea className={inputClass} rows="4" placeholder="eyJhbGciOiJIUzI1NiIs..." value={inputs.token||''} onChange={e=>set('token',e.target.value)} /></div>
      )
      case 'recon': return (
        <div><label className={labelClass}>Target Domain</label>
          <input className={inputClass} placeholder="example.com" value={inputs.domain||''} onChange={e=>set('domain',e.target.value)} /></div>
      )
      case 'dark-web': return (
        <div><label className={labelClass}>Email for Monitoring</label>
          <input type="email" className={inputClass} placeholder="user@example.com" value={inputs.email||''} onChange={e=>set('email',e.target.value)} /></div>
      )
      case 'sandbox': return (
        <div><label className={labelClass}>Filename to Analyze</label>
          <input className={inputClass} placeholder="suspicious_file.exe" value={inputs.filename||''} onChange={e=>set('filename',e.target.value)} /></div>
      )
      case 'hash-decode': return (
        <div><label className={labelClass}>Hash to Decode</label>
          <input className={inputClass} placeholder="md5 / sha1 / sha256" value={inputs.hash||''} onChange={e=>set('hash',e.target.value)} onKeyDown={e=>e.key==='Enter'&&run()} /></div>
      )
      case 'metadata-strip': return (
        <div><label className={labelClass}>JSON Metadata (Simulated)</label>
          <textarea className={inputClass} rows="3" placeholder='{"Author": "John", "GPS": "..."}' value={inputs.text||''} onChange={e=>set('text',e.target.value)} /></div>
      )
      default: return null
    }
  }

  return (
    <div className="space-y-4">
      {renderInputs()}
      {error && <div className="alert-critical p-3 text-sm text-cyber-red">{error}</div>}
      <button onClick={run} disabled={loading}
        className="w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)', color: '#070B14' }}>
        {loading ? <><Spinner size="sm" /> Running...</> : `▶ Run ${tool.label}`}
      </button>
    </div>
  )
}

// Result renderer
const ToolResult = ({ toolId, result }) => {
  if (!result) return null

  const renderContent = () => {
    switch (toolId) {
      case 'phishing': return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold font-mono" style={{ color: result.riskLevel==='high'?'#FF3366':result.riskLevel==='medium'?'#FFD700':'#00FF88' }}>{result.verdict}</span>
            <RiskBadge level={result.riskLevel} size="lg" />
          </div>
          <div className="text-sm text-cyber-muted">Risk Score: <span className="text-cyber-text font-mono">{result.score}/100</span></div>
          {result.flags?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-mono text-cyber-muted uppercase">Flags detected:</p>
              {result.flags.map((f,i)=><div key={i} className="flex items-center gap-2 text-sm"><span className="text-cyber-red">⚠</span>{f}</div>)}
            </div>
          )}
        </div>
      )
      case 'password': return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold" style={{ color: result.riskLevel==='high'?'#FF3366':result.riskLevel==='medium'?'#FFD700':'#00FF88' }}>{result.strength}</span>
            <span className="text-3xl font-bold font-mono text-cyber-text">{result.score}<span className="text-sm text-cyber-muted">/100</span></span>
          </div>
          <div className="w-full h-3 rounded-full bg-cyber-border overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width:`${result.score}%`, background: result.score>=80?'#00FF88':result.score>=50?'#FFD700':'#FF3366' }} />
          </div>
          {result.suggestions?.length > 0 && (
            <div>
              <p className="text-xs font-mono text-cyber-muted uppercase mb-2">Suggestions:</p>
              {result.suggestions.map((s,i)=><div key={i} className="flex items-start gap-2 text-sm text-cyber-text mb-1.5"><span className="text-cyber-accent mt-0.5 flex-shrink-0">→</span>{s}</div>)}
            </div>
          )}
        </div>
      )
      case 'breach': return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{result.breached ? '💥' : '✅'}</span>
            <div>
              <p className="font-semibold text-cyber-text">{result.breached ? 'Breach Found!' : 'No Breach Detected'}</p>
              <p className="text-sm text-cyber-muted">{result.email}</p>
            </div>
            <RiskBadge level={result.riskLevel} />
          </div>
          {result.breaches?.map((b,i)=>(
            <div key={i} className="alert-critical p-3 space-y-1">
              <p className="text-sm font-semibold text-cyber-red">{b.name}</p>
              <p className="text-xs text-cyber-muted">Date: {b.date} • Data: {b.dataTypes?.join(', ')}</p>
            </div>
          ))}
        </div>
      )
      case 'domain': return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-cyber-text">{result.domain}</span>
            <RiskBadge level={result.riskLevel} size="lg" />
          </div>
          <div className="flex items-center gap-4">
            <div><p className="text-xs text-cyber-muted">Trust Score</p><p className="text-2xl font-bold font-mono text-cyber-text">{result.trustScore}<span className="text-sm text-cyber-muted">/100</span></p></div>
            <div><p className="text-xs text-cyber-muted">Verdict</p><p className="font-semibold" style={{ color: result.riskLevel==='high'?'#FF3366':result.riskLevel==='medium'?'#FFD700':'#00FF88' }}>{result.verdict}</p></div>
          </div>
          {result.flags?.length > 0 && result.flags.map((f,i)=><div key={i} className="flex items-center gap-2 text-sm"><span className="text-cyber-yellow">⚡</span>{f}</div>)}
        </div>
      )
      case 'web-scan': return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold bg-cyber-bg border-2 ${result.grade === 'A' ? 'border-cyber-green text-cyber-green' : result.grade === 'F' ? 'border-cyber-red text-cyber-red' : 'border-cyber-yellow text-cyber-yellow'}`}>
                {result.grade}
              </div>
              <div>
                <p className="text-sm font-bold text-cyber-text">Security Grade</p>
                <p className="text-xs text-cyber-muted truncate max-w-[180px]">{result.url}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-cyber-muted uppercase">Response</p>
              <p className="text-sm font-mono text-cyber-accent">{result.responseTime}ms</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {result.checks.map((c, i) => (
              <div key={i} className="glass-card p-3 border-l-2" style={{ borderLeftColor: c.status === 'Good' ? '#00FF88' : c.impact === 'high' ? '#FF3366' : '#FFD700' }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-cyber-text">{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${c.status === 'Good' ? 'bg-cyber-green/10 text-cyber-green' : 'bg-cyber-red/10 text-cyber-red'}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-[10px] text-cyber-muted leading-tight">{c.desc}</p>
                {c.detail && <p className="text-[10px] font-mono text-cyber-accent mt-1 bg-cyber-bg p-1 rounded overflow-x-auto">{c.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )
      case 'port': return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-cyber-muted">{result.target}</span>
            <RiskBadge level={result.riskLevel} />
          </div>
          <p className="text-sm">Found <span className="font-bold text-cyber-text">{result.totalOpen}</span> open port{result.totalOpen!==1?'s':''}</p>
          {result.openPorts?.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {result.openPorts.map(p=>(
                <div key={p.port} className={`flex items-center justify-between p-2 rounded text-xs ${result.riskyPorts?.includes(p.port)?'alert-warning':'alert-info'}`}>
                  <span className="font-mono font-bold">{p.port}</span>
                  <span className="text-cyber-muted">{p.service}</span>
                  {result.riskyPorts?.includes(p.port)&&<span>⚠</span>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-cyber-green">No common ports open — good!</p>}
        </div>
      )
      case 'ip': return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-cyber-accent text-lg">{result.ip}</span>
            <RiskBadge level={result.riskLevel} size="lg" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[['Country',result.country],['City',result.city],['ISP',result.isp],['Org',result.org]].map(([k,v])=>v&&(
              <div key={k}><p className="text-xs text-cyber-muted">{k}</p><p className="text-cyber-text">{v}</p></div>
            ))}
          </div>
          {result.flags?.length > 0 && result.flags.map((f,i)=><div key={i} className="flex items-center gap-2 text-sm alert-warning p-2"><span className="text-cyber-yellow">⚠</span>{f}</div>)}
        </div>
      )
      // Utilities
      case 'encrypt': case 'base64': case 'binary': return (
        <div className="space-y-2">
          <p className="text-xs text-cyber-muted uppercase font-mono">Result:</p>
          <div className="p-3 rounded-lg font-mono text-sm break-all bg-cyber-bg border border-cyber">{result.result}</div>
          <CopyButton text={result.result} />
        </div>
      )
      case 'hash': return (
        <div className="space-y-2">
          <p className="text-xs text-cyber-muted uppercase font-mono">{result.algorithm?.toUpperCase()} Hash:</p>
          <div className="p-3 rounded-lg font-mono text-xs break-all bg-cyber-bg border border-cyber">{result.hash}</div>
          <CopyButton text={result.hash} />
        </div>
      )
      case 'hash-decode': return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${result.found ? 'bg-cyber-green/10 text-cyber-green' : 'bg-cyber-muted/10 text-cyber-muted'}`}>
                {result.type}
              </span>
              <span className="text-sm font-semibold text-cyber-text">{result.found ? 'DECODED' : 'NOT FOUND'}</span>
            </div>
            <RiskBadge level={result.found ? 'high' : 'low'} />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-cyber-muted uppercase mb-1">Plaintext Value</p>
              <div className={`p-3 rounded font-mono text-sm border ${result.found ? 'bg-cyber-green/5 border-cyber-green/20 text-cyber-green' : 'bg-cyber-bg border-cyber text-cyber-muted'}`}>
                {result.decodedValue}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-2">
                <p className="text-[10px] text-cyber-muted uppercase">Strength</p>
                <p className={`text-xs font-bold ${result.found ? 'text-cyber-red' : 'text-cyber-green'}`}>{result.strength}</p>
              </div>
              <div className="glass-card p-2">
                <p className="text-[10px] text-cyber-muted uppercase">Crack Time</p>
                <p className="text-xs font-bold text-cyber-accent">{result.crackTime}</p>
              </div>
            </div>

            <div className="p-3 bg-cyber-bg rounded border-l-2 border-cyber-accent text-xs italic text-cyber-muted">
              {result.insight}
            </div>
          </div>
        </div>
      )
      case 'jwt': return (
        <div className="space-y-3">
          {result.isExpired && <div className="alert-critical p-3 text-sm text-cyber-red">⚠ This token is expired!</div>}
          {result.expiresAt && <p className="text-xs text-cyber-muted">Expires: {new Date(result.expiresAt).toLocaleString()}</p>}
          {[['Header', result.header], ['Payload', result.payload]].map(([label, data])=>(
            <div key={label}>
              <p className="text-xs text-cyber-muted uppercase font-mono mb-1">{label}:</p>
              <pre className="p-3 rounded-lg text-xs overflow-x-auto bg-cyber-bg border border-cyber text-cyber-text">{JSON.stringify(data, null, 2)}</pre>
            </div>
          ))}
        </div>
      )
      case 'recon': return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-cyber-text">{result.domain}</span>
            <span className="text-xs text-cyber-muted font-mono">{result.totalFound} found</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {result.results.map((r,i)=>(
              <div key={i} className="flex items-center justify-between p-2 rounded bg-cyber-bg border border-cyber-border/40 text-[10px]">
                <span className="font-mono text-cyber-accent">{r.subdomain}</span>
                <span className="text-cyber-muted font-mono">{r.ip}</span>
              </div>
            ))}
          </div>
        </div>
      )
      case 'dark-web': return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-cyber-red animate-pulse">● MONITORING ACTIVE</span>
            <RiskBadge level={result.breached ? 'high' : 'low'} />
          </div>
          {result.breached ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-cyber-text uppercase">Exposure Detected:</p>
              {result.breaches.map((b,i)=>(
                <div key={i} className="alert-critical p-3 rounded border border-cyber-red/30">
                  <p className="text-xs font-bold text-cyber-red">{b.name}</p>
                  <p className="text-[10px] text-cyber-muted">Data: {b.dataTypes.join(', ')}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-cyber-green text-center py-4">Identity secure. No dark web leaks found.</p>}
        </div>
      )
      case 'sandbox': case 'metadata-strip': return (
        <div className="space-y-2">
          <p className="text-xs text-cyber-muted uppercase font-mono">Analysis Result:</p>
          <div className="p-3 rounded-lg font-mono text-xs leading-relaxed bg-cyber-bg border border-cyber text-cyber-text whitespace-pre-wrap">
            {typeof result.result === 'string' ? result.result : JSON.stringify(result.result || result, null, 2)}
          </div>
          {result.result && <CopyButton text={typeof result.result === 'string' ? result.result : JSON.stringify(result.result)} />}
        </div>
      )
      default: return <pre className="text-xs font-mono text-cyber-muted break-all">{JSON.stringify(result, null, 2)}</pre>
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <p className="text-xs text-cyber-muted uppercase font-mono mb-3">Result</p>
        {renderContent()}
      </div>
      {result.aiExplanation && <AIExplanationBox text={result.aiExplanation} />}
    </div>
  )
}

export default function ToolsPage() {
  const { toolId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)

  // Sync active tool with URL parameter
  const activeTool = toolId ? TOOLS.find(t => t.id === toolId) : null

  const handleSelectTool = (tool) => {
    setResult(null)
    if (tool.id === 'processes') { navigate('/processes') }
    else if (tool.id === '2fa') { navigate('/vault') }
    else if (tool.id === 'honeypot') { navigate('/honeypot') }
    else if (tool.id === 'threat-map') { navigate('/threats') }
    else { navigate(`/tools/${tool.id}`) }
  }

  const scanners = TOOLS.filter(t => t.category === 'scanner')
  const utilities = TOOLS.filter(t => t.category === 'utility')

  if (activeTool) return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { setResult(null); navigate('/tools') }}
          className="text-cyber-muted hover:text-cyber-accent transition-colors text-sm">← Back</button>
        <span className="text-cyber-muted">/</span>
        <span className="text-cyber-text font-medium">{activeTool.label}</span>
      </div>

      <div className="glass-card p-6 mb-4">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">{activeTool.icon}</span>
          <div>
            <h1 className="text-xl font-bold text-cyber-text">{activeTool.label}</h1>
            <p className="text-cyber-muted text-sm">{activeTool.desc}</p>
          </div>
        </div>
        <ToolForm tool={activeTool} onResult={setResult} />
      </div>

      {result && <ToolResult toolId={activeTool.id} result={result} />}
    </div>
  )

  return (
    <div className="animate-fadeIn">
      <SectionHeader title="Security Toolkit" subtitle="Professional security analysis tools" />
      <h3 className="text-sm font-semibold text-cyber-muted uppercase tracking-wider font-mono mb-3">Security Scanners</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {scanners.map(tool => (
          <div key={tool.id} className="tool-card" onClick={() => handleSelectTool(tool)}>
            <span className="text-3xl mb-3 block">{tool.icon}</span>
            <h3 className="font-semibold text-cyber-text mb-1">{tool.label}</h3>
            <p className="text-cyber-muted text-sm">{tool.desc}</p>
            <span className="mt-3 inline-block text-xs text-cyber-accent font-mono">Run tool →</span>
          </div>
        ))}
      </div>
      <h3 className="text-sm font-semibold text-cyber-muted uppercase tracking-wider font-mono mb-3">Security Utilities</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {utilities.map(tool => (
          <div key={tool.id} className="tool-card" onClick={() => handleSelectTool(tool)}>
            <span className="text-3xl mb-3 block">{tool.icon}</span>
            <h3 className="font-semibold text-cyber-text mb-1">{tool.label}</h3>
            <p className="text-cyber-muted text-sm">{tool.desc}</p>
            <span className="mt-3 inline-block text-xs text-cyber-accent font-mono">Open tool →</span>
          </div>
        ))}
      </div>
    </div>
  )
}
