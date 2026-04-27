import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/common/index'

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.email || !form.password) { setError('Please fill in all fields'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      const { data } = await authAPI.register({ username: form.username, email: form.email, password: form.password })
      login({ _id: data._id, username: data.username, email: data.email, securityScore: data.securityScore }, data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cyber-bg">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #8B5CF6, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(26,39,68,0.4) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #8B5CF622, #00D4FF22)', border: '1px solid #8B5CF633', boxShadow: '0 0 32px rgba(139,92,246,0.1)' }}>
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gradient">CipherNest</h1>
          <p className="text-cyber-muted text-sm mt-1">Create your secure account</p>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-5">Create Account</h2>

          {error && <div className="alert-critical p-3 mb-4 text-sm text-cyber-red">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'username', label: 'Username', type: 'text', placeholder: 'johndoe' },
              { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
              { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
              { key: 'confirm', label: 'Confirm Password', type: 'password', placeholder: '••••••••' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs text-cyber-muted font-mono uppercase tracking-wider block mb-1.5">{field.label}</label>
                <input type={field.type} placeholder={field.placeholder} className="cyber-input"
                  value={form[field.key]} onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))} />
              </div>
            ))}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', color: '#070B14' }}>
              {loading ? <><Spinner size="sm" /> Creating account...</> : '→ Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-cyber-muted mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-cyber-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
