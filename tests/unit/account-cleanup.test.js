import { beforeEach, expect, it, vi } from 'vitest'
const { purge } = vi.hoisted(() => ({ purge: vi.fn() }))
vi.mock('@/lib/account-purge', () => ({ purgeAccountData: purge }))
import { processAccountCleanup } from '@/lib/account-cleanup'
let client, writes, storage, job
beforeEach(() => {
  vi.clearAllMocks(); writes=[]; storage=[]; job={user_id:'closed',claim_token:'claim',auth_erased_at:null}
  client={
    rpc:vi.fn(async name => {
      if(name==='claim_account_cleanup') return {data:[job]}
      if(name==='account_storage_objects') return {data:storage.splice(0,100)}
      return {data:null}
    }),
    auth:{admin:{getUserById:vi.fn(async()=>({data:{user:{id:'closed'}}})),updateUserById:vi.fn(async()=>({})),deleteUser:vi.fn(async()=>({}))}},
    storage:{from:vi.fn(()=>({remove:vi.fn(async()=>({}))}))},
    from:vi.fn(table=>({update: value=>{ const item={table,value,filters:[]};writes.push(item);const chain={eq:(...args)=>{item.filters.push(args);return chain},then:resolve=>resolve({error:null})};return chain }})),
  }
  purge.mockResolvedValue(new Response(null,{status:200}))
})
it('erases credentials and content before attempting the guarded financial purge',async()=>{
  const r=await processAccountCleanup(client,{})
  expect(r).toEqual({closedAccountsChecked:1,accountCleanupPending:0,failed:0})
  expect(client.auth.admin.deleteUser).toHaveBeenCalledWith('closed',true)
  expect(client.rpc).toHaveBeenCalledWith('erase_closed_account_content',{p_user_id:'closed'})
  expect(writes[0].filters).toEqual([['user_id','closed'],['claim_token','claim']])
})
it('retention keeps the account closed, removes personal content and schedules a retry',async()=>{
  purge.mockResolvedValue(new Response(null,{status:409}))
  expect((await processAccountCleanup(client,{})).accountCleanupPending).toBe(1)
  expect(client.rpc).toHaveBeenCalledWith('erase_closed_account_content',{p_user_id:'closed'})
  expect(writes.at(-1).value).toMatchObject({claim_token:null,lease_until:null,last_error:expect.stringContaining('retention')})
  expect(writes.at(-1).filters).toContainEqual(['claim_token','claim'])
})
it('a storage outage preserves ownership rows and retries without claiming completion',async()=>{
  storage.push({bucket_id:'private',name:'closed/file'})
  client.storage.from.mockReturnValue({remove:vi.fn(async()=>({error:{message:'Unavailable'}}))})
  expect(await processAccountCleanup(client,{})).toMatchObject({failed:1,accountCleanupPending:1})
  expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();expect(purge).not.toHaveBeenCalled()
  expect(client.rpc).not.toHaveBeenCalledWith('erase_closed_account_content',{p_user_id:'closed'})
})
it('a retry after Auth erasure was committed does not attempt to erase credentials again',async()=>{
  client.auth.admin.getUserById.mockResolvedValue({data:{user:{deleted_at:'2026-09-29T00:00:00Z'}}})
  expect((await processAccountCleanup(client,{})).failed).toBe(0)
  expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();expect(purge).toHaveBeenCalledTimes(1)
})
it('Auth errors release the leased job and leave financial records intact',async()=>{
  client.auth.admin.deleteUser.mockResolvedValue({error:{message:'Unavailable'}})
  expect((await processAccountCleanup(client,{})).failed).toBe(1)
  expect(purge).not.toHaveBeenCalled();expect(writes.at(-1).value.last_error).toBe('Auth erasure pending')
})
