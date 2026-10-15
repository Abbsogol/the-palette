import { expect, it } from 'vitest'
import { validateEnv } from '../../scripts/check-env.mjs'
import { testEnv } from '../helpers/test-env.mjs'

it('reports missing server configuration without echoing secret values', () => {
  const errors = validateEnv({ STRIPE_SECRET_KEY: 'a-private-value' })
  expect(errors).toContain('SUPABASE_SERVICE_ROLE_KEY: missing')
  expect(errors).toContain('CRON_SECRET: missing')
  expect(errors.join('\n')).not.toContain('a-private-value')
})
it('does not certify offline build placeholders as a configured environment', () => {
  expect(validateEnv(testEnv, 'build')).toContain('STRIPE_SECRET_KEY: placeholder value')
})
it('rejects accidental public exposure of server credentials', () => {
  expect(validateEnv({ NEXT_PUBLIC_OPENAI_API_KEY: 'hidden' })).toContain('NEXT_PUBLIC_OPENAI_API_KEY: secret must not be exposed to the browser')
})
it('rejects invalid service URL schemes', () => {
  expect(validateEnv({ NEXT_PUBLIC_SUPABASE_URL: 'file:///private' }, 'build')).toContain('NEXT_PUBLIC_SUPABASE_URL: expected an HTTP(S) URL')
})
