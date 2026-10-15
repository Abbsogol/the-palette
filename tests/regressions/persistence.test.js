import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { database, jsonRequest, ok, user } from '../helpers/supabase'

const auth = vi.hoisted(() => ({ getSessionUser: vi.fn(), client: {} }))
vi.mock('@/lib/auth', () => ({ getSessionUser: auth.getSessionUser, serviceClient: auth.client }))
import { POST as publish } from '@/app/api/publish-nail-lab-generation/route'
import { POST as referral } from '@/app/api/apply-referral/route'
import { POST as upload } from '@/app/api/upload-design-photo/route'

beforeEach(() => {
  auth.getSessionUser.mockResolvedValue(user)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

it('REG-08: ensuring a board-save design preserves existing publication', async () => {
  let published = true
  Object.assign(auth.client, database(q => {
    if (q.table === 'nail_lab_generations') return ok({ id: 'generation-a', user_id: user.id })
    if (q.table === 'designs' && q.operation === 'select') return ok({ id: 'design-a', is_published: published })
    if (q.table === 'designs' && q.operation === 'update') { published = q.values.is_published; return ok(null) }
    throw new Error(`Unexpected query: ${q.table}`)
  }))
  expect((await publish(jsonRequest({ generationId: 'generation-a', asDraft: true }))).status).toBe(200)
  expect(published).toBe(true)
})

it('REG-10: a failed referral award is not acknowledged as successful and remains retryable', async () => {
  let claimed = false
  let rewards = 0
  let fail = true
  Object.assign(auth.client, database(() => { throw new Error('Referral must use one transaction') }, async (name) => {
    expect(name).toBe('apply_referral')
    if (fail) return { error: { message: 'Temporary write failure' } }
    if (!claimed) { claimed = true; rewards += 2 }
    return ok('applied')
  }))
  const first = await referral(jsonRequest({ code: 'TESTCODE' }))
  fail = false
  const retry = await referral(jsonRequest({ code: 'TESTCODE' }))
  expect.soft(first.status).toBeGreaterThanOrEqual(500)
  expect.soft(retry.status).toBe(200)
  expect(rewards).toBe(2)
})

it('REG-01: a benign AVIF mislabeled as JPEG is rejected before storage', async () => {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).avif().toBuffer()
  const store = vi.fn(async () => ok(null))
  Object.assign(auth.client, database(() => ok({ account_type: 'creator' })))
  auth.client.storage = { from: () => ({ upload: store, getPublicUrl: () => ({ data: { publicUrl: 'https://storage.invalid/image.webp' } }) }) }
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg')
  const response = await upload(new Request('http://localhost/api/upload-design-photo', { method: 'POST', body: form }))
  expect.soft(response.status).toBe(400)
  expect(store).not.toHaveBeenCalled()
})

it.each(['jpeg', 'png', 'webp', 'gif'])('accepts real %s bytes and stores a bounded WebP', async format => {
  const bytes = await sharp({ create: { width: 2000, height: 20, channels: 3, background: '#ff0000' } }).toFormat(format).toBuffer()
  const store = vi.fn(async () => ok(null))
  Object.assign(auth.client, database(() => ok({ account_type: 'creator' })))
  auth.client.storage = { from: () => ({ upload: store, getPublicUrl: () => ({ data: { publicUrl: 'https://storage.invalid/image.webp' } }) }) }
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: `image/${format}` }), `photo.${format}`)
  expect((await upload(new Request('http://localhost/api/upload-design-photo', { method: 'POST', body: form }))).status).toBe(200)
  const metadata = await sharp(store.mock.calls[0][1]).metadata()
  expect(metadata.format).toBe('webp')
  expect(metadata.width).toBeLessThanOrEqual(1600)
})
