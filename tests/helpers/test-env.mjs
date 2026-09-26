// Deliberately fake, loopback-only configuration. Always overrides inherited
// service credentials when running the offline test/build commands.
export const testEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'offline-anon-key',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
  SUPABASE_SERVICE_ROLE_KEY: 'offline-service-role-key',
  OPENAI_API_KEY: 'offline-openai-key',
  STRIPE_SECRET_KEY: 'sk_test_offline_no_network',
  STRIPE_WEBHOOK_SECRET: 'whsec_offline_no_network',
  CRON_SECRET: 'offline-cron-secret',
  RESEND_API_KEY: '',
}
