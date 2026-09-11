'use client'
import { useEffect, useRef, useState } from 'react'

// The redesign's modal/sheet primitive. Every overlay in the redesign builds
// on this so the accessibility contract holds everywhere: aria-modal dialog,
// Escape closes, focus moves into the sheet on open and returns to the
// trigger on close, backdrop click closes, body scroll locked while open.
//
// It also owns two mobile behaviours so no caller re-implements them:
//  • Keyboard-offset: when the on-screen keyboard opens, the panel lifts by
//    the keyboard height (visualViewport) so a focused input stays visible.
//  • Swipe-down-to-close (bottom sheets): drag the panel down to dismiss. It
//    only hijacks a downward drag that starts from the grab handle/header or
//    while the content is already scrolled to the top, so it never fights a
//    scroll inside the sheet. Past the threshold it dismisses through the SAME
//    onClose as Escape/backdrop (so the pushed history entry is cleaned up the
//    same way every time); below it, it snaps back. Honours reduced-motion.
export default function Sheet({
  onClose,
  title,               // string for the accessible name (rendered by children or via aria-label)
  children,
  fullScreen = false,  // true: covers the viewport (filter panel); false: bottom sheet
  footer = null,       // sticky footer content (e.g. an apply button)
}) {
  const panelRef = useRef(null)
  const scrollRef = useRef(null)
  const previouslyFocused = useRef(null)

  // Escape reads onClose through a ref so the open/focus effect can run on
  // MOUNT ONLY. Callers pass inline arrows, so with [onClose] as the dep the
  // effect re-ran on every parent render — and its panelRef.focus() stole
  // focus from whatever the user was typing in (each keystroke re-renders
  // the parent, so the mobile keyboard closed after every character).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const reduceMotion = useRef(false)
  const [kbOffset, setKbOffset] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  // MOUNT ONLY — focus in/return, Escape, scroll lock. Unchanged behaviour;
  // the drag/keyboard state above deliberately does NOT live in this effect's
  // deps, so re-renders can't re-run it and steal focus.
  useEffect(() => {
    reduceMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
    previouslyFocused.current = document.activeElement
    panelRef.current?.focus()

    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (previouslyFocused.current?.focus) previouslyFocused.current.focus()
    }
  }, [])

  // Keyboard-offset via visualViewport (guarded — older browsers keep today's
  // behaviour). Applied as paddingBottom on the backdrop container, which lifts
  // the bottom-anchored panel by exactly the keyboard height.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // Swipe-down-to-close — native listeners so touchmove can be non-passive
  // (React attaches touch handlers passively, which blocks preventDefault).
  // Bottom sheets only; fullScreen panels keep their explicit close controls.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || fullScreen) return
    const DISMISS_PX = 110
    const st = { startY: 0, dy: 0, active: false }

    const onStart = (e) => {
      const scroller = scrollRef.current
      // Eligible to dismiss when the drag begins off the scrollable content
      // (grab handle / header / footer) OR while the content is at the top.
      const inScroll = scroller?.contains(e.target)
      const atTop = (scroller?.scrollTop || 0) <= 0
      st.startY = e.touches[0].clientY
      st.dy = 0
      st.active = !inScroll || atTop
    }
    const onMove = (e) => {
      if (!st.active) return
      const dy = e.touches[0].clientY - st.startY
      if (dy <= 0) {           // dragging up → release so content can scroll
        st.active = false
        if (st.dy !== 0) { st.dy = 0; setDragY(0) }
        setDragging(false)
        return
      }
      e.preventDefault()        // hijack the downward drag
      st.dy = dy
      setDragging(true)
      setDragY(dy)
    }
    const onEnd = () => {
      const wasActive = st.active
      const dy = st.dy
      st.active = false
      st.dy = 0
      setDragging(false)
      if (wasActive && dy >= DISMISS_PX) { onCloseRef.current(); return } // same close path as Escape/backdrop
      setDragY(0)               // snap back
    }

    panel.addEventListener('touchstart', onStart, { passive: true })
    panel.addEventListener('touchmove', onMove, { passive: false })
    panel.addEventListener('touchend', onEnd, { passive: true })
    panel.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      panel.removeEventListener('touchstart', onStart)
      panel.removeEventListener('touchmove', onMove)
      panel.removeEventListener('touchend', onEnd)
      panel.removeEventListener('touchcancel', onEnd)
    }
  }, [fullScreen])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(20, 3, 8, 0.6)',
        display: 'flex', alignItems: fullScreen ? 'stretch' : 'flex-end', justifyContent: 'center',
        paddingBottom: fullScreen ? 0 : kbOffset,
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
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : (reduceMotion.current ? 'none' : 'transform 0.25s ease'),
        }}
      >
        {!fullScreen && (
          <div aria-hidden="true" style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.25)' }} />
          </div>
        )}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `${fullScreen ? 'calc(env(safe-area-inset-top) + 24px)' : '12px'} 24px 24px` }}>
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
