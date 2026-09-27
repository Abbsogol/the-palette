import { serviceClient as supabase } from '@/lib/auth'
import { ownedNailLabPath } from '@/lib/storage-path'

export const generationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function generationResult(userId, requestId) {
  const { data: generation, error } = await supabase.from('nail_lab_generations')
    .select('id,image_url').eq('id', requestId).eq('user_id', userId).single()
  if (error || !generation) throw new Error('Saved generation unavailable')
  const path = ownedNailLabPath(generation.image_url, userId)
  if (!path) throw new Error('Saved image unavailable')
  const { data: signed, error: signError } = await supabase.storage.from('nail-lab').createSignedUrl(path, 3600)
  if (signError || !signed?.signedUrl) throw new Error('Unable to prepare saved image')
  const { data: profile } = await supabase.from('profiles_data').select('credit_balance').eq('id', userId).single()
  return { generationId: generation.id, imageUrl: signed.signedUrl, creditsRemaining: profile?.credit_balance ?? null }
}
