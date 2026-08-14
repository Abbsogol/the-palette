import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// nail-lab is a private bucket; stored image_url values are non-fetchable path
// references, so resolve a short-lived signed URL for display.
export async function getNailLabSignedUrl(storedUrl) {
  if (!storedUrl) return null
  const marker = '/nail-lab/'
  const idx = storedUrl.indexOf(marker)
  const path = idx === -1 ? storedUrl : storedUrl.slice(idx + marker.length)
  const { data, error } = await supabase.storage.from('nail-lab').createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

// Batched version — one storage round trip for N paths instead of N.
// Returns a map of storedUrl -> signedUrl (or null on a per-path failure).
export async function getNailLabSignedUrls(storedUrls) {
  const marker = '/nail-lab/'
  const toPath = (storedUrl) => {
    const idx = storedUrl.indexOf(marker)
    return idx === -1 ? storedUrl : storedUrl.slice(idx + marker.length)
  }
  const uniqueUrls = [...new Set((storedUrls || []).filter(Boolean))]
  if (uniqueUrls.length === 0) return {}

  const paths = uniqueUrls.map(toPath)
  const { data, error } = await supabase.storage.from('nail-lab').createSignedUrls(paths, 3600)
  if (error) return {}

  const map = {}
  uniqueUrls.forEach((storedUrl, i) => { map[storedUrl] = data[i]?.error ? null : data[i]?.signedUrl || null })
  return map
}
