import { pathToFileURL } from 'node:url'
import nextEnv from '@next/env'

const buildRequired = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'STRIPE_SECRET_KEY']
const serverRequired = [...buildRequired, 'NEXT_PUBLIC_APP_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'STRIPE_WEBHOOK_SECRET', 'CRON_SECRET']

export function validateEnv(env, profile = 'server') {
  if (!['build', 'server'].includes(profile)) throw new Error('Profile must be build or server')
  const errors = []
  for (const key of profile === 'build' ? buildRequired : serverRequired) {
    if (!env[key]?.trim()) errors.push(`${key}: missing`)
    else if (/offline|your[-_]|replace[-_]|example\.invalid/i.test(env[key])) errors.push(`${key}: placeholder value`)
  }
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_APP_URL']) {
    if (!env[key]?.trim()) continue
    try {
      const url = new URL(env[key])
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol')
    } catch { errors.push(`${key}: expected an HTTP(S) URL`) }
  }
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'CRON_SECRET', 'RESEND_API_KEY']) {
    if (env[`NEXT_PUBLIC_${key}`]) errors.push(`NEXT_PUBLIC_${key}: secret must not be exposed to the browser`)
  }
  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  nextEnv.loadEnvConfig(process.cwd())
  const profile = process.argv[2] || 'server'
  const errors = validateEnv(process.env, profile)
  if (errors.length) {
    console.error(`Environment check failed (${profile}):\n${errors.map(e => `- ${e}`).join('\n')}`)
    process.exitCode = 1
  } else {
    console.log(`Environment names and formats are valid (${profile}); service access is NOT verified.`)
    if (!process.env.RESEND_API_KEY) console.log('RESEND_API_KEY is absent: reminder emails are disabled.')
  }
}
