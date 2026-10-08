import { getSessionUser, serviceClient as db } from '@/lib/auth'
import { mobileUserClient } from '@/lib/mobile-auth'
import { adminMediaPath,adminMediaPreview } from '@/lib/admin/media'
export async function GET(request) {
 if(!await getSessionUser(request))return Response.json({error:'Sign in to access LaQue.'},{status:401,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})
 const {data,error}=await db.from('admin_home').select('published,revision').single()
 if(error||!data)return Response.json({error:'Home content is unavailable.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})
 const c=data.published
 // Query with the viewer's normal RLS: moderation, author privacy, deletion and
 // suspension all apply. Never return service-role design records here.
 const ids=c.featuredDesignIds||[]
 const result=ids.length?await mobileUserClient(request).from('designs').select('id').eq('is_published',true).in('id',ids):{data:[],error:null}
 if(result.error)return Response.json({error:'Home content is unavailable.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})
 const visible=new Set(result.data.map(x=>x.id));const origin=new URL(request.url).origin
 let heroes
 try{heroes=(await Promise.all(c.heroes.map(async h=>{const path=adminMediaPath(h.imageUrl);if(path){const available=await mobileUserClient(request).rpc('admin_media_available',{p_bucket:'mobile-uploads',p_path:path});if(available.error)throw Error('Media visibility unavailable');if(!available.data)return null}return {...h,imageUrl:h.imageUrl.startsWith('/')?origin+h.imageUrl:await adminMediaPreview(db,h.imageUrl,60)}}))).filter(Boolean)}catch{return Response.json({error:'Home content is unavailable.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
 return Response.json({revision:data.revision,heroes,featuredDesignIds:ids.filter(id=>visible.has(id)),announcements:c.announcements},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})
}

export function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Authorization","Access-Control-Allow-Methods":"GET, OPTIONS"}})}
