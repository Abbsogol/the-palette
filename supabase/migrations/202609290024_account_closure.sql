-- Immediate, irreversible closure is separate from byte removal and financial retention.
-- Rehearse before rollout. No blanket two-year personal-data archive.
begin;
create table public.account_closures (
  user_id uuid primary key references public.profiles_data(id) on delete cascade,
  closed_at timestamptz not null default now(), cleanup_completed_at timestamptz, auth_erased_at timestamptz,
  attempts integer not null default 0, retry_at timestamptz not null default now(),
  last_error text, lease_until timestamptz, claim_token uuid
);
alter table public.account_closures enable row level security;
revoke all on public.account_closures from public,anon,authenticated;
grant all on public.account_closures to service_role;

-- Retention decisions must be specific, documented and dated. This is not an
-- archive of every deleted profile, message or image. No client access.
create table public.account_retention_holds (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles_data(id) on delete cascade,
  category text not null check(category in ('financial')),
  basis text not null check(length(basis)>=10), retain_until timestamptz not null,
  review_at timestamptz not null, created_at timestamptz not null default now(),
  check(review_at<=retain_until)
);
alter table public.account_retention_holds enable row level security;
revoke all on public.account_retention_holds from public,anon,authenticated;
grant all on public.account_retention_holds to service_role;

create function public.account_is_closed(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select from public.account_closures where user_id=p_user_id);
$$;
revoke all on function public.account_is_closed(uuid) from public;
grant execute on function public.account_is_closed(uuid) to anon,authenticated,service_role;

-- A specific legal preservation request can store selected evidence separately.
-- There is no automatic copy of a user's profile or inbox into this table.
create table public.account_legal_records (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null,
 case_reference text not null, basis text not null check(length(basis)>=10),
 record_scope text not null check(length(record_scope)>=5), evidence jsonb not null,
 retain_until timestamptz not null, review_at timestamptz not null,
 created_at timestamptz not null default now(), check(review_at<=retain_until)
);
alter table public.account_legal_records enable row level security;
revoke all on public.account_legal_records from public,anon,authenticated;
grant all on public.account_legal_records to service_role;

create function public.purge_expired_account_legal_records(p_limit integer default 1000) returns integer
language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
  with expired as (select id from public.account_legal_records where retain_until<=now()
    order by retain_until for update skip locked limit least(greatest(p_limit,1),1000))
  delete from public.account_legal_records r using expired e where r.id=e.id;
  get diagnostics removed=row_count;
  return removed;
end $$;
revoke all on function public.purge_expired_account_legal_records(integer) from public,anon,authenticated;
grant execute on function public.purge_expired_account_legal_records(integer) to service_role;

-- Old access JWTs can survive a ban until expiration. Deny their direct table
-- access as well as their API calls. Service workers keep financial access.
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  loop
    execute format('create policy "Closed accounts have no access" on public.%I as restrictive for all to anon,authenticated using (not public.account_is_closed(auth.uid())) with check(not public.account_is_closed(auth.uid()))',t.relname);
  end loop;
end $$;
create policy "Closed accounts have no storage access" on storage.objects as restrictive for all to anon,authenticated
 using(not public.account_is_closed(auth.uid())) with check(not public.account_is_closed(auth.uid()));

-- Preserve the existing masked column contract. Definer views need their own
-- closure predicate because they do not inherit the caller's RLS policies.
do $$ declare definition text; begin
  definition:=rtrim(pg_get_viewdef('public.profiles'::regclass,true),';');
  execute 'create or replace view public.profiles with(security_barrier=true) as select p.* from ('||definition||') p where not public.account_is_closed(p.id) and not public.account_is_closed(auth.uid())';
end $$;
do $$ declare t text; c text; begin
  for t,c in select * from (values ('designs','created_by'),('stories','user_id'),('salon_posts','creator_id'),('services','creator_id'),('availability','creator_id'),('creator_booking_settings','creator_id')) s(t,c)
  loop
    execute format('create policy "Hide closed account content" on public.%I as restrictive for select to anon,authenticated using(not public.account_is_closed(%I))',t,c);
  end loop;
end $$;

-- Definer RPCs bypass table RLS. Triggers reject old-JWT writes too, while
-- allowing service-role settlement/reconciliation after account closure.
create function public.guard_closed_actor() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() in ('anon','authenticated') and public.account_is_closed(auth.uid()) then raise exception 'ACCOUNT_CLOSED'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
  loop execute format('create trigger closed_actor_guard before insert or update or delete on public.%I for each row execute function public.guard_closed_actor()',t.relname); end loop;
end $$;
create function public.guard_closed_booking_participants() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or (new.status='confirmed' and old.status is distinct from 'confirmed') then
    -- Deterministic participant locks serialize booking requests with closure.
    perform 1 from public.profiles_data where id in (new.client_id,new.creator_id) order by id for update;
    if public.account_is_closed(new.client_id) or public.account_is_closed(new.creator_id) then raise exception 'ACCOUNT_CLOSED'; end if;
  end if;
  return new;
end $$;
create trigger a_closed_booking_participants before insert or update of status on public.bookings for each row execute function public.guard_closed_booking_participants();

create function public.close_account(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  insert into public.account_closures(user_id) values(p_user_id) on conflict do nothing;
  if not found then return jsonb_build_object('closed',true,'cleanup','pending'); end if;
  update public.profiles_data set deletion_started_at=coalesce(deletion_started_at,now()),
    is_private=true,message_permission='none',show_saves=false,is_admin=false,
    display_name='Deleted account',username=null,bio=null,location=null,avatar_url=null,
    phone_number=null,preferred_contact=null,booking_notes=null,booking_area=null,
    nail_shape=null,nail_length=null,nail_colors=null,nail_finishes=null,nail_techniques=null,
    occasions=null,budget_range=null,allergies=null,product_sensitivities=null,
    nail_condition=null,skin_undertone=null,hand_photo_url=null,specialties=null
    where id=p_user_id;
  -- Existing status triggers atomically create durable full-refund obligations.
  update public.bookings set status='cancelled' where p_user_id in (client_id,creator_id)
    and status in ('pending','confirmed') and (ends_at is null or ends_at>now());
  update public.services set is_active=false where creator_id=p_user_id;
  update public.designs set is_published=false where created_by=p_user_id;
  delete from public.mobile_push_registrations where user_id=p_user_id;
  -- Explicit disconnect: encrypted credentials are removed immediately. Google
  -- copies remain user-controlled; queued jobs for the other party are retained.
  delete from public.google_calendar_connections where user_id=p_user_id;
  delete from public.google_calendar_oauth where user_id=p_user_id;
  return jsonb_build_object('closed',true,'cleanup','pending');
end $$;

create function public.claim_account_cleanup(p_limit integer default 3) returns setof public.account_closures
language sql security definer set search_path='' as $$
  with ready as (select user_id from public.account_closures where cleanup_completed_at is null and retry_at<=now() and (lease_until is null or lease_until<now()) order by closed_at for update skip locked limit least(greatest(p_limit,1),10))
  update public.account_closures c set claim_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 from ready r where c.user_id=r.user_id returning c.*;
$$;

-- Personal data cleanup does not await settlement. Financial and appointment
-- records stay restricted until existing settlement guards and retention review
-- permit final physical deletion. Do not copy passwords, tokens or photos.
create function public.erase_closed_account_content(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.account_closures where user_id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_CLOSED'; end if;
  delete from public.stories where user_id=p_user_id;
  delete from public.saved_designs where user_id=p_user_id;
  delete from public.favourite_creators where user_id=p_user_id;
  delete from public.follows where follower_id=p_user_id or following_id=p_user_id;
  delete from public.collection_designs where collection_id in (select id from public.collections where user_id=p_user_id);
  delete from public.collections where user_id=p_user_id;
  delete from public.client_health_notes where user_id=p_user_id;
  delete from public.client_booking_notes where user_id=p_user_id;
  delete from public.client_notes where client_id=p_user_id or creator_id=p_user_id;
  delete from public.notifications where user_id=p_user_id;
  delete from public.moodboard_members where user_id=p_user_id or invited_by=p_user_id;
  delete from public.moodboards where user_id=p_user_id;
  delete from public.design_comments where user_id=p_user_id;
  delete from public.design_likes where user_id=p_user_id;
  delete from public.story_likes where user_id=p_user_id;
  delete from public.salon_posts where creator_id=p_user_id;
  delete from public.challenge_submissions where user_id=p_user_id;
  update public.messages set content='[Message removed]',image_path=null,design_id=null where sender_id=p_user_id;
  update public.bookings set notes=null where client_id=p_user_id;

  -- Keep a payment target until delayed webhooks have been reconciled.
  delete from public.designs d where created_by=p_user_id and not exists(select from public.order_payments p where p.kind='boost' and p.target_id=d.id) and not exists(select from public.payment_checkouts p where p.design_id=d.id);
  delete from public.nail_lab_generations where user_id=p_user_id and not exists(select from public.generation_reservations r where r.user_id=p_user_id and r.status='reserved');
end $$;

-- Every hard-deletion path (including the legacy self-delete RPC) honors holds
-- and requires an explicit, documented retention decision for financial users.
alter function public.delete_account(uuid) rename to delete_account_before_retention;
create function public.delete_account(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  perform public.begin_account_deletion(p_user_id);
  if exists(select from public.account_retention_holds where user_id=p_user_id and retain_until>now()) then raise exception 'RETENTION_IN_PROGRESS'; end if;
  if (exists(select from public.credit_payments where user_id=p_user_id)
    or exists(select from public.order_payments where user_id=p_user_id)
    or exists(select from public.order_payments p join public.bookings b on p.kind='deposit' and p.target_id=b.id where b.creator_id=p_user_id)
    or exists(select from public.subscription_credit_grants where user_id=p_user_id)
    or exists(select from public.mobile_store_transactions where user_id=p_user_id))
    and not exists(select from public.account_retention_holds where user_id=p_user_id and category='financial' and retain_until<=now()) then raise exception 'RETENTION_REVIEW_REQUIRED'; end if;
  perform public.delete_account_before_retention(p_user_id);
end $$;
revoke all on function public.delete_account_before_retention(uuid) from public,anon,authenticated,service_role;
revoke all on function public.close_account(uuid),public.claim_account_cleanup(integer),public.erase_closed_account_content(uuid),public.guard_closed_actor(),public.guard_closed_booking_participants(),public.delete_account(uuid) from public,anon,authenticated;
grant execute on function public.close_account(uuid),public.claim_account_cleanup(integer),public.erase_closed_account_content(uuid),public.delete_account(uuid) to service_role;
notify pgrst,'reload schema';
commit;
