// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock=vi.hoisted(()=>({session:null,change:null}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: mock.session } }),
  onAuthStateChange: callback => {
    mock.change = callback
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  },
} } }))
import Boost from '@/components/BoostButton'
beforeEach(()=>{mock.session={user:{id:'owner'},access_token:'test-only'};mock.change=null;window.history.replaceState({},'', '/');vi.stubGlobal('alert',vi.fn())})
afterEach(cleanup)
it.each([['payment_review','A boost refund needs attention. Please contact support.'],['refund_pending','A boost refund is still being processed.'],['refund_recorded','A refund is recorded for a boost purchase.']])('owner sees %s separately from current promotion entitlement',async(status,message)=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({status})))
  await act(async()=>render(<Boost designId="design" creatorId="owner" boostedUntil="2099-01-01"/>))
  expect(screen.getByRole('status')).toHaveTextContent(message)
  expect(screen.getByRole('button',{name:/Boosted/})).toBeVisible()
  await act(async()=>mock.change('SIGNED_OUT',null))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('a delayed private refund response cannot appear after logout',async()=>{
  let finish
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve})))
  await act(async()=>render(<Boost designId="design" creatorId="owner"/>))
  await act(async()=>mock.change('SIGNED_OUT',null))
  await act(async()=>finish(Response.json({status:'payment_review'})))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('a non-owner never requests private promotion receipts',async()=>{
  mock.session={user:{id:'stranger'},access_token:'other'}
  const send=vi.fn();vi.stubGlobal('fetch',send)
  await act(async()=>render(<Boost designId="design" creatorId="owner"/>))
  expect(send).not.toHaveBeenCalled()
})

const changeSession = async session => {
  mock.session = session
  await act(async () => mock.change(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
}
const chooseBoost = () => {
  fireEvent.click(screen.getByRole('button', { name: '✦ Boost' }))
  fireEvent.click(screen.getByRole('button', { name: /1 day/ }))
}
it('a checkout response cannot redirect a different account to the old owner payment page', async () => {
  let finish
  vi.stubGlobal('fetch', vi.fn(async url => url === '/api/create-boost-payment'
    ? new Promise(resolve => { finish = resolve }) : Response.json({ status: 'none' })))
  await act(async () => render(<Boost designId="design" creatorId="owner" />))
  chooseBoost()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Boost for AED 15 →' })))
  expect(fetch).toHaveBeenCalledWith('/api/create-boost-payment', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-only' }) }))
  await changeSession({ user: { id: 'other' }, access_token: 'other-token' })
  // Hash-only navigation is supported by jsdom and records whether the same
  // production window.location assignment would still run after the switch.
  await act(async () => finish(Response.json({ url: '#old-owner-checkout' })))
  expect(window.location.hash).toBe('')
})

it.each([null, { user: { id: 'other' }, access_token: 'other-token' }])('returning to the owner after %j does not inherit the old checkout', async intermediate => {
  let finish
  vi.stubGlobal('fetch', vi.fn(async url => url === '/api/create-boost-payment'
    ? new Promise(resolve => { finish = resolve }) : Response.json({ status: 'none' })))
  await act(async () => render(<Boost designId="design" creatorId="owner" />))
  chooseBoost()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Boost for AED 15 →' })))
  await changeSession(intermediate)
  await changeSession({ user: { id: 'owner' }, access_token: 'new-session' })
  chooseBoost()
  expect(screen.getByRole('button', { name: 'Boost for AED 15 →' })).toBeEnabled()
  await act(async () => finish(Response.json({ url: '#old-session-checkout' })))
  expect(window.location.hash).toBe('')
})

it('changing designs rejects an in-flight checkout response for the previous design', async () => {
  let finish
  vi.stubGlobal('fetch', vi.fn(async url => url === '/api/create-boost-payment'
    ? new Promise(resolve => { finish = resolve }) : Response.json({ status: 'none' })))
  let view
  await act(async () => { view = render(<Boost designId="design-a" creatorId="owner" />) })
  chooseBoost()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Boost for AED 15 →' })))
  await act(async () => view.rerender(<Boost designId="design-b" creatorId="owner" />))
  await act(async () => finish(Response.json({ url: '#old-design-checkout' })))
  expect(window.location.hash).toBe('')
  chooseBoost()
  expect(screen.getByRole('button', { name: 'Boost for AED 15 →' })).toBeEnabled()
})

it('a session change preceding its auth event cannot redirect the new account', async () => {
  let finish
  vi.stubGlobal('fetch', vi.fn(async url => url === '/api/create-boost-payment'
    ? new Promise(resolve => { finish = resolve }) : Response.json({ status: 'none' })))
  await act(async () => render(<Boost designId="design" creatorId="owner" />))
  chooseBoost()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Boost for AED 15 →' })))
  mock.session = { user: { id: 'other' }, access_token: 'other-token' }
  await act(async () => finish(Response.json({ url: '#old-owner-checkout' })))
  expect(window.location.hash).toBe('')
})

it('changing designs clears old refund details and the previously selected purchase', async () => {
  let finish
  vi.stubGlobal('fetch', vi.fn(async url => url.includes('design-a')
    ? Response.json({ status: 'payment_review' }) : new Promise(resolve => { finish = resolve })))
  let view
  await act(async () => { view = render(<Boost designId="design-a" creatorId="owner" />) })
  expect(screen.getByRole('status')).toHaveTextContent('A boost refund needs attention')
  chooseBoost()
  await act(async () => view.rerender(<Boost designId="design-b" creatorId="owner" />))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Boost this design' })).not.toBeInTheDocument()
  await act(async () => finish(Response.json({ status: 'none' })))
})

it('same-account token refresh preserves the selected boost and current checkout request', async () => {
  let finish
  vi.stubGlobal('fetch', vi.fn(async url => url === '/api/create-boost-payment'
    ? new Promise(resolve => { finish = resolve }) : Response.json({ status: 'none' })))
  await act(async () => render(<Boost designId="design" creatorId="owner" />))
  chooseBoost()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Boost for AED 15 →' })))
  mock.session = { user: { id: 'owner' }, access_token: 'refreshed-token' }
  await act(async () => mock.change('TOKEN_REFRESHED', mock.session))
  expect(screen.getByRole('button', { name: 'Redirecting to payment…' })).toBeDisabled()
  await act(async () => finish(Response.json({ url: '#current-checkout' })))
  expect(window.location.hash).toBe('#current-checkout')
})
