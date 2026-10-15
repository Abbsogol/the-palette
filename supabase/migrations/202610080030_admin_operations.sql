begin;
-- Administration is a service-only capability, never a writable profile flag.
create table public.admin_staff (
 user_id uuid primary key references public.profiles_data(id), role text not null check(role in('owner','support','moderator')),
 active boolean not null default true, assigned_by uuid, updated_at timestamptz not null default now()
);
create table public.admin_actions (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null, actor_role text not null,
 action text not null, target_id text, reason text not null check(length(trim(reason)) between 5 and 1000),
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index on public.admin_actions(created_at desc);
create table public.admin_notes (
 id uuid primary key default gen_random_uuid(), target_type text not null check(target_type in('user','booking','report')),
 target_id uuid not null, actor_id uuid not null, body text not null check(length(body) between 5 and 4000), created_at timestamptz not null default now()
);
create table public.admin_moderation (
 target_type text not null check(target_type in('design','post','story','message')), target_id uuid not null,
 hidden boolean not null default false, updated_at timestamptz not null default now(), primary key(target_type,target_id)
);
create table public.admin_suspensions (
 user_id uuid primary key references public.profiles_data(id), suspended boolean not null,
 updated_at timestamptz not null default now()
);
create table public.admin_owned_designs (design_id uuid primary key references public.designs(id) on delete cascade);
create table public.admin_credit_corrections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles_data(id), actor_id uuid not null,
 delta integer not null check(delta<>0 and abs(delta::bigint)<=10000), balance_after integer not null,
 reason text not null, idempotency_key uuid not null unique, created_at timestamptz not null default now()
);
create table public.admin_home (
 singleton boolean primary key default true check(singleton), draft jsonb not null, published jsonb not null,
 version integer not null default 1, revision integer not null default 1, published_at timestamptz not null default now()
);
insert into public.admin_home(singleton,draft,published) select true,c,c from (select '{"heroes":[{"id":"original","imageUrl":"/admin-assets/home-hero.png","alt":"Nail and beauty campaign photograph","title":"Nail & beauty\ndesign library","rotate":180},{"id":"second","imageUrl":"/admin-assets/home-hero-second.png","alt":"Burgundy nail art with silver jewellery","title":"Nail & beauty\ndesign library","rotate":0}],"featuredDesignIds":[],"announcements":[]}'::jsonb c) initial;
alter table public.mobile_reports add column assigned_to uuid;
alter table public.mobile_reports drop constraint mobile_reports_target_type_check;
alter table public.mobile_reports add constraint mobile_reports_target_type_check check(target_type in('profile','design','message','post','story'));
do $$ declare t text; begin
 foreach t in array array['admin_staff','admin_actions','admin_notes','admin_moderation','admin_suspensions','admin_owned_designs','admin_credit_corrections','admin_home'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create function public.account_is_suspended(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.admin_suspensions where user_id=p_id and suspended);
$$;
create function public.admin_content_hidden(p_type text,p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.admin_moderation where target_type=p_type and target_id=p_id and hidden);
$$;
revoke all on function public.account_is_suspended(uuid),public.admin_content_hidden(text,uuid) from public;
grant execute on function public.account_is_suspended(uuid),public.admin_content_hidden(text,uuid) to anon,authenticated,service_role;
-- Remove every legacy flag-based policy. Ordinary creator ownership policies stay intact.
do $$ declare p record; begin
 for p in select * from pg_policies where schemaname in('public','storage') and (coalesce(qual,'')||coalesce(with_check,'')) like '%is_admin%' loop
 execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
 end loop;
end $$;
-- Preserve the owner half of legacy combined owner/admin policies.
create policy "Own reported records" on public.mobile_reports for select to authenticated using(reporter_id=auth.uid());
create policy "Owner design tags" on public.design_tags for all to authenticated using(exists(select from public.designs d where d.id=design_id and d.created_by=auth.uid())) with check(exists(select from public.designs d where d.id=design_id and d.created_by=auth.uid()));
create policy "Owner design images" on public.design_images for all to authenticated using(exists(select from public.designs d where d.id=design_id and d.created_by=auth.uid())) with check(exists(select from public.designs d where d.id=design_id and d.created_by=auth.uid()));
create policy "Owner design colours" on public.design_colours for all to authenticated using(exists(select from public.designs d where d.id=design_id and d.created_by=auth.uid())) with check(exists(select from public.designs d where d.id=design_id and d.created_by=auth.uid()));
create policy "Own avatar story upload" on storage.objects for insert to authenticated with check(bucket_id='designs' and split_part(name,'/',1) in('avatars','stories') and split_part(name,'/',2)=auth.uid()::text);
create policy "Own avatar story update" on storage.objects for update to authenticated using(bucket_id='designs' and split_part(name,'/',1) in('avatars','stories') and split_part(name,'/',2)=auth.uid()::text);
update public.profiles_data set is_admin=false where is_admin;
create function public.retire_admin_flag() returns trigger language plpgsql set search_path='' as $$begin new.is_admin:=false;return new;end $$;
create trigger retire_admin_flag before insert or update of is_admin on public.profiles_data for each row execute function public.retire_admin_flag();
create policy "Admin visibility" on public.designs as restrictive for select to anon,authenticated using(not public.admin_content_hidden('design',id) and not public.account_is_suspended(created_by));
create policy "Admin visibility" on public.salon_posts as restrictive for select to anon,authenticated using(not public.admin_content_hidden('post',id) and not public.account_is_suspended(creator_id));
create policy "Admin visibility" on public.stories as restrictive for select to anon,authenticated using(not public.admin_content_hidden('story',id) and not public.account_is_suspended(user_id));
create policy "Admin visibility" on public.messages as restrictive for select to anon,authenticated using(not public.admin_content_hidden('message',id));
create policy "Admin visibility" on public.design_images as restrictive for select to anon,authenticated using(exists(select from public.designs where id=design_id));
create policy "Admin visibility" on public.design_tags as restrictive for select to anon,authenticated using(exists(select from public.designs where id=design_id));
do $$ declare definition text; begin
 definition:=rtrim(pg_get_viewdef('public.profiles'::regclass,true),';');
 execute 'create or replace view public.profiles with(security_barrier=true) as select p.* from ('||definition||') p where p.id=auth.uid() or not public.account_is_suspended(p.id)';
end $$;
do $$ declare t text; begin
 foreach t in array array['services','availability','creator_booking_settings'] loop
 execute format('create policy "Suspended creator discovery" on public.%I as restrictive for select to anon,authenticated using(creator_id=auth.uid() or not public.account_is_suspended(creator_id))',t);
 end loop;
end $$;
create function public.guard_suspended_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; other uuid;
begin
 actor:=coalesce(nullif(to_jsonb(new)->>'created_by','')::uuid,nullif(to_jsonb(new)->>'user_id','')::uuid,nullif(to_jsonb(new)->>'creator_id','')::uuid,nullif(to_jsonb(new)->>'sender_id','')::uuid,auth.uid());
 if tg_table_name='bookings' then
  if tg_op='UPDATE' and new.status<>'confirmed' then return new; end if;
  actor:=new.client_id; other:=new.creator_id;
  if tg_op='UPDATE' and old.status='confirmed' then return new; end if;
 elsif tg_table_name='messages' then
  select case when c.client_id=actor then c.creator_id else c.client_id end into other from public.conversations c where c.id=new.conversation_id;
 elsif tg_op='UPDATE' and auth.role()='service_role' then return new;
 end if;
 perform 1 from public.profiles_data where id in(actor,other) order by id for update;
 if public.account_is_suspended(actor) or public.account_is_suspended(other) then raise exception 'ACCOUNT_SUSPENDED'; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['designs','stories','salon_posts','messages','nail_lab_generations','generation_reservations','bookings'] loop
 execute format('create trigger admin_activity_guard before insert or update on public.%I for each row execute function public.guard_suspended_activity()',t);
 end loop;
end $$;
create function public.admin_media_available(p_bucket text,p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select from public.designs d where (d.image_url like '%/'||p_bucket||'/'||p_path or exists(select from public.design_images i where i.design_id=d.id and i.image_url like '%/'||p_bucket||'/'||p_path)) and(public.admin_content_hidden('design',d.id) or public.account_is_suspended(d.created_by)))
 and not exists(select from public.stories s where p_bucket='social-media' and s.media_path=p_path and(public.admin_content_hidden('story',s.id) or public.account_is_suspended(s.user_id)))
 and not exists(select from public.salon_posts p where p_bucket='social-media' and p.media @> jsonb_build_array(jsonb_build_object('path',p_path)) and(public.admin_content_hidden('post',p.id) or public.account_is_suspended(p.creator_id)))
 and not exists(select from public.messages m where p_bucket='mobile-uploads' and m.image_path=p_path and public.admin_content_hidden('message',m.id));
$$;
revoke all on function public.admin_media_available(text,text) from public;
grant execute on function public.admin_media_available(text,text) to anon,authenticated;
create policy "Moderated media access" on storage.objects as restrictive for select to anon,authenticated using(public.admin_media_available(bucket_id,name));

-- All mutations and their audit records commit together. Service role only;
-- the HTTP boundary verifies AAL2, this function rechecks and locks staff membership.
create function public.admin_mutate(p_actor uuid,p_action text,p_target uuid,p_reason text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r text; result jsonb:='{}'; v integer; b integer; correction public.admin_credit_corrections; report public.mobile_reports; typ text;
begin
 if length(trim(p_reason)) not between 5 and 1000 then raise exception 'REASON_REQUIRED'; end if;
 select role into r from public.admin_staff where user_id=p_actor and active for update;
 if r is null or public.account_is_closed(p_actor) or public.account_is_suspended(p_actor) then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_action in('staff','suspend','credits','own-design') and r<>'owner' then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_action in('moderate','report','home-draft','home-publish','design','tag','media') and r not in('owner','moderator') then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_action='note' and not ((p_data->>'type'='report' and r in('owner','moderator')) or (p_data->>'type' in('user','booking') and r in('owner','support'))) then raise exception 'ADMIN_FORBIDDEN'; end if;
 case p_action
 when 'media' then result:=jsonb_build_object('uploaded',true);
 when 'credits' then
  perform 1 from public.profiles_data where id=p_target and deletion_started_at is null for update;
  if not found then raise exception 'TARGET_UNAVAILABLE'; end if;
  select * into correction from public.admin_credit_corrections where idempotency_key=(p_data->>'key')::uuid;
  if found then
   if correction.user_id<>p_target or correction.actor_id<>p_actor or correction.delta<>(p_data->>'delta')::integer or correction.reason<>p_reason then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return to_jsonb(correction);
  end if;
  v:=(p_data->>'delta')::integer;
  if v=0 or abs(v::bigint)>10000 then raise exception 'INVALID_DELTA'; end if;
  update public.profiles_data set credit_balance=credit_balance+v where id=p_target and credit_balance+v>=0 returning credit_balance into b;
  if not found then raise exception 'INSUFFICIENT_BALANCE'; end if;
  insert into public.admin_credit_corrections(user_id,actor_id,delta,balance_after,reason,idempotency_key) values(p_target,p_actor,v,b,p_reason,(p_data->>'key')::uuid) returning * into correction;
  result:=to_jsonb(correction);
 when 'staff' then
  -- Serialize all membership changes so concurrent removals cannot remove the final owner.
  perform pg_advisory_xact_lock(86427030);
  perform 1 from auth.users where id=p_target and email_confirmed_at is not null;
  if not found or public.account_is_closed(p_target) or public.account_is_suspended(p_target) then raise exception 'VERIFIED_ACCOUNT_REQUIRED'; end if;
  if exists(select from public.admin_staff where user_id=p_target and role='owner') then
   if coalesce((p_data->>'active')::boolean,true) or (select count(*) from public.admin_staff where role='owner' and active)<=1 then raise exception 'FINAL_OWNER_PROTECTED'; end if;
   update public.admin_staff set active=false,updated_at=now() where user_id=p_target;
  else
   if p_data->>'role' not in('support','moderator') then raise exception 'INVALID_ROLE'; end if;
   insert into public.admin_staff(user_id,role,active,assigned_by) values(p_target,p_data->>'role',coalesce((p_data->>'active')::boolean,true),p_actor)
   on conflict(user_id) do update set role=excluded.role,active=excluded.active,assigned_by=p_actor,updated_at=now();
  end if;
 when 'suspend' then
  perform 1 from public.profiles_data where id=p_target and deletion_started_at is null for update;
  if not found or exists(select from public.admin_staff where user_id=p_target and role='owner' and active) then raise exception 'TARGET_UNAVAILABLE'; end if;
  insert into public.admin_suspensions(user_id,suspended) values(p_target,(p_data->>'suspended')::boolean) on conflict(user_id) do update set suspended=excluded.suspended,updated_at=now();
 when 'moderate' then
  select * into report from public.mobile_reports where id=p_target for update;
  if not found or report.target_type='profile' then raise exception 'REPORTED_CONTENT_REQUIRED'; end if;
  typ:=report.target_type;
  insert into public.admin_moderation(target_type,target_id,hidden) values(typ,report.target_id,(p_data->>'hidden')::boolean)
  on conflict(target_type,target_id) do update set hidden=excluded.hidden,updated_at=now();
 when 'report' then
  if p_data->>'status' not in('open','reviewed','resolved') then raise exception 'INVALID_STATUS'; end if;
  if nullif(p_data->>'assignedTo','') is not null and not exists(select from public.admin_staff where user_id=(p_data->>'assignedTo')::uuid and active and role in('owner','moderator')) then raise exception 'INVALID_ASSIGNEE'; end if;
  update public.mobile_reports set status=p_data->>'status',assigned_to=nullif(p_data->>'assignedTo','')::uuid where id=p_target;
  if not found then raise exception 'TARGET_UNAVAILABLE'; end if;
 when 'note' then
  if p_data->>'type' not in('user','booking','report') or length(p_data->>'body') not between 5 and 4000 then raise exception 'INVALID_NOTE'; end if;
  insert into public.admin_notes(target_type,target_id,actor_id,body) values(p_data->>'type',p_target,p_actor,p_data->>'body');
 when 'home-draft' then
  update public.admin_home set draft=p_data->'content',version=version+1 where singleton and version=(p_data->>'version')::integer returning version into v;
  if not found then raise exception 'EDIT_CONFLICT'; end if;
  result:=jsonb_build_object('version',v);
 when 'home-publish' then
  update public.admin_home set published=draft,revision=revision+1,version=version+1,published_at=now() where singleton and version=(p_data->>'version')::integer returning revision,version into b,v;
  if not found then raise exception 'EDIT_CONFLICT'; end if;
  result:=jsonb_build_object('revision',b,'version',v);
 when 'own-design' then
  insert into public.designs(title,description,image_url,created_by,is_published,category,shape,length) values(p_data->>'title',p_data->>'description',p_data->>'imageUrl',p_actor,false,p_data->>'category',p_data->>'shape',p_data->>'length') returning id into p_target;
  insert into public.admin_owned_designs(design_id) values(p_target); result:=jsonb_build_object('id',p_target);
 when 'design' then
  if not exists(select from public.admin_owned_designs where design_id=p_target) then raise exception 'LAQUE_DESIGN_REQUIRED'; end if;
  update public.designs set title=p_data->>'title',description=p_data->>'description',category=p_data->>'category',shape=p_data->>'shape',length=p_data->>'length',is_published=(p_data->>'published')::boolean where id=p_target;
  delete from public.design_tags where design_id=p_target;
  insert into public.design_tags(design_id,tag_id) select p_target,value::uuid from jsonb_array_elements_text(coalesce(p_data->'tags','[]'));
 when 'tag' then
  if length(trim(p_data->>'name')) not between 1 and 60 then raise exception 'INVALID_TAG'; end if;
  if p_target is null then insert into public.tags(name) values(trim(p_data->>'name')); else update public.tags set name=trim(p_data->>'name') where id=p_target; end if;
 else raise exception 'INVALID_ACTION';
 end case;
 insert into public.admin_actions(actor_id,actor_role,action,target_id,reason,details) values(p_actor,r,p_action,p_target::text,p_reason,p_data-'content'-'body'-'imageUrl');
 return result;
end $$;
revoke all on function public.admin_mutate(uuid,text,uuid,text,jsonb),public.guard_suspended_activity() from public,anon,authenticated;
grant execute on function public.admin_mutate(uuid,text,uuid,text,jsonb) to service_role;
create view public.admin_content_posts as select p.id,p.creator_id,p.body,p.created_at from public.salon_posts p where exists(select from public.mobile_reports r where r.target_type='post' and r.target_id=p.id);
create view public.admin_content_stories as select s.id,s.user_id,s.caption,s.created_at from public.stories s where exists(select from public.mobile_reports r where r.target_type='story' and r.target_id=s.id);
revoke all on public.admin_content_posts,public.admin_content_stories from public,anon,authenticated;grant select on public.admin_content_posts,public.admin_content_stories to service_role;
create view public.admin_content_designs as select d.* from public.designs d join public.profiles_data p on p.id=d.created_by
 where exists(select from public.admin_owned_designs o where o.design_id=d.id) or(d.is_published and not p.is_private and not public.account_is_closed(p.id));
revoke all on public.admin_content_designs from public,anon,authenticated;grant select on public.admin_content_designs to service_role;
create function public.bootstrap_admin_owner(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(86427030);
 if exists(select from public.admin_staff where role='owner') then raise exception 'OWNER_ALREADY_BOUND';end if;
 if not exists(select from auth.users where id=p_id and email_confirmed_at is not null) or public.account_is_closed(p_id) then raise exception 'VERIFIED_ACCOUNT_REQUIRED';end if;
 insert into public.admin_staff(user_id,role) values(p_id,'owner');
 insert into public.admin_actions(actor_id,actor_role,action,target_id,reason) values(p_id,'owner','owner-bootstrap',p_id::text,'Initial Owner explicitly bound to verified LaQue account during beta setup');
end $$;
revoke all on function public.bootstrap_admin_owner(uuid),public.retire_admin_flag() from public,anon,authenticated;
grant execute on function public.bootstrap_admin_owner(uuid) to service_role;
commit;
