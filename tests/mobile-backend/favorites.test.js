import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import { createSecurityDatabase } from '../helpers/security-database';
const owner='00000000-0000-4000-8000-000000000861', stranger='00000000-0000-4000-8000-000000000862', creator='00000000-0000-4000-8000-000000000863', folder='00000000-0000-4000-8000-000000000864', design='00000000-0000-4000-8000-000000000865', hidden='00000000-0000-4000-8000-000000000866';
let db;
beforeAll(async()=>{db=await createSecurityDatabase()},30000);
afterAll(async()=>{await db?.close()});
beforeEach(async()=>{
 await db.exec('truncate auth.users,profiles_data,designs,collections cascade');
 await db.query('insert into auth.users(id) values($1),($2),($3)',[owner,stranger,creator]);
 await db.query("insert into designs(id,title,created_by,is_published) values($1,'Public design',$3,true),($2,'Private design',$3,false)",[design,hidden,creator]);
 await db.as('authenticated',owner,"insert into collections(id,user_id,name) values($1,$2,'Next set')",[folder,owner]);
 await db.as('authenticated',owner,'insert into saved_designs(user_id,design_id) values($1,$2)',[owner,design]);
});
it('only the owner can read, rename, add to and delete a folder',async()=>{
 expect((await db.as('authenticated',stranger,'select id from collections where id=$1',[folder])).rows).toHaveLength(0);
 expect((await db.as('anon',null,'select id from collections')).rows).toHaveLength(0);
 expect((await db.as('authenticated',stranger,"update collections set name='Taken' where id=$1 returning id",[folder])).rows).toHaveLength(0);
 expect((await db.as('authenticated',stranger,'delete from collections where id=$1 returning id',[folder])).rows).toHaveLength(0);
 await expect(db.as('authenticated',stranger,'insert into collection_designs(collection_id,design_id) values($1,$2)',[folder,design])).rejects.toThrow();
 expect((await db.as('authenticated',owner,"update collections set name='Weekend' where id=$1 returning name",[folder])).rows).toEqual([{name:'Weekend'}]);
});
it('folder retries are idempotent and deleting a folder retains the saved design',async()=>{
 for(let i=0;i<2;i++){
  await db.as('authenticated',owner,"insert into collections(id,user_id,name) values($1,$2,'Next set') on conflict(id) do update set name=excluded.name,user_id=excluded.user_id",[folder,owner]);
  await db.as('authenticated',owner,'insert into collection_designs(collection_id,design_id) values($1,$2) on conflict(collection_id,design_id) do nothing',[folder,design]);
 }
 expect((await db.as('authenticated',owner,'select * from collection_designs')).rows).toHaveLength(1);
 await db.as('authenticated',owner,'delete from collections where id=$1',[folder]);
 expect((await db.query('select * from collection_designs')).rows).toHaveLength(0);
 expect((await db.as('authenticated',owner,'select design_id from saved_designs')).rows).toEqual([{design_id:design}]);
});
it('private foreign designs cannot be added even when their ID is known',async()=>{
 await expect(db.as('authenticated',owner,'insert into collection_designs(collection_id,design_id) values($1,$2)',[folder,hidden])).rejects.toThrow();
 expect((await db.query('select * from collection_designs')).rows).toHaveLength(0);
});
it('saved profiles belong only to their saver and can be removed without affecting another saver',async()=>{
 for(const user of [owner,stranger])await db.as('authenticated',user,'insert into favourite_creators(user_id,creator_id) values($1,$2)',[user,creator]);
 expect((await db.as('authenticated',owner,'select user_id from favourite_creators')).rows).toEqual([{user_id:owner}]);
 expect((await db.as('authenticated',owner,'delete from favourite_creators where user_id=$1 returning user_id',[stranger])).rows).toHaveLength(0);
 await db.as('authenticated',owner,'delete from favourite_creators where user_id=$1 and creator_id=$2',[owner,creator]);
 expect((await db.query('select user_id from favourite_creators')).rows).toEqual([{user_id:stranger}]);
});
