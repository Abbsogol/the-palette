import { expect, it, vi, afterEach } from 'vitest';
import { deploymentErrors, publicEnvironmentErrors } from '../../lib/deployment-security.mjs';
import { verifyStripeEnvironment, verifyStripeEventMode } from '../../lib/stripe-environment';
const production = {
  MOBILE_ENVIRONMENT:'production', VERCEL_ENV:'production',
  MOBILE_SUPABASE_PROJECT_REF:'faunikvhoommbebsmevg', NEXT_PUBLIC_SUPABASE_URL:'https://faunikvhoommbebsmevg.supabase.co',
  NEXT_PUBLIC_APP_URL:'https://www.laque.app', MOBILE_API_ORIGIN:'https://www.laque.app',
  STRIPE_SECRET_KEY:'rk_live_synthetic', STRIPE_ACCOUNT_ID:'acct_synthetic', STRIPE_MODE:'live',
};
afterEach(()=>vi.unstubAllEnvs());
it('refuses production databases and keys in previews, mismatched origins and public credentials',()=>{
  expect(deploymentErrors({...production,VERCEL_ENV:'preview'})).toContain('VERCEL_ENV: production services forbidden in preview/development');
  expect(deploymentErrors({...production,MOBILE_ENVIRONMENT:'beta'})).not.toEqual([]);
  expect(deploymentErrors({...production,MOBILE_API_ORIGIN:'https://attacker.invalid'})).not.toEqual([]);
  expect(deploymentErrors({...production,VERCEL_PROJECT_ID:'prj_foreign'})).toContain('VERCEL_PROJECT_ID: hosting project mismatch');
  expect(deploymentErrors({...production,LAB_STRIPE_CHECKOUT_KEY:'rk_test_synthetic'})).not.toEqual([]);
  expect(publicEnvironmentErrors({EXPO_PUBLIC_PINTEREST_TOKEN_KEY:'sensitive'})).not.toEqual([]);
  expect(publicEnvironmentErrors({NEXT_PUBLIC_VERCEL_URL:'laque.app',NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:'synthetic'})).toEqual([]);
  expect(publicEnvironmentErrors({NEXT_PUBLIC_VERCEL_URL:'rk_live_sensitive'})).not.toEqual([]);
  expect(publicEnvironmentErrors({NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_synthetic'})).not.toEqual([]);
  const jwt='e30.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.test';
  expect(publicEnvironmentErrors({EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:jwt})).not.toEqual([]);
});
it('requires production restricted credentials and validates exact enabled callbacks without echoing values',()=>{
  expect(deploymentErrors({...production,STRIPE_SECRET_KEY:'sk_live_doNotEcho'}).join()).not.toContain('doNotEcho');
  expect(deploymentErrors({...production,GOOGLE_CALENDAR_ENABLED:'true',GOOGLE_CALENDAR_REDIRECT_URI:'https://beta.invalid/api/calendar/google/callback'})).not.toEqual([]);
  expect(deploymentErrors(production)).toEqual([]);
  expect(deploymentErrors(production,{complete:true})).toContain('CRON_SECRET: missing');
});
it('validates Stripe account and price mode before any consumer can mutate financial data',async()=>{
  const stripe={accounts:{retrieve:vi.fn(async()=>({id:'acct_wrong'}))},prices:{retrieve:vi.fn()}};
  await expect(verifyStripeEnvironment(stripe,production)).rejects.toThrow('STRIPE_ACCOUNT_MISMATCH');
  expect(stripe.prices.retrieve).not.toHaveBeenCalled();
  stripe.accounts.retrieve.mockResolvedValue({id:'acct_synthetic'});
  stripe.prices.retrieve.mockResolvedValue({id:'price_expected',active:true,livemode:false});
  await expect(verifyStripeEnvironment(stripe,{...production,STRIPE_PRICE_PREMIUM:'price_expected'})).rejects.toThrow('STRIPE_CATALOG_MISMATCH');
  stripe.prices.retrieve.mockResolvedValue({id:'price_expected',active:true,livemode:true});
  await expect(verifyStripeEnvironment(stripe,{...production,STRIPE_PRICE_PREMIUM:'price_expected'})).resolves.toBeUndefined();
});
it('rejects correctly signed wrong-mode or Connect events in a platform webhook',()=>{
  expect(()=>verifyStripeEventMode({livemode:false},production)).toThrow();
  expect(()=>verifyStripeEventMode({livemode:true,account:'acct_foreign'},production)).toThrow();
  expect(()=>verifyStripeEventMode({livemode:true},production)).not.toThrow();
});
