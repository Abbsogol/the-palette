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
import { GET as boostStatus } from '@/app/api/boost-checkout-status/route'
import { deliverReminderEmails } from '@/lib/reminder-emails'

const user = '00000000-0000-4000-8000-000000000501'
const creator = '00000000-0000-4000-8000-000000000502'
const booking = '20000000-0000-4000-8000-000000000501'
const service = '30000000-0000-4000-8000-000000000501'
const meta = { type: 'deposit', bookingId: booking, userId: user }
let db, refunds
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
const event = (id, type, object, created = 100) => webhook(jsonRequest({ id, type, created, data: { object } }))
const lateDeposit = () => event('evt_late', 'checkout.session.completed', {
  id: 'cs_late', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_late', metadata: meta,
})
const outcome = async () => (await depositStatus(new Request(`http://localhost/api/deposit-checkout-status?booking=${booking}&session_id=cs_late`))).json()
const refund = (id, amount, status = 'succeeded', metadata = {}) => ({ id, amount, status, metadata, payment_intent: 'pi_late', currency: 'aed', charge: 'ch_late' })

beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await db.exec('truncate auth.users,public.profiles_data,public.processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1),($2)', [user, creator])
  await db.query("update profiles_data set account_type='creator' where id=$1", [creator])
  await db.query("insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values ($1,$2,'Manicure',60,100,25)", [service, creator])
  await db.query("insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time,status) values ($1,$2,$3,$4,current_date+1,'10:00','11:00','cancelled')", [booking, user, creator, service])
  Object.assign(mock.client, sqlSupabase(db))
  mock.user.mockResolvedValue({ id: user })
  refunds = []
  mock.intent.mockImplementation(async () => ({ id: 'pi_late', amount: 2500, amount_received: 2500, currency: 'aed', metadata: meta,
    latest_charge: { id: 'ch_late', amount: 2500, amount_refunded: refunds.filter(r => !['failed', 'canceled'].includes(r.status)).reduce((sum, r) => sum + r.amount, 0), currency: 'aed', payment_intent: 'pi_late' },
  }))
  mock.refundList.mockImplementation(async () => ({ data: refunds, has_more: false }))
  mock.refundRetrieve.mockImplementation(async id => refunds.find(r => r.id === id))
  // Model Stripe's remaining refundable amount instead of an unconditional
  // successful refund double. Already-refunded payments reject another refund.
  mock.refund.mockImplementation(async params => {
    const remaining = 2500 - refunds.filter(r => !['failed', 'canceled'].includes(r.status)).reduce((sum, r) => sum + r.amount, 0)
    if (remaining <= 0) throw new Error('Charge has already been refunded')
    const result = refund('re_auto', remaining, 'succeeded', params.metadata)
    refunds.push(result)
    return result
  })
})

it('a full manual refund before delayed deposit fulfillment resolves without another refund request', async () => {
  refunds.push(refund('re_manual', 2500))
  expect((await lateDeposit()).status).toBe(200)
  expect(mock.refund).not.toHaveBeenCalled()
  expect(await outcome()).toEqual({ status: 'refunded' })
  expect(await scalar("select needs_review from order_payments where payment_intent='pi_late'")).toBe(false)
  expect(await scalar('select deposit_paid from bookings where id=$1', [booking])).toBe(false)
})

it('a pending manual partial refund plus successful automatic remainder is not a completed full refund', async () => {
  refunds.push(refund('re_manual', 1000, 'pending'))
  expect((await lateDeposit()).status).toBe(200)
  expect(refunds.find(r => r.id === 're_auto')?.amount).toBe(1500)
  expect(await outcome()).toEqual({ status: 'refund_pending' })
  expect(await scalar("select refunded from order_payments where payment_intent='pi_late'")).toBe(false)
  await expect(db.as('service_role', null, 'select begin_account_deletion($1)', [user])).rejects.toThrow('BILLING_IN_PROGRESS')
})

it('successful manual partial refunds and the automatic remainder together resolve the entire deposit', async () => {
  refunds.push(refund('re_manual', 1000))
  expect((await lateDeposit()).status).toBe(200)
  expect(refunds.find(r => r.id === 're_auto')?.amount).toBe(1500)
  expect(await outcome()).toEqual({ status: 'refunded' })
  expect(await scalar("select needs_review from order_payments where payment_intent='pi_late'")).toBe(false)
})

it('a reminder claimed before cancellation does not send after the cancellation commits', async () => {
  await db.query("update bookings set status='confirmed' where id=$1", [booking])
  await db.as('service_role', null, 'select enqueue_booking_reminders(current_date+1)')
  let canceled = false
  mock.client.auth = { admin: { getUserById: async () => {
    if (!canceled) {
      await db.as('authenticated', user, "update bookings set status='cancelled' where id=$1", [booking])
      canceled = true
    }
    return { data: { user: { email: 'fixture@example.invalid' } }, error: null }
  } } }
  const send = vi.fn().mockResolvedValue({ data: { id: 'fixture_email' }, error: null })
  await deliverReminderEmails(mock.client, { emails: { send } })
  expect(await scalar('select status from bookings where id=$1', [booking])).toBe('cancelled')
  expect(send).not.toHaveBeenCalled()
  expect(await scalar("select count(*)::integer from reminder_emails where status='sent'")).toBe(0)
})

it('a manual refund transition completes the aggregate without late_deposit metadata', async () => {
  const manual = refund('re_manual', 1000, 'pending')
  refunds.push(manual)
  expect((await lateDeposit()).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refund_pending' })
  manual.status = 'succeeded'
  expect((await event('evt_manual_succeeded', 'refund.updated', manual, 200)).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
  expect(await scalar("select refund_succeeded_amount from order_payments where payment_intent='pi_late'")).toBe(2500)
})

it('a manual refund that later fails returns the overall deposit to review without issuing another refund', async () => {
  const manual = refund('re_manual', 1000)
  refunds.push(manual)
  expect((await lateDeposit()).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
  manual.status = 'failed'
  expect((await event('evt_manual_failed', 'refund.failed', manual, 200)).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refund_failed' })
  expect(await scalar("select needs_review from order_payments where payment_intent='pi_late'")).toBe(true)
  expect(mock.refund).toHaveBeenCalledTimes(1)
})

it('a newer refund event retries while an earlier reconciliation holds a stale provider snapshot', async () => {
  const manual = refund('re_manual', 2500, 'pending')
  refunds.push(manual)
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const reading = new Promise(resolve => { started = resolve })
  mock.refundList.mockImplementationOnce(async () => {
    const snapshot = structuredClone(refunds)
    started()
    await gate
    return { data: snapshot, has_more: false }
  })
  const first = lateDeposit()
  await reading
  manual.status = 'succeeded'
  const newer = await event('evt_manual_succeeded', 'refund.updated', manual, 200)
  release()
  expect(newer.status).toBe(500)
  expect((await first).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refund_pending' })
  expect((await event('evt_manual_succeeded', 'refund.updated', manual, 200)).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
})

it('a refund accepted before its response is lost is discovered without a duplicate request', async () => {
  mock.refund.mockImplementationOnce(async params => {
    refunds.push(refund('re_accepted', 2500, 'succeeded', params.metadata))
    throw new Error('Response connection lost')
  })
  expect((await lateDeposit()).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
  expect((await lateDeposit()).status).toBe(200)
  expect(mock.refund).toHaveBeenCalledTimes(1)
})

it('a manual full refund racing the automatic create is reconciled after Stripe rejects the duplicate', async () => {
  mock.refund.mockImplementationOnce(async () => {
    refunds.push(refund('re_manual_race', 2500))
    throw new Error('Charge has already been refunded')
  })
  expect((await lateDeposit()).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
  expect(refunds).toHaveLength(1)
})

it('an incomplete refund listing never creates another refund or marks the deposit resolved', async () => {
  mock.refundList.mockResolvedValue({ data: [refund('re_manual', 2500)], has_more: true })
  expect((await lateDeposit()).status).toBe(500)
  expect(mock.refund).not.toHaveBeenCalled()
  expect(await scalar("select refunded from order_payments where payment_intent='pi_late'")).toBe(false)
  expect(await scalar("select needs_review from order_payments where payment_intent='pi_late'")).toBe(true)
})

it('browser roles cannot acquire or finish refund reconciliation leases', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const signature of ['claim_deposit_refund_check(text)', 'finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint)', 'release_deposit_refund_check(text,uuid)']) {
      expect(await scalar("select has_function_privilege($1,$2,'EXECUTE')", [role, signature])).toBe(false)
    }
    await expect(db.as(role, user, "select claim_deposit_refund_check('pi_late')")).rejects.toThrow()
  }
})

it('an expired refund worker cannot overwrite a successor or release its lease', async () => {
  await db.as('service_role', null, "select apply_order_payment('evt_paid','pi_late',$1,'deposit',$2,0,'cs_late')", [user, booking])
  const oldToken = (await db.as('service_role', null, "select claim_deposit_refund_check('pi_late') as token")).rows[0].token
  await db.query("update order_payments set refund_check_until=now()-interval '1 second' where payment_intent='pi_late'")
  const newToken = (await db.as('service_role', null, "select claim_deposit_refund_check('pi_late') as token")).rows[0].token
  expect(newToken).not.toBe(oldToken)
  const oldWrite = await db.as('service_role', null, "select finish_deposit_refund_check('pi_late',$1,2500,0,2500,false,false,'re_manual',100) as saved", [oldToken])
  expect(oldWrite.rows[0].saved).toBe(false)
  await db.as('service_role', null, "select release_deposit_refund_check('pi_late',$1)", [oldToken])
  expect(await scalar("select refund_check_token from order_payments where payment_intent='pi_late'")).toBe(newToken)
  expect((await db.as('service_role', null, "select finish_deposit_refund_check('pi_late',$1,2500,2500,0,false,false,'re_manual',200) as saved", [newToken])).rows[0].saved).toBe(true)
  expect(await outcome()).toEqual({ status: 'refunded' })
})

it('a pending full refund before the cancelled booking checkout cannot masquerade as a succeeded refund', async () => {
  const manual = refund('re_manual', 2500, 'pending')
  refunds.push(manual)
  expect((await event('evt_charge_pending', 'charge.refunded', { id: 'ch_late', payment_intent: 'pi_late', amount: 2500, amount_refunded: 2500 }, 90)).status).toBe(200)
  expect((await lateDeposit()).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refund_pending' })
  expect(await scalar("select refunded from order_payments where payment_intent='pi_late'")).toBe(false)
  expect(mock.refund).not.toHaveBeenCalled()
  manual.status = 'succeeded'
  expect((await event('evt_manual_success', 'refund.updated', manual, 200)).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
  expect(await scalar("select needs_review from payment_refund_states where payment_intent='pi_late'")).toBe(false)
  await expect(db.as('service_role', null, 'select begin_account_deletion($1)', [user])).resolves.toBeDefined()
})

it('an ordinary booking deposit stays paid while a full refund is pending and clears when it succeeds', async () => {
  await db.query("update bookings set status='confirmed' where id=$1", [booking])
  expect((await lateDeposit()).status).toBe(200)
  const manual = refund('re_manual', 2500, 'pending')
  refunds.push(manual)
  expect((await event('evt_charge_pending', 'charge.refunded', { id: 'ch_late', payment_intent: 'pi_late', amount: 2500, amount_refunded: 2500 }, 150)).status).toBe(200)
  expect(await scalar('select deposit_paid from bookings where id=$1', [booking])).toBe(true)
  manual.status = 'succeeded'
  expect((await event('evt_manual_success', 'refund.updated', manual, 200)).status).toBe(200)
  expect(await scalar('select deposit_paid from bookings where id=$1', [booking])).toBe(false)
  expect(await outcome()).toEqual({ status: 'refunded' })
})

it('an ordinary deposit refund that later fails reports review and prevents deletion', async () => {
  await db.query("update bookings set status='confirmed' where id=$1", [booking])
  expect((await lateDeposit()).status).toBe(200)
  const manual = refund('re_manual', 2500)
  refunds.push(manual)
  expect((await event('evt_charge_success', 'charge.refunded', { id: 'ch_late', payment_intent: 'pi_late', amount: 2500, amount_refunded: 2500 }, 150)).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
  manual.status = 'failed'
  expect((await event('evt_manual_failed', 'refund.failed', manual, 200)).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'payment_review' })
  expect(await scalar("select needs_review from payment_refund_states where payment_intent='pi_late'")).toBe(true)
  await expect(db.as('service_role', null, 'select begin_account_deletion($1)', [user])).rejects.toThrow('BILLING_IN_PROGRESS')
})

async function creditPayment(credits = 5) {
  const metadata = { type: 'credits', userId: user, credits: String(credits) }
  mock.intent.mockResolvedValue({ id: 'pi_credit', amount_received: 1000, currency: 'aed', metadata })
  mock.session.mockResolvedValue({ id: 'cs_credit', mode: 'payment', metadata })
  expect((await event('evt_credit_paid', 'checkout.session.completed', { id: 'cs_credit', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_credit', metadata })).status).toBe(200)
  return { ...refund('re_credit', 1000), payment_intent: 'pi_credit' }
}

it('a pending credit-pack refund does not revoke usable credits', async () => {
  const pending = await creditPayment(); pending.status = 'pending'; refunds.push(pending)
  expect((await event('evt_credit_refund', 'charge.refunded', { id: 'ch_credit', payment_intent: 'pi_credit', amount: 1000, amount_refunded: 1000 })).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(5)
  expect(await scalar("select refunded_credits from credit_payments where payment_intent='pi_credit'")).toBe(0)
})

it('a pending boost refund preserves purchased promotion time', async () => {
  const design = '10000000-0000-4000-8000-000000000501'
  await db.query("insert into designs(id,created_by,title,is_published) values ($1,$2,'Promotion',true)", [design, creator])
  const metadata = { type: 'boost', creatorId: creator, designId: design, days: '1' }
  mock.intent.mockResolvedValue({ id: 'pi_boost', amount_received: 1500, currency: 'aed', metadata })
  expect((await event('evt_boost_paid', 'checkout.session.completed', { id: 'cs_boost', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_boost', metadata })).status).toBe(200)
  const until = await scalar('select boosted_until from designs where id=$1', [design])
  refunds.push({ ...refund('re_boost', 1500, 'pending'), payment_intent: 'pi_boost' })
  expect((await event('evt_boost_refund', 'charge.refunded', { id: 'ch_boost', payment_intent: 'pi_boost', amount: 1500, amount_refunded: 1500 })).status).toBe(200)
  expect(await scalar('select boosted_until from designs where id=$1', [design])).toEqual(until)
})

it('a credit refund that later fails stays reviewable and blocks deletion without inventing another grant', async () => {
  const manual = await creditPayment(); refunds.push(manual)
  expect((await event('evt_credit_refund', 'charge.refunded', { id: 'ch_credit', payment_intent: 'pi_credit', amount: 1000, amount_refunded: 1000 })).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
  manual.status = 'failed'
  expect((await event('evt_credit_failed', 'refund.failed', manual, 200)).status).toBe(200)
  await expect(db.as('service_role', null, 'select begin_account_deletion($1)', [user])).rejects.toThrow('BILLING_IN_PROGRESS')
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
})

it('successive partial refunds reverse credits cumulatively and duplicates never debit twice', async () => {
  const partial = await creditPayment(40); partial.amount = 250; refunds.push(partial)
  expect((await event('evt_partial_a', 'refund.updated', partial)).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(30)
  refunds.push({ ...partial, id: 're_credit_b' })
  expect((await event('evt_partial_b', 'refund.updated', refunds[1])).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(20)
  expect((await event('evt_partial_b', 'refund.updated', refunds[1])).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(20)
  expect(await scalar("select refunded_credits from credit_payments where payment_intent='pi_credit'")).toBe(20)
})

it('a monetary refund smaller than one credit remains visible to its owner', async () => {
  const small = await creditPayment(); small.amount = 1; refunds.push(small)
  expect((await event('evt_small_refund', 'refund.updated', small)).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(5)
  expect(await (await creditStatus(new Request('http://localhost/api/credit-checkout-status?session_id=cs_credit'))).json()).toEqual({ status: 'refund_recorded' })
})

it('pending and failed credit refund outcomes are private and visible without a false credit grant', async () => {
  const pending = await creditPayment(); pending.status = 'pending'; refunds.push(pending)
  expect((await event('evt_pending', 'refund.updated', pending)).status).toBe(200)
  const request = new Request('http://localhost/api/credit-checkout-status?session_id=cs_credit')
  expect(await (await creditStatus(request)).json()).toEqual({ status: 'refund_pending' })
  pending.status = 'failed'
  expect((await event('evt_failed', 'refund.failed', pending)).status).toBe(200)
  expect(await (await creditStatus(request)).json()).toEqual({ status: 'payment_review' })
  mock.user.mockResolvedValue({ id: creator })
  expect((await creditStatus(request)).status).toBe(404)
})

it('boost refund review is visible only to the design owner and preserves unrelated promotions', async () => {
  const design = '10000000-0000-4000-8000-000000000501'
  await db.query("insert into designs(id,created_by,title,is_published) values ($1,$2,'Promotion',true)", [design, creator])
  const metadata = { type: 'boost', creatorId: creator, designId: design, days: '1' }
  mock.intent.mockResolvedValue({ id: 'pi_boost', amount_received: 1500, currency: 'aed', metadata })
  for (const intent of ['pi_boost', 'pi_unrelated']) {
    expect((await event(`evt_${intent}`, 'checkout.session.completed', { id: `cs_${intent}`, mode: 'payment', payment_status: 'paid', payment_intent: intent, metadata })).status).toBe(200)
  }
  const manual = { ...refund('re_boost', 1500, 'pending'), payment_intent: 'pi_boost' }; refunds.push(manual)
  expect((await event('evt_pending', 'refund.updated', manual)).status).toBe(200)
  mock.user.mockResolvedValue({ id: creator })
  const request = new Request(`http://localhost/api/boost-checkout-status?designId=${design}`)
  const pending = await boostStatus(request)
  expect(pending.headers.get('cache-control')).toBe('no-store')
  expect(await pending.json()).toEqual({ status: 'refund_pending' })
  manual.status = 'succeeded'
  expect((await event('evt_succeeded', 'refund.updated', manual)).status).toBe(200)
  expect(await (await boostStatus(request)).json()).toEqual({ status: 'refund_recorded' })
  expect(new Date(await scalar('select boosted_until from designs where id=$1', [design])).getTime()).toBeGreaterThan(Date.now() + 0.99 * 86400000)
  manual.status = 'failed'
  expect((await event('evt_failed', 'refund.failed', manual)).status).toBe(200)
  expect(await (await boostStatus(request)).json()).toEqual({ status: 'payment_review' })
  await expect(db.as('service_role', null, 'select begin_account_deletion($1)', [creator])).rejects.toThrow('BILLING_IN_PROGRESS')
  mock.user.mockResolvedValue({ id: user })
  expect((await boostStatus(request)).status).toBe(404)
  mock.user.mockResolvedValue(null)
  expect((await boostStatus(request)).status).toBe(401)
})

it('refund status and entitlement changes roll back together after a database failure', async () => {
  const manual = await creditPayment(); refunds.push(manual)
  await db.exec("alter table profiles_data add constraint simulated_refund_failure check(id<>'00000000-0000-4000-8000-000000000501'::uuid or credit_balance>=5)")
  try {
    expect((await event('evt_retry', 'refund.updated', manual)).status).toBe(500)
    expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(5)
    expect(await scalar("select refunded_credits from credit_payments where payment_intent='pi_credit'")).toBe(0)
    expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_retry'")).toBe(0)
  } finally { await db.exec('alter table profiles_data drop constraint simulated_refund_failure') }
  expect((await event('evt_retry', 'refund.updated', manual)).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
  expect(await scalar("select status from payment_refund_states where payment_intent='pi_credit'")).toBe('refunded')
})

it('browser roles cannot read financial review state or acquire its privileged operations', async () => {
  for (const role of ['anon', 'authenticated']) {
    await expect(db.as(role, user, 'select * from payment_refund_states')).rejects.toThrow()
    for (const signature of ['claim_payment_refund_check(text,uuid,text,uuid,integer)', 'finish_payment_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text)', 'release_payment_refund_check(text,uuid)']) {
      expect(await scalar("select has_function_privilege($1,$2,'EXECUTE')", [role, signature])).toBe(false)
    }
  }
})

it('a changed refund metadata owner cannot create review state for another account', async () => {
  const manual = await creditPayment(); refunds.push(manual)
  mock.intent.mockResolvedValue({ id: 'pi_credit', amount_received: 1000, currency: 'aed', metadata: { type: 'credits', userId: creator, credits: '5' } })
  expect((await event('evt_wrong_owner', 'refund.updated', manual)).status).toBe(500)
  expect(await scalar('select count(*)::integer from payment_refund_states')).toBe(0)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(5)
})

it('a late deposit refund stays protected after a subsequent reconciliation loses provider access', async () => {
  refunds.push(refund('re_manual', 2500))
  expect((await lateDeposit()).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
  mock.intent.mockRejectedValueOnce(new Error('Provider read unavailable'))
  expect((await event('evt_refund_refresh', 'refund.updated', refunds[0], 200)).status).toBe(500)
  expect(await outcome()).toEqual({ status: 'payment_review' })
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
  expect((await event('evt_refund_refresh', 'refund.updated', refunds[0], 200)).status).toBe(200)
  expect(await outcome()).toEqual({ status: 'refunded' })
})

it('an expired late refund reconciliation lease never permits deletion before a fresh provider check', async () => {
  refunds.push(refund('re_manual', 2500))
  expect((await lateDeposit()).status).toBe(200)
  await db.as('service_role', null, "select claim_deposit_refund_check('pi_late')")
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
  await db.query("update order_payments set refund_check_until=now()-interval '1 second' where payment_intent='pi_late'")
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
})

it('a credit refund stays protected after an acquired reconciliation lease loses provider access', async () => {
  const manual = await creditPayment(); refunds.push(manual)
  expect((await event('evt_success', 'refund.updated', manual)).status).toBe(200)
  const current = await mock.intent()
  mock.intent.mockResolvedValueOnce(current).mockRejectedValueOnce(new Error('Provider read unavailable'))
  expect((await event('evt_refresh', 'refund.updated', manual, 200)).status).toBe(500)
  expect(await scalar("select status from payment_refund_states where payment_intent='pi_credit'")).toBe('payment_review')
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
  expect((await event('evt_refresh', 'refund.updated', manual, 200)).status).toBe(200)
  expect(await scalar("select status from payment_refund_states where payment_intent='pi_credit'")).toBe('refunded')
})

it('a crashed generic refund worker cannot make an expired lease look safe for deletion', async () => {
  const manual = await creditPayment(); refunds.push(manual)
  expect((await event('evt_success', 'refund.updated', manual)).status).toBe(200)
  await db.as('service_role', null, "select claim_payment_refund_check('pi_credit',$1,'credits',null,5)", [user])
  await db.query("update payment_refund_states set check_until=now()-interval '1 second' where payment_intent='pi_credit'")
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
})
