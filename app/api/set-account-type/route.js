import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const VALID_TYPES = ['user', 'creator', 'salon']

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { accountType, displayName } = await request.json()

  if (!VALID_TYPES.includes(accountType)) {
    return Response.json({ error: 'Invalid account type' }, { status: 400 })
  }

  const update = { account_type: accountType }
  if (displayName) update.display_name = displayName

  const { error } = await supabase.from('profiles_data').update(update).eq('id', user.id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
