/**
 * AskCipher — Phase 3.8 / 4.3
 * Structured SOC analyst output + risk-score bar + thumbs feedback loop.
 * Feedback sends { type, response_id, feedback } to /api/feedback/report.
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { chatAPI } from '../services/api'
import api from '../services/api'
import { Spinner } from '../components/common/index'
import {
  ShieldAlert, Wrench, ListChecks, BarChart2,
  Send, Trash2, Bot, User, ThumbsUp, ThumbsDown
} from 'lucide-react'

const SUGGESTIONS = [
  'What is phishing and how do I avoid it?',
  'How do I create a strong password?',
  'What does "data breach" mean?',
  'How can I stay safe on public WiFi?',
  'What is two-factor authentication?',
  'How do I know if my device is hacked?',
]

// ── 4.3 — Risk score bar ────────────────────────────────────────────────────
const RiskScoreBar = ({ score }) => {
  if (score === undefined || score === null) return null
  const pct   = Math.round(score * 100)
  const color = pct <= 30 ? '#10b981' : pct <= 60 ? '#fbbf24' : '#f43f5e'
  const label = pct <= 30 ? 'Low' : pct <= 60 ? 'Medium' : 'High'
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs font-semibold" style={{ color, minWidth: 40 }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border-ui)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ── Structured response renderer (3.8 / 4.3) ────────────────────────────────
const StructuredResponse = ({ content, messageId, onFeedback }) => {
  const [voted, setVoted] = useState(null)

  let parsed = null
  try {
    const clean = content.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  }

  const sections = [
    { key: 'threat_assessment', icon: <ShieldAlert size={13} />, label: 'Situation Assessment',  color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.20)'   },
    { key: 'mitre_code',        icon: <Wrench size={13} />,      label: 'Technical Root Cause',  color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.20)'  },
    { key: 'remediation',       icon: <ListChecks size={13} />,  label: 'Actionable Mitigation', color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.20)'  },
    { key: 'confidence_score',  icon: <BarChart2 size={13} />,   label: 'Confidence Level',      color: 'var(--accent)', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.20)' },
  ]

  const handleVote = async (vote) => {
    if (voted) return
    setVoted(vote)
    onFeedback?.(messageId, vote)
  }

  return (
    <div className="space-y-2.5">
      {sections.map(({ key, icon, label, color, bg, border }) => {
        const val = parsed[key]
        if (!val && val !== 0) return null
        return (
          <div key={key} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="flex items-center gap-1.5 mb-1.5" style={{ color }}>
              {icon}
              <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
            </div>
            {Array.isArray(val) ? (
              <ul className="space-y-1">
                {val.map((item, i) => (
                  <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color }}>›</span>{item}
                  </li>
                ))}
              </ul>
            ) : typeof val === 'number' ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border-ui)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.round(val * 100)}%`, background: color }} />
                  </div>
                  <span className="text-xs font-mono font-bold" style={{ color }}>{Math.round(val * 100)}%</span>
                </div>
                {/* 4.3 — risk score bar derived from confidence */}
                <RiskScoreBar score={1 - val} />
              </>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{val}</p>
            )}
          </div>
        )
      })}

      {parsed.evidence_citations?.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Sources: {parsed.evidence_citations.join(', ')}
        </p>
      )}

      {/* 4.3 — Thumbs feedback */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Was this helpful?</span>
        <button onClick={() => handleVote('👍')} aria-label="Thumbs up"
          className="p-1 rounded transition-all"
          style={{ color: voted === '👍' ? '#10b981' : 'var(--text-muted)', opacity: voted && voted !== '👍' ? 0.3 : 1 }}>
          <ThumbsUp size={13} />
        </button>
        <button onClick={() => handleVote('👎')} aria-label="Thumbs down"
          className="p-1 rounded transition-all"
          style={{ color: voted === '👎' ? '#f43f5e' : 'var(--text-muted)', opacity: voted && voted !== '👎' ? 0.3 : 1 }}>
          <ThumbsDown size={13} />
        </button>
        {voted && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Thanks!</span>}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AskCipher() {
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [aiOnline, setAiOnline]       = useState(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  useEffect(() => {
    checkStatus()
    loadHistory()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const checkStatus = async () => {
    try { const { data } = await chatAPI.status(); setAiOnline(data.online) }
    catch { setAiOnline(false) }
  }

  const loadHistory = async () => {
    try { const { data } = await chatAPI.history(); setMessages(data) }
    catch {}
    setHistoryLoaded(true)
  }

  const send = async (msg) => {
    const text = (msg || input).trim()
    if (!text || loading) return
    setInput('')

    const userMsg = { role: 'user', content: text, _id: `u_${Date.now()}` }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const assistantId = `ai_${Date.now()}`
    setMessages(prev => [...prev, { role: 'assistant', content: '', _id: assistantId }])

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cn_token')}`,
        },
        body: JSON.stringify({ message: text }),
      })
      if (!response.ok) throw new Error('Network error')

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.content) {
              accumulated += data.content
              setMessages(prev => prev.map(m =>
                m._id === assistantId ? { ...m, content: accumulated } : m
              ))
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m._id === assistantId
          ? { ...m, content: 'Connection error. Please check if the backend is running.' }
          : m
      ))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = async () => {
    if (!confirm('Clear all chat history?')) return
    await chatAPI.clear()
    setMessages([])
  }

  // 4.3 — Send thumbs feedback to /api/feedback/report
  const handleFeedback = async (messageId, vote) => {
    try {
      await api.post('/feedback/report', {
        toolResultId: messageId,
        toolType:     'ai_response',
        reportedStatus: vote === '👍' ? 'Dangerous' : 'Safe', // 👎 = false positive signal
        analystReasoning: `User voted ${vote} on AI response ${messageId}`,
      })
    } catch { /* non-blocking */ }
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.25)' }}>
            <Bot size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Ask Cipher</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: aiOnline ? '#10b981' : aiOnline === false ? '#f43f5e' : '#fbbf24' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {aiOnline === null ? 'Checking…' : aiOnline ? 'Groq AI Connected' : 'AI Offline — check GROQ_API_KEY'}
              </span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} aria-label="Clear chat history"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-ui)' }}>
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 bento-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Welcome */}
          {messages.length === 0 && historyLoaded && (
            <motion.div
              className="text-center py-8"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)' }}>
                <Bot size={28} style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Hello, I'm Cipher</h2>
              <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Your SOC-grade AI assistant. I explain threats in plain English, interpret scan results, and guide remediation.
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto text-left">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left px-3 py-2.5 rounded-xl text-xs transition-all"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-ui)', background: 'var(--bg-card)' }}>
                    💬 {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg._id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                    <Bot size={14} color="#fff" />
                  </div>
                )}

                <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                    style={msg.role === 'user'
                      ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }
                      : { background: 'var(--bg-card)', border: '1px solid var(--border-ui)', color: 'var(--text-primary)' }
                    }>
                    {msg.role === 'assistant' && (
                      <span className="text-xs font-mono font-semibold block mb-2" style={{ color: 'var(--accent)' }}>
                        Cipher
                      </span>
                    )}
                    {/* 3.8 / 4.3 — structured output renderer */}
                    {msg.role === 'assistant'
                      ? <StructuredResponse content={msg.content} messageId={msg._id} onFeedback={handleFeedback} />
                      : <p className="whitespace-pre-wrap">{msg.content}</p>
                    }
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-ui)', color: 'var(--text-primary)' }}>
                    <User size={14} />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div className="flex gap-3 justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                <Bot size={14} color="#fff" />
              </div>
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-ui)' }}>
                <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>Cipher is thinking</span>
                <span className="flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: 'var(--accent)', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-4" style={{ borderTop: '1px solid var(--border-ui)' }}>
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask Cipher about security…"
              rows={1}
              aria-label="Message input"
              className="cyber-input flex-1 resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="px-4 py-2 rounded-xl transition-all disabled:opacity-40 flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', minWidth: '48px' }}
            >
              {loading ? <Spinner size="sm" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
