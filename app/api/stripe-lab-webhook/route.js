import { serviceClient as db } from '@/lib/auth';
import { verifyStripeSignature } from '@/lib/stripe-webhook-signature';
import { labStripeClient, checkedLabStripe, stripeId, reconcileLabStripe } from '@/lib/lab-stripe';
export const runtime = 'nodejs';
const events = new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired','invoice.paid','invoice.payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','charge.refunded','charge.dispute.created','charge.dispute.closed','refund.updated','payment_intent.succeeded','payment_intent.payment_failed','payment_intent.canceled']);
export async function POST(request) {
  let event;
  try {
    if (Number(request.headers.get('content-length')) > 1000000) return new Response('Too large', { status: 413 });
    const raw = await request.text();
    if (raw.length > 1000000) return new Response('Too large', { status: 413 });
    event = verifyStripeSignature(labStripeClient(), raw, request.headers.get('stripe-signature'), process.env.LAB_STRIPE_WEBHOOK_SECRET, process.env.LAB_STRIPE_WEBHOOK_PREVIOUS_SECRET);
    if (event.livemode !== false) throw new Error('Wrong environment');
  } catch { return new Response('Invalid webhook', { status: 400 }); }
  if (!events.has(event.type)) return Response.json({ received: true });
  try {
    const stripe = await checkedLabStripe();
    const object = event.data.object;
    let customer = stripeId(object.customer);
    if (!customer && object.charge) customer = stripeId((await stripe.charges.retrieve(stripeId(object.charge))).customer);
    if (!customer) return Response.json({ received: true });
    const binding = await db.from('lab_stripe_customers').select('user_id').eq('customer_id', customer).maybeSingle();
    if (binding.error) throw binding.error;
    if (!binding.data) return Response.json({ received: true });
    // The signed event is a wake-up signal. Fetch current provider state under a
    // shared lease; delayed events cannot roll back a newer renewal or refund.
    const result = await reconcileLabStripe(db, stripe, binding.data.user_id);
    if (result.pending) return new Response('Retry verification', { status: 503 });
    return Response.json({ received: true });
  } catch { return new Response('Retry verification', { status: 503 }); }
}
