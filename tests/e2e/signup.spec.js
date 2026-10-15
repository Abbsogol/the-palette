import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort())
})
async function chooseCreator(page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await page.getByPlaceholder('Display name', { exact: true }).fill('Test Artist')
  await page.getByPlaceholder('Email', { exact: true }).fill('artist@example.invalid')
  await page.getByPlaceholder('Password', { exact: true }).fill('test-only-password')
  await page.getByRole('checkbox', { name: /I agree/ }).check()
  await page.getByRole('checkbox', { name: /I am 18/ }).check()
  await page.getByRole('button', { name: 'Continue →' }).click()
  await page.getByRole('button', { name: /Nail Artist/ }).click()
}
test('confirmation-required signup preserves creator choice and shows the email step', async ({ page }) => {
  let signup, profileWrites = 0
  page.on('request', request => { if (request.url().includes('/api/set-account-type')) profileWrites++ })
  // Exercise the actual Supabase browser SDK response parsing and rendered UI;
  // Auth email delivery itself remains an isolated-staging verification gap.
  await page.route('http://127.0.0.1:54321/auth/v1/signup**', route => {
    signup = route.request().postDataJSON()
    return route.fulfill({ json: { id: '00000000-0000-4000-8000-000000000499', aud: 'authenticated', role: 'authenticated', email: 'artist@example.invalid', user_metadata: signup.data, identities: [], created_at: new Date().toISOString() } })
  })
  await chooseCreator(page)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  expect(signup.data).toMatchObject({ account_type: 'creator', display_name: 'Test Artist' })
  expect(profileWrites).toBe(0)
  await page.getByRole('button', { name: 'Back to sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})
test('a signup service rejection stays visible and leaves the form retryable', async ({ page }) => {
  await page.route('http://127.0.0.1:54321/auth/v1/signup**', route => route.fulfill({ status: 422, json: { code: 'signup_disabled', msg: 'Signup temporarily unavailable' } }))
  await chooseCreator(page)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByText('Signup temporarily unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled()
})
