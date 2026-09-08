'use client'
import { useEffect, useRef } from 'react'

// Scroll restoration for every scrollable list (navigation round, 2026-09-08).
// Continuous, anchor-based:
//  - a passive 150ms-throttled scroll listener stores { y, anchorHref,
//    anchorOffset } — the design-card link nearest the viewport top and its
//    offset — so every exit path is captured, not just instrumented links;
//  - restore runs once per mount when the page signals `ready` (data loaded;
//    reserved image boxes mean layout is already stable at that moment). The
//    anchor is looked up by href: if found we scroll it back to its stored
//    offset (content that shifted still lands on the SAME card); if the item
//    is gone, fall back to the stored y clamped to the new document height.
//  - keys are pathname+search plus a page-supplied suffix for state not in
//    the URL (feed tab, profile tab, creator tab). Session-scoped.
// NOTE: no list paginates or virtualises today (verified 2026-09-08) — every
// surface is a single capped fetch, so the anchor always exists at ready.
// If pagination is ever introduced, restore the loaded-page count BEFORE
// positioning, or hold restore until the anchor is reachable.

const PREFIX = 'lq-scroll:'
const MAX_KEYS = 30

const prune = () => {
  try {
    const keys = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    if (keys.length > MAX_KEYS) {
      keys.map(k => ({ k, ts: JSON.parse(sessionStorage.getItem(k) || '{}').ts || 0 }))
        .sort((a, b) => a.ts - b.ts)
        .slice(0, keys.length - MAX_KEYS)
        .forEach(({ k }) => sessionStorage.removeItem(k))
    }
  } catch {}
}

export function useScrollMemory(suffix, ready) {
  const restored = useRef(false)

  // continuous writer
  useEffect(() => {
    const key = PREFIX + location.pathname + location.search + (suffix ? `#${suffix}` : '')
    let t = 0
    const write = () => {
      t = 0
      try {
        let anchorHref = null, anchorOffset = 0
        for (const a of document.querySelectorAll('a[href^="/design/"], a[href^="/moodboards/"], a[href^="/messages/"], a[href^="/creator/"]')) {
          const r = a.getBoundingClientRect()
          if (r.bottom > 0 && r.height > 0) { anchorHref = a.getAttribute('href'); anchorOffset = r.top; break }
        }
        sessionStorage.setItem(key, JSON.stringify({ y: window.scrollY, anchorHref, anchorOffset, ts: Date.now() }))
      } catch {}
    }
    const onScroll = () => {
      // Next resets scroll to top while re-rendering a back navigation —
      // writing during that window would overwrite the position we're
      // about to restore. No writes until the restore attempt has run.
      if (!restored.current) return
      if (!t) t = setTimeout(write, 150)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (t) clearTimeout(t); if (restored.current) write() }
  }, [suffix])

  // one-shot restore when ready
  useEffect(() => {
    if (!ready || restored.current) return
    restored.current = true
    const key = PREFIX + location.pathname + location.search + (suffix ? `#${suffix}` : '')
    let saved
    try { saved = JSON.parse(sessionStorage.getItem(key) || 'null') } catch { saved = null }
    prune()
    if (!saved || (!saved.y && !saved.anchorHref)) return
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (saved.anchorHref) {
        const el = document.querySelector(`a[href="${CSS.escape(saved.anchorHref).replace(/\\/g, '\\\\')}"]`) ||
                   [...document.querySelectorAll('a')].find(a => a.getAttribute('href') === saved.anchorHref)
        if (el) {
          const target = window.scrollY + el.getBoundingClientRect().top - saved.anchorOffset
          window.scrollTo(0, Math.max(0, Math.min(target, max)))
          return
        }
      }
      window.scrollTo(0, Math.max(0, Math.min(saved.y, max)))
    })
  }, [ready, suffix])

  // re-arm when the key changes (tab switches)
  useEffect(() => { restored.current = false }, [suffix])
}
