'use client'
import { useCallback, useRef } from 'react'

// Horizontal swipe between tabs. Shipped on /search and /appointments only.
// Reusable on purpose so another page (e.g. the feed) can be added later as a
// scope change, not a rewrite.
//
// CALLBACK-REF API:  const swipe = useTabSwipe({...});  <div ref={swipe}>
// It returns a ref CALLBACK, not a ref object. React invokes it with the node
// when the element mounts and with null when it unmounts — including on a
// REMOUNT (unmount old → mount new). So if a page rebuilds its subtree (an
// inline Shell component, a keyed remount, anything) the hook re-attaches to
// the fresh node instead of silently dying on the old one. That "worked once
// then stopped" failure is what this shape prevents. It also means the
// listeners attach exactly when the content element exists, so there is no
// readiness flag to pass.
//
// No-fight guard: a drag beginning inside a horizontal scroller is left to that
// scroller (the tab never changes). A drag becomes a tab swipe only once it is
// clearly horizontal (|dx| > |dy|), past 60px. Edge guard: a drag that starts
// within EDGE px of the screen's left/right is ignored, because the OS reserves
// the edges for its own back/forward gesture and JS cannot override it.
// touch-action: pan-y on the root keeps vertical scrolling native and hands
// horizontal to us; nested horizontal scrollers get pan-x back. Honours
// prefers-reduced-motion.
export function useTabSwipe({ tabs, active, onSelect }) {
  const tabsRef = useRef(tabs); tabsRef.current = tabs
  const activeRef = useRef(active); activeRef.current = active
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect
  const cleanupRef = useRef(null)

  // Stable identity ([] deps) so React only calls it on real mount/unmount,
  // not on every render.
  return useCallback((node) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    if (node) cleanupRef.current = attach(node, tabsRef, activeRef, onSelectRef)
  }, [])
}

function attach(el, tabsRef, activeRef, onSelectRef) {
  el.dataset.tabswipe = ''
  el.style.touchAction = 'pan-y'
  // Kill the OS tap-highlight inside the swipe area. Without this, a swipe that
  // starts on a full-width link (e.g. an appointments row) flashes the UA
  // highlight sheet over the card on touchstart, then clears it as the drag
  // cancels the tap. Inherited, so it covers every card in the root. Tapping a
  // card still navigates (that's the feedback); links elsewhere are untouched.
  el.style.webkitTapHighlightColor = 'transparent'
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
  const THRESHOLD = 60
  const EDGE = 30

  // Give any nested horizontal scroller (e.g. search's People row) native
  // sideways panning back with pan-x. Re-run as content changes because such a
  // scroller can appear later. touch-action isn't a layout property, so this
  // loop forces no reflow.
  const markScrollers = () => {
    el.querySelectorAll('*').forEach((n) => {
      if (n.dataset.tabswipeScroll) return
      if (n.scrollWidth > n.clientWidth + 2) {
        const ox = getComputedStyle(n).overflowX
        if (ox === 'auto' || ox === 'scroll') { n.style.touchAction = 'pan-x'; n.dataset.tabswipeScroll = '1' }
      }
    })
  }
  markScrollers()
  let scan = 0
  const mo = new MutationObserver(() => { if (scan) return; scan = requestAnimationFrame(() => { scan = 0; markScrollers() }) })
  mo.observe(el, { childList: true, subtree: true })

  const startedOnHScroll = (target) => {
    let n = target
    while (n && n !== el && n.nodeType === 1) {
      if (n.scrollWidth > n.clientWidth + 2) {
        const ox = getComputedStyle(n).overflowX
        if (ox === 'auto' || ox === 'scroll') return true
      }
      n = n.parentElement
    }
    return false
  }

  const s = {}
  const onStart = (e) => {
    const tch = e.touches[0]
    s.x = tch.clientX; s.y = tch.clientY; s.dx = 0
    const w = window.innerWidth
    // ignore edge-started drags (OS back/forward) and drags on a scroller
    s.active = tch.clientX >= EDGE && tch.clientX <= w - EDGE && !startedOnHScroll(e.target)
    s.decided = false; s.horiz = false
  }
  const onMove = (e) => {
    if (!s.active) return
    const tch = e.touches[0]
    const dx = tch.clientX - s.x, dy = tch.clientY - s.y
    if (!s.decided) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { s.decided = true; s.horiz = Math.abs(dx) > Math.abs(dy) }
    }
    if (!s.horiz) return          // vertical drag → let the page scroll
    e.preventDefault()            // horizontal → it's a tab swipe
    s.dx = dx
    if (!reduce) {
      const i = tabsRef.current.indexOf(activeRef.current)
      const atStart = i <= 0, atEnd = i >= tabsRef.current.length - 1
      const capped = (dx > 0 && atStart) || (dx < 0 && atEnd) ? dx * 0.25 : dx  // resist at the ends
      el.style.transform = `translateX(${capped}px)`
      el.style.transition = 'none'
    }
  }
  const onEnd = () => {
    if (!reduce) { el.style.transition = 'transform 0.2s ease'; el.style.transform = '' }
    if (s.horiz && Math.abs(s.dx) >= THRESHOLD) {
      const i = tabsRef.current.indexOf(activeRef.current)
      const ni = s.dx < 0 ? i + 1 : i - 1
      if (ni >= 0 && ni < tabsRef.current.length) onSelectRef.current(tabsRef.current[ni])
    }
    s.active = false; s.horiz = false; s.dx = 0
  }

  el.addEventListener('touchstart', onStart, { passive: true })
  el.addEventListener('touchmove', onMove, { passive: false })
  el.addEventListener('touchend', onEnd, { passive: true })
  el.addEventListener('touchcancel', onEnd, { passive: true })
  return () => {
    mo.disconnect()
    if (scan) cancelAnimationFrame(scan)
    el.removeEventListener('touchstart', onStart)
    el.removeEventListener('touchmove', onMove)
    el.removeEventListener('touchend', onEnd)
    el.removeEventListener('touchcancel', onEnd)
  }
}
