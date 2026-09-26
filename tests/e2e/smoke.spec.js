import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page, baseURL }) => {
  // These smoke tests never contact a production API, analytics, or payment
  // provider. Live database/browser journeys require isolated staging later.
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === new URL(baseURL).origin ? route.continue() : route.abort()
  })
})

test('help renders and expands a booking answer', async ({ page }) => {
  await page.goto('/help')
  await expect(page.getByRole('heading', { name: 'Help & Support' })).toBeVisible()
  await page.getByRole('button', { name: /How do I book an appointment/ }).click()
  await expect(page.getByText(/Go to any nail artist or salon profile/)).toBeVisible()
})

test('anonymous profile provides login and recovery navigation', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByPlaceholder('Email', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Password', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Forgot password/ }).click()
  await expect(page.getByRole('button', { name: /Send reset link/ })).toBeVisible()
})

test('bottom navigation reaches the profile without authentication', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('search initializes a deep-linked query without a hydration error', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/search?q=bridal')
  await expect(page.getByRole('textbox').first()).toHaveValue('bridal')
  expect(errors).toEqual([])
})

test('an unverified checkout does not announce credits were added', async ({ page }) => {
  await page.goto('/buy-credits/success?session_id=cs_unverified')
  await expect(page.getByRole('heading', { name: 'Confirming your purchase' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Credits added ✦' })).toHaveCount(0)
})
