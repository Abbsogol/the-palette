// Persist a stable private reference, never a bearer token from a signed URL.
export function privateImageLocation(reference) {
  if (typeof reference !== 'string') return null
  try {
    if (/[\\%]/.test(reference.split(/[?#]/)[0])) return null
    const url = new URL(reference)
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin) return null
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(nail-lab|mobile-uploads|social-media)\/(.+)$/)
    if (!match || /[%\\]/.test(match[2]) || reference.split('/').some(part => part === '.' || part === '..')) return null
    return { bucket: match[1], path: match[2] }
  } catch { return null }
}
export function privateImagePath(reference) {
  const location = privateImageLocation(reference)
  return location?.bucket === 'nail-lab' ? location.path : null
}
export function persistentImageReference(reference) {
  const path = privateImagePath(reference)
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nail-lab/${path}` : reference
}
