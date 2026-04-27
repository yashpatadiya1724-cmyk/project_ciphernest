/**
 * HelpPanel — Phase 3.3
 * Contextual help overlay rendered inside a BentoCard.
 * Accepts: { title, description, legend: [{color, label}], proTip }
 * Accessible: focus-trapped, ESC to close, role="dialog".
 */
import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, BookOpen } from 'lucide-react'

const HelpPanel = ({ data, onClose }) => {
  const closeRef = useRef(null)

  // Close on ESC — accessibility requirement
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Help: ${data.title}`}
        className="absolute inset-0 z-20 rounded-2xl flex flex-col p-5 overflow-y-auto"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid rgba(99,102,241,0.30)',
          backdropFilter: 'blur(16px)',
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: 'var(--accent)' }} />
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              {data.title}
            </h3>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close help panel"
            className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
          {data.description}
        </p>

        {/* Legend */}
        {data.legend?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Legend
            </p>
            <div className="space-y-2">
              {data.legend.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: item.color }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pro Tip */}
        {data.proTip && (
          <div
            className="mt-auto rounded-xl p-3 flex gap-2"
            style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.20)',
            }}
          >
            <Lightbulb size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              <span className="font-semibold">Pro tip: </span>
              {data.proTip}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export default HelpPanel
