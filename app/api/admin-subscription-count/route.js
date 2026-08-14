import { getSessionUser, isAdmin, serviceClient as supabase } from '@/lib/auth'

export async function GET(request) {
  const user = await getSessionUser(request)
  if (!user || !(await isAdmin(user.id))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // profiles_data, not the profiles view — subscription_tier is masked
  // behind auth.uid() = id in the view, always null for other users' rows.
  const { count, error } = await supabase
    .from('profiles_data')
    .select('*', { count: 'exact', head: true })
    .not('subscription_tier', 'is', null)

  if (error) {
    console.error('admin-subscription-count error:', error)
    return Response.json({ error: 'Failed to load count' }, { status: 500 })
  }

  return Response.json({ count })
}
