import { AdminError } from './auth'

export function adminMediaPath(url) {
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/mobile-uploads/`
  if(typeof url!=='string'||!url.startsWith(prefix))return null
  const path=url.slice(prefix.length)
  const id='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
  return new RegExp(`^${id}/admin/${id}\\.webp$`,'i').test(path)?path:null
}
export async function adminMediaPreview(db,url,seconds=900) {
  const path=adminMediaPath(url)
  if(!path)return url
  const r=await db.storage.from('mobile-uploads').createSignedUrl(path,seconds)
  if(r.error||!r.data?.signedUrl)throw new AdminError('The image could not load. Retry later.',503)
  return r.data.signedUrl
}
