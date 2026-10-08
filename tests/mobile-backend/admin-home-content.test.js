import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {database,ok} from '../helpers/supabase'
const mock=vi.hoisted(()=>({service:null,viewer:null,user:{id:"member"}}))
vi.mock('@/lib/auth',()=>({get serviceClient(){return mock.service},getSessionUser:async()=>mock.user}))
vi.mock('@/lib/mobile-auth',()=>({mobileUserClient:()=>mock.viewer}))
import {GET} from '@/app/api/mobile/home-content/route'
const visible='00000000-0000-4000-8000-000000000999',hidden='00000000-0000-4000-8000-000000000998'
const published={heroes:[{id:'original',imageUrl:'/admin-assets/home-hero.png',title:'Nail library',alt:'Nails',rotate:180}],featuredDesignIds:[hidden,visible],announcements:[{id:'public',title:'Hello',body:'Published announcement'}]}
beforeEach(()=>{
 mock.user={id:"member"};
 mock.service=database(q=>{expect(q.table).toBe('admin_home');expect(q.columns).toBe('published,revision');return ok({published,revision:4,draft:{secret:'Unpublished announcement'},staff:'private'})})
 mock.viewer=database(q=>{expect(q.table).toBe('designs');expect(q.columns).toBe('id');expect(q.filters).toContainEqual(['eq','is_published',true]);return ok([{id:visible}])})
})
it('returns published configuration, absolute hero URLs and only viewer-visible featured IDs',async()=>{
 const r=await GET(new Request('https://laque-beta.vercel.app/api/mobile/home-content'))
 expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store')
 const body=await r.json();expect(body).toEqual({revision:4,heroes:[{...published.heroes[0],imageUrl:'https://laque-beta.vercel.app/admin-assets/home-hero.png'}],featuredDesignIds:[visible],announcements:published.announcements})
 expect(JSON.stringify(body)).not.toContain('Unpublished');expect(mock.service.calls).toHaveLength(1)
})
it('fails closed when viewer visibility cannot be checked',async()=>{
 mock.viewer=database(()=>({data:null,error:{message:'private provider detail'}}))
 const r=await GET(new Request('https://laque-beta.vercel.app/api/mobile/home-content'));expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain('provider')
})

afterEach(()=>vi.unstubAllEnvs())
const mediaPath='00000000-0000-4000-8000-000000000111/admin/00000000-0000-4000-8000-000000000222.webp'
function privateHome(availability=true){
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://beta.supabase.co')
 const imageUrl='https://beta.supabase.co/storage/v1/object/public/mobile-uploads/'+mediaPath
 mock.service=database(()=>ok({published:{...published,heroes:[{...published.heroes[0],imageUrl}]},revision:4,draft:{heroes:[{imageUrl:'private-draft'}]}}))
 const sign=vi.fn(async()=>ok({signedUrl:'https://beta.supabase.co/signed/published-only'}))
 mock.service.storage={from:vi.fn(bucket=>{expect(bucket).toBe('mobile-uploads');return {createSignedUrl:sign}})}
 mock.viewer.rpc=vi.fn(async()=>availability instanceof Error?{data:null,error:{message:'secret'}}:ok(availability))
 return sign
}
it('signs only a published private hero after normal viewer visibility approval',async()=>{
 const sign=privateHome();const r=await GET(new Request('https://laque-beta.vercel.app/api/mobile/home-content'))
 expect(r.status).toBe(200);const b=await r.json();expect(b.heroes[0].imageUrl).toBe('https://beta.supabase.co/signed/published-only')
 expect(sign).toHaveBeenCalledExactlyOnceWith(mediaPath,60)
 expect(mock.viewer.rpc).toHaveBeenCalledExactlyOnceWith('admin_media_available',{p_bucket:'mobile-uploads',p_path:mediaPath})
 expect(JSON.stringify(b)).not.toContain('private-draft')
})
it('does not issue new access to a hidden private hero',async()=>{
 const sign=privateHome(false);const r=await GET(new Request('https://laque-beta.vercel.app/api/mobile/home-content'))
 expect(r.status).toBe(200);expect((await r.json()).heroes).toEqual([]);expect(sign).not.toHaveBeenCalled()
})
it('fails closed before signing when media visibility cannot be checked',async()=>{
 const sign=privateHome(new Error());const r=await GET(new Request('https://laque-beta.vercel.app/api/mobile/home-content'))
 expect(r.status).toBe(503);expect(sign).not.toHaveBeenCalled();expect(JSON.stringify(await r.json())).not.toContain('secret')
})

it('denies signed-out callers before reading configuration or signing media',async()=>{
 const sign=privateHome();mock.user=null;
 const r=await GET(new Request('https://laque-beta.vercel.app/api/mobile/home-content'));
 expect(r.status).toBe(401);expect(r.headers.get('cache-control')).toBe('no-store');
 expect(mock.service.calls).toHaveLength(0);expect(mock.viewer.calls).toHaveLength(0);
 expect(mock.viewer.rpc).not.toHaveBeenCalled();expect(sign).not.toHaveBeenCalled();
});
