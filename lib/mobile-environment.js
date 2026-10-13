import contract from '@/mobile/environment-contract.json';
export function mobileBackendIdentity(env = process.env) {
  const environment = env.MOBILE_ENVIRONMENT;
  if (!Object.hasOwn(contract.schemes, environment || '')) throw new Error('Mobile environment is not configured');
  const db = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  const ref = env.MOBILE_SUPABASE_PROJECT_REF;
  const local = environment === 'development' && ['localhost','127.0.0.1'].includes(db.hostname);
  if (!ref || db.username || db.password || db.search || db.hash || !['','/'].includes(db.pathname) || !local && (db.port || db.protocol !== 'https:' || db.hostname !== `${ref}.supabase.co`) || local && !['https:','http:'].includes(db.protocol)) throw new Error('Backend database identity mismatch');
  const production = environment === 'production';
  if (production ? ref !== contract.productionProjectRef : ref === contract.productionProjectRef) throw new Error('Backend database environment mismatch');
  if (!production && env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('sk_test_')) throw new Error('Beta requires sandbox payments');
  let apiOrigin;
  if (env.MOBILE_API_ORIGIN) {
    const api = new URL(env.MOBILE_API_ORIGIN);
    if (api.username || api.password || api.search || api.hash || !['','/'].includes(api.pathname) || api.protocol !== 'https:' && !(environment === 'development' && api.protocol === 'http:' && ['localhost','127.0.0.1'].includes(api.hostname))) throw new Error('Invalid mobile API origin');
    apiOrigin = api.origin;
  }
  if (production && (!apiOrigin || !contract.productionApiOrigins.includes(apiOrigin)) || !production && contract.productionApiOrigins.includes(apiOrigin)) throw new Error('Backend API environment mismatch');
  return { environment, projectRef:ref, contractVersion:1, ...(apiOrigin ? {apiOrigin,appScheme:contract.schemes[environment]} : {}) };
}
export function environmentReturnSchemes(env = process.env) {
  const scheme = contract.schemes[env.MOBILE_ENVIRONMENT];
  // Legacy unlabelled servers may retain existing non-production returns only.
  return scheme ? [scheme] : ['laque','laque-dev'];
}
