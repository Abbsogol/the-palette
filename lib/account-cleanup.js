import { purgeAccountData } from '@/lib/account-purge'

export async function removeAccountFiles(supabase, userId, batches = 10) {
  for (let batch = 0; batch < batches; batch++) {
    const { data: objects, error } = await supabase.rpc('account_storage_objects', { p_user_id: userId })
    if (error || !Array.isArray(objects)) throw new Error('Storage listing unavailable')
    if (!objects.length) return true
    for (const [bucket, entries] of Map.groupBy(objects, object => object.bucket_id)) {
      for (let offset = 0; offset < entries.length; offset += 100) {
        const { error: removeError } = await supabase.storage.from(bucket).remove(entries.slice(offset, offset + 100).map(object => object.name))
        if (removeError) throw new Error('Storage cleanup pending')
      }
    }
  }
  return false
}

export async function processAccountCleanup(supabase, stripe) {
  const { error: expiryError } = await supabase.rpc('purge_expired_account_legal_records', { p_limit: 1000 })
  if (expiryError) throw new Error('Legal record expiry cleanup unavailable')
  const { data: jobs, error } = await supabase.rpc('claim_account_cleanup', { p_limit: 3 })
  if (error) throw new Error('Account cleanup queue unavailable')
  const result = { closedAccountsChecked: 0, accountCleanupPending: 0, failed: 0 }
  for (const job of jobs || []) {
    let issue = null, pending = false
    try {
      // RLS/API closure takes effect before this asynchronous Auth ban. Session
      // JWTs are already denied and there is no supported unban/restore flow.
      let authErased = !!job.auth_erased_at
      if (!authErased) {
        const { data, error: lookupError } = await supabase.auth.admin.getUserById(job.user_id)
        if (lookupError) throw new Error('Auth status pending')
        authErased = !!data?.user?.deleted_at
      }
      if (!authErased) {
        const { error: authError } = await supabase.auth.admin.updateUserById(job.user_id, { ban_duration: '876000h' })
        if (authError) throw new Error('Auth cleanup pending')
      }
      if (!(await removeAccountFiles(supabase, job.user_id))) throw new Error('File cleanup continues in next batch')
      if (!authErased) {
        // Supabase soft deletion is irreversible and erases credentials/identity
        // while preserving the UUID needed for outstanding financial records.
        const { error: eraseError } = await supabase.auth.admin.deleteUser(job.user_id, true)
        if (eraseError) throw new Error('Auth erasure pending')
        const { error: stateError } = await supabase.from('account_closures').update({ auth_erased_at: new Date().toISOString() }).eq('user_id', job.user_id).eq('claim_token', job.claim_token)
        if (stateError) throw new Error('Auth erasure status pending')
      }
      const { error: contentError } = await supabase.rpc('erase_closed_account_content', { p_user_id: job.user_id })
      if (contentError) throw new Error('Content cleanup pending')
      const response = await purgeAccountData(supabase, stripe, job.user_id)
      if (!response.ok) {
        pending = true
        issue = response.status === 409 ? 'Financial settlement or retention review pending' : 'Account cleanup retry required'
        if (response.status !== 409) result.failed++
      }
      result.closedAccountsChecked++
    } catch (error) {
      pending = true; result.failed++
      issue = error.message
    }
    if (pending) {
      result.accountCleanupPending++
      const { error: saveError } = await supabase.from('account_closures').update({ last_error: issue, lease_until: null, claim_token: null, retry_at: new Date(Date.now() + (issue?.includes('retention') ? 86400000 : 900000)).toISOString() }).eq('user_id', job.user_id).eq('claim_token', job.claim_token)
      if (saveError) result.failed++
    }
  }
  return result
}
