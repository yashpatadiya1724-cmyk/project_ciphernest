import React, { useState, useEffect, useRef } from 'react'
import { chatAPI } from '../../services/api'
import { Spinner } from '../common/index'

export default function CipherChat({ onClose, initialContext }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiOnline, setAiOnline] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadHistory()
    checkStatus()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const checkStatus = async () => {
    try {
      const { data } = await chatAPI.status()
      setAiOnline(data.online)
    } catch { setAiOnline(false) }
  }

  const loadHistory = async () => {
    try {
      const { data } = await chatAPI.history()
      setMessages(data.slice(-20))
    } catch {}
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    
    const userMsgId = Date.now()
    setMessages(prev => [...prev, { role: 'user', content: userMsg, _id: userMsgId }])
    
    const assistantMsgId = userMsgId + 1
    setMessages(prev => [...prev, { role: 'assistant', content: '', _id: assistantMsgId }])
    
    setLoading(true)
    
    try {
      const token = localStorage.getItem('cn_token')
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg, toolContext: initialContext })
      })

      if (!response.ok) throw new Error('Network response was not ok')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep partial line in buffer
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.content) {
              accumulated += data.content
              setMessages(prev => prev.map(m => 
                m._id === assistantMsgId ? { ...m, content: accumulated } : m
              ))
            }
          } catch (e) {
            console.error('Frontend stream parse error:', e)
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => 
        m._id === assistantMsgId ? { ...m, content: 'Error: Connection lost. Please try again.' } : m
      ))
    } finally {
      setLoading(false)
    }
  }

  const clearChat = async () => {
    await chatAPI.clear()
    setMessages([])
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-80 sm:w-96 rounded-2xl overflow-hidden cipher-chat animate-slideUp"
      style={{ height: '520px', boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.15)' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-cyber-border/60"
        style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(139,92,246,0.1))' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)' }}>🤖</div>
          <div>
            <p className="text-sm font-semibold text-cyber-text">Cipher</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: aiOnline ? '#00FF88' : aiOnline === false ? '#FF3366' : '#FFD700', boxShadow: `0 0 4px ${aiOnline ? '#00FF88' : '#FF3366'}` }} />
              <span className="text-xs text-cyber-muted">{aiOnline === null ? 'Checking...' : aiOnline ? 'Online' : 'Offline (fallback mode)'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} title="Clear history" className="p-1.5 rounded text-cyber-muted hover:text-cyber-yellow transition-colors text-sm">🗑</button>
          <button onClick={onClose} className="p-1.5 rounded text-cyber-muted hover:text-cyber-red transition-colors text-sm">✕</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <span className="text-3xl block mb-3">🛡️</span>
            <p className="text-cyber-text text-sm font-medium">Hi! I'm Cipher</p>
            <p className="text-cyber-muted text-xs mt-1">Your AI security assistant. Ask me anything about cybersecurity or let me explain scan results.</p>
            <div className="mt-4 space-y-2">
              {['What is phishing?', 'How do I make a strong password?', 'Is my network safe?'].map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="block w-full text-left px-3 py-2 rounded-lg text-xs text-cyber-muted hover:text-cyber-accent border border-cyber hover:border-cyber-accent/40 transition-all">
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg._id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'text-cyber-bg rounded-br-sm'
                : 'text-cyber-text rounded-bl-sm border border-cyber-border/60'
            }`}
              style={msg.role === 'user'
                ? { background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)' }
                : { background: 'rgba(255,255,255,0.03)' }}>
              {msg.role === 'assistant' && <span className="text-xs text-cyber-accent font-mono block mb-1">🤖 Cipher</span>}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2.5 rounded-xl rounded-bl-sm border border-cyber-border/60 flex items-center gap-2"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <Spinner size="sm" />
              <span className="text-xs text-cyber-muted">Cipher is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-cyber-border/60">
        <div className="flex gap-2">
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask Cipher anything..."
            className="cyber-input flex-1 py-2 text-xs"
          />
          <button onClick={send} disabled={!input.trim() || loading}
            className="px-3 py-2 rounded-lg transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00D4FF22, #8B5CF622)', border: '1px solid #00D4FF44', color: '#00D4FF' }}>
            <span className="text-sm">{loading ? '⏳' : '▶'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
