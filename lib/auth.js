import { createClient } from '@supabase/supabase-js'

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Verifies the bearer token on a request and returns the real signed-in user, or null.
export async function getSessionUser(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    console.error('[DEBUG getSessionUser] no bearer token on request')
    return null
  }

  const { data, error } = await anonClient.auth.getUser(token)
  if (error || !data?.user) {
    console.error('[DEBUG getSessionUser] anonClient.auth.getUser failed:', error?.message, error?.status)
    return null
  }
  return data.user
}

export async function isAdmin(userId) {
  if (!userId) {
    console.error('[DEBUG isAdmin] no userId passed in')
    return false
  }

  const { data, error } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data) {
    console.error('[DEBUG isAdmin] query failed for userId', userId, '-', error?.message, error?.code)
    return false
  }
  console.error('[DEBUG isAdmin] userId', userId, 'is_admin value:', data.is_admin)
  return !!data.is_admin
}
