import { getSessionUser, serviceClient as db } from '@/lib/auth';
import { mobileJson, uuidPattern } from '@/lib/mobile-auth';
import { labStripePilot, checkedLabStripe, packageFor } from '@/lib/lab-stripe';
import { createNativeLabPayment } from '@/lib/lab-stripe-native';
export const runtime = 'nodejs';
export async function POST(request) {
  const user = await getSessionUser(request, { allowSuspended: true });
  if (!user) return mobileJson({ error: 'Unauthorized' }, 401);
  const body = await request.json().catch(() => null);
  if (!body || body.action !== 'payment' || !uuidPattern.test(body.id || '') || !packageFor(body.package)) return mobileJson({ error: 'Invalid purchase' }, 400);
  if (!labStripePilot(user)) return mobileJson({ error: 'Native sandbox payments are unavailable for this account.' }, 403);
  try {
    const stripe = await checkedLabStripe();
    return mobileJson(await createNativeLabPayment(db, stripe, user.id, body.id, body.package));
  } catch (error) {
    const conflict = /PURCHASE_PENDING|SUBSCRIPTION_EXISTS|USE_MONTHLY_ALLOWANCE_FIRST|IDENTITY_MISMATCH|ACCOUNT_UNAVAILABLE|BILLING_REVIEW/.test(error.message);
    return mobileJson({ error: conflict ? 'Check your pending payments and remaining allowance before purchasing.' : 'Payment is not ready. Check purchases before trying again.' }, conflict ? 409 : 503);
  }
}
