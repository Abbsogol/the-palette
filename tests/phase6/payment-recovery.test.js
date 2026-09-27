import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { sqlSupabase } from '../helpers/sql-supabase'
import { jsonRequest } from '../helpers/supabase'

const mock = vi.hoisted(() => ({ client: {}, user: vi.fn(), session: vi.fn(), intent: vi.fn(), refund: vi.fn(), refundRetrieve: vi.fn(), refundList: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mock.user, serviceClient: mock.client }))
vi.mock('stripe', () => ({ default: class Stripe {
  checkout = { sessions: { retrieve: mock.session } }
  paymentIntents = { retrieve: mock.intent }
  refunds = { create: mock.refund, retrieve: mock.refundRetrieve, list: mock.refundList }
  webhooks = { constructEvent: body => JSON.parse(body) }
} }))
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { GET as depositStatus } from '@/app/api/deposit-checkout-status/route'
import { GET as creditStatus } from '@/app/api/credit-checkout-status/route'

const user = '00000000-0000-4000-8000-000000000601'
const creator = '00000000-0000-4000-8000-000000000602'
const booking = '20000000-0000-4000-8000-000000000601'
const service = '30000000-0000-4000-8000-000000000601'
const depositMeta = { type: 'deposit', bookingId: booking, userId: user }
let db, intents, refunds, sessions
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
const event = (id, type, object, created = 100) => webhook(jsonRequest({ id, type, created, data: { object } }))
const refund = (intent, id, amount, status = 'succeeded') => ({ id, amount, status, metadata: {}, payment_intent: intent, currency: 'aed' })
const depositOutcome = async () => (await depositStatus(new Request(`http://localhost/api/deposit-checkout-status?booking=${booking}&session_id=cs_deposit`))).json()
const creditOutcome = async () => (await creditStatus(new Request('http://localhost/api/credit-checkout-status?session_id=cs_credit'))).json()
const refundEvent = (item, id = 'evt_refund', type = 'refund.updated') => event(id, type, item)

beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await db.exec('truncate auth.users,public.profiles_data,public.processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1),($2)', [user, creator])
  await db.query("update profiles_data set account_type='creator' where id=$1", [creator])
  await db.query("insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values ($1,$2,'Manicure',60,100,25)", [service, creator])
  await db.query("insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time,status,time_zone) values ($1,$2,$3,$4,current_date+1,'10:00','11:00','cancelled','UTC')", [booking, user, creator, service])
  Object.assign(mock.client, sqlSupabase(db))
  mock.user.mockResolvedValue({ id: user })
  intents = new Map(); sessions = new Map(); refunds = []
  mock.intent.mockImplementation(async id => structuredClone(intents.get(id)))
  mock.session.mockImplementation(async id => structuredClone(sessions.get(id)))
  mock.refundRetrieve.mockImplementation(async id => structuredClone(refunds.find(item => item.id === id)))
  mock.refundList.mockImplementation(async ({ payment_intent, limit = 100, starting_after }) => {
    const matching = refunds.filter(item => item.payment_intent === payment_intent)
    const start = starting_after ? matching.findIndex(item => item.id === starting_after) + 1 : 0
    return { data: structuredClone(matching.slice(start, start + limit)), has_more: start + limit < matching.length }
  })
  mock.refund.mockImplementation(async ({ payment_intent, metadata }) => {
    const reserved = refunds.filter(item => item.payment_intent === payment_intent && !['failed', 'canceled'].includes(item.status)).reduce((sum, item) => sum + item.amount, 0)
    const amount = intents.get(payment_intent).amount_received - reserved
    if (amount <= 0) throw new Error('Already refunded')
    const created = { ...refund(payment_intent, `re_auto_${refunds.length}`, amount), metadata }
    refunds.push(created)
    return created
  })
})

async function credits(amount = 1000, count = 5) {
  const metadata = { type: 'credits', userId: user, credits: String(count) }
  intents.set('pi_credit', { id: 'pi_credit', amount_received: amount, currency: 'aed', metadata })
  const session = { id: 'cs_credit', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_credit', metadata }
  sessions.set(session.id, session)
  expect((await event('evt_credit_paid', 'checkout.session.completed', session)).status).toBe(200)
}
async function settledCredit() {
  await credits()
  const item = refund('pi_credit', 're_credit', 1000); refunds.push(item)
  expect((await refundEvent(item)).status).toBe(200)
  return item
}
async function settledLateDeposit() {
  intents.set('pi_deposit', { id: 'pi_deposit', amount_received: 2500, currency: 'aed', metadata: depositMeta })
  const session = { id: 'cs_deposit', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_deposit', metadata: depositMeta }
  sessions.set(session.id, session)
  expect((await event('evt_deposit_paid', 'checkout.session.completed', session)).status).toBe(200)
  return refunds[0]
}

it.each(['refund-object', 'charge-intent'])('a failed first %s provider lookup durably protects a settled credit refund', async boundary => {
  const item = await settledCredit(); item.status = 'failed'
  let response
  if (boundary === 'refund-object') {
    mock.refundRetrieve.mockRejectedValueOnce(new Error('Refund API unavailable'))
    response = await refundEvent(item, 'evt_bank_failed', 'refund.failed')
  } else {
    mock.intent.mockRejectedValueOnce(new Error('PaymentIntent API unavailable'))
    response = await event('evt_bank_failed', 'charge.refunded', { payment_intent: item.payment_intent })
  }
  expect(response.status).toBe(500)
  expect(await creditOutcome()).toEqual({ status: 'payment_review' })
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
})

it('a failed first refund lookup protects a previously settled late deposit', async () => {
  const item = await settledLateDeposit(); item.status = 'failed'
  mock.refundRetrieve.mockRejectedValueOnce(new Error('Refund API unavailable'))
  expect((await refundEvent(item, 'evt_bank_failed', 'refund.failed')).status).toBe(500)
  expect(await depositOutcome()).toEqual({ status: 'payment_review' })
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
})

it('an older successful refund reader cannot clear a newer event whose first provider lookup failed', async () => {
  const item = await settledCredit()
  let started, release
  const reading = new Promise(resolve => { started = resolve })
  const gate = new Promise(resolve => { release = resolve })
  mock.refundList.mockImplementationOnce(async () => {
    const snapshot = structuredClone(refunds)
    started(); await gate
    return { data: snapshot, has_more: false }
  })
  const older = refundEvent(item, 'evt_older_success')
  await reading
  item.status = 'failed'
  mock.refundRetrieve.mockRejectedValueOnce(new Error('Refund API unavailable'))
  const newer = await refundEvent(item, 'evt_newer_failed', 'refund.failed')
  release()
  expect(newer.status).toBe(500)
  expect((await older).status).toBe(500)
  expect(await creditOutcome()).toEqual({ status: 'payment_review' })
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
})

it('valid refund history spanning more than one provider page reconciles all money exactly once', async () => {
  await credits(10100, 40)
  refunds.push(...Array.from({ length: 101 }, (_, index) => refund('pi_credit', `re_page_${index}`, 100)))
  expect((await refundEvent(refunds[0], 'evt_many_refunds')).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
  expect(await scalar("select succeeded_amount from payment_refund_states where payment_intent='pi_credit'")).toBe(10100)
  expect(await creditOutcome()).toEqual({ status: 'refund_recorded' })
  expect(mock.refundList).toHaveBeenCalledWith({ payment_intent: 'pi_credit', limit: 100, starting_after: 're_page_99' })
  expect((await refundEvent(refunds[0], 'evt_many_refunds')).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
})

it('an older late-deposit reader cannot clear a newer refund event that failed before its claim', async () => {
  const item = await settledLateDeposit()
  let started, release
  const reading = new Promise(resolve => { started = resolve })
  const gate = new Promise(resolve => { release = resolve })
  mock.refundList.mockImplementationOnce(async () => {
    const snapshot = structuredClone(refunds)
    started(); await gate
    return { data: snapshot, has_more: false }
  })
  const older = refundEvent(item, 'evt_older_success')
  await reading
  item.status = 'failed'
  mock.refundRetrieve.mockRejectedValueOnce(new Error('Refund API unavailable'))
  const newer = await refundEvent(item, 'evt_newer_failed', 'refund.failed')
  release()
  expect(newer.status).toBe(500)
  expect((await older).status).toBe(500)
  expect(await depositOutcome()).toEqual({ status: 'payment_review' })
  expect((await refundEvent(item, 'evt_newer_failed', 'refund.failed')).status).toBe(200)
  expect(await depositOutcome()).toEqual({ status: 'refund_failed' })
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
})

it('retrying a failed first lookup reconciles the money state without a second credit grant', async () => {
  const item = await settledCredit()
  mock.refundRetrieve.mockRejectedValueOnce(new Error('Refund API unavailable'))
  expect((await refundEvent(item, 'evt_retry')).status).toBe(500)
  expect(await creditOutcome()).toEqual({ status: 'payment_review' })
  expect((await refundEvent(item, 'evt_retry')).status).toBe(200)
  expect(await creditOutcome()).toEqual({ status: 'refund_recorded' })
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
  expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='refund-total:pi_credit:1000'")).toBe(1)
  await expect(db.as('authenticated', user, 'select delete_own_account()')).resolves.toBeDefined()
})

it('a second-page provider failure does not apply an incomplete partial refund', async () => {
  await credits(10100, 40)
  refunds.push(...Array.from({ length: 101 }, (_, index) => refund('pi_credit', `re_page_${index}`, 100)))
  mock.refundList.mockImplementationOnce(async () => ({ data: structuredClone(refunds.slice(0, 100)), has_more: true }))
    .mockRejectedValueOnce(new Error('Second page unavailable'))
  expect((await refundEvent(refunds[0])).status).toBe(500)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(40)
  expect(await scalar("select refunded_credits from credit_payments where payment_intent='pi_credit'")).toBe(0)
  expect(await creditOutcome()).toEqual({ status: 'payment_review' })
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
  expect((await refundEvent(refunds[0])).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
})

it.each(['repeated-cursor', 'empty-more', 'wrong-intent', 'wrong-currency'])('malformed %s refund history fails closed without revoking credits', async malformed => {
  await credits()
  const item = refund('pi_credit', 're_bad', 1000); refunds.push(item)
  if (malformed === 'repeated-cursor') mock.refundList.mockResolvedValue({ data: [item], has_more: true })
  if (malformed === 'empty-more') mock.refundList.mockResolvedValue({ data: [], has_more: true })
  if (malformed === 'wrong-intent') mock.refundList.mockResolvedValue({ data: [{ ...item, payment_intent: 'pi_other' }], has_more: false })
  if (malformed === 'wrong-currency') mock.refundList.mockResolvedValue({ data: [{ ...item, currency: 'usd' }], has_more: false })
  expect((await refundEvent(item)).status).toBe(500)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(5)
  expect(await creditOutcome()).toEqual({ status: 'payment_review' })
})

it('late deposit refunds include manual refunds on later pages before requesting the exact remainder', async () => {
  intents.set('pi_deposit', { id: 'pi_deposit', amount_received: 2500, currency: 'aed', metadata: depositMeta })
  refunds.push(...Array.from({ length: 101 }, (_, index) => refund('pi_deposit', `re_partial_${index}`, 10)))
  const session = { id: 'cs_deposit', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_deposit', metadata: depositMeta }
  sessions.set(session.id, session)
  expect((await event('evt_deposit_paid', 'checkout.session.completed', session)).status).toBe(200)
  expect(mock.refund).toHaveBeenCalledTimes(1)
  expect(refunds.at(-1).amount).toBe(1490)
  expect(await depositOutcome()).toEqual({ status: 'refunded' })
  expect(await scalar("select refund_succeeded_amount from order_payments where payment_intent='pi_deposit'")).toBe(2500)
})

it('a pending refund preserves a held generation credit and only successful settlement reverses the hold', async () => {
  await credits()
  const generation = '40000000-0000-4000-8000-000000000601'
  expect((await db.as('service_role', null, 'select reserve_generation($1,$2,null) as reserved', [generation, user])).rows[0].reserved).toBe(true)
  const item = refund('pi_credit', 're_hold', 1000, 'pending'); refunds.push(item)
  expect((await refundEvent(item, 'evt_pending')).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(4)
  expect(await scalar('select credit_reversed from generation_reservations where id=$1', [generation])).toBe(false)
  item.status = 'succeeded'
  expect((await refundEvent(item, 'evt_success')).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
  expect(await scalar('select credit_reversed from generation_reservations where id=$1', [generation])).toBe(true)
  await db.as('service_role', null, 'select release_generation($1)', [generation])
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
})

it('browser roles cannot fabricate pre-provider refund uncertainty for another account', async () => {
  for (const role of ['anon', 'authenticated']) {
    expect(await scalar("select has_function_privilege($1,'mark_payment_refund_pending(text)','EXECUTE')", [role])).toBe(false)
    await expect(db.as(role, creator, "select mark_payment_refund_pending('pi_credit')")).rejects.toThrow()
  }
  expect((await db.as('service_role', null, "select mark_payment_refund_pending('pi_unknown') as tracked")).rows[0].tracked).toBe(false)
  expect(await scalar('select count(*)::integer from payment_refund_states')).toBe(0)
})

it('a refund history that omits the independently retrieved incoming refund cannot clear review', async () => {
  await credits()
  const item = refund('pi_credit', 're_pending', 1000, 'pending'); refunds.push(item)
  mock.refundList.mockResolvedValueOnce({ data: [], has_more: false })
  expect((await refundEvent(item, 'evt_missing_history', 'refund.created')).status).toBe(500)
  expect(await creditOutcome()).toEqual({ status: 'payment_review' })
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
})

it('conflicting provider snapshots cannot acknowledge a bank failure as a settled refund', async () => {
  const item = await settledCredit()
  const olderListing = structuredClone(refunds)
  item.status = 'failed'
  mock.refundList.mockResolvedValueOnce({ data: olderListing, has_more: false })
  expect((await refundEvent(item, 'evt_conflicting_bank_failure', 'refund.failed')).status).toBe(500)
  expect(await creditOutcome()).toEqual({ status: 'payment_review' })
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
  expect((await refundEvent(item, 'evt_conflicting_bank_failure', 'refund.failed')).status).toBe(200)
  expect(await creditOutcome()).toEqual({ status: 'payment_review' })
})
