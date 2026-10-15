import Stripe from 'stripe';
import { nativeLabSnapshot } from './lab-stripe-native';
import { LAB_STRIPE_SANDBOX, assertLabSandboxKey, verifyLabStripeSandbox } from './lab-stripe-sandbox.mjs';

const origin = `https://${LAB_STRIPE_SANDBOX.domain}`;
export const stripeId = value => typeof value === 'string' ? value : value?.id;
const date = seconds => { if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error('INVALID_PROVIDER_DATE'); return new Date(seconds * 1000).toISOString(); };
const must = (condition, message = 'PAYMENT_VERIFICATION_FAILED') => { if (!condition) throw new Error(message); };
export const packageFor = key => LAB_STRIPE_SANDBOX.products.find(item => item.key === key);

// Separate credentials and a verified-account pilot. Never a live fallback.
export function labStripeConfigured() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://atjwbdrvgljddedtwoqo.supabase.co' &&
    process.env.NEXT_PUBLIC_APP_URL === origin && !!process.env.LAB_STRIPE_CHECKOUT_KEY && !!process.env.LAB_STRIPE_WEBHOOK_SECRET;
}
export function labStripePilot(user) {
  return labStripeConfigured() && process.env.LAB_STRIPE_SANDBOX_CHECKOUT_ENABLED === '1' && !!user?.email_confirmed_at &&
    (process.env.LAB_STRIPE_SANDBOX_USERS || '').split(',').map(item => item.trim()).includes(user.id);
}
export function labStripeClient() {
  if (!labStripeConfigured()) throw new Error('SANDBOX_NOT_CONFIGURED');
  assertLabSandboxKey(process.env.LAB_STRIPE_CHECKOUT_KEY);
  return new Stripe(process.env.LAB_STRIPE_CHECKOUT_KEY, { apiVersion: '2026-08-26.dahlia', maxNetworkRetries: 2, timeout: 15000 });
}
export async function checkedLabStripe() {
  const stripe = labStripeClient();
  await verifyLabStripeSandbox(stripe);
  return stripe;
}
const result = response => { if (response.error) throw new Error(response.error.message); return response.data; };
const rows = async query => result(await query) || [];
export async function all(list, params) {
  const output = [];
  for await (const item of list({ ...params, limit: 100 })) {
    if (output.length >= 1000) throw new Error('PROVIDER_HISTORY_REQUIRES_REVIEW');
    output.push(item);
  }
  return output;
}

export function verifySession(session, checkout, customer, lines) {
  const pack = packageFor(checkout.package);
  must(pack && session.livemode === false && stripeId(session.customer) === customer && session.client_reference_id === checkout.id);
  must(!checkout.session_id || checkout.session_id === session.id);
  must(session.mode === (pack.key === 'monthly' ? 'subscription' : 'payment') && session.currency === 'usd' && session.amount_total === pack.amount);
  must(lines.length === 1 && lines[0].quantity === 1 && stripeId(lines[0].price) === pack.priceId && lines[0].amount_total === pack.amount);
  must(['open', 'complete', 'expired'].includes(session.status));
  must(['paid', 'unpaid'].includes(session.payment_status)); // No free/trial entitlement.
  return { id: checkout.id, package: pack.key, sessionId: session.id,
    expiresAt: date(session.expires_at), status: session.payment_status === 'paid' ? 'paid' : session.status === 'expired' ? 'expired' : 'open',
    subscriptionId: stripeId(session.subscription) || null, paymentIntent: stripeId(session.payment_intent) || null, refundedUnits: 0 };
}
export function verifyCharge(intent, customer, amount) {
  const charge = intent?.latest_charge;
  must(intent?.livemode === false && stripeId(intent.customer) === customer && intent.status === 'succeeded' && intent.currency === 'usd' && intent.amount_received === amount);
  must(charge && typeof charge === 'object' && charge.livemode === false && stripeId(charge.customer) === customer && stripeId(charge.payment_intent) === intent.id && charge.paid && charge.currency === 'usd' && charge.amount === amount);
  must(Number.isSafeInteger(charge.amount_refunded) && charge.amount_refunded >= 0 && charge.amount_refunded <= amount);
  return { refunded: charge.amount_refunded, disputed: charge.disputed === true };
}
export function verifyInvoice(invoice, subscriptionId, customer) {
  const pack = packageFor('monthly');
  const lines = invoice.lines?.data;
  must(invoice.livemode === false && stripeId(invoice.customer) === customer && stripeId(invoice.parent?.subscription_details?.subscription) === subscriptionId);
  must(invoice.status === 'paid' && invoice.currency === 'usd' && invoice.amount_paid === pack.amount && invoice.total === pack.amount &&
    ['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason));
  must(!invoice.lines?.has_more && lines?.length === 1 && lines[0].quantity === 1 && lines[0].amount === pack.amount &&
    lines[0].pricing?.price_details?.price === pack.priceId && stripeId(lines[0].parent?.subscription_item_details?.subscription) === subscriptionId);
  must(lines[0].period.end > lines[0].period.start);
  return { id: invoice.id, periodStart: date(lines[0].period.start), periodEnd: date(lines[0].period.end), refunded: false, paymentIntent: null };
}

export async function customerFor(db, stripe, userId) {
  const existing = result(await db.from('lab_stripe_customers').select('customer_id').eq('user_id', userId).maybeSingle());
  if (existing) return existing.customer_id;
  const customer = await stripe.customers.create({ metadata: { laque_account: userId } }, { idempotencyKey: `lab-beta-customer:${userId}` });
  must(customer.livemode === false);
  return result(await db.rpc('bind_lab_stripe_customer', { p_user_id: userId, p_customer: customer.id }));
}
export async function createLabStripeCheckout(db, stripe, userId, id, key) {
  id = id.toLowerCase(); // Postgres UUIDs and provider idempotency keys use one canonical identity.
  const checkout = result(await db.rpc('begin_lab_stripe_checkout', { p_user_id: userId, p_id: id, p_package: key }));
  const customer = await customerFor(db, stripe, userId);
  let session;
  if (checkout.session_id) session = await stripe.checkout.sessions.retrieve(checkout.session_id);
  else {
    // A creating intent is not abandoned on a network failure. Find a completed
    // provider request before reusing its immutable idempotency key.
    const sessions = await all(stripe.checkout.sessions.list.bind(stripe.checkout.sessions), { customer });
    session = sessions.find(item => item.client_reference_id === id);
    if (!session) {
      must(Date.now() - new Date(checkout.created_at).getTime() < 23 * 3600000, 'CHECKOUT_RECOVERY_REQUIRED');
      session = await stripe.checkout.sessions.create({
        customer, client_reference_id: id, mode: key === 'monthly' ? 'subscription' : 'payment',
        line_items: [{ price: packageFor(key).priceId, quantity: 1 }],
        payment_method_configuration: 'pmc_1UOYiG2MrQDGVNukvudFhRte',
        success_url: `${origin}/lab-payment?result=submitted`, cancel_url: `${origin}/lab-payment?result=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        integration_identifier: 'laque_lab_beta_qrwzmxpt',
      }, { idempotencyKey: `lab-beta-checkout:${id}` });
    }
  }
  const lines = await all(params => stripe.checkout.sessions.listLineItems(session.id, params), {});
  // SDK's listLineItems takes the session ID as its first positional argument.
  verifySession(session, checkout, customer, lines);
  result(await db.from('lab_stripe_checkouts').update({ session_id: session.id, expires_at: date(session.expires_at) }).eq('id', id).eq('user_id', userId));
  if (session.status !== 'open') return { id, pending: true, url: null };
  const url = new URL(session.url);
  must(url.protocol === 'https:' && url.hostname === 'checkout.stripe.com');
  return { id, url: url.href, pending: true };
}

async function paidCharge(stripe, id, customer, amount) {
  const intent = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] });
  return verifyCharge(intent, customer, amount);
}
export async function reconcileLabStripe(db, stripe, userId) {
  const customer = result(await db.from('lab_stripe_customers').select('customer_id').eq('user_id', userId).maybeSingle());
  if (!customer) return { pending: false };
  const token = result(await db.rpc('claim_lab_stripe_sync', { p_user_id: userId }));
  if (!token) return { pending: true };
  try {
    const checkouts = await rows(db.from('lab_stripe_checkouts').select('*').eq('user_id', userId).limit(1001));
    must(checkouts.length <= 1000, 'PROVIDER_HISTORY_REQUIRES_REVIEW');
    const recovered = checkouts.some(item => item.surface !== 'native' && !item.session_id) ? await all(stripe.checkout.sessions.list.bind(stripe.checkout.sessions), { customer: customer.customer_id }) : [];
    const snapshot = { accountId: LAB_STRIPE_SANDBOX.accountId, customerId: customer.customer_id, checkouts: [], subscriptions: [], review: false };
    for (const checkout of checkouts) {
      if (checkout.surface === 'native') {
        const native = await nativeLabSnapshot(stripe, checkout, customer.customer_id);
        if (native) {
          snapshot.checkouts.push(native.checkout);
          if (native.subscription) snapshot.subscriptions.push(native.subscription);
          snapshot.review ||= native.review;
        }
        continue;
      }
      const session = checkout.session_id ? await stripe.checkout.sessions.retrieve(checkout.session_id) : recovered.find(item => item.client_reference_id === checkout.id);
      if (!session) {
        // A full provider read must prove the abandoned intent never reached checkout.
        if (Date.now() - new Date(checkout.created_at).getTime() > 24 * 3600000) snapshot.checkouts.push({ id: checkout.id, package: checkout.package, sessionId: null, expiresAt: null, status: 'failed', subscriptionId: null, paymentIntent: null });
        continue;
      }
      const lines = await all(params => stripe.checkout.sessions.listLineItems(session.id, params), {});
      const item = verifySession(session, checkout, customer.customer_id, lines);
      if (item.status === 'paid' && checkout.package !== 'monthly') {
        const payment = await paidCharge(stripe, item.paymentIntent, customer.customer_id, packageFor(checkout.package).amount);
        item.refundedUnits = Math.ceil(packageFor(checkout.package).designs * payment.refunded / packageFor(checkout.package).amount);
        snapshot.review ||= payment.disputed;
      }
      snapshot.checkouts.push(item);
      if (item.status !== 'paid' || checkout.package !== 'monthly') continue;
      must(item.subscriptionId);
      const subscription = await stripe.subscriptions.retrieve(item.subscriptionId);
      must(subscription.livemode === false && stripeId(subscription.customer) === customer.customer_id && !subscription.items.has_more && subscription.items.data.length === 1 &&
        subscription.items.data[0].quantity === 1 && subscription.items.data[0].price.id === packageFor('monthly').priceId);
      const invoices = await all(stripe.invoices.list.bind(stripe.invoices), { subscription: subscription.id, status: 'paid' });
      const verified = [];
      for (const invoice of invoices) {
        const receipt = verifyInvoice(invoice, subscription.id, customer.customer_id);
        const payments = await all(stripe.invoicePayments.list.bind(stripe.invoicePayments), { invoice: invoice.id });
        const paid = payments.filter(p => p.status === 'paid');
        must(paid.length === 1 && paid[0].livemode === false && paid[0].currency === 'usd' && stripeId(paid[0].invoice) === invoice.id && paid[0].payment.type === 'payment_intent' && paid[0].amount_paid === 500);
        receipt.paymentIntent = stripeId(paid[0].payment.payment_intent);
        const payment = await paidCharge(stripe, receipt.paymentIntent, customer.customer_id, 500);
        receipt.refunded = payment.refunded > 0;
        snapshot.review ||= payment.disputed;
        verified.push(receipt);
      }
      snapshot.subscriptions.push({ id: subscription.id, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end, invoices: verified });
    }
    must(result(await db.rpc('finish_lab_stripe_sync', { p_user_id: userId, p_token: token, p_snapshot: snapshot })), 'VERIFICATION_LEASE_EXPIRED');
    return { pending: false };
  } finally {
    await db.rpc('release_lab_stripe_sync', { p_user_id: userId, p_token: token });
  }
}

export async function labStripeStatus(db, user) {
  if (!labStripeConfigured()) return null;
  const binding = result(await db.from('lab_stripe_customers').select('verified_at,needs_review').eq('user_id', user.id).maybeSingle());
  if (!labStripePilot(user) && !binding) return null;
  const pending = await rows(db.from('lab_stripe_checkouts').select('id,package,status,expires_at,surface').eq('user_id', user.id).in('status', ['creating', 'open']));
  const receipts = await rows(db.from('lab_stripe_checkouts').select('package,created_at,refunded_units').eq('user_id', user.id).eq('status', 'paid').neq('package', 'monthly').order('created_at', { ascending: false }).limit(20));
  const subscriptions = await rows(db.from('lab_stripe_subscriptions').select('id,status,cancel_at_period_end').eq('user_id', user.id).order('updated_at', { ascending: false }));
  return { sandbox: true, enabled: labStripePilot(user), native: /^pk_test_[A-Za-z0-9]+$/.test(process.env.LAB_STRIPE_PUBLISHABLE_KEY || '') && process.env.LAB_STRIPE_NATIVE_ENABLED === '1', packages: LAB_STRIPE_SANDBOX.products.map(p => ({ id: p.key, credits: p.designs, kind: p.key === 'monthly' ? 'subscription' : 'credits', price: `$${p.amount / 100}` })), pending, subscription: subscriptions.find(s => !['canceled', 'incomplete_expired'].includes(s.status)) || null,
    history: receipts.map(r => ({ store: 'STRIPE_LAB', environment: 'SANDBOX', productId: r.package, credits: packageFor(r.package).designs, purchasedAt: r.created_at, status: r.refunded_units ? 'refunded' : 'credited' })), verifiedAt: binding?.verified_at || null, needsReview: binding?.needs_review || false };
}
export async function cancelLabStripe(db, stripe, userId, immediate = false) {
  const binding = result(await db.from('lab_stripe_customers').select('customer_id').eq('user_id', userId).maybeSingle());
  if (!binding) return;
  await reconcileLabStripe(db, stripe, userId);
  const subscriptions = await rows(db.from('lab_stripe_subscriptions').select('id,status').eq('user_id', userId));
  if (immediate) {
    const unfinished = await rows(db.from('lab_stripe_checkouts').select('subscription_id').eq('user_id', userId).in('status', ['creating','open']));
    for (const checkout of unfinished) if (checkout.subscription_id && !subscriptions.some(s => s.id === checkout.subscription_id)) subscriptions.push({ id: checkout.subscription_id, status: 'incomplete' });
  }
  for (const sub of subscriptions) {
    if (['canceled', 'incomplete_expired'].includes(sub.status)) continue;
    const provider = await stripe.subscriptions.retrieve(sub.id);
    must(provider.livemode === false && stripeId(provider.customer) === binding.customer_id);
    if (immediate) await stripe.subscriptions.cancel(sub.id);
    else await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
  }
  if (immediate) {
    const checkouts = await rows(db.from('lab_stripe_checkouts').select('session_id,surface,payment_intent').eq('user_id', userId).in('status', ['creating', 'open']));
    for (const checkout of checkouts) if (checkout.session_id && checkout.surface !== 'native') {
      const session = await stripe.checkout.sessions.retrieve(checkout.session_id);
      must(stripeId(session.customer) === binding.customer_id && session.livemode === false);
      if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
    }
  }
  if (immediate) {
    const native = await rows(db.from('lab_stripe_checkouts').select('payment_intent').eq('user_id', userId).eq('surface', 'native').in('status', ['creating','open']));
    for (const item of native) if (item.payment_intent) {
      const intent = await stripe.paymentIntents.retrieve(item.payment_intent);
      must(intent.livemode === false && stripeId(intent.customer) === binding.customer_id);
      if (['requires_payment_method','requires_confirmation','requires_action'].includes(intent.status)) await stripe.paymentIntents.cancel(intent.id);
    }
  }
  return reconcileLabStripe(db, stripe, userId);
}
