import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { database, jsonRequest, ok, user } from '../helpers/supabase'
const auth = vi.hoisted(() => ({ getSessionUser: vi.fn(), client: {} }))
vi.mock('@/lib/auth', () => ({ getSessionUser: auth.getSessionUser, serviceClient: auth.client }))
vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn() } } }))
import { GET as reminders } from '@/app/api/send-reminders/route'
import { POST as publish } from '@/app/api/publish-nail-lab-generation/route'
import { POST as upload } from '@/app/api/upload-challenge-photo/route'
import { POST as privacy } from '@/app/api/update-privacy-settings/route'
import { POST as onboard } from '@/app/api/complete-onboarding/route'
import { ownedNailLabPath } from '@/lib/storage-path'

beforeEach(() => {
  auth.getSessionUser.mockResolvedValue(user)
  Object.assign(auth.client, database(() => ok([]), async name => { if (name === 'enqueue_booking_reminders') return ok(0); throw new Error(`Unexpected RPC: ${name}`) }))
  auth.client.storage = { from: vi.fn() }
})
afterEach(() => vi.unstubAllEnvs())
it.each(['', '   '])('does not run reminders with an unconfigured secret (%j)', async secret => {
  vi.stubEnv('CRON_SECRET',secret)
  expect((await reminders(new Request('http://localhost/api/send-reminders'))).status).toBe(503)
  expect(auth.client.from).not.toHaveBeenCalled()
})
it('rejects wrong scheduler credentials and accepts the configured secret', async () => {
  vi.stubEnv('CRON_SECRET','test-scheduler-secret')
  expect((await reminders(new Request('http://localhost/api/send-reminders',{headers:{authorization:'Bearer wrong'}}))).status).toBe(401)
  expect(auth.client.from).not.toHaveBeenCalled()
  expect((await reminders(new Request('http://localhost/api/send-reminders',{headers:{authorization:'Bearer test-scheduler-secret'}}))).status).toBe(200)
})
it.each(['other-user/private.png','user-a/../other-user/private.png','user-a/%2e%2e/private.png','user-a\\other.png','https://foreign.invalid/storage/v1/object/public/nail-lab/user-a/image.png'])('rejects privileged copies of an unowned or ambiguous path (%s)', async path => {
  Object.assign(auth.client,database(q => q.table==='nail_lab_generations' ? ok({id:'generation',user_id:user.id,image_url:path}) : ok(null)))
  expect((await publish(jsonRequest({generationId:'generation'}))).status).toBe(400)
  expect(auth.client.storage.from).not.toHaveBeenCalled()
})
it('accepts canonical owner paths and known Supabase references', () => {
  expect(ownedNailLabPath('user-a/owned.png','user-a')).toBe('user-a/owned.png')
  expect(ownedNailLabPath(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nail-lab/user-a/owned.png`,'user-a')).toBe('user-a/owned.png')
})
it('rejects disguised non-image challenge uploads before storage', async () => {
  Object.assign(auth.client,database(() => ok({id:'challenge',ends_at:'2099-01-01'})))
  const form = new FormData()
  form.append('challengeId','00000000-0000-4000-8000-000000000001')
  form.append('file',new Blob(['<script>not an image</script>'],{type:'image/png'}),'image.png')
  expect((await upload(new Request('http://localhost/api/upload-challenge-photo',{method:'POST',body:form}))).status).toBe(400)
  expect(auth.client.storage.from).not.toHaveBeenCalled()
})
it('reencodes valid challenge photos instead of serving their original bytes', async () => {
  Object.assign(auth.client,database(() => ok({id:'challenge',ends_at:'2099-01-01'})))
  const store = vi.fn(async () => ok(null))
  auth.client.storage = { from: () => ({upload:store,getPublicUrl:()=>({data:{publicUrl:'https://storage.invalid/image.webp'}})}) }
  const png = await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer()
  const form = new FormData()
  form.append('challengeId','00000000-0000-4000-8000-000000000001')
  form.append('file',new Blob([png],{type:'image/png'}),'image.png')
  expect((await upload(new Request('http://localhost/api/upload-challenge-photo',{method:'POST',body:form}))).status).toBe(200)
  expect((await sharp(store.mock.calls[0][1]).metadata()).format).toBe('webp')
})
it.each([null,[],{is_private:'false'},{show_saves:1}])('rejects malformed privacy settings (%j)', async body => {
  expect((await privacy(jsonRequest(body))).status).toBe(400)
  expect(auth.client.from).not.toHaveBeenCalled()
})
it('onboarding sends only sanitized profile fields to the atomic service RPC', async () => {
  Object.assign(auth.client,database(() => {throw new Error('No direct profile overwrite')},async()=>ok(true)))
  expect((await onboard(jsonRequest({display_name:' Alice ',credit_balance:100,is_admin:true,account_type:'salon'}))).status).toBe(200)
  expect(auth.client.rpc).toHaveBeenCalledWith('complete_onboarding',expect.objectContaining({
    p_user_id:user.id,p_fields:expect.objectContaining({display_name:'Alice'}),
  }))
  const fields=auth.client.rpc.mock.calls[0][1].p_fields
  expect(fields).not.toHaveProperty('credit_balance')
  expect(fields).not.toHaveProperty('is_admin')
  expect(fields).not.toHaveProperty('account_type')
})
it('saving a new AI draft never copies its private image to public storage', async () => {
  Object.assign(auth.client,database(q => {
    if(q.table==='nail_lab_generations') return ok({id:'generation',user_id:user.id,image_url:'user-a/owned.png'})
    if(q.operation==='select') return ok(null)
    expect(q.values.is_published).toBe(false)
    expect(q.values.image_url).toContain('/nail-lab/user-a/owned.png')
    return ok({id:'draft'})
  }))
  expect((await publish(jsonRequest({generationId:'generation',asDraft:true}))).status).toBe(200)
  expect(auth.client.storage.from).not.toHaveBeenCalled()
})
it('explicit publication of a draft copies its owned file and replaces the private reference', async () => {
  Object.assign(auth.client,database(q => {
    if(q.table==='nail_lab_generations') return ok({id:'generation',user_id:user.id,image_url:'user-a/owned.png'})
    if(q.operation==='select') return ok({id:'draft',created_by:user.id,source_generation_id:'generation',is_published:false})
    expect(q.values).toEqual({is_published:true,image_url:'https://storage.invalid/published.png'})
    return ok(null)
  }))
  const download = vi.fn(async () => ok(new Blob(['png'])))
  const store = vi.fn(async () => ok(null))
  auth.client.storage = {from: () => ({download,upload:store,getPublicUrl:()=>({data:{publicUrl:'https://storage.invalid/published.png'}})})}
  expect((await publish(jsonRequest({generationId:'generation',designId:'draft'}))).status).toBe(200)
  expect(download).toHaveBeenCalledWith('user-a/owned.png')
  expect(store).toHaveBeenCalledTimes(1)
})
