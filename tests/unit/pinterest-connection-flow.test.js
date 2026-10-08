import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {database,ok} from '../helpers/supabase'
const mock=vi.hoisted(()=>({identity:vi.fn()}))
vi.mock('@/lib/admin/auth',()=>({AdminError:class extends Error{constructor(m,status=400,code='ADMIN_INVALID'){super(m);this.status=status;this.code=code}},adminIdentity:mock.identity}))
import {pinterestAdminPost,completeOAuth,exchange,connectedToken,sealToken,openToken,invalidateConnectedToken} from '@/lib/pinterest/connection'
const actor={user:{id:'owner'},role:'owner'},callback='https://laque-beta.vercel.app/api/pinterest/oauth/callback'
const fetchMock=vi.fn()
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('PINTEREST_APP_ID','1616792');vi.stubEnv('PINTEREST_APP_SECRET','server-only-app-secret');vi.stubEnv('PINTEREST_REDIRECT_URI',callback);vi.stubEnv('PINTEREST_TOKEN_KEY',Buffer.alloc(32,8).toString('base64'));vi.stubEnv('PINTEREST_DAILY_LIMIT','100');vi.stubEnv('PINTEREST_MINUTE_LIMIT','5');vi.stubEnv('PINTEREST_USER_DAILY_LIMIT','10');vi.stubGlobal('fetch',fetchMock);mock.identity.mockResolvedValue(actor)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
const db=rpc=>database(()=>ok(null),rpc||(()=>ok({allowed:true})))
const tokens={access_token:'pina_private',refresh_token:'pinr_private',expires_in:2592000,refresh_token_expires_in:5184000,scope:'pins:read,boards:read,user_accounts:read'}
it('binds a genuine read-only OAuth URL to an encrypted HTTP-only owner/browser cookie',async()=>{
 const client=db();const request=new Request('https://laque-beta.vercel.app/api/admin/pinterest',{headers:{authorization:'Bearer owner-session'}})
 const result=await pinterestAdminPost(client,actor,{action:'connect',reason:'Connect beta public boards'},request)
 const u=new URL(result.authorizationUrl);expect(u.origin+u.pathname).toBe('https://www.pinterest.com/oauth/');expect(u.searchParams.get('redirect_uri')).toBe(callback);expect(u.searchParams.get('scope')).toBe('boards:read,pins:read,user_accounts:read');expect(u.searchParams.get('state')).toHaveLength(43)
 expect(result.cookie).toContain('HttpOnly; Secure; SameSite=Lax');expect(result.cookie).not.toContain('owner-session');expect(result.cookie).not.toContain('server-only-app-secret')
 const value=JSON.parse(openToken(decodeURIComponent(result.cookie.split(';')[0].split('=')[1])));expect(value.token).toBe('owner-session');expect(value.browser).toHaveLength(43);expect(fetchMock).not.toHaveBeenCalled()
})
const callbackRequest=()=>new Request(callback+'?state='+'a'.repeat(43)+'&code=testcode',{headers:{cookie:'laque_pinterest_oauth='+encodeURIComponent(sealToken(JSON.stringify({browser:'b'.repeat(43),token:'owner-session'})))}})
it('rejects expired or replayed callback attempts before sending provider requests',async()=>{
 const client=db((name)=>name==='claim_pinterest_oauth'?ok(null):ok({allowed:true}));await expect(completeOAuth(client,callbackRequest())).rejects.toThrow(/expired|used/);expect(fetchMock).not.toHaveBeenCalled();expect(mock.identity).toHaveBeenCalled()
})
it('rechecks owner access and consumes a denied attempt without acquiring tokens',async()=>{
 mock.identity.mockResolvedValueOnce({...actor,role:'moderator'});await expect(completeOAuth(db(),callbackRequest())).rejects.toMatchObject({status:403});const client=db(()=>ok({reason:'Connect beta public boards'}));const req=callbackRequest();const u=new URL(req.url);u.searchParams.set('error','access_denied');await expect(completeOAuth(client,new Request(u,{headers:req.headers}))).rejects.toThrow(/declined/);expect(client.rpc).toHaveBeenCalledWith('claim_pinterest_oauth',expect.objectContaining({p_owner:'owner'}));expect(fetchMock).not.toHaveBeenCalled()
})
it('exchanges only after a claimed attempt, validates business identity and stores encrypted tokens',async()=>{
 const client=db(name=>name==='claim_pinterest_oauth'?ok({reason:'Connect beta public boards'}):ok({allowed:true}));fetchMock.mockImplementation(async url=>String(url).endsWith('/oauth/token')?Response.json(tokens):Response.json({account_type:'BUSINESS',username:'laque'}))
 await completeOAuth(client,callbackRequest());const completed=client.rpc.mock.calls.find(([name,args])=>name==='pinterest_admin_change'&&args.p_action==='complete')[1];expect(completed.p_data).not.toHaveProperty('access_token');expect(completed.p_data.token).toBeUndefined();expect(openToken(completed.p_data.access)).toBe(tokens.access_token);expect(openToken(completed.p_data.refresh)).toBe(tokens.refresh_token);expect(JSON.stringify(completed)).not.toContain(tokens.access_token);expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('fails closed for missing scopes and budget exhaustion without exposing provider payloads',async()=>{
 fetchMock.mockResolvedValue(Response.json({...tokens,scope:'boards:read'}));await expect(exchange(db(),'owner',{grant_type:'authorization_code'})).rejects.toMatchObject({code:'PINTEREST_RECONNECT'});fetchMock.mockClear();await expect(exchange(db(()=>ok({allowed:false,retryAt:'2099-01-01T00:00:00Z'})),'owner',{})).rejects.toMatchObject({status:429,code:'PINTEREST_BUDGET',retryAt:'2099-01-01T00:00:00.000Z'});expect(fetchMock).not.toHaveBeenCalled();vi.stubEnv('PINTEREST_DAILY_LIMIT','101');await expect(exchange(db(),'owner',{})).rejects.toMatchObject({code:'PINTEREST_SETUP'})
})
it('uses a live token without refresh and rejects a second shared refresh lease',async()=>{
 const c={status:'connected',access_cipher:sealToken('live'),expires_at:'2099-01-01T00:00:00Z'};const client=database(()=>ok(c),()=>ok(null));expect((await connectedToken(client)).token).toBe('live');expect(client.rpc).not.toHaveBeenCalled();c.expires_at='2001-01-01T00:00:00Z';await expect(connectedToken(client)).rejects.toMatchObject({code:'PINTEREST_RETRY'});expect(fetchMock).not.toHaveBeenCalled()
})
it('a late rejected request cannot invalidate a newer access token',async()=>{
 const cipher=sealToken('new-token');const client=database(()=>ok({status:'connected',access_cipher:cipher}));await invalidateConnectedToken(client,'old-token');expect(client.calls).toHaveLength(1);const current=database(q=>q.operation==='update'?ok(null):ok({status:'connected',access_cipher:cipher}));await invalidateConnectedToken(current,'new-token');const change=current.calls.find(x=>x.operation==='update');expect(change.values).toMatchObject({status:'reconnect',paused:true,access_cipher:null,refresh_cipher:null});expect(change.filters).toContainEqual(['eq','access_cipher',cipher])
})
