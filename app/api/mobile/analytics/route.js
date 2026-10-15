import { getSessionUser,serviceClient as db } from '@/lib/auth'
import { mobileJson,uuidPattern } from '@/lib/mobile-auth'
const screens=new Set(['home','search','lab','messages','favorites','profile','design','booking','stories','updates','other'])
export async function GET(request){
 const user=await getSessionUser(request);if(!user)return mobileJson({error:'Sign in to continue.'},401)
 const r=await db.from('app_analytics_preferences').select('enabled').eq('user_id',user.id).maybeSingle()
 return r.error?mobileJson({error:'Usage preference is unavailable.'},503):mobileJson({enabled:r.data?.enabled===true})
}
export async function POST(request){
 const user=await getSessionUser(request);if(!user)return mobileJson({error:'Sign in to continue.'},401)
 const raw=await request.text();if(new TextEncoder().encode(raw).length>1024)return mobileJson({error:'Request is too large.'},413)
 let body;try{body=JSON.parse(raw)}catch{return mobileJson({error:'Invalid request.'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return mobileJson({error:'Invalid request.'},400)
 if(body.action==='preference'){
  if(typeof body.enabled!=='boolean'||Object.keys(body).some(k=>!['action','enabled'].includes(k)))return mobileJson({error:'Choose a usage preference.'},400)
  const r=await db.rpc('app_analytics_preference',{p_user:user.id,p_enabled:body.enabled})
  return r.error?mobileJson({error:'Preference could not be saved.'},503):mobileJson({enabled:body.enabled})
 }
 if(Object.keys(body).some(k=>!['id','sessionId','screen','platform'].includes(k))||typeof body.id!=='string'||typeof body.sessionId!=='string'||!uuidPattern.test(body.id)||!uuidPattern.test(body.sessionId)||!screens.has(body.screen)||!['ios','android','web'].includes(body.platform))return mobileJson({error:'Invalid usage event.'},400)
 const r=await db.rpc('app_analytics_record',{p_user:user.id,p_id:body.id,p_session:body.sessionId,p_screen:body.screen,p_platform:body.platform})
 // Consent, duplicates and ceilings are checked atomically in the service-only RPC.
 // Failures never include provider payloads or account identifiers.
 return r.error?mobileJson({error:'Usage event could not be recorded.'},503):mobileJson({ok:true})
}
export function OPTIONS(){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}})}
