'use client'
import { useEffect, useRef } from 'react'

// Horizontal swipe between tabs. Reusable ON PURPOSE so adding another page
// later (e.g. the feed, currently excluded for its carousels) is a scope
// change, not a rewrite.
//
// No-fight guard: a drag that begins inside a horizontally-scrollable
// descendant is left to that scroller — the tab does NOT change (same
// principle as the Sheet's no-fight-scroll). A drag is only treated as a tab
// swipe once it's clearly horizontal (|dx| > |dy|); otherwise the page scrolls
// as normal. Tab state is changed through the caller's own setter, so
// persistence + tab-suffixed scroll memory follow the gesture exactly as the
// tap path does. Honours prefers-reduced-motion (no follow-the-finger slide).
//
// Usage: give the hook a ref on the element wrapping the TAB CONTENT (not the
//   page header), the ordered tab keys, the active key, and the caller's
//   select fn (the same one the tab buttons call).
//
// READINESS: the listeners attach in an effect keyed on `enabled`. If the ref'd
//   element mounts AFTER first render (e.g. the page shows a loading screen
//   first, then renders the tab content), pass `enabled: !loading` (or whatever
//   gates the content) so the effect re-runs and attaches once the element is
//   actually in the DOM. Pages that render their container on the first paint
//   can leave `enabled` at its default.
export function useTabSwipe(ref, { tabs, active, onSelect, enabled = true }) {
  const st = useRef({})
  const tabsRef = useRef(tabs); tabsRef.current = tabs
  const activeRef = useRef(active); activeRef.current = active
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    el.dataset.tabswipe = ''   // marks the gesture root (debugging / gesture tests)

    // Reserve horizontal for JS. With touch-action:auto, real hardware touch
    // lets the compositor claim a horizontal drag that begins on draggable
    // content (links/images) and fire touchcancel — the gesture then aborts.
    // That failure is invisible to synthetic CDP touch (it bypasses the
    // compositor), so a scripted pass can't see it — real-device is the only
    // proof. pan-y keeps vertical scrolling native and hands horizontal to us.
    el.style.touchAction = 'pan-y'
    // A nested horizontal scroller (e.g. search's People row) still needs
    // native sideways panning, so give it back pan-x. Done centrally here, and
    // re-run as content changes because such a scroller can appear later (the
    // People row only exists once a query returns people). touch-action is not
    // a layout property, so setting it in this loop forces no reflow.
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

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
    const THRESHOLD = 60

    // Walk from the touch target up to the swipe root; if any ancestor is a
    // real horizontal scroller (overflow-x auto/scroll AND wider than its box),
    // this drag belongs to it, not to the tabs.
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

    const s = st.current
    const onStart = (e) => {
      const tch = e.touches[0]
      s.x = tch.clientX; s.y = tch.clientY; s.dx = 0
      s.active = !startedOnHScroll(e.target)
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
  }, [ref, enabled])
}
