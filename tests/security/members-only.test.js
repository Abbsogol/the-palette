import { beforeAll, afterAll, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createSecurityDatabase } from '../helpers/security-database'
let db, migration, beforePermissions
const member='00000000-0000-4000-8000-000000000901',creator='00000000-0000-4000-8000-000000000902',design='00000000-0000-4000-8000-000000000903'
const permissions=async()=>({
 tables:(await db.query(`select r.rolname,c.relname,p.privilege,has_table_privilege(r.rolname,c.oid,p.privilege) allowed from pg_roles r cross join pg_class c cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p(privilege) where r.rolname in('authenticated','service_role') and c.relnamespace='public'::regnamespace and c.relkind in('r','v') order by 1,2,3`)).rows,
 columns:(await db.query(`select r.rolname,c.relname,a.attname,p.privilege,has_column_privilege(r.rolname,c.oid,a.attnum,p.privilege) allowed from pg_roles r cross join pg_class c join pg_attribute a on a.attrelid=c.oid cross join unnest(array['SELECT','UPDATE']) p(privilege) where r.rolname in('authenticated','service_role') and c.relnamespace='public'::regnamespace and c.relkind in('r','v') and a.attnum>0 and not a.attisdropped order by 1,2,3,4`)).rows,
 functions:(await db.query(`select r.rolname,p.oid::regprocedure::text routine,has_function_privilege(r.rolname,p.oid,'EXECUTE') allowed from pg_roles r cross join pg_proc p where r.rolname in('authenticated','service_role') and p.pronamespace='public'::regnamespace and p.prokind='f' order by 1,2`)).rows,
})
beforeAll(async()=>{
 db=await createSecurityDatabase()
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz')
 for(const n of ['202610080027_pinterest_budget.sql','202610080028_pinterest_budget_recovery.sql','202610080029_pinterest_pilot_allowance.sql','202610080030_admin_operations.sql','202610080031_pinterest_oauth.sql','202610080032_admin_private_media.sql']) await db.exec(await readFile(new URL('../../supabase/migrations/'+n,import.meta.url),'utf8'))
 for(const id of [member,creator])await db.query('insert into auth.users(id) values($1)',[id])
 await db.query("update profiles_data set display_name='Fixture',email='private@example.test',credit_balance=7,allergies='Private health' where id=$1",[creator])
 await db.query("insert into designs(id,title,created_by,is_published,image_url) values($1,'Published nails',$2,true,$3)",[design,creator,'https://beta.supabase.co/storage/v1/object/public/mobile-uploads/'+creator+'/design/photo.jpg'])
 await db.query("insert into storage.objects(bucket_id,name) values('mobile-uploads',$1)",[creator+'/design/photo.jpg'])
 beforePermissions=await permissions()
 migration=await readFile(new URL('../../supabase/migrations/202610080037_members_only_app.sql',import.meta.url),'utf8')
 await db.exec(migration)
},30000)
afterAll(()=>db?.close())
it('removes all anonymous table/column access, including the legacy raw id grant',async()=>{
 for(const table of ['profiles','profiles_data','designs','design_images','stories','salon_posts','tags','services','availability'])await expect(db.as('anon',null,`select * from ${table}`)).rejects.toThrow(/permission denied/)
 await expect(db.as('anon',null,'select id from profiles_data')).rejects.toThrow(/permission denied/)
 expect((await db.query(`select has_table_privilege('anon','profiles','SELECT') allowed`)).rows[0].allowed).toBe(false)
})
it('preserves exactly the effective authenticated and service permissions',async()=>{
 expect(await permissions()).toEqual(beforePermissions)
 for(const column of ['email','allergies','credit_balance'])await expect(db.as('authenticated',member,`select ${column} from profiles_data`)).rejects.toThrow(/permission denied/)
 const profile=(await db.as('authenticated',member,'select id,email,allergies,credit_balance from profiles where id=$1',[creator])).rows[0]
 expect(profile).toEqual({id:creator,email:null,allergies:null,credit_balance:null})
 expect((await db.as('authenticated',member,'select id from designs where id=$1',[design])).rows).toHaveLength(1)
 expect((await db.as('service_role',null,'select credit_balance from profiles_data where id=$1',[creator])).rows[0].credit_balance).toBe(7)
})
it('keeps author privacy on detail reads and does not widen staff permissions',async()=>{
 await db.query('update profiles_data set is_private=true where id=$1',[creator])
 expect((await db.as('authenticated',member,'select id from designs where id=$1',[design])).rows).toHaveLength(0)
 await db.query('update profiles_data set is_private=false where id=$1',[creator])
 await expect(db.as('authenticated',member,'select * from admin_staff')).rejects.toThrow(/permission denied/)
 await expect(db.as('authenticated',member,"select admin_mutate($1,'credits',$1,'test','{}')",[member])).rejects.toThrow(/permission denied/)
})
it('blocks anonymous RPC/media access while members retain visible design media',async()=>{
 await expect(db.as('anon',null,"select can_read_design_object('mobile-uploads',$1)",[creator+'/design/photo.jpg'])).rejects.toThrow(/permission denied/)
 const anonymous=await db.as('anon',null,'select name from storage.objects')
 expect(anonymous.rows).toEqual([])
 expect((await db.as('authenticated',member,'select name from storage.objects where name=$1',[creator+'/design/photo.jpg'])).rows).toHaveLength(1)
})
it('allows new account creation and keeps the restriction after an idempotent repeat',async()=>{
 const id='00000000-0000-4000-8000-000000000904'
 await db.query('insert into auth.users(id) values($1)',[id])
 expect((await db.as('authenticated',id,'select id from profiles where id=$1',[id])).rows).toHaveLength(1)
 await db.exec(migration)
 expect(await permissions()).toEqual(beforePermissions)
 await expect(db.as('anon',null,'select id from profiles')).rejects.toThrow(/permission denied/)
})
it('beta installer fails on the wrong project, then records and verifies the bound beta change',async()=>{
 const installer=await readFile(new URL('../../supabase/beta-install-members-only.sql',import.meta.url),'utf8')
 await expect(db.exec(installer)).rejects.toThrow(/Expected verified beta Owner missing/)
 await db.exec('rollback')
 const owner='a92d4175-0da7-463a-a58e-7f067d5057e9'
 await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[owner])
 await db.query("insert into admin_staff(user_id,role) values($1,'owner')",[owner])
 await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])')
 await db.exec(installer)
 await db.exec(installer)
 expect((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='202610080037'")).rows[0].n).toBe(1)
 expect((await db.query("select has_table_privilege('anon','profiles','SELECT') anonymous_profiles,has_table_privilege('authenticated','profiles','SELECT') member_profiles,has_column_privilege('authenticated','profiles_data','email','SELECT') raw_email")).rows[0]).toEqual({anonymous_profiles:false,member_profiles:true,raw_email:false})
 expect(await permissions()).toEqual(beforePermissions)
})
