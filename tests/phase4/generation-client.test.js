import { beforeEach, expect, it, vi } from 'vitest'
import { requestGeneration } from '@/lib/generation-request'
const session = { user: { id: 'user-one' }, access_token: 'test-only' }
const payload = { vibe: ['Minimal'], shape: 'Almond', length: 'Short' }
let storage, saved
beforeEach(() => {
  saved = new Map()
  storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }
})
it('P4-03: a lost HTTP response reuses the persisted intent when the user retries', async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(Response.json({ generationId: 'saved-generation', creditsRemaining: 0 }))
  vi.stubGlobal('fetch', send)
  await expect(requestGeneration(session, payload, storage)).rejects.toThrow('Connection lost')
  const result = await requestGeneration(session, payload, storage)
  expect(result.generationId).toBe('saved-generation')
  expect(JSON.parse(send.mock.calls[0][1].body).requestId).toBe(JSON.parse(send.mock.calls[1][1].body).requestId)
  expect(saved.size).toBe(0)
})
it('P4-03: pending work is not rendered as a completed image and keeps its retry token', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Still generating' }, { status: 202 })))
  await expect(requestGeneration(session, payload, storage)).rejects.toThrow('Still generating')
  expect(saved.size).toBe(1)
})
it('P4-03: a released attempt clears its token so the next explicit generation is a new intent', async () => {
  const send = vi.fn().mockResolvedValueOnce(Response.json({ error: 'Credit restored' }, { status: 410 })).mockResolvedValueOnce(Response.json({ generationId: 'new-generation' }))
  vi.stubGlobal('fetch', send)
  await expect(requestGeneration(session, payload, storage)).rejects.toThrow('Credit restored')
  await requestGeneration(session, payload, storage)
  expect(JSON.parse(send.mock.calls[0][1].body).requestId).not.toBe(JSON.parse(send.mock.calls[1][1].body).requestId)
})
it('P4-03: blocked local storage fails before a paid request; another account never reuses the same intent', async () => {
  const send = vi.fn(async () => { throw new Error('Offline') })
  vi.stubGlobal('fetch', send)
  await expect(requestGeneration(session, payload, { ...storage, setItem: () => { throw new Error('Storage disabled') } })).rejects.toThrow('Storage disabled')
  expect(send).not.toHaveBeenCalled()
  await requestGeneration(session, payload, storage).catch(() => {})
  await requestGeneration({ ...session, user: { id: 'user-two' } }, payload, storage).catch(() => {})
  expect(JSON.parse(send.mock.calls[0][1].body).requestId).not.toBe(JSON.parse(send.mock.calls[1][1].body).requestId)
})
