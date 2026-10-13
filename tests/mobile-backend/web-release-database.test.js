import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { createSecurityDatabase } from '../helpers/security-database'
const owner='00000000-0000-4000-8000-000000000951', other='00000000-0000-4000-8000-000000000952'
let db
beforeAll(async () => {
  db=await createSecurityDatabase()
  await db.exec('alter table auth.users add column email text,add column email_confirmed_at timestamptz')
  const directory=new URL('../../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(directory)).sort().filter(name=>Number(name.slice(8,12))>26))
    await db.exec(await readFile(new URL(file,directory),'utf8'))
},30000)
afterAll(async()=>db?.close())
beforeEach(async()=>{
  await db.exec('truncate auth.users,profiles_data,storage.objects,mobile_media_cleanup cascade')
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now())',[owner,other])
})
const finish=fields=>db.as('service_role',null,'select complete_onboarding($1,$2) as completed',[owner,fields])
const consent={age_confirmed:true,privacy_accepted:true,display_name:'Test Member'}
it('onboarding stores health notes privately once, preserves sharing preference and never resets entitlement on replay',async()=>{
  await db.query("update profiles_data set credit_balance=7 where id=$1",[owner])
  await db.query('insert into client_health_notes(user_id,share_with_tech) values($1,true)',[owner])
  expect((await finish({...consent,allergies:'Latex',product_sensitivities:['Gel'],removal_needed:true})).rows[0].completed).toBe(true)
  expect((await db.query('select * from client_health_notes where user_id=$1',[owner])).rows[0]).toMatchObject({allergies:'Latex',product_sensitivities:['Gel'],removal_needed:true,share_with_tech:true})
  expect((await db.query('select credit_balance,allergies from profiles_data where id=$1',[owner])).rows[0]).toEqual({credit_balance:10,allergies:null})
  expect((await db.query('select privacy_policy_version from profiles_data where id=$1',[owner])).rows[0].privacy_policy_version).toBe('2026-10-13')
  expect((await finish({...consent,allergies:'Forged replay'})).rows[0].completed).toBe(false)
  // Existing onboarding adds its legacy three credits once; this wrapper neither resets nor repeats it.
  expect((await db.query('select credit_balance from profiles_data where id=$1',[owner])).rows[0].credit_balance).toBe(10)
  expect((await db.query('select allergies from client_health_notes where user_id=$1',[owner])).rows[0].allergies).toBe('Latex')
  expect((await db.as('authenticated',other,'select * from client_health_notes where user_id=$1',[owner])).rows).toEqual([])
})
it('invalid health data rolls back the entire onboarding and unprivileged callers cannot bypass the wrapper',async()=>{
  await expect(finish({...consent,product_sensitivities:{bad:'value'}})).rejects.toThrow()
  expect((await db.query('select onboarding_complete,age_confirmed_at from profiles_data where id=$1',[owner])).rows[0]).toMatchObject({onboarding_complete:false,age_confirmed_at:null})
  for(const role of ['anon','authenticated']) {
    await expect(db.as(role,role==='authenticated'?owner:null,'select complete_onboarding($1,$2)',[owner,consent])).rejects.toThrow(/permission denied/)
    await expect(db.as(role,role==='authenticated'?owner:null,'select complete_onboarding_before_web($1,$2)',[owner,consent])).rejects.toThrow(/permission denied/)
  }
})
const reference=path=>`https://test.supabase.co/storage/v1/object/public/mobile-uploads/${path}`
async function upload(user=owner,name='hand.webp') {
  const path=`${user}/hand-photos/${name}`
  await db.query("insert into storage.objects(bucket_id,name) values('mobile-uploads',$1)",[path])
  await db.query("insert into mobile_media_cleanup(bucket,path,user_id) values('mobile-uploads',$1,$2)",[path,user])
  return path
}
it('hand uploads remain owner-only, claim their cleanup lease on save and release on removal',async()=>{
  const path=await upload()
  await db.query('update profiles_data set hand_photo_url=$1 where id=$2',[reference(path),owner])
  expect((await db.query('select state from mobile_media_cleanup where path=$1',[path])).rows[0].state).toBe('linked')
  expect((await db.as('authenticated',owner,"select name from storage.objects where bucket_id='mobile-uploads' and name=$1",[path])).rows).toHaveLength(1)
  expect((await db.as('authenticated',other,"select name from storage.objects where bucket_id='mobile-uploads' and name=$1",[path])).rows).toHaveLength(0)
  await db.query("update mobile_media_cleanup set state='pending',run_after=now()-interval '1 day'")
  expect((await db.as('service_role',null,'select claim_mobile_media_cleanup() as jobs')).rows[0].jobs).toEqual([])
  await db.query('update profiles_data set hand_photo_url=null where id=$1',[owner])
  await db.query("update mobile_media_cleanup set run_after=now()-interval '1 minute'")
  const jobs=(await db.as('service_role',null,'select claim_mobile_media_cleanup() as jobs')).rows[0].jobs
  expect(jobs).toEqual([expect.objectContaining({bucket:'mobile-uploads',path})]);expect(jobs[0].token).toBeTruthy()
})
it('foreign, unqueued, missing and deletion-claimed hand objects cannot be adopted',async()=>{
  const foreign=await upload(other), valid=await upload(owner)
  for(const path of [foreign,`${owner}/hand-photos/absent.webp`])
    await expect(db.query('update profiles_data set hand_photo_url=$1 where id=$2',[reference(path),owner])).rejects.toThrow(/PRIVATE_HAND_PHOTO/)
  await db.query("update mobile_media_cleanup set state='deleting' where path=$1",[valid])
  await expect(db.query('update profiles_data set hand_photo_url=$1 where id=$2',[reference(valid),owner])).rejects.toThrow(/PRIVATE_HAND_PHOTO/)
  expect((await db.query('select hand_photo_url from profiles_data where id=$1',[owner])).rows[0].hand_photo_url).toBeNull()
})
