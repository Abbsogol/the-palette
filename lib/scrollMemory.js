'use client'
import { useEffect, useRef } from 'react'

// Scroll restoration for every scrollable list (navigation round; rewritten
// 2026-09-09 after verification caught a false pass).
//
// Anchor-based, but disambiguated by ABSOLUTE document position — the feed
// shows the same design in several sections (Trending carousel, New This
// Week, the grid), so a given /design/<id> href appears multiple times in
// the DOM. The previous version looked the anchor up by href and got the
// FIRST occurrence (always near the top), so every restore landed near the
// top regardless of where the user was. Now the write also records the
// anchor's absolute doc position (docTop = scrollY + rect.top), and restore
// picks the occurrence whose current docTop is closest to it — the right one
// even with duplicates, and tolerant of content that shifted since.
//
// One combined effect (keyed on [ready, suffix]) owns both the scroll writer
// and the one-shot restore, so there is no cross-effect ref-ordering to get
// wrong. Writes are disabled until shortly AFTER the restore scroll settles,
// so the restore's own scroll can't overwrite the stored position, and Next's
// scroll-to-top during a back render can't either.
//
// NOTE: no list paginates or virtualises today (verified 2026-09-08). If that
// changes, restore the loaded-page count before positioning.

const PREFIX = 'lq-scroll:'
const MAX_KEYS = 30
const ANCHOR_SEL = 'a[href^="/design/"], a[href^="/moodboards/"], a[href^="/messages/"], a[href^="/creator/"]'

const keyFor = (suffix) => PREFIX + location.pathname + location.search + (suffix ? `#${suffix}` : '')

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
  // Which key has already been restored on this mount — so a later ready/
  // suffix re-run doesn't re-restore over the user's fresh scrolling.
  const restoredKey = useRef(null)

  useEffect(() => {
    const key = keyFor(suffix)
    let writeEnabled = false
    let t = 0

    const write = () => {
      t = 0
      try {
        const y = window.scrollY
        let anchorHref = null, anchorOffset = 0, anchorDocTop = 0
        for (const a of document.querySelectorAll(ANCHOR_SEL)) {
          const r = a.getBoundingClientRect()
          if (r.bottom > 0 && r.height > 0) {
            anchorHref = a.getAttribute('href'); anchorOffset = r.top; anchorDocTop = y + r.top; break
          }
        }
        sessionStorage.setItem(key, JSON.stringify({ y, anchorHref, anchorOffset, anchorDocTop, ts: Date.now() }))
      } catch {}
    }
    const onScroll = () => { if (writeEnabled && !t) t = setTimeout(write, 150) }
    window.addEventListener('scroll', onScroll, { passive: true })

    const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const doRestore = (saved) => {
      if (saved.anchorHref) {
        const cands = [...document.querySelectorAll(ANCHOR_SEL)].filter(a => a.getAttribute('href') === saved.anchorHref)
        if (cands.length) {
          // The occurrence at (about) the same absolute document position —
          // disambiguates duplicates and tolerates a shifted list.
          let best = cands[0], bestDelta = Infinity
          for (const a of cands) {
            const docTop = window.scrollY + a.getBoundingClientRect().top
            const d = Math.abs(docTop - saved.anchorDocTop)
            if (d < bestDelta) { bestDelta = d; best = a }
          }
          const target = window.scrollY + best.getBoundingClientRect().top - saved.anchorOffset
          window.scrollTo(0, Math.max(0, Math.min(target, maxY())))
          return
        }
      }
      window.scrollTo(0, Math.max(0, Math.min(saved.y, maxY())))
    }

    let raf1 = 0, raf2 = 0, enableTimer = 0
    if (ready) {
      if (restoredKey.current === key) {
        writeEnabled = true // already positioned this mount; just keep capturing
      } else {
        restoredKey.current = key
        let saved = null
        try { saved = JSON.parse(sessionStorage.getItem(key) || 'null') } catch {}
        prune()
        // Two frames so layout (with reserved image boxes) is settled, then
        // enable writes a beat later so the restore scroll isn't persisted.
        raf1 = requestAnimationFrame(() => {
          raf2 = requestAnimationFrame(() => {
            if (saved && (saved.y || saved.anchorHref)) doRestore(saved)
            enableTimer = setTimeout(() => { writeEnabled = true }, 250)
          })
        })
      }
    }

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (t) clearTimeout(t)
      if (raf1) cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      if (enableTimer) clearTimeout(enableTimer)
    }
  }, [ready, suffix])
}
