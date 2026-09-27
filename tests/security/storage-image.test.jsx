// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => ({ sign: vi.fn(), listen: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  getNailLabSignedUrl: storage.sign,
  supabase: { auth: { onAuthStateChange: storage.listen } },
}))
import StorageImage from '@/components/StorageImage'
import { persistentImageReference } from '@/lib/storage-reference'
const reference = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nail-lab/user-a/file.png`
let authChanged
beforeEach(() => {
  vi.clearAllMocks()
  storage.listen.mockImplementation(cb => { authChanged=cb; return {data:{subscription:{unsubscribe:vi.fn()}}} })
  storage.sign.mockResolvedValue('https://storage.invalid/signed.png')
})
afterEach(cleanup)
it('resolves private references through the authenticated Storage client', async () => {
  render(<StorageImage src={reference} alt="Private design" />)
  await waitFor(()=>expect(screen.getByAltText('Private design').getAttribute('src')).toBe('https://storage.invalid/signed.png'))
  expect(storage.sign).toHaveBeenCalledWith('user-a/file.png')
})
it('does not persist the access token from a signed board-cover URL', () => {
  expect(persistentImageReference(reference.replace('/public/','/sign/')+'?token=private-token')).toBe(reference)
})
it('does not show a stale signed response after the account changes', async () => {
  let resolveOld
  storage.sign.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve})).mockResolvedValue(null)
  render(<StorageImage src={reference} alt="Private design" />)
  await act(async()=>{authChanged();resolveOld('https://storage.invalid/stale-owner.png')})
  expect(screen.getByAltText('Private design').getAttribute('src')).toBeNull()
})
it('renders ordinary public images without requesting a signature', () => {
  render(<StorageImage src="https://public.invalid/design.png" alt="Public design" />)
  expect(screen.getByAltText('Public design').getAttribute('src')).toBe('https://public.invalid/design.png')
  expect(storage.sign).not.toHaveBeenCalled()
})
