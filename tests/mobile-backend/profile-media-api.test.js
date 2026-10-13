import { beforeEach, expect, it, vi } from 'vitest';
import { database, ok, jsonRequest } from '../helpers/supabase';
const state=vi.hoisted(()=>({user:null,db:null}));
vi.mock('@/lib/auth',()=>({getSessionUser:async()=>state.user,get serviceClient(){return state.db}}));
import { POST as save } from '@/app/api/update-profile/route';
import { POST as finish } from '@/app/api/complete-onboarding/route';
const uid='00000000-0000-4000-8000-000000000941';
beforeEach(()=>{state.user={id:uid};state.db=database(()=>ok(null),async()=>ok(true));});
it.each(['avatar_url','banner_url'])('accepts removal and rejects foreign or arbitrary %s URLs before mutation',async key=>{
 const folder=key==='avatar_url'?'avatars':'banners';
 for(const value of ['https://example.com/unowned.jpg',`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/designs/${folder}/someone-else/file.webp`]){
  expect((await save(jsonRequest({[key]:value}))).status).toBe(400);
 }
 expect(state.db.from).not.toHaveBeenCalled();
 expect((await save(jsonRequest({[key]:null}))).status).toBe(200);
});
it('persists normalized public interests/specialties only for the authenticated owner and permits clearing them',async()=>{
 expect((await save(jsonRequest({specialties:[' Chrome ','chrome','Minimal'],id:'other',account_type:'creator'}))).status).toBe(200);
 expect(state.db.calls[0]).toMatchObject({table:'profiles_data',operation:'update',values:{specialties:['Chrome','Minimal']},filters:[['eq','id',uid]]});
 expect((await save(jsonRequest({specialties:[]}))).status).toBe(200);
 expect(state.db.calls[1].values.specialties).toEqual([]);
 state.user=null;
 expect((await save(jsonRequest({specialties:['Chrome']}))).status).toBe(401);
 expect(state.db.calls).toHaveLength(2);
});
it.each([null,'Chrome',[7],[''],['x'.repeat(51)],Array(21).fill('Chrome')])('rejects invalid tags before any profile write: %j',async specialties=>{
 expect((await save(jsonRequest({specialties}))).status).toBe(400);
 expect(state.db.from).not.toHaveBeenCalled();
});
it('only forwards literal age and privacy booleans, never client-provided timestamps',async()=>{
 await finish(jsonRequest({age_confirmed:'true',privacy_accepted:true,age_confirmed_at:'2000-01-01',privacy_policy_version:'forged'}));
 const fields=state.db.rpc.mock.calls[0][1].p_fields;
 expect(fields.age_confirmed).toBe(false);expect(fields.privacy_accepted).toBe(true);
 expect(fields).not.toHaveProperty('age_confirmed_at');expect(fields).not.toHaveProperty('privacy_policy_version');
});
it('displays a missing eligibility error and blocks unauthenticated completion',async()=>{
 state.db=database(()=>ok(null),async()=>({data:null,error:{message:'AGE_AND_PRIVACY_CONFIRMATION_REQUIRED'}}));
 expect((await finish(jsonRequest({}))).status).toBe(400);
 state.user=null;
 expect((await finish(jsonRequest({age_confirmed:true,privacy_accepted:true}))).status).toBe(401);
});
