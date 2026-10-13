// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ client: {}, router: { push: vi.fn() }, callbacks: new Set(), session: null, params: new URLSearchParams() }))
vi.mock('@/lib/supabase', () => ({ supabase: mock.client }))
vi.mock('next/navigation', () => ({ useRouter: () => mock.router, useSearchParams: () => mock.params }))
import Profile from '@/app/profile/page'
import Onboarding from '@/app/onboarding/page'

const session = id => ({ user: { id, email: `${id}@example.test` }, access_token: `token-${id}` })
const profile = (id, extra = {}) => ({ id, account_type: 'user', display_name: `Account ${id}`, onboarding_complete: true, phone_number: `Private phone ${id}`, ...extra })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const switchSession = async next => {
  mock.session = next
  await act(async () => { for (const callback of mock.callbacks) callback(next ? 'SIGNED_IN' : 'SIGNED_OUT', next) })
}
beforeEach(() => {
  vi.clearAllMocks(); mock.callbacks.clear(); mock.params = new URLSearchParams(); mock.session = session('a')
  mock.client.auth = {
    getSession: vi.fn(async () => ({ data: { session: mock.session } })),
    updateUser: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(callback => { mock.callbacks.add(callback); return { data: { subscription: { unsubscribe: () => mock.callbacks.delete(callback) } } } }),
  }
  Object.assign(mock.client, database(q => q.table === 'profiles' ? ok(profile(q.filters.find(([op, name]) => op === 'eq' && name === 'id')[2])) : ok([])))
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })))
  vi.stubGlobal('alert', vi.fn())
})
afterEach(cleanup)

it('P5-auth: changing account immediately removes the previous private profile while the new account loads', async () => {
  await act(async () => render(<Profile />))
  expect(screen.getByText('Private phone a')).toBeVisible()
  const pending = deferred()
  mock.client.from = database(q => q.table === 'profiles' ? pending.promise : ok([])).from
  await switchSession(session('b'))
  expect(screen.queryByText('Private phone a')).not.toBeInTheDocument()
  await act(async () => pending.resolve(ok(profile('b'))))
  expect(screen.getByText('Private phone b')).toBeVisible()
})

it('P5-auth: an older profile response cannot overwrite the newly signed-in account', async () => {
  const pending = deferred()
  mock.client.from = database(q => q.table === 'profiles' ? q.filters[0][2] === 'a' ? pending.promise : ok(profile('b')) : ok([])).from
  await act(async () => render(<Profile />))
  await switchSession(session('b'))
  expect(screen.getByText('Private phone b')).toBeVisible()
  await act(async () => pending.resolve(ok(profile('a'))))
  expect(screen.queryByText('Private phone a')).not.toBeInTheDocument()
  expect(screen.getByText('Private phone b')).toBeVisible()
})

it('P5-auth: a late initial session read cannot restore private data after logout', async () => {
  const pending = deferred()
  mock.client.auth.getSession.mockReturnValueOnce(pending.promise)
  await act(async () => render(<Profile />))
  await switchSession(null)
  await act(async () => pending.resolve({ data: { session: session('a') } }))
  expect(screen.queryByText('Private phone a')).not.toBeInTheDocument()
  expect(screen.getByText('Welcome back')).toBeVisible()
})

async function completeOnboardingForm() {
  fireEvent.click(screen.getByRole('button', { name: "Let's go →" }))
  for (let count = 0; count < 4; count++) fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
  fireEvent.click(screen.getByRole('checkbox', {name:'I am 18 or older'}))
  fireEvent.click(screen.getByRole('checkbox', {name:/I have read/}))
}
const onboardingProfiles = q => q.table === 'profiles' ? ok(profile(q.filters[0][2], { onboarding_complete: false })) : ok([])
it('P5-auth: onboarding cannot submit account A contact details using a newly switched account B token', async () => {
  mock.client.from = database(onboardingProfiles).from
  await act(async () => render(<Onboarding />))
  await completeOnboardingForm()
  // Cross-tab session storage may update before its auth event reaches this tab.
  mock.session = session('b')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Browse the feed →' })))
  expect(fetch).not.toHaveBeenCalled()
  expect(mock.router.push).not.toHaveBeenCalledWith('/feed')
})

it('P5-auth: onboarding clears private form state on logout', async () => {
  mock.client.from = database(onboardingProfiles).from
  await act(async () => render(<Onboarding />))
  fireEvent.click(screen.getByRole('button', { name: "Let's go →" }))
  expect(screen.getByDisplayValue('Private phone a')).toBeVisible()
  await switchSession(null)
  expect(screen.queryByDisplayValue('Private phone a')).not.toBeInTheDocument()
  expect(mock.router.push).toHaveBeenCalledWith('/profile')
})

it('P5-auth: onboarding loads the new account from its first step after a session switch', async () => {
  mock.client.from = database(onboardingProfiles).from
  await act(async () => render(<Onboarding />))
  await completeOnboardingForm()
  await switchSession(session('b'))
  expect(screen.getByText('Welcome to Laque, Account')).toBeVisible()
  expect(screen.getByRole('button', { name: "Let's go →" })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: "Let's go →" }))
  expect(screen.getByDisplayValue('Private phone b')).toBeVisible()
})

it('P5-auth: successful onboarding sends only the authenticated account form and redirects after its response', async () => {
  mock.client.from = database(onboardingProfiles).from
  await act(async () => render(<Onboarding />))
  await completeOnboardingForm()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Browse the feed →' })))
  expect(fetch).toHaveBeenCalledWith('/api/complete-onboarding', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-a' }), body: expect.stringContaining('Private phone a') }))
  expect(mock.router.push).toHaveBeenCalledWith('/feed')
})

it('P5-auth: a profile edit cannot use another account token before the auth event arrives', async () => {
  await act(async () => render(<Profile />))
  const row = screen.getByText('Phone number').parentElement
  fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
  fireEvent.change(within(row).getByRole('textbox'), { target: { value: '+971 50 123 4567' } })
  mock.session = session('b')
  await act(async () => fireEvent.click(within(row).getByRole('button', { name: 'Save' })))
  expect(fetch).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringMatching(/account changed/i))
})

it('P5-auth: a delayed onboarding response cannot redirect the new account or apply the previous invitation', async () => {
  mock.params = new URLSearchParams('ref=INVITE22')
  mock.client.from = database(onboardingProfiles).from
  const pending = deferred()
  fetch.mockImplementation(url => url === '/api/complete-onboarding' ? pending.promise : Promise.resolve(Response.json({ ok: true })))
  await act(async () => render(<Onboarding />))
  await completeOnboardingForm()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Browse the feed →' })))
  const requestsBeforeSwitch = fetch.mock.calls.length
  await switchSession(session('b'))
  await act(async () => pending.resolve(Response.json({ ok: true })))
  expect(mock.router.push).not.toHaveBeenCalledWith('/feed')
  expect(fetch).toHaveBeenCalledTimes(requestsBeforeSwitch)
})

it('P5-auth: onboarding ignores delayed private profile reads after logout', async () => {
  const pending = deferred()
  mock.client.from = database(() => pending.promise).from
  await act(async () => render(<Onboarding />))
  await switchSession(null)
  await act(async () => pending.resolve(ok(profile('a', { onboarding_complete: false }))))
  expect(screen.queryByText('Welcome to Laque, Account')).not.toBeInTheDocument()
  expect(mock.router.push).toHaveBeenCalledWith('/profile')
})

it('P5-auth: onboarding keeps entered preferences when the same account refreshes its token', async () => {
  mock.client.from = database(onboardingProfiles).from
  await act(async () => render(<Onboarding />))
  fireEvent.click(screen.getByRole('button', { name: "Let's go →" }))
  fireEvent.change(screen.getByDisplayValue('Private phone a'), { target: { value: '+123456789' } })
  await act(async () => { for (const callback of mock.callbacks) callback('TOKEN_REFRESHED', mock.session) })
  expect(screen.getByDisplayValue('+123456789')).toBeVisible()
})

it('P5-auth: recovery opens even when its event arrives before the initial session read', async () => {
  const pending = deferred()
  mock.client.auth.getSession.mockReturnValueOnce(pending.promise)
  await act(async () => render(<Profile />))
  await act(async () => { for (const callback of mock.callbacks) callback('PASSWORD_RECOVERY', session('a')) })
  await act(async () => pending.resolve({ data: { session: session('a') } }))
  expect(screen.getByRole('heading', { name: 'Set new password' })).toBeVisible()
})

it('P5-auth: recovery cannot change the password of an account that switched before its auth event arrived', async () => {
  await act(async () => render(<Profile />))
  await act(async () => { for (const callback of mock.callbacks) callback('PASSWORD_RECOVERY', session('a')) })
  fireEvent.change(screen.getByPlaceholderText('New password (min 6 characters)'), { target: { value: 'new-password' } })
  mock.session = session('b')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save new password' })))
  expect(mock.client.auth.updateUser).not.toHaveBeenCalled()
  expect(screen.getByText(/account changed/i)).toBeVisible()
})

it('P5-auth: an in-flight recovery keeps its original token and cannot restore the old account after a switch', async () => {
  await act(async () => render(<Profile />))
  await act(async () => { for (const callback of mock.callbacks) callback('PASSWORD_RECOVERY', session('a')) })
  fireEvent.change(screen.getByPlaceholderText('New password (min 6 characters)'), { target: { value: 'new-password' } })
  const pending = deferred()
  fetch.mockReturnValueOnce(pending.promise)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save new password' })))
  expect(fetch).toHaveBeenCalledWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, expect.objectContaining({ method: 'PUT', headers: expect.objectContaining({ Authorization: 'Bearer token-a' }), body: JSON.stringify({ password: 'new-password' }) }))
  expect(mock.client.auth.updateUser).not.toHaveBeenCalled()
  await switchSession(session('b'))
  await act(async () => pending.resolve(Response.json({ id: 'a' })))
  expect(screen.getByText('Private phone b')).toBeVisible()
  expect(screen.queryByText('Private phone a')).not.toBeInTheDocument()
})

it('P5-auth: recovery shows provider failures and permits retry with the same account', async () => {
  await act(async () => render(<Profile />))
  await act(async () => { for (const callback of mock.callbacks) callback('PASSWORD_RECOVERY', session('a')) })
  fireEvent.change(screen.getByPlaceholderText('New password (min 6 characters)'), { target: { value: 'new-password' } })
  fetch.mockResolvedValueOnce(Response.json({ msg: 'Please reauthenticate' }, { status: 401 }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save new password' })))
  expect(screen.getByText('Please reauthenticate')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Save new password' })).toBeEnabled()
  fetch.mockResolvedValueOnce(Response.json({ id: 'a' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save new password' })))
  expect(screen.getByText('✓ Password updated successfully')).toBeVisible()
})

it('P5-auth: the account type selection cannot update another newly switched account', async () => {
  await act(async () => render(<Profile />))
  mock.session = session('b')
  vi.stubGlobal('confirm', () => true)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Switch to Creator Account' })))
  expect(fetch).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith(expect.stringMatching(/account changed/i))
})

it('P5-billing: a customer whose paid tier was revoked can still manage billing', async () => {
  mock.client.from = database(q => q.table === 'profiles' ? ok(profile('a', { subscription_tier: null, stripe_customer_id: 'cus_a' })) : ok([])).from
  await act(async () => render(<Profile />))
  expect(screen.getByRole('button', { name: /Manage subscription/i })).toBeVisible()
  expect(screen.getByRole('link', { name: /Upgrade to Pro/i })).toBeVisible()
})

it.each(['rejected', 'network'])('P5-referral: a %s referral failure remains retryable before onboarding is marked complete', async kind => {
  mock.params = new URLSearchParams('ref=INVITE22')
  mock.client.from = database(onboardingProfiles).from
  fetch.mockImplementation(url => {
    if (url !== '/api/apply-referral') return Promise.resolve(Response.json({ ok: true }))
    return kind === 'network' ? Promise.reject(new Error('Connection lost')) : Promise.resolve(Response.json({ error: 'Referral temporarily unavailable' }, { status: 503 }))
  })
  await act(async () => render(<Onboarding />))
  await completeOnboardingForm()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Browse the feed →' })))
  expect(mock.router.push).not.toHaveBeenCalledWith('/feed')
  expect(fetch.mock.calls.some(([url]) => url === '/api/complete-onboarding')).toBe(false)
  expect(screen.getByRole('button', { name: 'Browse the feed →' })).toBeEnabled()
  fetch.mockImplementation(async () => Response.json({ ok: true }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Browse the feed →' })))
  expect(fetch.mock.calls.filter(([url]) => url === '/api/apply-referral')).toHaveLength(2)
  expect(fetch.mock.calls.filter(([url]) => url === '/api/complete-onboarding')).toHaveLength(1)
  expect(mock.router.push).toHaveBeenCalledWith('/feed')
})
