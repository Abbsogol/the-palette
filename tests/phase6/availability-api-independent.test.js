import { beforeEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ getSessionUser: vi.fn(), serviceClient: { rpc: vi.fn() } }))
vi.mock('@/lib/auth', () => auth)
import { POST } from '@/app/api/update-availability/route'

const payload = { timeZone: 'Asia/Dubai', schedule: Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, start_time: '09:00', end_time: '17:00', is_active: true })) }
const request = body => new Request('https://example.test/api/update-availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  auth.getSessionUser.mockResolvedValue({ id: 'actual-owner' })
  auth.serviceClient.rpc.mockResolvedValue({ error: null })
})

it('binds a forged schedule owner to the authenticated account', async () => {
  const response = await POST(request({ ...payload, userId: 'victim', p_user_id: 'victim', creator_id: 'victim' }))
  expect(response.status).toBe(200)
  expect(auth.serviceClient.rpc).toHaveBeenCalledWith('save_creator_availability', { p_user_id: 'actual-owner', p_time_zone: payload.timeZone, p_schedule: payload.schedule })
})

it('returns a forbidden response when the database rejects a consumer or deleting account', async () => {
  auth.serviceClient.rpc.mockResolvedValue({ error: { message: 'CREATOR_REQUIRED' } })
  expect((await POST(request(payload))).status).toBe(403)
})

it('reports invalid hours and a failed save instead of claiming success', async () => {
  auth.serviceClient.rpc.mockResolvedValueOnce({ error: { message: 'INVALID_AVAILABILITY' } })
  expect((await POST(request(payload))).status).toBe(400)
  auth.serviceClient.rpc.mockResolvedValueOnce({ error: { message: 'connection unavailable' } })
  const response = await POST(request(payload))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'Availability could not be saved. Please retry.' })
})
