import Stripe from 'stripe'
import { assertLabSandboxKey, verifyLabStripeSandbox } from '../lib/lab-stripe-sandbox.mjs'

try {
  const key = process.env.LAB_STRIPE_SANDBOX_KEY
  assertLabSandboxKey(key)
  const stripe = new Stripe(key, { apiVersion: '2026-08-26.dahlia', maxNetworkRetries: 1, timeout: 15000 })
  console.log(JSON.stringify(await verifyLabStripeSandbox(stripe), null, 2))
  console.log('Read-only verification. No payment, subscription, token grant or app billing change was performed.')
} catch (error) {
  // Provider errors can contain operational payloads. Never print them or keys.
  console.error(error?.type ? 'Stripe sandbox verification failed. Check key permissions and account configuration.' : error.message)
  process.exitCode = 1
}
