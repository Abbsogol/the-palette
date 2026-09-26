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

it.each(['network', 'invalid-json', 'missing-image', 'upload', 'sign', 'persist'])('releases a paid reservation after a %s failure', async failure => {
  const env = setup({ balance: 1, failFetch: failure === 'network' })
  if (failure === 'invalid-json') env.fetch.mockResolvedValue({ ok: true, json: async () => { throw new Error('Bad JSON') } })
  if (failure === 'missing-image') env.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
  if (['upload', 'sign'].includes(failure)) {
    const original = env.client.storage.from()
    env.client.storage.from.mockReturnValue({ ...original, [failure === 'upload' ? 'upload' : 'createSignedUrl']: async () => ({ error: new Error('Storage unavailable') }) })
  }
  if (failure === 'persist') {
    const rpc = env.client.rpc.getMockImplementation()
    env.client.rpc.mockImplementation((name, args) => name === 'complete_generation' ? { error: new Error('Write failed') } : rpc(name, args))
  }
  expect((await POST(jsonRequest(body))).status).toBe(500)
  expect(env.state.balance).toBe(1)
  expect(env.state.inserts).toBe(0)
})

it('fails closed before contacting OpenAI when credit reservation is unavailable', async () => {
  const env = setup()
  env.client.rpc.mockResolvedValue({ error: new Error('Database unavailable') })
  expect((await POST(jsonRequest(body))).status).toBe(500)
  expect(env.fetch).not.toHaveBeenCalled()
})
