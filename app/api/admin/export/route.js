import {adminIdentity,adminFailure,AdminError} from '@/lib/admin/auth';
import {prepareExport,recordExport} from '@/lib/admin/export';
export async function POST(request){try{
 const identity=await adminIdentity(request);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>4096)throw new AdminError('Export request is too large.',413);
 let body;try{body=JSON.parse(raw)}catch{throw new AdminError('Invalid export request.')}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AdminError('Invalid export request.');
 const file=await prepareExport(identity,body);
 // Revalidate session/MFA and role after assembling a multi-page download.
 const current=await adminIdentity(request);if(current.role!==identity.role)throw new AdminError('Dashboard access changed. Try again.',403);
 await recordExport(current,file);
 return new Response(file.content,{headers:{'Content-Type':file.type+'; charset=utf-8','Content-Disposition':`attachment; filename="${file.filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(error){return adminFailure(error)}}
