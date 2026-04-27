import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/common/index'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill in all fields'); return }
    setLoading(true); setError('')
    try {
      const { data } = await authAPI.login(form)
      login({ _id: data._id, username: data.username, email: data.email, securityScore: data.securityScore }, data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cyber-bg">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #00D4FF, transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #8B5CF6, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(26,39,68,0.4) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #00D4FF22, #8B5CF622)', border: '1px solid #00D4FF33', boxShadow: '0 0 32px rgba(0,212,255,0.1)' }}>
            <span className="text-3xl">🛡️</span>
          </div>
          <h1 className="text-2xl font-bold text-gradient">CipherNest</h1>
          <p className="text-cyber-muted text-sm mt-1">Your security command center</p>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-5">Sign In</h2>

          {error && (
            <div className="alert-critical p-3 mb-4 text-sm text-cyber-red">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-cyber-muted font-mono uppercase tracking-wider block mb-1.5">Email</label>
              <input type="email" placeholder="you@example.com" className="cyber-input"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-cyber-muted font-mono uppercase tracking-wider block mb-1.5">Password</label>
              <input type="password" placeholder="••••••••" className="cyber-input"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)', color: '#070B14' }}>
              {loading ? <><Spinner size="sm" /> Authenticating...</> : '→ Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-cyber-muted mt-4">
            No account?{' '}
            <Link to="/register" className="text-cyber-accent hover:underline">Create one</Link>
          </p>

          {/* Demo hint */}
          <div className="mt-4 p-3 rounded-lg text-xs border border-cyber/50 bg-cyber-bg/50">
            <p className="text-cyber-muted">💡 <span className="text-cyber-text">Demo:</span> Register a new account to get started</p>
          </div>
        </div>
      </div>
    </div>
  )
}
