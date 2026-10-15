import {beforeEach,it,expect,vi} from 'vitest'
import sharp from 'sharp'
import {database,ok,jsonRequest} from '../helpers/supabase'
const m=vi.hoisted(()=>({user:vi.fn(),db:{},member:vi.fn(),upload:vi.fn()}))
vi.mock('@/lib/auth',()=>({getSessionUser:m.user,serviceClient:m.db}))
vi.mock('@/lib/mobile-auth',async importOriginal=>({...await importOriginal(),mobileUserClient:m.member}))
vi.mock('@/app/api/mobile/upload/route',()=>({POST:m.upload}))
import {GET as reply} from '@/app/api/creator-reply-time/route'
import {POST as upload} from '@/app/api/upload-image/route'
const uid='00000000-0000-4000-8000-000000000951', artist='00000000-0000-4000-8000-000000000952'
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({id:uid});Object.assign(m.db,database(()=>ok([])));m.member.mockReturnValue(database(()=>ok(null)))})
const req=()=>new Request(`https://beta.invalid/api/creator-reply-time?creator=${artist}`,{headers:{Authorization:'Bearer member'}})
it('new routes require a verified session before any privileged read or upload',async()=>{
 m.user.mockResolvedValue(null)
 expect((await reply(req())).status).toBe(401)
 expect((await upload(jsonRequest({}))).status).toBe(401)
 expect(m.db.from).not.toHaveBeenCalled();expect(m.upload).not.toHaveBeenCalled()
})
it.each([null,{id:artist,account_type:'user'}])('an invisible or non-creator profile has no aggregate access: %j',async visible=>{
 m.member.mockReturnValue(database(()=>ok(visible)))
 expect((await reply(req())).status).toBe(404);expect(m.db.from).not.toHaveBeenCalled()
})
it('aggregate visibility uses the caller RLS client and returns only timing, with no cache or chat contents',async()=>{
 const visible=database(()=>ok({id:artist,account_type:'creator'}));m.member.mockReturnValue(visible)
 Object.assign(m.db,database(q=>q.table==='conversations'?ok([{id:'conversation'}]):ok([{conversation_id:'conversation',sender_id:uid,created_at:'2026-10-13T10:00:00Z'},{conversation_id:'conversation',sender_id:artist,created_at:'2026-10-13T10:15:00Z'}])))
 const response=await reply(req());expect(response.headers.get('Cache-Control')).toBe('no-store');expect(await response.json()).toEqual({medianMinutes:15,samples:1})
 expect(m.member).toHaveBeenCalledWith(expect.any(Request));expect(visible.calls[0].filters).toEqual([['eq','id',artist]])
 expect(m.db.calls[1].columns).toBe('conversation_id, sender_id, created_at')
})
const formRequest=form=>new Request('https://beta.invalid/api/upload-image',{method:'POST',headers:{Authorization:'Bearer member'},body:form})
it.each(['admin-design','admin-product'])('retires the legacy %s write instead of trusting is_admin',async purpose=>{
 const form=new FormData();form.set('purpose',purpose)
 expect((await upload(formRequest(form))).status).toBe(410);expect(m.db.from).not.toHaveBeenCalled();expect(m.upload).not.toHaveBeenCalled()
})
it('chat upload delegates conversation access and private media rules to the existing protected handler',async()=>{
 const form=new FormData();form.set('purpose','chat-photo');form.set('conversationId',artist)
 m.upload.mockImplementation(async request=>{expect(request.headers.get('Authorization')).toBe('Bearer member');const fd=await request.formData();expect(fd.get('kind')).toBe('message');expect(fd.get('conversationId')).toBe(artist);return Response.json({error:'Conversation unavailable'},{status:403})})
 expect((await upload(formRequest(form))).status).toBe(403);expect(m.db.from).not.toHaveBeenCalled()
})
it('hand upload queues and writes only an owned private WebP; corrupt content has no storage side effects',async()=>{
 const bytes=await sharp({create:{width:8,height:6,channels:3,background:'#ff517f'}}).png().toBuffer()
 const store=vi.fn(async()=>ok(null));m.db.storage={from:vi.fn(()=>({upload:store}))}
 const form=new FormData();form.set('purpose','hand-photo');form.set('file',new File([bytes],'hand.png',{type:'image/png'}))
 const response=await upload(formRequest(form));expect(response.status).toBe(200)
 const result=await response.json();expect(result.publicUrl).toContain(`/mobile-uploads/${uid}/hand-photos/`);expect(result).toMatchObject({width:8,height:6})
 expect(m.db.storage.from).toHaveBeenCalledWith('mobile-uploads');expect(store.mock.calls[0][1].constructor).toBe(Uint8Array);expect(store.mock.calls[0][2].contentType).toBe('image/webp')
 form.set('file',new File(['bad'],'hand.png',{type:'image/png'}));expect((await upload(formRequest(form))).status).toBe(400);expect(store).toHaveBeenCalledTimes(1)
})
