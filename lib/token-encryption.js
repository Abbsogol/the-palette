import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const providers = new Set(['GOOGLE_CALENDAR', 'PINTEREST']);
const keyId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value);
export function tokenKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('TOKEN_KEY_CONFIGURATION');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== value) throw new Error('TOKEN_KEY_CONFIGURATION');
  return bytes;
}
export function tokenKeyring(provider, env = process.env) {
  if (!providers.has(provider)) throw new Error('TOKEN_KEY_CONFIGURATION');
  const current = tokenKey(env[`${provider}_TOKEN_KEY`]);
  const id = env[`${provider}_TOKEN_KEY_ID`];
  if (id && !keyId(id)) throw new Error('TOKEN_KEY_CONFIGURATION');
  let previous;
  try { previous = JSON.parse(env[`${provider}_TOKEN_PREVIOUS_KEYS`] || '{}'); }
  catch { throw new Error('TOKEN_KEY_CONFIGURATION'); }
  if (!previous || Array.isArray(previous) || typeof previous !== 'object' || Object.keys(previous).length > 4) throw new Error('TOKEN_KEY_CONFIGURATION');
  const keys = new Map();
  for (const [name, value] of Object.entries(previous)) {
    if (!keyId(name) || name === id) throw new Error('TOKEN_KEY_CONFIGURATION');
    keys.set(name, tokenKey(value));
  }
  if (id) keys.set(id, current);
  const legacy = env[`${provider}_TOKEN_LEGACY_KEY`] ? tokenKey(env[`${provider}_TOKEN_LEGACY_KEY`]) : current;
  return { current, id, keys, legacy };
}
const aad = (provider, scope, env) => {
  const environment = env.MOBILE_ENVIRONMENT || 'legacy';
  if (!['production', 'beta', 'development', 'legacy'].includes(environment)) throw new Error('TOKEN_KEY_CONFIGURATION');
  return Buffer.from(JSON.stringify(['laque-token-v2', provider, environment, scope]));
};
export function sealTokenEnvelope(value, provider, scope, legacySeal, env = process.env) {
  const ring = tokenKeyring(provider, env);
  if (!ring.id) return legacySeal(ring.current);
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', ring.current, iv);
  cipher.setAAD(aad(provider, scope, env));
  const data = Buffer.concat([iv, cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return `v2.${ring.id}.${data.toString('base64')}`;
}
export function openTokenEnvelope(value, provider, scope, legacyOpen, env = process.env) {
  const ring = tokenKeyring(provider, env);
  if (typeof value !== 'string' || value.length > 100000) throw new Error('TOKEN_CIPHER_INVALID');
  if (!value.startsWith('v2.')) return legacyOpen(ring.legacy);
  const [version, id, encoded, extra] = value.split('.');
  const key = ring.keys.get(id);
  if (version !== 'v2' || extra !== undefined || !key || !encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('TOKEN_CIPHER_INVALID');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 29 || bytes.toString('base64') !== encoded) throw new Error('TOKEN_CIPHER_INVALID');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  cipher.setAAD(aad(provider, scope, env)); cipher.setAuthTag(bytes.subarray(-16));
  try { return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8'); }
  catch { throw new Error('TOKEN_CIPHER_INVALID'); }
}
