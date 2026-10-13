import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { serviceClient } from '@/lib/auth'
import { adminIdentity,requireSection,adminResponse,adminFailure,AdminError } from '@/lib/admin/auth'
export async function POST(request) {
 let path
 try {
  const identity=await adminIdentity(request);requireSection(identity,'content')
  if(Number(request.headers.get('content-length'))>8500000)throw new AdminError('Choose an image smaller than 8 MB.',413)
  const form=await request.formData();const file=form.get('file'),reason=form.get('reason')
  if(!file?.arrayBuffer||file.size>8388608||!['image/jpeg','image/png','image/webp'].includes(file.type)||typeof reason!=='string'||reason.trim().length<5||reason.length>1000)throw new AdminError('Choose a JPEG, PNG or WebP up to 8 MB and enter a reason.')
  const buffer=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25000000}).rotate().resize({width:2400,height:3000,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer()
  path=`${identity.user.id}/admin/${randomUUID()}.webp`
  const upload=await serviceClient.storage.from('mobile-uploads').upload(path,buffer,{contentType:'image/webp',upsert:false});if(upload.error)throw new AdminError('Image upload failed. Try again.',503)
  // Recheck and audit after processing the upload. A revoked staff member cannot
  // obtain a publishable URL. Clean up an upload whose audit cannot commit.
  const result=await serviceClient.rpc('admin_mutate',{p_actor:identity.user.id,p_action:'media',p_target:null,p_reason:reason,p_data:{path}})
  if(result.error)throw new AdminError('Upload access changed. Try again.',403)
  const preview=await serviceClient.storage.from('mobile-uploads').createSignedUrl(path,900)
  if(preview.error)throw new AdminError('The image preview could not load.',503)
  // Persistent path reference, never a public byte URL. App design readers
  // already resolve this existing private bucket through normal viewer RLS.
  return adminResponse({url:`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/mobile-uploads/${path}`,previewUrl:preview.data.signedUrl})
 }catch(e){if(path)await serviceClient.storage.from('mobile-uploads').remove([path]);return adminFailure(e)}
}
