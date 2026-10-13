import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createSecurityDatabase} from '../helpers/security-database';
let db,installer;
beforeAll(async()=>{
 db=await createSecurityDatabase();
 await db.exec('alter table auth.users add column email text; create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
 for(const name of ['202610080027_pinterest_budget.sql','202610080028_pinterest_budget_recovery.sql','202610080029_pinterest_pilot_allowance.sql','202610080030_admin_operations.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec("insert into supabase_migrations.schema_migrations(version) values('202610080034')");
 installer=await readFile(new URL('../../supabase/beta-install-lab-subscription.sql',import.meta.url),'utf8');
},30000);
afterAll(()=>db?.close());
it('reapplying the reviewed beta installer preserves used monthly allowance and disabled products',async()=>{
 await db.exec(installer);
 const id='00000000-0000-4000-8000-000000000851';
 await db.query('insert into auth.users(id) values($1)',[id]);
 await db.query("insert into lab_monthly_allowances(user_id,store,product_id,period_start,period_end,used) values($1,'APP_STORE','laque_lab_monthly_5',now(),now()+interval '30 days',8)",[id]);
 await db.exec(installer);
 expect((await db.query('select used from lab_monthly_allowances where user_id=$1',[id])).rows[0].used).toBe(8);
 expect((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version in('202610080035','202610080036')")).rows[0].n).toBe(2);
 expect((await db.query("select count(*)::int n from mobile_store_products where active")).rows[0].n).toBe(0);
 expect((await db.query("select credits from mobile_store_products where store='PLAY_STORE' and product_id='laque_lab_monthly_5:monthly'")).rows[0].credits).toBe(15);
});
it('a partially registered existing schema stops safely instead of recreating financial state',async()=>{
 await db.exec("delete from supabase_migrations.schema_migrations where version='202610080035'");
 await expect(db.exec(installer)).rejects.toThrow(/schema exists without migration 035 record/);
 await db.exec('rollback');
 expect((await db.query('select used from lab_monthly_allowances')).rows[0].used).toBe(8);
});
