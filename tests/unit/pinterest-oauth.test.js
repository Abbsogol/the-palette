import {it,expect,vi,afterEach} from 'vitest'
vi.mock('@/lib/admin/auth',()=>({AdminError:class extends Error{constructor(m,status,code){super(m);this.status=status;this.code=code}},adminIdentity:vi.fn()}))
import {sealToken,openToken,oauthConfiguration} from '@/lib/pinterest/connection'
afterEach(()=>vi.unstubAllEnvs())
const setup=()=>{vi.stubEnv('PINTEREST_APP_ID','1616792');vi.stubEnv('PINTEREST_APP_SECRET','test-secret');vi.stubEnv('PINTEREST_REDIRECT_URI','https://laque-beta.vercel.app/api/pinterest/oauth/callback');vi.stubEnv('PINTEREST_TOKEN_KEY',Buffer.alloc(32,7).toString('base64'))}
it('encrypts tokens with authenticated encryption and rejects tampering',()=>{setup();const token='private-test-token';const a=sealToken(token),b=sealToken(token);expect(a).not.toEqual(b);expect(a).not.toContain(token);expect(openToken(a)).toBe(token);const bits=Buffer.from(a,'base64');bits[bits.length-1]^=1;expect(()=>openToken(bits.toString('base64'))).toThrow()})
it('requires an exact HTTPS callback and a 32-byte encryption key',()=>{setup();expect(oauthConfiguration().redirect).toBe('https://laque-beta.vercel.app/api/pinterest/oauth/callback');vi.stubEnv('PINTEREST_REDIRECT_URI','https://laque-beta.vercel.app/admin');expect(()=>oauthConfiguration()).toThrow();setup();vi.stubEnv('PINTEREST_TOKEN_KEY','short');expect(()=>oauthConfiguration()).toThrow()})
