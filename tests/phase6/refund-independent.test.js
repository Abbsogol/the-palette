import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { sqlSupabase } from '../helpers/sql-supabase'
import { jsonRequest } from '../helpers/supabase'

const mock = vi.hoisted(() => ({ client: {}, intent: vi.fn(), refund: vi.fn(), list: vi.fn() }))
vi.mock('@/lib/auth', () => ({ serviceClient: mock.client }))
vi.mock('stripe', () => ({ default: class Stripe {
  paymentIntents = { retrieve: mock.intent }
  refunds = { retrieve: mock.refund, list: mock.list }
  webhooks = { constructEvent: body => JSON.parse(body) }
} }))
import { POST as webhook } from '@/app/api/stripe-webhook/route'

const user = '00000000-0000-4000-8000-000000000821'
const creator = '00000000-0000-4000-8000-000000000822'
const booking = '20000000-0000-4000-8000-000000000821'
const service = '30000000-0000-4000-8000-000000000821'
let db
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await db.exec('truncate auth.users,profiles_data,processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1),($2)', [user, creator])
  Object.assign(mock.client, sqlSupabase(db))
})

it('a known credit payment reconciles a refund even when its mutable PaymentIntent metadata was cleared', async () => {
  await db.as('service_role', null, "select apply_credit_payment('evt_paid','pi_owned',$1,5,'cs_owned')", [user])
  const refund = { id: 're_owned', payment_intent: 'pi_owned', amount: 1000, status: 'succeeded', currency: 'aed' }
  mock.refund.mockResolvedValue(refund)
  mock.intent.mockResolvedValue({ id: 'pi_owned', amount_received: 1000, currency: 'aed', metadata: {} })
  mock.list.mockResolvedValue({ data: [refund], has_more: false })
  const response = await webhook(jsonRequest({ id: 'evt_refunded', type: 'refund.updated', created: 200, data: { object: refund } }))
  expect(response.status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(0)
  expect(await scalar("select status from payment_refund_states where payment_intent='pi_owned'")).toBe('refunded')
  await db.as('service_role', null, 'select begin_account_deletion($1)', [user])
})

it('a charge refund for a known late deposit reconciles its obligation after PaymentIntent metadata was cleared', async () => {
  await db.query("update profiles_data set account_type='creator' where id=$1", [creator])
  await db.query("insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values($1,$2,'Manicure',60,100,25)", [service, creator])
  await db.query("insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time,status,time_zone) values($1,$2,$3,$4,current_date+1,'10:00','11:00','cancelled','UTC')", [booking, user, creator, service])
  await db.as('service_role', null, "select apply_order_payment('evt_deposit','pi_owned',$1,'deposit',$2,0,'cs_owned')", [user, booking])
  const refund = { id: 're_owned', payment_intent: 'pi_owned', amount: 2500, status: 'succeeded', currency: 'aed' }
  mock.intent.mockResolvedValue({ id: 'pi_owned', amount_received: 2500, currency: 'aed', metadata: {} })
  mock.list.mockResolvedValue({ data: [refund], has_more: false })
  const response = await webhook(jsonRequest({ id: 'evt_charge', type: 'charge.refunded', created: 200, data: { object: { payment_intent: 'pi_owned' } } }))
  expect(response.status).toBe(200)
  expect((await db.query("select refunded,needs_review,refund_reconciliation_pending from order_payments where payment_intent='pi_owned'")).rows[0])
    .toEqual({ refunded: true, needs_review: false, refund_reconciliation_pending: false })
  await db.as('service_role', null, 'select begin_account_deletion($1)', [user])
})

it.each([{ userId: creator }, { credits: '40' }, { type: 'boost' }])('a known payment rejects conflicting present metadata %j without reversing someone else’s credits', async metadata => {
  await db.as('service_role', null, "select apply_credit_payment('evt_paid','pi_owned',$1,5,'cs_owned')", [user])
  const refund = { id: 're_owned', payment_intent: 'pi_owned', amount: 1000, status: 'succeeded', currency: 'aed' }
  mock.refund.mockResolvedValue(refund)
  mock.intent.mockResolvedValue({ id: 'pi_owned', amount_received: 1000, currency: 'aed', metadata })
  mock.list.mockResolvedValue({ data: [refund], has_more: false })
  const response = await webhook(jsonRequest({ id: 'evt_conflict', type: 'refund.updated', created: 200, data: { object: refund } }))
  expect(response.status).toBe(500)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(5)
  expect(await scalar("select needs_review from payment_refund_states where payment_intent='pi_owned'")).toBe(true)
  await expect(db.as('service_role', null, 'select begin_account_deletion($1)', [user])).rejects.toThrow('BILLING_IN_PROGRESS')
})
