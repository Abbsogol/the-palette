import { assertDeploymentBoundary } from './deployment-security.mjs';

export async function verifyStripeEnvironment(stripe, env = process.env) {
  if (!env.MOBILE_ENVIRONMENT && !env.VERCEL_ENV) return; // Existing offline contract fixtures.
  assertDeploymentBoundary(env);
  const live = env.MOBILE_ENVIRONMENT === 'production';
  if (env.STRIPE_MODE !== (live ? 'live' : 'test') || !/^acct_[A-Za-z0-9]+$/.test(env.STRIPE_ACCOUNT_ID || '')) throw new Error('STRIPE_BINDING_CONFIGURATION');
  const account = await stripe.accounts.retrieve();
  if (account.id !== env.STRIPE_ACCOUNT_ID) throw new Error('STRIPE_ACCOUNT_MISMATCH');
  // Retrieve the explicit catalog using this exact account/key. A foreign Price
  // or wrong mode cannot be used, even when its ID looks syntactically valid.
  for (const name of ['STRIPE_PRICE_PREMIUM','STRIPE_PRICE_PRO_CREATOR']) {
    if (!env[name]) continue;
    const price = await stripe.prices.retrieve(env[name]);
    if (price.id !== env[name] || price.livemode !== live || price.active !== true) throw new Error('STRIPE_CATALOG_MISMATCH');
  }
}
export function verifyStripeEventMode(event, env = process.env) {
  if (!env.MOBILE_ENVIRONMENT && !env.VERCEL_ENV) return;
  if (event.livemode !== (env.MOBILE_ENVIRONMENT === 'production') || event.account) throw new Error('STRIPE_EVENT_ENVIRONMENT');
}
