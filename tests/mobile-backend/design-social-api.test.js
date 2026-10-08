import { beforeEach, expect, it, vi } from 'vitest';
import { database, ok, jsonRequest } from '../helpers/supabase';
const state=vi.hoisted(()=>({ user:null, db:null }));
vi.mock('@/lib/auth',()=>({getSessionUser:async()=>state.user,get serviceClient(){return state.db}}));
vi.mock('@/lib/mobile-auth',()=>({mobileUserClient:()=>state.db,mobileJson:(body,status=200)=>Response.json(body,{status}),uuidPattern:/^[a-f0-9-]{36}$/i}));
import { POST as save } from '@/app/api/mobile/portfolio/route';
import { POST as ticket } from '@/app/api/mobile/social-media/route';
import { POST as profile } from '@/app/api/update-profile/route';
const uid='00000000-0000-4000-8000-000000000831',id='00000000-0000-4000-8000-000000000832';
const image=`${uid}/designs/00000000-0000-4000-8000-000000000833.webp`;
const body={id,create:true,detailsVersion:1,title:'New title',description:'Ivory arches',shape:'Stiletto',length:'Long',category:'Gothic',technique:'Gel',occasion:'',images:[image],colours:[],tags:['#Ivory'],isPublished:false};
beforeEach(()=>{state.user={id:uid};});
it('retries new metadata saves rather than silently discarding edited fields on an existing ID',async()=>{
 state.db=database(q=>q.table==='designs'?ok({id,image_url:null}):ok([]),async()=>ok(id));
 const result=await save(jsonRequest(body));
 expect(result.status).toBe(200);
 expect(state.db.rpc).toHaveBeenCalledWith('save_mobile_design',expect.objectContaining({p_id:id,p_user:uid,p_fields:expect.objectContaining({title:'New title',technique:'Gel'}),p_tags:['ivory']}));
});
it('rejects a foreign media path before attempting a metadata mutation',async()=>{
 state.db=database(()=>ok(null));
 expect((await save(jsonRequest({...body,images:[image.replace(uid,id)]}))).status).toBe(400);
 expect(state.db.rpc).not.toHaveBeenCalled();
});
it('never issues an upload token when authentication or cleanup registration fails',async()=>{
 const sign=vi.fn();state.db=database(()=>({data:null,error:{message:'Offline'}}));
 state.db.storage={from:()=>({createSignedUploadUrl:sign})};
 state.user=null;expect((await ticket(jsonRequest({mime:'video/mp4'}))).status).toBe(401);
 state.user={id:uid};expect((await ticket(jsonRequest({mime:'video/mp4'}))).status).toBe(503);
 expect(sign).not.toHaveBeenCalled();
});
it('a social upload ticket is restricted to a server-created owner path and allowed media MIME',async()=>{
 const sign=vi.fn(async()=>ok({token:'test-ticket'}));state.db=database(()=>ok(null));
 state.db.storage={from:()=>({createSignedUploadUrl:sign})};
 expect((await ticket(jsonRequest({mime:'text/html'}))).status).toBe(400);
 const response=await ticket(jsonRequest({mime:'video/mp4',path:'another-user/private.mp4'}));
 expect(response.status).toBe(200);const data=await response.json();
 expect(data.path).toMatch(new RegExp(`^${uid}/[a-f0-9-]+\\.mp4$`));
 expect(sign).toHaveBeenCalledWith(data.path);
});
it('normalizes a public account handle and reports conflicts without claiming success',async()=>{
 state.db=database(q=>{expect(q.values.username).toBe('sarah.nails');return {data:null,error:{code:'23505'}};});
 const response=await profile(jsonRequest({username:'@Sarah.Nails'}));
 expect(response.status).toBe(409);expect((await response.json()).error).toMatch(/taken/);
});
