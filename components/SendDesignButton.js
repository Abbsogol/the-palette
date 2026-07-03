'use client'

import { useState } from 'react'
import SendDesignSheet from './SendDesignSheet'

export default function SendDesignButton({ design }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Send to chat"
        style={{
          background: 'var(--bg-card)',
          border: '0.5px solid var(--border)',
          borderRadius: '10px',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
      >
        {/* Paper plane icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
        </svg>
      </button>

      {open && (
        <SendDesignSheet
          design={design}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
