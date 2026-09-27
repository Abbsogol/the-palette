import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { sqlSupabase } from '../helpers/sql-supabase'
import { jsonRequest } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ client: {}, user: vi.fn(), retrieve: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mock.user, serviceClient: mock.client }))
vi.mock('stripe', () => ({ default: class {
  checkout = { sessions: { retrieve: mock.retrieve, create: mock.create } }
  webhooks = { constructEvent: body => JSON.parse(body) }
} }))
import { POST as credits } from '@/app/api/create-checkout-session/route'
import { POST as deposit } from '@/app/api/create-deposit-payment/route'
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { GET as creditStatus } from '@/app/api/credit-checkout-status/route'
import { GET as depositStatus } from '@/app/api/deposit-checkout-status/route'
const user = '00000000-0000-4000-8000-000000000471'
const creator = '00000000-0000-4000-8000-000000000472'
const booking = '10000000-0000-4000-8000-000000000471'
const service = '20000000-0000-4000-8000-000000000471'
let db, session
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0]
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {})
  await db.exec('truncate auth.users,profiles_data,processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1),($2)', [user, creator])
  mock.user.mockResolvedValue({ id: user })
  Object.assign(mock.client, sqlSupabase(db))
  session = null
  mock.create.mockImplementation(async params => { session = { ...params, id: 'cs_failed', status: 'open', payment_status: 'unpaid', url: 'https://checkout.invalid/test' }; return session })
  mock.retrieve.mockImplementation(async () => session)
})
async function startDeposit() {
  await db.query("insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values ($1,$2,'Manicure',60,100,25)", [service, creator])
  await db.query("insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time,status) values ($1,$2,$3,$4,current_date+1,'10:00','11:00','confirmed')", [booking, user, creator, service])
  return deposit(jsonRequest({ bookingId: booking }))
}
const event = (type = 'checkout.session.async_payment_failed') => webhook(jsonRequest({ id: 'evt_failed', type, created: 100, data: { object: session } }))
it.each(['credits', 'deposit'])('P4-07: a terminal asynchronous %s payment failure releases its durable checkout', async kind => {
  expect((await (kind === 'credits' ? credits(jsonRequest({ packId: 'starter' })) : startDeposit())).status).toBe(200)
  session = { ...session, status: 'complete', payment_status: 'unpaid' }
  expect((await event()).status).toBe(200)
  const table = kind === 'credits' ? 'payment_checkouts' : 'deposit_checkouts'
  expect(await scalar(`select count(*)::integer from ${table}`)).toBe(0)
  expect(await scalar('select count(*)::integer from credit_payments')).toBe(0)
  expect(await scalar('select count(*)::integer from order_payments')).toBe(0)
})
it('P4-08: a purchase with reversed credits reports its refund instead of fresh credit fulfillment', async () => {
  session = { id: 'cs_refunded', mode: 'payment', status: 'complete', metadata: { userId: user, credits: '5' } }
  await db.as('service_role', null, "select apply_credit_payment('evt_paid','pi_paid',$1,5,'cs_refunded',0)", [user])
  await db.as('service_role', null, "select apply_credit_payment('evt_refund','pi_paid',$1,5,null,5)", [user])
  const response = await creditStatus(new Request('http://localhost/api/credit-checkout-status?session_id=cs_refunded'))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'refund_recorded', creditBalance: 0 })
})
it('P4-07: a delayed duplicate failure cannot delete the replacement checkout', async () => {
  await credits(jsonRequest({ packId: 'starter' }))
  const failed = { ...session, status: 'complete', payment_status: 'unpaid' }
  session = failed
  await event()
  await credits(jsonRequest({ packId: 'starter' }))
  const freshAttempt = (await db.query('select id from payment_checkouts')).rows[0].id
  // Stripe gives the replacement its own session, even if the scope is equal.
  await db.query("update payment_checkouts set session_id='cs_replacement'")
  session = failed
  await event()
  expect((await db.query('select id,session_id from payment_checkouts')).rows).toEqual([{ id: freshAttempt, session_id: 'cs_replacement' }])
})
it.each(['open', 'paid'])('P4-07: current Stripe state %s prevents a stale failure from releasing a checkout', async state => {
  await credits(jsonRequest({ packId: 'starter' }))
  session = { ...session, status: state === 'open' ? 'open' : 'complete', payment_status: state === 'paid' ? 'paid' : 'unpaid' }
  await event()
  expect(await scalar('select count(*)::integer from payment_checkouts')).toBe(1)
  expect(await scalar('select count(*)::integer from checkout_failures')).toBe(0)
})
it.each(['credits', 'deposit'])('P4-07: failure before %s checkout acknowledgment still closes the exact reserved attempt', async kind => {
  await (kind === 'credits' ? credits(jsonRequest({ packId: 'starter' })) : startDeposit())
  const table = kind === 'credits' ? 'payment_checkouts' : 'deposit_checkouts'
  await db.query(`update ${table} set session_id=null`)
  session = { ...session, status: 'complete', payment_status: 'unpaid' }
  expect((await event()).status).toBe(200)
  expect(await scalar(`select count(*)::integer from ${table}`)).toBe(0)
})
it('P4-07: a failed checkout is visible only to its owner and no longer blocks account deletion', async () => {
  await credits(jsonRequest({ packId: 'starter' }))
  session = { ...session, status: 'complete', payment_status: 'unpaid' }
  await event()
  const request = new Request('http://localhost/api/credit-checkout-status?session_id=cs_failed')
  expect(await (await creditStatus(request)).json()).toEqual({ status: 'failed' })
  await expect(db.as('service_role', null, 'select begin_account_deletion($1)', [user])).resolves.toBeDefined()
  mock.user.mockResolvedValue({ id: creator })
  expect((await creditStatus(request)).status).toBe(404)
})
it('P4-07: deposit failures belong to the booking named by the confirmed Stripe session', async () => {
  await startDeposit()
  session = { ...session, status: 'complete', payment_status: 'unpaid' }
  await event()
  const response = await depositStatus(new Request(`http://localhost/api/deposit-checkout-status?booking=${booking}&session_id=cs_failed`))
  expect(await response.json()).toEqual({ status: 'failed' })
  mock.user.mockResolvedValue({ id: creator })
  expect((await depositStatus(new Request(`http://localhost/api/deposit-checkout-status?booking=${booking}&session_id=cs_failed`))).status).toBe(404)
})
it('P4-07: a database failure rolls back the terminal receipt and leaves the event retryable', async () => {
  await credits(jsonRequest({ packId: 'starter' }))
  session = { ...session, status: 'expired' }
  await db.exec("create function public.fail_checkout_delete_test() returns trigger language plpgsql as $$ begin raise exception 'delete unavailable'; end $$; create trigger fail_checkout_delete_test before delete on payment_checkouts for each row execute function fail_checkout_delete_test()")
  try {
    expect((await event('checkout.session.expired')).status).toBe(500)
    expect(await scalar('select count(*)::integer from checkout_failures')).toBe(0)
    expect(await scalar('select count(*)::integer from payment_checkouts')).toBe(1)
  } finally { await db.exec('drop trigger fail_checkout_delete_test on payment_checkouts; drop function fail_checkout_delete_test()') }
  expect((await event('checkout.session.expired')).status).toBe(200)
  expect(await scalar('select count(*)::integer from payment_checkouts')).toBe(0)
})
it('P4-07: a recorded payment wins over a stale failure even when the supplied current snapshot is unpaid', async () => {
  await credits(jsonRequest({ packId: 'starter' }))
  await db.as('service_role', null, "select apply_credit_payment('evt_paid','pi_paid',$1,5,'cs_failed',0)", [user])
  session = { ...session, status: 'complete', payment_status: 'unpaid' }
  await event()
  expect(await scalar('select count(*)::integer from checkout_failures')).toBe(0)
  expect((await creditStatus(new Request('http://localhost/api/credit-checkout-status?session_id=cs_failed'))).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data order by credit_balance desc limit 1')).toBe(5)
})
it('P4-07: browser roles cannot forge failed receipts or release another checkout', async () => {
  for (const role of ['anon', 'authenticated']) {
    await expect(db.as(role, user, 'select * from checkout_failures')).rejects.toThrow()
    await expect(db.as(role, user, "select close_failed_checkout('cs_forged',$1,'credits','failed')", [user])).rejects.toThrow()
  }
})
