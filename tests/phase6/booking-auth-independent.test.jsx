// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ client: {}, session: null, callbacks: new Set(), router: { push: vi.fn() }, params: { id: 'booking-1', creatorId: 'artist' }, search: new URLSearchParams(), status: 'confirmed', ended: false, zone: 'UTC', failHours: false, zeroRows: false, reviewWrite: null }))
vi.mock('@/lib/supabase', () => ({ supabase: mock.client }))
vi.mock('next/navigation', () => ({ useRouter: () => mock.router, useParams: () => mock.params, useSearchParams: () => mock.search }))
import AppointmentDetail from '@/app/appointments/[id]/page'
import CreatorDetail from '@/app/bookings/[id]/page'
import Appointments from '@/app/appointments/page'
import Bookings from '@/app/bookings/page'
import Availability from '@/app/availability/page'
import Book from '@/app/book/[creatorId]/page'
import Planner from '@/app/planner/page'

const pages = [['appointment detail', AppointmentDetail], ['creator detail', CreatorDetail], ['appointments', Appointments], ['bookings', Bookings], ['availability', Availability], ['booking form', Book], ['planner', Planner]]
const session = id => ({ user: { id }, access_token: `token-${id}` })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { resolve, promise } }
const offer = { id: 'service-1', name: 'Private service', duration_minutes: 30, price: 100, deposit_amount: 20 }
const profile = id => ({ id, account_type: 'creator', display_name: `Profile ${id}`, username: id })
const changeSession = async next => {
  mock.session = next
  await act(async () => { for (const callback of mock.callbacks) callback(next ? 'SIGNED_IN' : 'SIGNED_OUT', next) })
}
beforeEach(() => {
  vi.clearAllMocks(); mock.callbacks.clear(); mock.session = session('a'); mock.search = new URLSearchParams(); window.history.replaceState({}, '', '/')
  Object.assign(mock, { status: 'confirmed', ended: false, midnight: false, zone: 'UTC', failHours: false, zeroRows: false, reviewWrite: null })
  Object.assign(mock.client, database(q => {
    if (q.operation !== 'select') {
      if (q.table === 'reviews' && mock.reviewWrite) return mock.reviewWrite.promise
      if (mock.zeroRows) return ok(null)
      if (q.table === 'reviews' || q.table === 'client_notes') return ok({ id: `${q.table}-1`, ...q.values })
    }
    if (q.table === 'profiles') return ok(q.single ? profile(q.filters[0][2]) : q.filters[0][2].map(profile))
    if (q.table === 'services') return ok([offer])
    if (q.table === 'creator_booking_settings') return ok({ time_zone: mock.zone })
    if (q.table === 'availability') return mock.failHours ? { data: null, error: { message: 'Unavailable' } } : ok(Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, start_time: '09:00', end_time: '17:00', is_active: true })))
    if (['follows', 'reviews', 'client_notes'].includes(q.table)) return ok(null)
    if (q.table === 'bookings') {
      const client = q.filters.find(f => f[1] === 'client_id')?.[2] || 'customer'
      const creator = q.filters.find(f => f[1] === 'creator_id')?.[2] || 'artist'
      const day = mock.ended ? '2000-01-01' : '2099-09-29'
      const row = { id: 'booking-1', client_id: client, creator_id: creator, status: mock.status, notes: `Private notes ${client}`, booking_date: day, start_time: mock.midnight ? '23:30' : '10:00', end_time: mock.midnight ? '24:00' : '10:30', starts_at: `${day}T${mock.midnight ? '23:30' : '10:00'}:00Z`, ends_at: mock.midnight ? '2099-09-30T00:00:00Z' : `${day}T10:30:00Z`, time_zone: 'UTC', service: offer, ...q.values }
      return ok(q.single ? row : [row])
    }
    throw new Error(`Unexpected ${q.table} ${q.operation}`)
  }))
  mock.client.auth = {
    getSession: vi.fn(async () => ({ data: { session: mock.session } })),
    getUser: vi.fn(async () => ({ data: { user: mock.session?.user || null } })),
    onAuthStateChange: callback => { mock.callbacks.add(callback); return { data: { subscription: { unsubscribe: () => mock.callbacks.delete(callback) } } } },
  }
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ url: '#checkout-a' })))
  vi.stubGlobal('alert', vi.fn())
  vi.stubGlobal('confirm', vi.fn(() => true))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it.each(pages)('%s ignores a late getUser from an unmounted account instead of redirecting the new account', async (_name, Page) => {
  const oldUser = deferred()
  mock.client.auth.getUser.mockReturnValueOnce(oldUser.promise)
  await act(async () => render(<Page />))
  await changeSession(session('b'))
  expect(mock.router.push).not.toHaveBeenCalled()
  await act(async () => oldUser.resolve({ data: { user: session('b').user } }))
  expect(mock.router.push).not.toHaveBeenCalled()
})

it.each(pages)('%s clears its account content immediately when signed out', async (_name, Page) => {
  await act(async () => render(<Page />))
  expect(screen.queryByRole('heading', { name: /Sign in to/ })).not.toBeInTheDocument()
  await changeSession(null)
  expect(screen.getByRole('heading', { name: /Sign in to/ })).toBeVisible()
  expect(screen.queryByText('Private service')).not.toBeInTheDocument()
  expect(screen.queryByText('Private notes a')).not.toBeInTheDocument()
})

it('a deposit response cannot redirect after account A to B to A', async () => {
  const checkout = deferred(); fetch.mockReturnValueOnce(checkout.promise)
  await act(async () => render(<AppointmentDetail />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Pay deposit/ })))
  await changeSession(session('b')); await changeSession(session('a'))
  await act(async () => checkout.resolve(Response.json({ url: '#old-payment' })))
  expect(window.location.hash).toBe('')
  expect(screen.getByRole('button', { name: /Pay deposit/ })).not.toBeDisabled()
})

it('a session switch before deposit getSession resolves cannot pay with the new identity', async () => {
  await act(async () => render(<AppointmentDetail />))
  const lookup = deferred(); mock.client.auth.getSession.mockReturnValueOnce(lookup.promise)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Pay deposit/ })))
  await changeSession(session('b'))
  await act(async () => lookup.resolve({ data: { session: session('b') } }))
  expect(fetch).not.toHaveBeenCalled()
})

it('a delayed availability save does not mark the new account schedule as saved', async () => {
  const save = deferred(); fetch.mockReturnValueOnce(save.promise)
  await act(async () => render(<Availability />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
  await changeSession(session('b'))
  await act(async () => save.resolve(Response.json({ ok: true })))
  expect(screen.queryByRole('button', { name: 'Saved ✓' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
})

it('a failed hours load cannot overwrite existing hours with an editable default schedule', async () => {
  mock.failHours = true
  await act(async () => render(<Availability />))
  expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i)
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  mock.failHours = false
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })))
  expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
})

it('Planner Today keeps the creator local week when UTC has already crossed Sunday', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-27T00:30:00Z')); mock.zone = 'America/Los_Angeles'
  await act(async () => render(<Planner />))
  expect(screen.getByText('20–26 Sep')).toBeVisible()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Today' })))
  expect(screen.getByText('20–26 Sep')).toBeVisible()
})

it.each(['Accept', 'Decline'])('%s requires the displayed account before sending an update', async button => {
  mock.status = 'pending'
  await act(async () => render(<CreatorDetail />))
  mock.session = session('b')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: button })))
  expect(mock.client.calls.filter(q => q.operation === 'update')).toHaveLength(0)
})

it.each(['Accept', 'Decline'])('%s does not report success when RLS changes no booking row', async button => {
  mock.status = 'pending'; mock.zeroRows = true
  await act(async () => render(<CreatorDetail />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: button })))
  expect(screen.getByRole('button', { name: button })).not.toBeDisabled()
  expect(screen.getByText('Pending')).toBeVisible()
  expect(alert).toHaveBeenCalled()
})

it('a note save requires a returned row before showing Saved', async () => {
  mock.zeroRows = true
  await act(async () => render(<CreatorDetail />))
  await act(async () => fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New private note' } }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save note' })))
  expect(screen.queryByRole('button', { name: /Saved/ })).not.toBeInTheDocument()
  expect(alert).toHaveBeenCalled()
})

it('a review with no returned row is not shown as submitted or rewarded', async () => {
  mock.ended = true; mock.zeroRows = true
  await act(async () => render(<AppointmentDetail />))
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: '★' })[4]))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit review' })))
  expect(screen.getByRole('button', { name: 'Submit review' })).not.toBeDisabled()
  expect(fetch).not.toHaveBeenCalled()
})

it('a delayed review rewards only the account that submitted it', async () => {
  mock.ended = true; mock.reviewWrite = deferred()
  await act(async () => render(<AppointmentDetail />))
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: '★' })[4]))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit review' })))
  await changeSession(session('b'))
  await act(async () => mock.reviewWrite.resolve(ok({ id: 'review-a', reviewer_id: 'a' })))
  expect(fetch).toHaveBeenCalledWith('/api/add-reward', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-a' }) }))
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: '★' })[4]))
  expect(screen.getByRole('button', { name: 'Submit review' })).not.toBeDisabled()
})

it('renders a booking ending at 24:00 as midnight rather than noon', async () => {
  mock.midnight = true
  await act(async () => render(<AppointmentDetail />))
  expect(screen.getByText('11:30pm – 12am')).toBeVisible()
})
