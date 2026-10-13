import { serviceClient as db } from '@/lib/auth';
import { AdminError,requireSection } from './auth';
import { adminGet } from './data';
import { userDirectory,userDetails } from './users';
const sections=new Set(['overview','users','content','bookings','lab','credits','reports','activity']);
export function csvCell(value){let s=value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);if(/^[\s\u0000-\u001f]*[=+@-]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
export function csvRows(rows){const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];return '\uFEFF'+[keys.map(csvCell).join(','),...rows.map(row=>keys.map(k=>csvCell(row[k])).join(','))].join('\r\n')}
export async function prepareExport(identity,body){
 const {section,reason}=body;
 if(!sections.has(section))throw new AdminError('This section cannot be exported.');
 requireSection(identity,section);
 if(section==='users'&&identity.role!=='owner')throw new AdminError('Only the Owner can export users.',403,'ADMIN_FORBIDDEN');
 if(typeof reason!=='string'||reason.trim().length<5||reason.length>1000)throw new AdminError('Enter an export reason of 5–1,000 characters.');
 if(Object.keys(body).some(k=>!['section','reason','q','filter','type','days','id'].includes(k)))throw new AdminError('Invalid export options.');
 if(body.id&&(section!=='users'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)))throw new AdminError('Invalid account.');
 const params=new URLSearchParams();for(const k of ['q','filter','type','days'])if(body[k]!==undefined){if(typeof body[k]!=='string'&&typeof body[k]!=='number')throw new AdminError('Invalid filters.');params.set(k,String(body[k]))}
 const rows=[];let payload,json=section==='overview'||!!body.id;
 if(json)payload=section==='overview'?await adminGet(section,null,params,identity):await userDetails(identity,body.id);
 else if(section==='users'){
  const q=(params.get('q')||'').replace(/[^\p{L}\p{N}_ @.-]/gu,'').slice(0,100);
  for(let offset=0;offset<=5000;offset+=500){const batch=await userDirectory(identity,{q,filter:params.get('filter')||'',offset,limit:500});rows.push(...batch);if(rows.length>5000)throw new AdminError('More than 5,000 accounts match. Narrow the search or account-type filter.',422);if(batch.length<500)break}
 }else{
  for(let page=0;page<=200;page++){params.set('page',String(page));const result=await adminGet(section,null,params,identity);rows.push(...(result.items||[]));if(rows.length>5000)throw new AdminError('More than 5,000 records match. Narrow the filters.',422);if(!result.hasMore)break}
 }
 const content=json?JSON.stringify(payload,null,2):csvRows(rows);
 if(Buffer.byteLength(content,'utf8')>4*1024*1024)throw new AdminError('This export exceeds 4 MB. Narrow the filters.',422);
 return {content,type:json?'application/json':'text/csv',filename:`laque-${section}-${new Date().toISOString().slice(0,10)}.${json?'json':'csv'}`,count:json?1:rows.length,section,reason:reason.trim(),account:body.id||null};
}
export async function recordExport(identity,file){const r=await db.rpc('admin_export_log',{p_actor:identity.user.id,p_role:identity.role,p_section:file.section,p_reason:file.reason,p_count:file.count,p_account:file.account});if(r.error)throw new AdminError('Export could not be authorised and recorded. Try again.',403,'ADMIN_FORBIDDEN')}
