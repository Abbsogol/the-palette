import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
export async function POST(request) {
  const user=await getSessionUser(request)
  if (!user) return Response.json({ error:'Unauthorized' },{ status:401 })
  try {
    const {bookingId}=await request.json()
    if (typeof bookingId!=='string' || !bookingId) return Response.json({ error:'Missing bookingId' },{ status:400 })
    for(let retry=0;retry<2;retry++) {
      const {data:attempt,error}=await supabase.rpc('reserve_deposit_checkout',{
        p_user_id:user.id,p_booking_id:bookingId,p_base_url:process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app',
      })
      if(error) {
        if(error.message?.includes('BOOKING_NOT_FOUND')) return Response.json({error:'Booking not found'},{status:404})
        if(error.message?.includes('NO_DEPOSIT_REQUIRED')) return Response.json({error:'No deposit required'},{status:400})
        if(error.message?.includes('BOOKING_NOT_PAYABLE')) return Response.json({error:'This booking cannot accept a deposit'},{status:409})
        throw error
      }
      if(attempt.session_id) {
        const session=await stripe.checkout.sessions.retrieve(attempt.session_id)
        if(session.status==='expired') {
          const {error:expiryError}=await supabase.from('deposit_checkouts').delete().eq('id',attempt.id).eq('user_id',user.id)
          if(expiryError)throw expiryError
          continue
        }
        if(session.status!=='open' || !session.url) return Response.json({error:'Your deposit is being processed. Please wait.'},{status:409})
        return Response.json({url:session.url})
      }
      if(Date.now()-new Date(attempt.created_at).getTime()>23*3600000) return Response.json({error:'Your previous checkout needs support review before retrying.'},{status:503})
      const metadata={type:'deposit',bookingId,userId:user.id,checkoutAttemptId:attempt.id}
      const session=await stripe.checkout.sessions.create({
        integration_identifier:'laque_checkout_qmrtxvpa',mode:'payment',
        line_items:[{price_data:{currency:'aed',product_data:{name:`Deposit — ${attempt.service_name}`},unit_amount:attempt.amount},quantity:1}],
        metadata,payment_intent_data:{metadata},
        success_url:`${attempt.base_url}/appointments/deposit-success?booking=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:`${attempt.base_url}/appointments`,
      },{idempotencyKey:`deposit-${attempt.id}`})
      const {data:saved,error:saveError}=await supabase.from('deposit_checkouts').update({session_id:session.id}).eq('id',attempt.id).eq('user_id',user.id).select('id').single()
      if(saveError || !saved)throw saveError || new Error('Checkout was not saved')
      return Response.json({url:session.url})
    }
    return Response.json({error:'Checkout changed. Please retry.'},{status:409})
  } catch(error) {
    console.error('Deposit checkout failed:',error)
    return Response.json({error:'Unable to prepare deposit checkout'},{status:503})
  }
}
