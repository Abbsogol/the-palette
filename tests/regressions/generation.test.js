import { beforeEach, expect, it, vi } from 'vitest'
import { generationEnvironment, jsonRequest, user } from '../helpers/supabase'

const auth = vi.hoisted(() => ({ getSessionUser: vi.fn(), client: {} }))
vi.mock('@/lib/auth', () => ({ getSessionUser: auth.getSessionUser, serviceClient: auth.client }))
import { POST } from '@/app/api/generate-nail-design/route'

const body = { vibe: ['Minimal'], shape: 'Almond', length: 'Short' }
beforeEach(() => {
  auth.getSessionUser.mockResolvedValue(user)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
function setup(options) {
  const env = generationEnvironment(options)
  Object.assign(auth.client, env.client)
  vi.stubGlobal('fetch', env.fetch)
  return env
}

it('REG-02: reserves the last credit before incurring a second generation cost', async () => {
  const env = setup({ balance: 1 })
  const responses = await Promise.all([POST(jsonRequest(body)), POST(jsonRequest(body))])
  expect.soft(responses.filter(r => r.ok)).toHaveLength(1)
  expect.soft(env.state.generated).toBe(1)
  expect(env.state.charged).toBe(1)
})

it('REG-06: restores the free regeneration after an upstream network exception', async () => {
  const env = setup({ failFetch: true })
  expect((await POST(jsonRequest({ ...body, freeRegen: true, parentGenerationId: 'parent-a' }))).status).toBe(500)
  expect(env.state.inserts).toBe(0)
  expect(env.state.freeRegenUsed).toBe(false)
})

it('REG-05: rejects unsupported reference-image mode without charging for a misleading result', async () => {
  const env = setup({ balance: 3 })
  const response = await POST(jsonRequest({ ...body, referenceImageUrls: ['https://images.invalid/reference.jpg'] }))
  expect.soft([400, 422]).toContain(response.status)
  expect.soft(env.fetch).not.toHaveBeenCalled()
  expect(env.state.charged).toBe(0)
})
