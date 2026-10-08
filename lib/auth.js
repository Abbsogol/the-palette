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
export async function getSessionUser(request, { allowDeleting = false, allowSuspended = false } = {}) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  try {
    const { data, error } = await anonClient.auth.getUser(token)
    if (error || !data?.user) return null
    if (!allowDeleting) {
      const { data: profile, error: profileError } = await serviceClient.from('profiles_data')
        .select('deletion_started_at').eq('id', data.user.id).single()
      if (profileError || !profile || profile.deletion_started_at) return null
    }
    if (!allowSuspended && !['GET','HEAD'].includes(request.method || 'GET')) {
      const { data: suspended, error: statusError } = await serviceClient.rpc('account_is_suspended', { p_id: data.user.id })
      if (statusError || suspended) return null
    }
    return data.user
  } catch { return null }

}

// Legacy flags no longer grant administrative authority. Use adminIdentity.
export async function isAdmin() { return false }
