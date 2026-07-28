import { createClient } from '@supabase/supabase-js'

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Verifies the bearer token on a request and returns the real signed-in user, or null.
export async function getSessionUser(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const { data, error } = await anonClient.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

// Reads profiles_data directly (not the profiles view) — the view masks
// privileged columns like is_admin behind `auth.uid() = id`, which is never
// true for a service-role caller, so it would always read as null here.
export async function isAdmin(userId) {
  if (!userId) return false

  const { data, error } = await serviceClient
    .from('profiles_data')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data) return false
  return !!data.is_admin
}
