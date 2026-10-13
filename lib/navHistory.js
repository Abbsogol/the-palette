'use client'

// In-app history depth tracking for the shared back control.
//
// Mechanism: wrap history.pushState/replaceState ONCE (installed by
// NavigationTracker in the root layout, before any client navigation).
// Every entry gets tagged with a __lqKey in its state object and its depth
// recorded in a sessionStorage map:
//   pushState    → depth = current + 1  (real forward navigation)
//   replaceState → depth = current      (redirects add no history)
//   popstate     → depth = map[entry key] (back AND forward both exact)
// Unknown entries (created before the wrapper, external, or a future Next
// version stripping foreign state keys) resolve to depth 1 — which makes
// BackButton use the declared fallback. Degradation is always "one fallback
// navigation instead of a history step", never an app exit.
//
// If list pagination is ever introduced, scroll restore (lib/scrollMemory)
// must restore the loaded-page count before positioning — see that module.

const MAP_KEY = 'lq-nav-depths'
const uid = () => Math.random().toString(36).slice(2, 10)

let installed = false
let currentDepth = 1

const readMap = () => {
  try { return JSON.parse(sessionStorage.getItem(MAP_KEY) || '{}') } catch { return {} }
}
const writeMap = (m) => {
  try {
    const keys = Object.keys(m)
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach(k => delete m[k])
    sessionStorage.setItem(MAP_KEY, JSON.stringify(m))
  } catch {}
}

export function installNavTracker() {
  if (installed || typeof window === 'undefined') return
  installed = true

  const map = readMap()
  const existingKey = window.history.state?.__lqKey
  if (existingKey && map[existingKey]) {
    currentDepth = map[existingKey] // refresh / server-redirect landing on a known entry
  } else {
    const key = existingKey || uid()
    currentDepth = 1
    map[key] = 1
    writeMap(map)
    if (!existingKey) {
      try { window.history.replaceState({ ...(window.history.state || {}), __lqKey: key }, '') } catch {}
    }
  }

  const tag = (state, depth) => {
    const key = uid()
    const m = readMap()
    m[key] = depth
    writeMap(m)
    return { ...(state || {}), __lqKey: key }
  }

  const origPush = window.history.pushState.bind(window.history)
  const origReplace = window.history.replaceState.bind(window.history)
  window.history.pushState = function (state, title, url) {
    currentDepth += 1
    return origPush(tag(state, currentDepth), title, url)
  }
  window.history.replaceState = function (state, title, url) {
    // keep the existing key when Next re-replaces its own entry
    const key = state?.__lqKey || window.history.state?.__lqKey
    if (key) {
      const m = readMap(); m[key] = currentDepth; writeMap(m)
      return origReplace({ ...(state || {}), __lqKey: key }, title, url)
    }
    return origReplace(tag(state, currentDepth), title, url)
  }
  window.addEventListener('popstate', (e) => {
    const key = e.state?.__lqKey
    currentDepth = (key && readMap()[key]) || 1
  })
}

export function canGoBack() {
  return currentDepth > 1
}
