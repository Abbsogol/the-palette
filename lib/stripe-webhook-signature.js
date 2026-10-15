// Keep the retiring endpoint secret only for Stripe's configured overlap window.
// Signature verification still uses the untouched raw request body and SDK clock.
export function verifyStripeSignature(stripe, body, signature, current, previous) {
  if (!current) throw Error('STRIPE_WEBHOOK_CONFIGURATION');
  try { return stripe.webhooks.constructEvent(body, signature, current); }
  catch {
    if (!previous || previous === current) throw Error('STRIPE_WEBHOOK_SIGNATURE');
    try { return stripe.webhooks.constructEvent(body, signature, previous); }
    catch { throw Error('STRIPE_WEBHOOK_SIGNATURE'); }
  }
}
