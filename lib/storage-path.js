// Reject ambiguous/encoded paths before a privileged Storage request. Objects
// in nail-lab always begin with the verified user's ID, never a client ID.
export function ownedNailLabPath(reference, userId) {
  if (typeof reference !== 'string' || !userId || /[%\\?#\x00-\x20]/.test(reference)) return null
  let path = reference
  if (reference.includes('://')) {
    try {
      const url = new URL(reference)
      if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin) return null
      const prefix = '/storage/v1/object/public/nail-lab/'
      if (!url.pathname.startsWith(prefix)) return null
      // Inspect the raw input as well: URL parsing normalizes dot segments.
      if (reference.split('/').some(segment => segment === '.' || segment === '..')) return null
      path = url.pathname.slice(prefix.length)
    } catch { return null }
  }
  const parts = path.split('/')
  if (parts.length < 2 || parts[0] !== userId || parts.some(p => !p || p === '.' || p === '..')) return null
  return path
}
