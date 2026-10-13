import { mobileBackendIdentity } from '@/lib/mobile-environment';
const response = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
});
export async function GET(request) {
  try {
    const identity = mobileBackendIdentity();
    if (request && identity.apiOrigin && new URL(request.url).origin !== identity.apiOrigin) return response({error:'Backend API identity mismatch'},503);
    return response(identity);
  } catch {
    return response({error:'Mobile service configuration has not been verified'},503);
  }
}
