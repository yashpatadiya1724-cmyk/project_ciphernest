import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('cn_token')
    const savedUser = localStorage.getItem('cn_user')
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      } catch { logout() }
    }
    setLoading(false)
  }, [])

  const login = (userData, token) => {
    localStorage.setItem('cn_token', token)
    localStorage.setItem('cn_user', JSON.stringify(userData))
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('cn_token')
    localStorage.removeItem('cn_user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  const updateScore = (score) => {
    setUser(prev => prev ? { ...prev, securityScore: score } : prev)
  }

  const refreshProfile = async () => {
    try {
      const { data } = await api.get('/auth/profile')
      setUser(data)
      localStorage.setItem('cn_user', JSON.stringify(data))
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateScore, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
