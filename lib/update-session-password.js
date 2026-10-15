// Use the same Auth user endpoint as auth.updateUser, with the recovery
// session's captured bearer token. The shared SDK looks up its current session
// after acquiring an async lock, which may now belong to a different account.
export async function updateSessionPassword(session, password) {
  if (!session?.access_token || !session.user?.id) throw new Error('Please open your recovery link again.')
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.msg || result.message || result.error_description || 'Could not update your password. Please retry.')
  if (result.id !== session.user.id) throw new Error('Your password update could not be confirmed. Please sign in again.')
}
