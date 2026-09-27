export async function paymentCheckout(supabase,stripe,userId,scope,params) {
  for(let retry=0;retry<2;retry++) {
    const {data:attempt,error}=await supabase.rpc('reserve_payment_checkout',{p_user_id:userId,p_scope:scope,p_params:params})
    if(error || !attempt)throw error || new Error('Checkout reservation unavailable')
    if(attempt.session_id) {
      const session=await stripe.checkout.sessions.retrieve(attempt.session_id)
      if(session.status==='expired') {
        const {error:removeError}=await supabase.from('payment_checkouts').delete().eq('id',attempt.id).eq('user_id',userId)
        if(removeError)throw removeError
        continue
      }
      if(session.status!=='open' || !session.url)throw new Error('Your payment is being processed. Please wait before purchasing again.')
      return session
    }
    if(Date.now()-new Date(attempt.created_at).getTime()>23*3600000)throw new Error('Your previous checkout needs support review before retrying.')
    const metadata={...attempt.params.metadata,checkoutAttemptId:attempt.id}
    const session=await stripe.checkout.sessions.create({
      ...attempt.params,metadata,
      payment_intent_data:{...attempt.params.payment_intent_data,metadata:{...attempt.params.payment_intent_data?.metadata,checkoutAttemptId:attempt.id}},
    },{idempotencyKey:`payment-${attempt.id}`})
    const {data:saved,error:saveError}=await supabase.from('payment_checkouts').update({session_id:session.id}).eq('id',attempt.id).eq('user_id',userId).select('id').single()
    if(saveError || !saved)throw saveError || new Error('Unable to save checkout')
    return session
  }
  throw new Error('Checkout changed. Please retry.')
}
