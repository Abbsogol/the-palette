import {it,expect,vi,afterEach} from 'vitest'
vi.mock('@/lib/admin/auth',()=>({AdminError:class extends Error{}}))
import {validateHome} from '@/lib/admin/home'
const content={heroes:[{id:'one',imageUrl:'/admin-assets/home-hero.png',title:'Nail library',alt:'Nails',rotate:180}],featuredDesignIds:[],announcements:[{id:'hello',title:'Hello',body:'From LaQue'}]}
it('projects only published product fields and rejects arbitrary remote URLs',()=>{expect(validateHome({...content,secret:'no'})).toEqual(content);expect(()=>validateHome({...content,heroes:[{...content.heroes[0],imageUrl:'https://evil.invalid/image.png'}]})).toThrow();expect(()=>validateHome({...content,heroes:[]})).toThrow();expect(()=>validateHome({...content,featuredDesignIds:['not-a-uuid']})).toThrow();expect(()=>validateHome({...content,announcements:[{id:'a',title:'',body:'body'}]})).toThrow()})

afterEach(()=>vi.unstubAllEnvs())
it('accepts only exact beta private admin image references, never signed URLs or foreign paths',()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://beta.supabase.co')
 const url='https://beta.supabase.co/storage/v1/object/public/mobile-uploads/00000000-0000-4000-8000-000000000111/admin/00000000-0000-4000-8000-000000000222.webp'
 const withImage=imageUrl=>({...content,heroes:[{...content.heroes[0],imageUrl}]})
 expect(validateHome(withImage(url)).heroes[0].imageUrl).toBe(url)
 for(const invalid of [url+'?token=secret',url.replace('beta.supabase.co','evil.invalid'),url.replace('/admin/','/private/'),url.replace('.webp','/../file.webp')])expect(()=>validateHome(withImage(invalid))).toThrow()
})
