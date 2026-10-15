import { getSessionUser, serviceClient as db } from '@/lib/auth';
import { mobileJson, uuidPattern } from '@/lib/mobile-auth';
import { labStripePilot, checkedLabStripe, createLabStripeCheckout, reconcileLabStripe, cancelLabStripe, packageFor } from '@/lib/lab-stripe';
export async function POST(request) {
  const user = await getSessionUser(request, { allowSuspended: true });
  if (!user) return mobileJson({ error: 'Unauthorized' }, 401);
  const body = await request.json().catch(() => null);
  if (!body || !['checkout', 'check', 'cancelSubscription'].includes(body.action)) return mobileJson({ error: 'Invalid billing action' }, 400);
  if (body.action === 'checkout' && (!uuidPattern.test(body.id || '') || !packageFor(body.package))) return mobileJson({ error: 'Invalid package or purchase ID' }, 400);
  // Cancellation/recovery remains available after pilot enrolment is removed.
  if (!labStripePilot(user)) {
    const binding = await db.from('lab_stripe_customers').select('user_id').eq('user_id', user.id).maybeSingle();
    if (body.action === 'checkout' || !binding.data) return mobileJson({ error: 'Sandbox checkout is not available for this account.' }, 403);
  }
  try {
    const stripe = await checkedLabStripe();
    if (body.action === 'checkout') return mobileJson(await createLabStripeCheckout(db, stripe, user.id, body.id, body.package));
    if (body.action === 'cancelSubscription') return mobileJson({ verified: true, ...(await cancelLabStripe(db, stripe, user.id)) });
    return mobileJson({ verified: true, ...(await reconcileLabStripe(db, stripe, user.id)) });
  } catch (error) {
    const conflict = /PURCHASE_PENDING|SUBSCRIPTION_EXISTS|USE_MONTHLY_ALLOWANCE_FIRST|CHECKOUT_IDENTITY_MISMATCH|ACCOUNT_UNAVAILABLE|BILLING_REVIEW/.test(error.message);
    return mobileJson({ error: conflict ? 'This purchase cannot be started. Check pending payments, subscription status and your remaining monthly allowance.' : 'Payment verification is pending. Do not purchase again. Check purchases shortly.' }, conflict ? 409 : 503);
  }
}
