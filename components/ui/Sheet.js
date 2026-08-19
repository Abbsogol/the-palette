'use client'
import { useEffect, useRef } from 'react'

// The redesign's modal/sheet primitive. Every overlay in the redesign builds
// on this so the accessibility contract holds everywhere: aria-modal dialog,
// Escape closes, focus moves into the sheet on open and returns to the
// trigger on close, backdrop click closes, body scroll locked while open.
export default function Sheet({
  onClose,
  title,               // string for the accessible name (rendered by children or via aria-label)
  children,
  fullScreen = false,  // true: covers the viewport (filter panel); false: bottom sheet
  footer = null,       // sticky footer content (e.g. an apply button)
}) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement
    panelRef.current?.focus()

    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (previouslyFocused.current?.focus) previouslyFocused.current.focus()
    }
  }, [onClose])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(20, 3, 8, 0.6)',
        display: 'flex', alignItems: fullScreen ? 'stretch' : 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          width: '100%', maxWidth: '480px', outline: 'none',
          background: 'linear-gradient(180deg, var(--lq-wine-deep) 0%, var(--lq-wine) 100%)',
          borderRadius: fullScreen ? 0 : 'var(--lq-radius-sheet) var(--lq-radius-sheet) 0 0',
          maxHeight: fullScreen ? 'none' : '86vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `calc(env(safe-area-inset-top) + ${fullScreen ? 24 : 12}px) 24px 24px` }}>
          {children}
        </div>
        {footer && (
          <div style={{
            padding: '12px 24px calc(16px + env(safe-area-inset-bottom))',
            background: 'linear-gradient(to top, var(--lq-wine-deep), rgba(41, 0, 10, 0.6))',
            backdropFilter: 'blur(8px)',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
