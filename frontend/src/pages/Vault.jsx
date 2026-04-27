import React, { useState, useEffect } from 'react'
import { secretAPI, authAPI } from '../services/api'
import { SectionHeader, EmptyState, Spinner, AIExplanationBox } from '../components/common/index'
import { useAuth } from '../context/AuthContext'

export default function Vault() {
  const { user, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('secrets') // 'secrets' | '2fa'
  const [secrets, setSecrets] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [formData, setFormData] = useState({ label: '', value: '', category: 'General', icon: '🔒' })
  const [revealing, setRevealing] = useState({}) 

  // 2FA state
  const [setupData, setSetupData] = useState(null)
  const [setupToken, setSetupToken] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')

  useEffect(() => {
    if (activeTab === 'secrets') fetchSecrets()
  }, [activeTab])

  const fetchSecrets = async () => {
    try {
      const { data } = await secretAPI.list()
      setSecrets(data)
    } catch (err) {
      console.error('Failed to fetch secrets')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup2FA = async () => {
    setSetupLoading(true); setSetupError('')
    try {
      const { data } = await authAPI.setup2FA()
      setSetupData(data)
    } catch (err) {
      setSetupError('Failed to initialize 2FA setup')
    } finally { setSetupLoading(false) }
  }

  const handleVerify2FA = async () => {
    setSetupLoading(true); setSetupError('')
    try {
      await authAPI.verify2FA(setupToken)
      await refreshProfile()
      setSetupData(null)
      setSetupToken('')
    } catch (err) {
      setSetupError('Invalid code. Please try again.')
    } finally { setSetupLoading(false) }
  }

  const handleDisable2FA = async () => {
    if (!window.confirm('Deleting 2FA will lower your security score. Proceed?')) return
    try {
      await authAPI.disable2FA()
      await refreshProfile()
    } catch (err) { alert('Failed to disable 2FA') }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await secretAPI.add(formData)
      setFormData({ label: '', value: '', category: 'General', icon: '🔒' })
      setAdding(false)
      fetchSecrets()
    } catch (err) { alert('Failed to add secret') }
  }

  const handleReveal = async (id) => {
    if (revealing[id]) {
      setRevealing(prev => { const next = { ...prev }; delete next[id]; return next })
      return
    }
    try {
      const { data } = await secretAPI.reveal(id)
      setRevealing(prev => ({ ...prev, [id]: data.value }))
    } catch (err) { alert('Decryption failed') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this secret?')) return
    try {
      await secretAPI.delete(id)
      fetchSecrets()
    } catch (err) { alert('Failed to delete') }
  }

  const tabClass = (id) => `flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === id ? 'text-cyber-accent border-cyber-accent bg-cyber-accent/5' : 'text-cyber-muted border-transparent hover:text-cyber-text'}`

  return (
    <div className="space-y-6 animate-fadeIn">
      <SectionHeader 
        title="Secure Vault" 
        subtitle="Manage your encrypted secrets and multi-factor authentication"
        action={
          activeTab === 'secrets' && (
            <button onClick={() => setAdding(!adding)} className="cyber-btn text-xs">
              {adding ? 'Cancel' : '+ Add Secret'}
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex glass-card overflow-hidden">
        <button className={tabClass('secrets')} onClick={() => setActiveTab('secrets')}>🔑 Secrets</button>
        <button className={tabClass('2fa')} onClick={() => setActiveTab('2fa')}>🛡️ 2FA Identity</button>
      </div>

      {activeTab === 'secrets' ? (
        <>
          {adding && (
            <div className="glass-card p-6 animate-slideDown">
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-cyber-muted font-mono uppercase">Label</label>
                  <input type="text" required value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} placeholder="e.g. WiFi Password" className="cyber-input w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-cyber-muted font-mono uppercase">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="cyber-input w-full">
                    <option>General</option><option>Credentials</option><option>API Keys</option><option>Personal</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-cyber-muted font-mono uppercase">Secret Value</label>
                  <textarea required value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} placeholder="Secret content..." className="cyber-input w-full h-24 resize-none" />
                </div>
                <div className="md:col-span-2">
                  <button type="submit" className="cyber-btn-primary w-full py-2.5">Encrypt & Store Secret</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? <div className="col-span-full py-12 text-center"><Spinner size="lg" /></div> :
              secrets.length === 0 ? <div className="col-span-full"><EmptyState icon="🔐" title="Vault is empty" desc="Start by adding your first encrypted secret." /></div> :
              secrets.map(secret => (
                <div key={secret._id} className="glass-card p-4 border-l-2" style={{ borderLeftColor: '#8B5CF6' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyber-bg border border-cyber-border/40 text-xl">{secret.icon || '🔒'}</div>
                      <div>
                        <h3 className="text-sm font-semibold text-cyber-text truncate w-32">{secret.label}</h3>
                        <span className="text-[10px] text-cyber-accent font-mono uppercase">{secret.category}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(secret._id)} className="text-cyber-muted hover:text-cyber-red">🗑</button>
                  </div>
                  <div className="bg-cyber-bg/80 border border-cyber-border/40 rounded-lg p-3 min-h-[48px] flex items-center justify-between">
                    <div className="font-mono text-xs break-all text-cyber-text">{revealing[secret._id] ? revealing[secret._id] : '••••••••••••••••'}</div>
                    <button onClick={() => handleReveal(secret._id)} className="ml-2 text-xs text-cyber-accent hover:underline">{revealing[secret._id] ? 'Hide' : 'Reveal'}</button>
                  </div>
                </div>
              ))
            }
          </div>
        </>
      ) : (
        <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
          {user?.isTwoFactorEnabled ? (
            <div className="glass-card p-8 text-center bg-cyber-green/5 border-cyber-green/20">
              <div className="w-20 h-20 rounded-full bg-cyber-green/10 flex items-center justify-center mx-auto mb-4 border border-cyber-green/30 animate-pulse">
                <span className="text-4xl">🛡️</span>
              </div>
              <h2 className="text-2xl font-bold text-cyber-text mb-2">2FA Protection Active</h2>
              <p className="text-cyber-muted text-sm mb-6">Your account is secured with Multi-Factor Authentication. Any new login attempt will require a verification code.</p>
              <button onClick={handleDisable2FA} className="text-xs text-cyber-muted hover:text-cyber-red transition-colors font-mono uppercase tracking-widest">Disable Protection</button>
            </div>
          ) : (
            <div className="glass-card p-8 border-dashed border-2 border-cyber-border/40">
              {setupData ? (
                <div className="space-y-6 text-center animate-fadeIn">
                  <h3 className="text-lg font-bold text-cyber-text">Configure Authenticator</h3>
                  <p className="text-xs text-cyber-muted">Scan this QR code with Google Authenticator or Authy</p>
                  <div className="bg-white p-4 rounded-xl inline-block shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                    <img src={setupData.qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                  </div>
                  <div className="bg-cyber-bg p-3 rounded-lg border border-cyber-border/40 max-w-xs mx-auto">
                    <p className="text-[10px] text-cyber-muted uppercase font-mono mb-1">Manual Key</p>
                    <p className="text-xs font-mono text-cyber-accent select-all">{setupData.secret}</p>
                  </div>
                  <div className="space-y-4">
                    <input 
                      type="text" maxLength="6" placeholder="Enter 6-digit code"
                      className="cyber-input text-center text-2xl tracking-[0.5em] font-mono w-full"
                      value={setupToken} onChange={e => setSetupToken(e.target.value)}
                    />
                    {setupError && <p className="text-xs text-cyber-red">{setupError}</p>}
                    <button 
                      onClick={handleVerify2FA} disabled={setupLoading || setupToken.length < 6}
                      className="cyber-btn-primary w-full py-3"
                    >
                      {setupLoading ? <Spinner size="sm" /> : 'Confirm & Enable 2FA'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-5xl block mb-4 opacity-50">🔑</span>
                  <h2 className="text-xl font-bold text-cyber-text mb-2">Enable Multi-Factor Authentication</h2>
                  <p className="text-sm text-cyber-muted mb-6 px-4 leading-relaxed">Boost your security score by adding an extra layer of protection. We'll ask for a code from your mobile device when you log in.</p>
                  <button onClick={handleSetup2FA} disabled={setupLoading} className="cyber-btn-primary px-8 py-3">
                    {setupLoading ? <Spinner size="sm" /> : 'Start 2FA Setup'}
                  </button>
                </div>
              )}
            </div>
          )}
          <AIExplanationBox text="Cipher's Security Tip: Multi-Factor Authentication (MFA) is the single most effective way to prevent account takeovers. Even if your password is leaked, attackers cannot access your vault without your physical device." />
        </div>
      )}
    </div>
  )
}
