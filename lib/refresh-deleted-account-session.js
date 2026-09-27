// refreshSession() without an explicit session acquires Supabase Auth's lock
// before reading the latest stored refresh token. A deleted account's invalid
// session is removed by the SDK; a different valid account is preserved.
// Calling global signOut after an asynchronous deletion could sign out that
// newly selected account instead.
export async function refreshDeletedAccountSession(auth, deletedUserId) {
  await auth.refreshSession()
  const { data, error } = await auth.getSession()
  if (error || data?.session?.user?.id === deletedUserId) {
    throw error || new Error('The deleted account session is still present')
  }
}
