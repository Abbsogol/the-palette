import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { releaseSubscriptionCheckout } from '@/lib/subscription-checkout'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  const user = await getSessionUser(request, { allowDeleting:true })
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const billingFields = 'subscription_tier,stripe_subscription_id,subscription_status'
    let { data: profile, error: profileError } = await supabase.from('profiles_data')
      .select(billingFields).eq('id', user.id).single()
    if (profileError || !profile) throw profileError || new Error('Account unavailable')
    const { data: pendingCheckout, error: checkoutError } = await supabase.from('subscription_checkouts')
      .select('id, session_id').eq('user_id', user.id).maybeSingle()
    if (checkoutError) throw checkoutError
    let checkout = pendingCheckout
    if (checkout?.session_id) {
      if (await releaseSubscriptionCheckout(supabase, stripe, user.id, checkout)) {
        checkout = null
        ;({ data: profile, error: profileError } = await supabase.from('profiles_data')
          .select(billingFields).eq('id', user.id).single())
        if (profileError || !profile) throw profileError || new Error('Account unavailable')
      }
    }
    const billableSubscription = profile.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(profile.subscription_status)
    if ((profile.subscription_tier && profile.subscription_tier !== 'free') || billableSubscription || checkout) {
      return Response.json({ error: 'Please cancel your subscription or let your pending checkout expire before deleting your account. Contact support if checkout could not be confirmed.' }, { status: 409 })
    }
    for (const table of ['deposit_checkouts','payment_checkouts']) {
      const { data: attempts, error: attemptsError } = await supabase.from(table).select('id,session_id').eq('user_id',user.id)
      if (attemptsError) throw attemptsError
      for (const attempt of attempts || []) {
        if (!attempt.session_id) return Response.json({error:'A payment checkout needs review before deleting your account.'},{status:409})
        const session=await stripe.checkout.sessions.retrieve(attempt.session_id)
        if (session.status!=='expired') return Response.json({error:'Finish your payment or let checkout expire before deleting your account.'},{status:409})
        const {error:expiryError}=await supabase.from(table).delete().eq('id',attempt.id).eq('user_id',user.id)
        if(expiryError)throw expiryError
      }
    }
    const { error: beginError } = await supabase.rpc('begin_account_deletion', { p_user_id:user.id })
    if (beginError) return Response.json({ error: 'Finish any in-progress generation, payment or refund before deleting your account. Contact support if a payment needs attention.' }, { status:409 })
    // Remove object bytes with the Storage API before deleting ownership rows.
    // A failed cleanup leaves the account signed in and can safely be retried.
    // Fetch bounded batches: Supabase may cap RPC row counts at 1000.
    for (let batch = 0; batch < 100; batch++) {
      const { data: objects, error } = await supabase.rpc('account_storage_objects', { p_user_id: user.id })
      if (error || !Array.isArray(objects)) throw error || new Error('Could not list account files')
      if (!objects.length) {
        const { error: deleteError } = await supabase.rpc('delete_account', { p_user_id: user.id })
        if (deleteError) throw deleteError
        return Response.json({ ok: true })
      }
      const buckets = Map.groupBy(objects, object => object.bucket_id)
      for (const [bucket, entries] of buckets) {
        for (let offset = 0; offset < entries.length; offset += 100) {
          const { error: removeError } = await supabase.storage.from(bucket).remove(entries.slice(offset, offset + 100).map(object => object.name))
          if (removeError) throw removeError
        }
      }
    }
    return Response.json({ error: 'File cleanup is still in progress. Please retry to finish deleting your account.' }, { status: 503 })
  } catch (error) {
    console.error('Account deletion failed:', error)
    return Response.json({ error: 'Your account could not be deleted. Please retry; some files may already have been removed.' }, { status: 503 })
  }
}
