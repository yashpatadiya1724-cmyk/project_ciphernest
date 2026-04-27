/**
 * BentoCard — Phase 3.2 / 3.3 / 3.5
 * Glassmorphism card for the Bento grid layout.
 * - Soft shadow + glass-white background (light) / dark glass (dark mode)
 * - Optional HelpPanel trigger via `helpData` prop
 * - Framer Motion: fade+slide on mount, scale+glow on hover
 */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import HelpPanel from './HelpPanel'

const BentoCard = ({
  children,
  className = '',
  helpData,          // { title, description, legend, proTip }
  colSpan = 1,       // 1 | 2 | 3
  rowSpan = 1,
  noPadding = false,
  style = {},
}) => {
  const [helpOpen, setHelpOpen] = useState(false)

  const colClass = colSpan === 3 ? 'md:col-span-3'
    : colSpan === 2 ? 'md:col-span-2'
    : ''
  const rowClass = rowSpan === 2 ? 'md:row-span-2' : ''

  return (
    <motion.div
      className={`bento-card relative ${noPadding ? '' : 'p-5'} ${colClass} ${rowClass} ${className}`}
      style={style}
      // 3.5 — mount animation: slight y-offset + fade
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      // 3.5 — hover: scale + glow
      whileHover={{ scale: 1.015, transition: { duration: 0.2 } }}
    >
      {/* 3.3 — Help trigger */}
      {helpData && (
        <button
          onClick={() => setHelpOpen(true)}
          aria-label={`Help for ${helpData.title}`}
          className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
          style={{
            background: 'rgba(99,102,241,0.12)',
            color: 'var(--accent)',
            border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          ?
        </button>
      )}

      {children}

      {/* 3.3 — HelpPanel overlay */}
      {helpData && helpOpen && (
        <HelpPanel data={helpData} onClose={() => setHelpOpen(false)} />
      )}
    </motion.div>
  )
}

export default BentoCard
