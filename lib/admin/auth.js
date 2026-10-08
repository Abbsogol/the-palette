import { getSessionUser, serviceClient } from '@/lib/auth';
export const permissions = {
  owner: ['overview', 'users', 'content', 'home', 'bookings', 'lab', 'credits', 'reports', 'pinterest', 'integrations', 'team', 'activity'],
  support: ['overview', 'users', 'bookings', 'lab'],
  moderator: ['overview', 'content', 'home', 'reports']
};
export class AdminError extends Error {
  constructor(message, status = 400, code = 'ADMIN_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export async function adminIdentity(request, {
  identityOnly = false
} = {}) {
  const user = await getSessionUser(request);
  if (!user) throw new AdminError('Sign in to LaQue to continue.', 401, 'SIGN_IN_REQUIRED');
  if (!user.email_confirmed_at) throw new AdminError('Verify your LaQue email before opening the dashboard.', 403, 'ADMIN_FORBIDDEN');
  const {
    data: staff,
    error
  } = await serviceClient.from('admin_staff').select('role,active').eq('user_id', user.id).maybeSingle();
  if (error) throw new AdminError('Dashboard access is unavailable.', 503, 'ADMIN_UNAVAILABLE');
  if (!staff?.active || !permissions[staff.role]) throw new AdminError('This account does not have dashboard access.', 403, 'ADMIN_FORBIDDEN');
  const suspended = await serviceClient.rpc('account_is_suspended', {
    p_id: user.id
  });
  if (!staff?.active || !permissions[staff.role] || suspended.error || suspended.data || !user.email_confirmed_at) throw new AdminError('This account does not have dashboard access.', 403, 'ADMIN_FORBIDDEN');
  // getUser above verifies this token with Supabase. Never authorize an unverified JWT.
  let claims = {};
  try {
    claims = JSON.parse(Buffer.from(request.headers.get('authorization').slice(7).split('.')[1], 'base64url').toString());
  } catch {}
  const mfa = claims.aal === 'aal2' && user.factors?.some(f => f.factor_type === 'totp' && f.status === 'verified');
  if (!identityOnly && !mfa) throw new AdminError('Verify with your authenticator app.', 403, 'MFA_REQUIRED');
  return {
    user,
    role: staff.role,
    permissions: permissions[staff.role],
    mfa: !!mfa
  };
}
export function requireSection(identity, section) {
  if (!identity.permissions.includes(section)) throw new AdminError('Your role cannot access this section.', 403, 'ADMIN_FORBIDDEN');
}
export function adminResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
export function adminFailure(error) {
  return adminResponse({
    error: error instanceof AdminError ? error.message : 'The operation could not be completed. Try again.',
    code: error instanceof AdminError ? error.code : 'ADMIN_UNAVAILABLE'
  }, error instanceof AdminError ? error.status : 503);
}
