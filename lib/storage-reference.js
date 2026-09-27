// Persist a stable private reference, never a bearer token from a signed URL.
export function privateImagePath(reference) {
  if (typeof reference !== 'string') return null
  try {
    const url = new URL(reference)
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin) return null
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/nail-lab\/(.+)$/)
    if (!match || /[%\\]/.test(match[1])) return null
    return match[1]
  } catch { return null }
}
export function persistentImageReference(reference) {
  const path = privateImagePath(reference)
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nail-lab/${path}` : reference
}
