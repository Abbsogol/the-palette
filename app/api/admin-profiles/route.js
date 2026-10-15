import { adminIdentity,adminFailure,adminResponse } from '@/lib/admin/auth'
async function retired(request) {try {await adminIdentity(request);return adminResponse({error:'Use the protected dashboard API.',code:'ADMIN_ENDPOINT_RETIRED'},410)} catch(e){return adminFailure(e)}}
export const GET=retired
export const POST=retired
export const PATCH=retired
