import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { stripeId } from '@/lib/subscription-plans'
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY)
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}})
export async function GET(request) {
  const user=await getSessionUser(request)
  if(!user)return json({error:'Unauthorized'},401)
  const id=new URL(request.url).searchParams.get('session_id')
  if(!id || !id.startsWith('cs_'))return json({error:'Invalid checkout'},400)
  try {
    const session=await stripe.checkout.sessions.retrieve(id)
    if(session.mode!=='subscription' || session.metadata?.userId!==user.id)return json({error:'Checkout not found'},404)
    const {data:profile,error}=await supabase.from('profiles_data').select('stripe_subscription_id,stripe_customer_id,subscription_tier').eq('id',user.id).single()
    if(error)throw error
    const paid=['paid','no_payment_required'].includes(session.payment_status)
    if(paid && profile?.subscription_tier && profile.stripe_subscription_id===stripeId(session.subscription) && profile.stripe_customer_id===stripeId(session.customer)) {
      return json({status:'fulfilled',planId:profile.subscription_tier})
    }
    return json({status:'pending'})
  } catch {return json({error:'Unable to confirm subscription'},503)}
}
