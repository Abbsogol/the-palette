import { all, customerFor, packageFor, stripeId, verifyCharge, verifyInvoice } from './lab-stripe';
const must = (value, message = 'NATIVE_PAYMENT_VERIFICATION_FAILED') => { if (!value) throw new Error(message); };
const result = r => { if (r.error) throw new Error(r.error.message); return r.data; };

export function nativeLabConfigured() {
  return process.env.LAB_STRIPE_NATIVE_ENABLED === '1' && /^pk_test_[A-Za-z0-9]+$/.test(process.env.LAB_STRIPE_PUBLISHABLE_KEY || '');
}
export function verifyNativeResource(resource, checkout, customer) {
  const pack = packageFor(checkout.package);
  must(pack && resource?.livemode === false && stripeId(resource.customer) === customer);
  if (pack.key === 'monthly') {
    must(!checkout.subscription_id || checkout.subscription_id === resource.id);
    must(!resource.items?.has_more && resource.items?.data.length === 1 && resource.items.data[0].quantity === 1 && resource.items.data[0].price.id === pack.priceId);
    must(resource.collection_method === 'charge_automatically' && !resource.trial_end && !resource.discount && !resource.discounts?.length);
  } else {
    must(!checkout.payment_intent || checkout.payment_intent === resource.id);
    must(resource.amount === pack.amount && resource.currency === 'usd');
  }
  return resource;
}
async function resourceFor(stripe, checkout, customer) {
  const monthly = checkout.package === 'monthly';
  const id = monthly ? checkout.subscription_id : checkout.payment_intent;
  const api = monthly ? stripe.subscriptions : stripe.paymentIntents;
  if (id) return verifyNativeResource(await api.retrieve(id, monthly ? { expand: ['latest_invoice.confirmation_secret'] } : { expand: ['latest_charge'] }), checkout, customer);
  // Recovery metadata is only used before the first-class provider ID is durably bound.
  const matches = (await all(api.list.bind(api), { customer, ...(monthly ? { status: 'all' } : {}) })).filter(item => item.metadata?.laque_native_checkout === checkout.id);
  must(matches.length <= 1, 'NATIVE_PAYMENT_DUPLICATE');
  return matches.length ? verifyNativeResource(await api.retrieve(matches[0].id, monthly ? { expand: ['latest_invoice.confirmation_secret'] } : { expand: ['latest_charge'] }), checkout, customer) : null;
}
export async function createNativeLabPayment(db, stripe, userId, purchaseId, key) {
  must(nativeLabConfigured(), 'NATIVE_NOT_CONFIGURED');
  const id = purchaseId.toLowerCase();
  const checkout = result(await db.rpc('begin_lab_stripe_native_checkout', { p_user_id: userId, p_id: id, p_package: key }));
  const customer = await customerFor(db, stripe, userId);
  let resource = await resourceFor(stripe, checkout, customer);
  if (!resource) {
    must(Date.now() - new Date(checkout.created_at).getTime() < 23 * 3600000, 'CHECKOUT_RECOVERY_REQUIRED');
    const metadata = { laque_native_checkout: id };
    const options = { idempotencyKey: `lab-native:${id}` };
    resource = key === 'monthly' ? await stripe.subscriptions.create({
      customer, items: [{ price: packageFor(key).priceId }], payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata, expand: ['latest_invoice.confirmation_secret'],
    }, options) : await stripe.paymentIntents.create({
      customer, amount: packageFor(key).amount, currency: 'usd', metadata,
      automatic_payment_methods: { enabled: true },
      payment_method_configuration: 'pmc_1UOYiG2MrQDGVNukvudFhRte',
    }, options);
    verifyNativeResource(resource, checkout, customer);
  }
  result(await db.rpc('bind_lab_stripe_native_resource', { p_user_id: userId, p_id: id, p_resource: resource.id }));
  const payable = key === 'monthly' ? resource.status === 'incomplete' : ['requires_payment_method','requires_action','requires_confirmation'].includes(resource.status);
  const clientSecret = payable ? key === 'monthly' ? resource.latest_invoice?.confirmation_secret?.client_secret : resource.client_secret : null;
  if (payable) must(typeof clientSecret === 'string' && clientSecret.startsWith('pi_'), 'NATIVE_SECRET_UNAVAILABLE');
  return { id, sandbox: true, pending: true, clientSecret, publishableKey: process.env.LAB_STRIPE_PUBLISHABLE_KEY };
}
export async function nativeLabSnapshot(stripe, checkout, customer) {
  const resource = await resourceFor(stripe, checkout, customer);
  if (!resource) {
    if (Date.now() - new Date(checkout.created_at).getTime() <= 24 * 3600000) return null;
    return { checkout: { id: checkout.id, package: checkout.package, sessionId: checkout.session_id, status: 'failed', subscriptionId: null, paymentIntent: null, expiresAt: null }, review: false };
  }
  const item = { id: checkout.id, package: checkout.package, sessionId: checkout.session_id, expiresAt: null, refundedUnits: 0,
    status: 'open', subscriptionId: checkout.package === 'monthly' ? resource.id : null, paymentIntent: checkout.package === 'monthly' ? null : resource.id };
  if (checkout.package !== 'monthly') {
    item.status = resource.status === 'succeeded' ? 'paid' : resource.status === 'canceled' ? 'expired' : 'open';
    if (item.status !== 'paid') return { checkout: item, review: false };
    const payment = verifyCharge(resource, customer, packageFor(checkout.package).amount);
    item.refundedUnits = Math.ceil(packageFor(checkout.package).designs * payment.refunded / packageFor(checkout.package).amount);
    return { checkout: item, review: payment.disputed };
  }
  const invoices = await all(stripe.invoices.list.bind(stripe.invoices), { subscription: resource.id, status: 'paid' });
  const verified = [];
  let review = false;
  for (const invoice of invoices) {
    const receipt = verifyInvoice(invoice, resource.id, customer);
    const payments = (await all(stripe.invoicePayments.list.bind(stripe.invoicePayments), { invoice: invoice.id })).filter(p => p.status === 'paid');
    must(payments.length === 1 && payments[0].livemode === false && payments[0].currency === 'usd' && stripeId(payments[0].invoice) === invoice.id && payments[0].payment.type === 'payment_intent' && payments[0].amount_paid === 500);
    receipt.paymentIntent = stripeId(payments[0].payment.payment_intent);
    const payment = verifyCharge(await stripe.paymentIntents.retrieve(receipt.paymentIntent, { expand: ['latest_charge'] }), customer, 500);
    receipt.refunded = payment.refunded > 0; review ||= payment.disputed;
    verified.push(receipt);
  }
  // A subscription status alone never grants the 15-design allowance.
  item.status = verified.length ? 'paid' : ['canceled','incomplete_expired'].includes(resource.status) ? 'expired' : 'open';
  return { checkout: item, review, subscription: verified.length ? { id: resource.id, status: resource.status, cancelAtPeriodEnd: resource.cancel_at_period_end, invoices: verified } : null };
}
