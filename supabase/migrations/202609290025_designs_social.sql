begin;
-- D36 metadata is committed with its design, never as partial child updates.
create function public.save_mobile_design(p_user uuid,p_id uuid,p_fields jsonb,p_images jsonb,p_colours jsonb,p_tags jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare item jsonb; tag text; tid uuid; d public.designs; i integer:=0;
begin
 perform 1 from public.profiles_data where id=p_user for update;
 if not found or public.account_is_closed(p_user) then raise exception 'ACCOUNT_CLOSED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text, 925));
 select * into d from public.designs where id=p_id for update;
 if found and d.created_by is distinct from p_user then raise exception 'DESIGN_OWNER_REQUIRED'; end if;
 if length(trim(p_fields->>'title')) not between 1 and 150 or jsonb_array_length(p_images)>8 or jsonb_array_length(p_colours)>12 or jsonb_array_length(p_tags)>20 then raise exception 'INVALID_DESIGN_DETAILS'; end if;
 -- INSERT triggers charge the upload quota before ON CONFLICT, so edits must use UPDATE.
 if d.id is not null then
  update public.designs set title=p_fields->>'title',description=p_fields->>'description',shape=p_fields->>'shape',length=p_fields->>'length',category=p_fields->>'category',technique=p_fields->>'technique',occasion=p_fields->>'occasion',image_url=p_fields->>'image_url',is_published=(p_fields->>'is_published')::boolean where id=p_id;
 else
  insert into public.designs(id,created_by,title,description,shape,length,category,technique,occasion,image_url,is_published,is_curated)
  values(p_id,p_user,p_fields->>'title',p_fields->>'description',p_fields->>'shape',p_fields->>'length',p_fields->>'category',p_fields->>'technique',p_fields->>'occasion',p_fields->>'image_url',(p_fields->>'is_published')::boolean,false);
 end if;
 if p_images is not null then
  delete from public.design_images where design_id=p_id;
  for item in select * from jsonb_array_elements(p_images) loop
   insert into public.design_images(design_id,image_url,image_order) values(p_id,item#>>'{}',i); i:=i+1;
  end loop;
 end if;
 if p_colours is not null then
  delete from public.design_colours where design_id=p_id; i:=0;
  for item in select * from jsonb_array_elements(p_colours) loop
   if nullif(item->>'hex_code','') is not null and item->>'hex_code' !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'INVALID_COLOUR'; end if;
   insert into public.design_colours(design_id,colour_name,hex_code,brand_name,brand_code,colour_order)
   values(p_id,item->>'colour_name',nullif(item->>'hex_code',''),item->>'brand_name',item->>'brand_code',i); i:=i+1;
  end loop;
 end if;
 if p_tags is not null then
  delete from public.design_tags where design_id=p_id;
  for tag in select distinct lower(trim(value#>>'{}')) from jsonb_array_elements(p_tags) loop
   if length(tag) not between 1 and 40 then raise exception 'INVALID_TAG'; end if;
   insert into public.tags(name) values(tag) on conflict(name) do update set name=excluded.name returning id into tid;
   insert into public.design_tags(design_id,tag_id) values(p_id,tid) on conflict do nothing;
  end loop;
 end if;
 return p_id;
end $$;
revoke all on function public.save_mobile_design(uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_mobile_design(uuid,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;

-- Sharing a draft gives only the chosen chat participant read access to D36.
create table public.design_chat_shares(design_id uuid references public.designs(id) on delete cascade,recipient_id uuid references auth.users(id) on delete cascade,owner_id uuid references auth.users(id) on delete cascade,primary key(design_id,recipient_id));
alter table public.design_chat_shares enable row level security;
revoke all on public.design_chat_shares from public,anon,authenticated;
grant all on public.design_chat_shares to service_role;
create function public.can_read_shared_design(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not public.account_is_closed(auth.uid()) and exists(select from public.design_chat_shares s where s.design_id=p_id and s.recipient_id=auth.uid() and not public.account_is_closed(s.owner_id)
 and not exists(select from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=s.owner_id) or (b.blocked_id=auth.uid() and b.blocker_id=s.owner_id)));
$$;
revoke all on function public.can_read_shared_design(uuid) from public;
grant execute on function public.can_read_shared_design(uuid) to authenticated;
create policy "Chosen recipient can read shared design" on public.designs for select to authenticated using(public.can_read_shared_design(id));
create function public.send_design_message(p_id uuid,p_conversation uuid,p_design uuid,p_content text) returns public.messages
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); other_id uuid; d public.designs; m public.messages;
begin
 if uid is null or public.account_is_closed(uid) then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 select case when client_id=uid then creator_id else client_id end into other_id from public.conversations where id=p_conversation and uid in(client_id,creator_id);
 if other_id is null or public.account_is_closed(other_id) then raise exception 'CONVERSATION_UNAVAILABLE'; end if;
 perform 1 from public.profiles_data where id in(uid,other_id) order by id for update;
 if public.account_is_closed(uid) or public.account_is_closed(other_id) then raise exception 'ACCOUNT_CLOSED'; end if;
 select * into d from public.designs where id=p_design for share;
 if not found or public.account_is_closed(d.created_by) or not (d.created_by=uid or (d.is_published and public.design_visible_to_viewer(d.created_by,uid) and public.design_visible_to_viewer(d.created_by,other_id))) then raise exception 'DESIGN_UNAVAILABLE'; end if;
 if length(p_content) not between 1 and 4000 then raise exception 'INVALID_MESSAGE'; end if;
 if exists(select from public.blocks where (blocker_id=uid and blocked_id=other_id) or (blocker_id=other_id and blocked_id=uid)) then raise exception 'BLOCKED_CANNOT_MESSAGE'; end if;
 select * into m from public.messages where id=p_id;
 if found then
  if m.sender_id=uid and m.conversation_id=p_conversation and m.design_id=p_design and m.content=p_content then return m; end if;
  raise exception 'MESSAGE_ID_CONFLICT';
 end if;
 if d.created_by=uid then insert into public.design_chat_shares values(p_design,other_id,uid) on conflict do nothing; end if;
 insert into public.messages(id,conversation_id,sender_id,content,design_id) values(p_id,p_conversation,uid,p_content,p_design) returning * into m;
 return m;
end $$;
revoke all on function public.send_design_message(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.send_design_message(uuid,uuid,uuid,text) to authenticated;
create function public.can_read_design_object(p_bucket text,p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.designs d where split_part(p_path,'/',1)=d.created_by::text and public.can_read_shared_design(d.id) and (d.image_url like '%/storage/v1/object/public/'||p_bucket||'/'||p_path or exists(select from public.design_images i where i.design_id=d.id and i.image_url like '%/storage/v1/object/public/'||p_bucket||'/'||p_path)));
$$;
revoke all on function public.can_read_design_object(text,text) from public;
grant execute on function public.can_read_design_object(text,text) to anon,authenticated;
create policy "Shared design bytes" on storage.objects for select to authenticated using(bucket_id in('mobile-uploads','nail-lab') and public.can_read_design_object(bucket_id,name));
alter policy "Restrict mobile image access" on storage.objects using(bucket_id<>'mobile-uploads' or public.can_read_mobile_image(name) or public.can_read_design_object(bucket_id,name));

-- Social media is independent from the searchable nail-design library.
alter table public.salon_posts add column media jsonb not null default '[]',add column tags text[] not null default '{}',add column mentioned_user_ids uuid[] not null default '{}';
alter table public.stories add column media_path text,add column media_type text not null default 'image' check(media_type in('image','video')),add column tags text[] not null default '{}',add column mentioned_user_ids uuid[] not null default '{}';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('social-media','social-media',false,52428800,array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif','video/mp4','video/quicktime']);
alter table public.mobile_media_cleanup drop constraint mobile_media_cleanup_bucket_check;
alter table public.mobile_media_cleanup add check(bucket in('designs','mobile-uploads','social-media'));
create function public.social_visible(p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not public.account_is_closed(auth.uid()) and not public.account_is_closed(p_owner) and public.design_visible_to_viewer(p_owner,auth.uid()) and not exists(select from public.blocks where(blocker_id=p_owner and blocked_id=auth.uid())or(blocker_id=auth.uid() and blocked_id=p_owner));
$$;
revoke all on function public.social_visible(uuid) from public;
grant execute on function public.social_visible(uuid) to authenticated,anon;
create policy "Social audience" on public.salon_posts as restrictive for select to anon,authenticated using(public.social_visible(creator_id));
create policy "Story audience and expiry" on public.stories as restrictive for select to anon,authenticated using(public.social_visible(user_id) and created_at>now()-interval '24 hours');
create function public.can_read_social_media(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select not public.account_is_closed(auth.uid()) and (split_part(p_path,'/',1)=auth.uid()::text or exists(select from public.salon_posts p where public.social_visible(p.creator_id) and p.media @> jsonb_build_array(jsonb_build_object('path',p_path))) or exists(select from public.stories s where s.media_path=p_path and s.created_at>now()-interval '24 hours' and public.social_visible(s.user_id)));
$$;
revoke all on function public.can_read_social_media(text) from public;
grant execute on function public.can_read_social_media(text) to authenticated,anon;
create policy "Read social media" on storage.objects for select to authenticated using(bucket_id='social-media' and public.can_read_social_media(name));
create policy "Limit social media reads" on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'social-media' or public.can_read_social_media(name));
create policy "Social uploads use server tickets" on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'social-media');
create policy "Social updates use server" on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'social-media');
create policy "Social deletion uses server" on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'social-media');
create function public.guard_social_content() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid; items jsonb; item jsonb; mid uuid; job public.mobile_media_cleanup;
begin
 if auth.role()='authenticated' then
  if tg_op='INSERT' then new.created_at:=now(); elsif new.created_at is distinct from old.created_at then raise exception 'POST_TIME_IMMUTABLE'; end if;
 end if;
 if tg_table_name='salon_posts' then owner_id:=new.creator_id; items:=new.media;
  if length(new.body)>2200 or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>8 then raise exception 'INVALID_POST'; end if;
 else owner_id:=new.user_id; items:=case when new.media_path is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('path',new.media_path,'type',new.media_type)) end;
  if length(new.caption)>500 then raise exception 'INVALID_CAPTION'; end if;
 end if;
 if cardinality(new.tags)>20 or cardinality(new.mentioned_user_ids)>20 or exists(select from unnest(new.tags)t where length(t) not between 1 and 40 or t !~ '^[a-z0-9_]+$') then raise exception 'INVALID_TAGS'; end if;
 foreach mid in array new.mentioned_user_ids loop
  if not exists(select from public.profiles_data where id=mid and username is not null) or public.account_is_closed(mid) or exists(select from public.blocks where (blocker_id=owner_id and blocked_id=mid)or(blocker_id=mid and blocked_id=owner_id)) then raise exception 'TAGGED_ACCOUNT_UNAVAILABLE'; end if;
 end loop;
 for item in select * from jsonb_array_elements(items) loop
  if coalesce(item->>'type','') not in('image','video') or split_part(item->>'path','/',1) is distinct from owner_id::text then raise exception 'MEDIA_OWNER_REQUIRED'; end if;
  select * into job from public.mobile_media_cleanup where bucket='social-media' and path=item->>'path' and user_id=owner_id for update;
  if not found or job.state='deleting' or not exists(select from storage.objects where bucket_id='social-media' and name=item->>'path') then raise exception 'MEDIA_UNAVAILABLE'; end if;
  update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket='social-media' and path=item->>'path';
 end loop;
 if tg_op='UPDATE' then
  if tg_table_name='salon_posts' then
   update public.mobile_media_cleanup set state='pending',run_after=now()+interval '1 minute' where bucket='social-media' and path in(select value->>'path' from jsonb_array_elements(old.media)) and not(new.media @> jsonb_build_array(jsonb_build_object('path',path)));
  elsif old.media_path is distinct from new.media_path then
   update public.mobile_media_cleanup set state='pending',run_after=now()+interval '1 minute' where bucket='social-media' and path=old.media_path;
  end if;
 end if;
 return new;
end $$;
create trigger social_content_guard before insert or update on public.salon_posts for each row execute function public.guard_social_content();
create trigger social_story_guard before insert or update on public.stories for each row execute function public.guard_social_content();
create function public.release_social_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='salon_posts' then update public.mobile_media_cleanup set state='pending',run_after=now()+interval '1 minute' where bucket='social-media' and path in(select value->>'path' from jsonb_array_elements(old.media));
 else update public.mobile_media_cleanup set state='pending',run_after=now()+interval '1 minute' where bucket='social-media' and path=old.media_path; end if;
 return old;
end $$;
create trigger release_post_media after delete on public.salon_posts for each row execute function public.release_social_media();
create trigger release_story_media after delete on public.stories for each row execute function public.release_social_media();
-- Close-up files take the same cleanup lock as design cover images.
create function public.manage_design_detail_image() returns trigger language plpgsql security definer set search_path='' as $$
declare url text; job public.mobile_media_cleanup;
begin
 if tg_op<>'DELETE' then
  select * into job from public.mobile_media_cleanup where new.image_url like '%/storage/v1/object/public/'||bucket||'/'||path for update;
  if found then
   if job.state='deleting' then raise exception 'IMAGE_UPLOAD_EXPIRED'; end if;
   if not exists(select from public.designs where id=new.design_id and created_by=job.user_id) then raise exception 'IMAGE_OWNER_MISMATCH'; end if;
   if not exists(select from storage.objects where bucket_id=job.bucket and name=job.path) then raise exception 'IMAGE_UPLOAD_UNAVAILABLE'; end if;
   update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket=job.bucket and path=job.path;
  end if;
 end if;
 if tg_op<>'INSERT' then
  update public.mobile_media_cleanup set state='pending',run_after=now()+interval '1 minute' where old.image_url like '%/storage/v1/object/public/'||bucket||'/'||path;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger manage_design_detail_image after insert or update or delete on public.design_images for each row execute function public.manage_design_detail_image();
-- Extend the existing cleanup protocol without deleting Storage rows directly.
alter function public.claim_mobile_media_cleanup() rename to claim_mobile_media_cleanup_before_social;
create function public.claim_mobile_media_cleanup() returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.mobile_media_cleanup; result jsonb:='[]'; token uuid;
begin
 update public.mobile_media_cleanup q set state='pending',run_after=now() where q.bucket='social-media' and q.state='linked' and exists(select from public.stories s where s.media_path=q.path and s.created_at<=now()-interval '24 hours');
 for job in select * from public.mobile_media_cleanup where state in('pending','deleting') and run_after<=now() and(claim_until is null or claim_until<now()) order by run_after limit 20 for update skip locked loop
  if exists(select from public.designs where image_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path) or exists(select from public.design_images where image_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path)
   or(job.bucket='mobile-uploads' and exists(select from public.messages where image_path=job.path))
   or(job.bucket='social-media' and (exists(select from public.salon_posts where media @> jsonb_build_array(jsonb_build_object('path',job.path))) or exists(select from public.stories where media_path=job.path and created_at>now()-interval '24 hours'))) then
   update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket=job.bucket and path=job.path;
  else
   token:=gen_random_uuid(); update public.mobile_media_cleanup set state='deleting',claim_token=token,claim_until=now()+interval '2 minutes' where bucket=job.bucket and path=job.path;
   result:=result||jsonb_build_array(jsonb_build_object('bucket',job.bucket,'path',job.path,'token',token));
  end if;
 end loop;
 return result;
end $$;
alter function public.account_storage_objects(uuid) rename to account_storage_objects_before_social;
create function public.account_storage_objects(p_user_id uuid) returns table(bucket_id text,name text) language sql stable security definer set search_path='' as $$
 select * from public.account_storage_objects_before_social(p_user_id) union all select o.bucket_id,o.name from storage.objects o where o.bucket_id='social-media' and split_part(o.name,'/',1)=p_user_id::text limit 500;
$$;
revoke all on function public.account_storage_objects_before_social(uuid),public.claim_mobile_media_cleanup_before_social(),public.guard_social_content(),public.release_social_media(),public.manage_design_detail_image() from public,anon,authenticated,service_role;
revoke all on function public.account_storage_objects(uuid),public.claim_mobile_media_cleanup() from public,anon,authenticated;
grant execute on function public.account_storage_objects(uuid),public.claim_mobile_media_cleanup() to service_role;
create function public.search_accounts(p_query text) returns setof public.profiles language sql stable security definer set search_path='' as $$
 select p.* from public.profiles p where auth.uid() is not null
 and not exists(select from public.blocks b where(b.blocker_id=auth.uid() and b.blocked_id=p.id)or(b.blocked_id=auth.uid() and b.blocker_id=p.id))
 and (case when left(trim(p_query),1)='@' then position(lower(substr(trim(p_query),2)) in lower(coalesce(p.username,'')))=1
 else position(lower(trim(p_query)) in lower(coalesce(p.display_name,'')))>0 or position(lower(trim(p_query)) in lower(coalesce(p.username,'')))>0 end);
$$;
revoke all on function public.search_accounts(text) from public,anon;
grant execute on function public.search_accounts(text) to authenticated;
notify pgrst,'reload schema';
commit;
