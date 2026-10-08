import { adminIdentity, requireSection, adminResponse, adminFailure, AdminError } from '@/lib/admin/auth';
import { adminGet, adminPost } from '@/lib/admin/data';
export async function GET(request, context) {
  try {
    const path = (await context?.params)?.path || [];
    const section = path[0];
    const identity = await adminIdentity(request, {
      identityOnly: section === 'identity'
    });
    if (section === 'identity') return adminResponse({
      id: identity.user.id,
      role: identity.role,
      permissions: identity.permissions,
      mfa: identity.mfa
    });
    requireSection(identity, section);
    return adminResponse(await adminGet(section, path[1], new URL(request.url).searchParams, identity));
  } catch (error) {
    return adminFailure(error);
  }
}
export async function POST(request, context) {
  try {
    const path = (await context?.params)?.path || [];
    const identity = await adminIdentity(request);
    requireSection(identity, path[0]);
    const length = Number(request.headers.get('content-length'));
    if (length > 65536) throw new AdminError('Request is too large.', 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 65536) throw new AdminError('Request is too large.', 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AdminError('Invalid request.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdminError('Invalid request.');
    const result = await adminPost(path[0], path[1], body, identity, request);
    const cookie = result?.cookie;
    if (cookie) {
      delete result.cookie;
      const response = adminResponse(result);
      response.headers.set('Set-Cookie', cookie);
      return response;
    }
    return adminResponse(result);
  } catch (error) {
    return adminFailure(error);
  }
}
