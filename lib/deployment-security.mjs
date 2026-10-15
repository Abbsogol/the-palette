import contract from '../mobile/environment-contract.json' with { type: 'json' };

export const publicEnvironmentNames = new Set([
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_DESIGN_PREVIEW', 'EXPO_PUBLIC_EAS_PROJECT_ID',
  'EXPO_PUBLIC_SUPABASE_PROJECT_REF', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_REVENUECAT_APPLE_KEY', 'EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY',
  // Vercel injects these documented public deployment metadata variables.
  ...['ENV','TARGET_ENV','URL','BRANCH_URL','PROJECT_PRODUCTION_URL','HASH_SALT',
    'GIT_PROVIDER','GIT_REPO_SLUG','GIT_REPO_OWNER','GIT_REPO_ID','GIT_COMMIT_REF',
    'GIT_COMMIT_SHA','GIT_COMMIT_MESSAGE','GIT_COMMIT_AUTHOR_LOGIN','GIT_COMMIT_AUTHOR_NAME',
    'GIT_PULL_REQUEST_ID'].map(name=>`NEXT_PUBLIC_VERCEL_${name}`),
]);
export function publicEnvironmentErrors(env) {
  const errors = [];
  for (const [name, value] of Object.entries(env)) {
    if (!/^(NEXT_PUBLIC_|EXPO_PUBLIC_)/.test(name) || !value) continue;
    if (!publicEnvironmentNames.has(name)) errors.push(`${name}: public variable is not approved`);
    if (/^(?:sk|rk)_(?:live|test)_|^sb_secret_|^whsec_/.test(value)) errors.push(`${name}: server credential in public configuration`);
    try {
      const payload = JSON.parse(Buffer.from(value.split('.')[1] || '', 'base64url').toString());
      if (payload.role === 'service_role') errors.push(`${name}: service credential in public configuration`);
    } catch {}
  }
  return errors;
}
const origin = value => { try { const u = new URL(value); return !u.username && !u.password && !u.search && !u.hash && ['','/'].includes(u.pathname) ? u.origin : null; } catch { return null; } };
export function deploymentErrors(env, { complete = false } = {}) {
  const errors = publicEnvironmentErrors(env);
  const production = env.MOBILE_ENVIRONMENT === 'production';
  const hosted = !!env.VERCEL_ENV;
  if (!production && !hosted && !env.MOBILE_ENVIRONMENT) return errors; // Offline tests and legacy local development.
  const db = origin(env.NEXT_PUBLIC_SUPABASE_URL), api = origin(env.MOBILE_API_ORIGIN || env.NEXT_PUBLIC_APP_URL);
  if (!['production','beta','development'].includes(env.MOBILE_ENVIRONMENT)) errors.push('MOBILE_ENVIRONMENT: explicit environment required');
  const hostingProjects={production:'prj_pJuRejR5TLJK5bWpoFBSrepCy12c',beta:'prj_SoMqxE3wuWJ2mN2oK5aFdkL0M7Lj'};
  if (env.VERCEL_PROJECT_ID && hostingProjects[env.MOBILE_ENVIRONMENT] && env.VERCEL_PROJECT_ID !== hostingProjects[env.MOBILE_ENVIRONMENT]) errors.push('VERCEL_PROJECT_ID: hosting project mismatch');
  if (production) {
    if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') errors.push('VERCEL_ENV: production services forbidden in preview/development');
    if (db !== `https://${contract.productionProjectRef}.supabase.co` || env.MOBILE_SUPABASE_PROJECT_REF !== contract.productionProjectRef) errors.push('MOBILE_SUPABASE_PROJECT_REF: production identity mismatch');
    if (!contract.productionApiOrigins.includes(api) || origin(env.NEXT_PUBLIC_APP_URL) !== api) errors.push('MOBILE_API_ORIGIN: production origin mismatch');
    if (env.STRIPE_SECRET_KEY && !/^rk_live_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY)) errors.push('STRIPE_SECRET_KEY: production requires a restricted live key');
    for (const name of ['LAB_STRIPE_SANDBOX_KEY','LAB_STRIPE_CHECKOUT_KEY','LAB_STRIPE_WEBHOOK_SECRET','LAB_STRIPE_PUBLISHABLE_KEY'])
      if (env[name]) errors.push(`${name}: beta-only credential forbidden in production`);
    if (env.REVENUECAT_SECRET_KEY && env.REVENUECAT_ENVIRONMENT !== 'PRODUCTION') errors.push('REVENUECAT_ENVIRONMENT: production required');
    if (complete) {
      for (const name of ['SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','CRON_SECRET','STRIPE_ACCOUNT_ID','STRIPE_MODE'])
        if (!env[name]?.trim()) errors.push(`${name}: missing`);
      if (env.STRIPE_MODE !== 'live') errors.push('STRIPE_MODE: live required');
      if (!/^acct_[A-Za-z0-9]+$/.test(env.STRIPE_ACCOUNT_ID || '')) errors.push('STRIPE_ACCOUNT_ID: explicit provider identity required');
      if ((env.CRON_SECRET || '').length < 32) errors.push('CRON_SECRET: at least 32 random characters required');
      if (!/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET || '')) errors.push('STRIPE_WEBHOOK_SECRET: signing secret required');
      for (const name of ['SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
        const value = env[name] || '';
        if (value.startsWith(name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'sb_secret_' : 'sb_publishable_')) continue;
        try {
          const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
          if (payload.ref !== contract.productionProjectRef || payload.role !== (name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service_role' : 'anon')) throw new Error();
        } catch { errors.push(`${name}: credential role/project mismatch`); }
      }
    }
  } else {
    if (db === `https://${contract.productionProjectRef}.supabase.co` || env.MOBILE_SUPABASE_PROJECT_REF === contract.productionProjectRef || contract.productionApiOrigins.includes(api)) errors.push('MOBILE_ENVIRONMENT: production services forbidden outside production');
    if (env.STRIPE_SECRET_KEY && !/^(?:sk|rk)_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY)) errors.push('STRIPE_SECRET_KEY: test key required outside production');
  }
  for (const [provider, path] of [['GOOGLE_CALENDAR','/api/calendar/google/callback'],['PINTEREST','/api/pinterest/oauth/callback']]) {
    const enabled = provider === 'GOOGLE_CALENDAR' ? env.GOOGLE_CALENDAR_ENABLED === 'true' : env.PINTEREST_OAUTH_MODE === '1';
    if (!enabled) continue;
    if (env[`${provider}_REDIRECT_URI`] !== `${api}${path}`) errors.push(`${provider}_REDIRECT_URI: exact environment callback required`);
    if (production && complete && !env[`${provider}_TOKEN_KEY_ID`]) errors.push(`${provider}_TOKEN_KEY_ID: versioned encryption required`);
  }
  if (env.GOOGLE_CALENDAR_TOKEN_KEY && env.GOOGLE_CALENDAR_TOKEN_KEY === env.PINTEREST_TOKEN_KEY) errors.push('TOKEN_KEY: providers must use different encryption keys');
  return errors;
}
export function assertDeploymentBoundary(env = process.env) {
  if (deploymentErrors(env).length) throw new Error('DEPLOYMENT_IDENTITY_CONFIGURATION');
}
