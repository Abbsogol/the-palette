-- Apply after 001 and 002, before the matching routes.
begin;

alter table public.profiles_data add column stripe_subscription_id text;
alter table public.profiles_data add column subscription_event_created bigint not null default 0;

-- One durable attempt per account, across plans, processes and HTTP retries.
-- Never release an attempt because a Stripe call timed out: it may have succeeded.
create table public.subscription_checkouts (
  user_id uuid primary key references public.profiles_data(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  plan_id text not null check (plan_id in ('premium','pro_creator')),
  customer_id text,
  email text,
  base_url text not null,
  session_id text unique,
  created_at timestamptz not null default now()
);
alter table public.subscription_checkouts enable row level security;
revoke all on public.subscription_checkouts from public, anon, authenticated;
grant all on public.subscription_checkouts to service_role;

create function public.reserve_subscription_checkout(p_user_id uuid, p_plan_id text, p_email text, p_base_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prof public.profiles_data; attempt public.subscription_checkouts;
begin
  select * into strict prof from public.profiles_data where id=p_user_id for update;
  if prof.subscription_tier is not null and prof.subscription_tier<>'free' then
    raise exception 'ALREADY_SUBSCRIBED';
  end if;
  select * into attempt from public.subscription_checkouts where user_id=p_user_id;
  if not found then
    insert into public.subscription_checkouts(user_id,plan_id,customer_id,email,base_url)
      values(p_user_id,p_plan_id,prof.stripe_customer_id,p_email,p_base_url) returning * into attempt;
  end if;
  return to_jsonb(attempt);
end $$;

-- This may only be called after Stripe positively reports an expired session.
-- Both IDs protect a newer attempt from a delayed expiry/retry.
create function public.expire_subscription_checkout(p_user_id uuid,p_id uuid,p_session_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  delete from public.subscription_checkouts where user_id=p_user_id and id=p_id and session_id=p_session_id;
  return found;
end $$;

create function public.complete_onboarding(p_user_id uuid,p_fields jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare fields public.profiles_data;
begin
  fields:=jsonb_populate_record(null::public.profiles_data,p_fields);
  update public.profiles_data set
    display_name=fields.display_name,phone_number=fields.phone_number,location=fields.location,bio=fields.bio,
    nail_shape=fields.nail_shape,nail_length=fields.nail_length,nail_colors=fields.nail_colors,
    nail_finishes=fields.nail_finishes,nail_techniques=fields.nail_techniques,occasions=fields.occasions,
    budget_range=fields.budget_range,allergies=fields.allergies,product_sensitivities=fields.product_sensitivities,
    removal_needed=fields.removal_needed,specialties=fields.specialties,
    credit_balance=coalesce(credit_balance,0)+case when account_type in ('creator','salon') then 5 else 3 end,
    onboarding_complete=true
    where id=p_user_id and onboarding_complete is not true;
  if found then return true; end if;
  if not exists(select from public.profiles_data where id=p_user_id) then raise no_data_found; end if;
  return false;
end $$;

-- Terminal state survives delivery before checkout fulfillment. This closes
-- the race where checkout read Stripe just before a cancellation occurred.
create table public.subscription_cancellations (
  subscription_id text primary key,
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  customer_id text not null
);
alter table public.subscription_cancellations enable row level security;
revoke all on public.subscription_cancellations from public,anon,authenticated;
grant all on public.subscription_cancellations to service_role;

-- Event receipt, subscription identity and entitlement update commit together.
-- Cancellation leaves the identity as a tombstone so late activation cannot
-- resurrect it. A fresh checkout attempt can bind a different subscription.
create function public.apply_subscription_event(p_event_id text,p_user_id uuid,p_subscription_id text,
  p_customer_id text,p_plan_id text,p_status text,p_created bigint,p_attempt_id uuid default null,p_session_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare prof public.profiles_data; attempt public.subscription_checkouts; terminal boolean;
begin
  if p_subscription_id is null or p_customer_id is null or p_created is null or p_created<0
    or p_status not in ('active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused') then
    raise exception 'INVALID_SUBSCRIPTION_EVENT';
  end if;
  select * into prof from public.profiles_data where id=p_user_id for update;
  -- Deleted accounts must not make Stripe retry forever.
  if not found then return false; end if;
  insert into public.processed_webhook_events(event_id) values(p_event_id) on conflict do nothing;
  if not found then return false; end if;
  if p_status in ('canceled','incomplete_expired') then
    insert into public.subscription_cancellations(subscription_id,user_id,customer_id)
      values(p_subscription_id,p_user_id,p_customer_id) on conflict do nothing;
  end if;
  if exists(select from public.subscription_cancellations where subscription_id=p_subscription_id
    and user_id=p_user_id and customer_id=p_customer_id) then p_status:='canceled'; end if;
  select * into attempt from public.subscription_checkouts where user_id=p_user_id;
  if p_session_id is not null then
    if p_attempt_id is not null then
      if attempt.id is distinct from p_attempt_id or
        (attempt.session_id is not null and attempt.session_id<>p_session_id) or
        (attempt.customer_id is not null and attempt.customer_id<>p_customer_id) then return false; end if;
    else
      -- Legacy sessions require an already known customer; reconcile unknown
      -- pre-migration purchases before enabling this deployment.
      if prof.stripe_customer_id is distinct from p_customer_id or
        (prof.stripe_subscription_id is not null and prof.stripe_subscription_id<>p_subscription_id)
        or attempt.id is not null then return false; end if;
    end if;
  elsif prof.stripe_subscription_id is distinct from p_subscription_id or
        prof.stripe_customer_id is distinct from p_customer_id then
    return false;
  end if;
  if prof.stripe_subscription_id=p_subscription_id then
    if (p_created<prof.subscription_event_created and p_status not in ('canceled','incomplete_expired'))
      or prof.subscription_status in ('canceled','incomplete_expired') then return false; end if;
  elsif p_session_id is null then return false;
  end if;
  terminal:=p_status in ('canceled','incomplete_expired');
  if not terminal and (p_plan_id is null or p_plan_id not in ('premium','pro_creator')) then
    raise exception 'INVALID_SUBSCRIPTION_PLAN';
  end if;
  update public.profiles_data set stripe_subscription_id=p_subscription_id,stripe_customer_id=p_customer_id,
    subscription_tier=case when terminal then null when p_status in ('active','trialing','past_due','unpaid') then p_plan_id else null end,
    subscription_status=p_status,subscription_event_created=case when prof.stripe_subscription_id=p_subscription_id then greatest(p_created,prof.subscription_event_created) else p_created end where id=p_user_id;
  if p_session_id is not null then
    delete from public.subscription_checkouts where user_id=p_user_id and id=p_attempt_id;
  end if;
  return true;
end $$;

revoke all on function public.reserve_subscription_checkout(uuid,text,text,text),public.expire_subscription_checkout(uuid,uuid,text),
  public.complete_onboarding(uuid,jsonb),public.apply_subscription_event(text,uuid,text,text,text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_subscription_checkout(uuid,text,text,text),public.expire_subscription_checkout(uuid,uuid,text),
  public.complete_onboarding(uuid,jsonb),public.apply_subscription_event(text,uuid,text,text,text,text,bigint,uuid,text) to service_role;

-- Account-owned content is removed with the account, consistently with the
-- existing cascades for bookings, messages, generations and credit ledgers.
-- Collections survive; their links to deleted designs do not.
alter table public.designs drop constraint designs_created_by_fkey;
alter table public.designs add constraint designs_created_by_fkey foreign key(created_by) references public.profiles_data(id) on delete cascade;
alter table public.designs drop constraint designs_source_generation_id_fkey;
alter table public.designs add constraint designs_source_generation_id_fkey foreign key(source_generation_id) references public.nail_lab_generations(id) on delete set null;
alter table public.collection_designs drop constraint collection_designs_design_id_fkey;
alter table public.collection_designs add constraint collection_designs_design_id_fkey foreign key(design_id) references public.designs(id) on delete cascade;
alter table public.moodboard_members drop constraint moodboard_members_invited_by_fkey;
alter table public.moodboard_members add constraint moodboard_members_invited_by_fkey foreign key(invited_by) references auth.users(id) on delete cascade;

-- Only enumerate objects with a verified owner or an application-owned path.
-- Actual bytes must be removed through Storage's API, never SQL DELETE.
create function public.account_storage_objects(p_user_id uuid)
returns table(bucket_id text,name text) language sql security definer set search_path='' as $$
  select o.bucket_id,o.name from storage.objects o where
    o.owner_id=p_user_id::text or
    (o.bucket_id='nail-lab' and starts_with(o.name,p_user_id::text||'/')) or
    (o.bucket_id='designs' and (
      starts_with(o.name,p_user_id::text||'-') or
      starts_with(o.name,'avatars/'||p_user_id::text||'/') or
      starts_with(o.name,'hand-photos/'||p_user_id::text||'/') or
      starts_with(o.name,'published/'||p_user_id::text||'/') or
      (o.name like 'challenges/%' and split_part(o.name,'/',3) like p_user_id::text||'-%')
    ));
$$;
create function public.delete_account(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists(select from public.profiles_data where id=p_user_id and subscription_tier is not null and subscription_tier<>'free')
    or exists(select from public.subscription_checkouts where user_id=p_user_id) then
    raise exception 'MANAGE_SUBSCRIPTION_BEFORE_DELETION';
  end if;
  if exists(select from public.account_storage_objects(p_user_id)) then raise exception 'ACCOUNT_FILES_REMAIN'; end if;
  -- This legacy table has no owner foreign key, so remove owned collections
  -- explicitly in the same transaction. Other users' collections survive.
  delete from public.collection_designs where collection_id in (select id from public.collections where user_id=p_user_id);
  delete from public.collections where user_id=p_user_id;
  delete from auth.users where id=p_user_id;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
end $$;
revoke all on function public.account_storage_objects(uuid),public.delete_account(uuid) from public,anon,authenticated;
grant execute on function public.account_storage_objects(uuid),public.delete_account(uuid) to service_role;

create or replace function public.delete_own_account() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  perform public.delete_account(auth.uid());
end $$;

create policy "Admins manage products" on public.products for all to authenticated
using (exists(select from public.profiles where id=auth.uid() and is_admin=true))
with check (exists(select from public.profiles where id=auth.uid() and is_admin=true));

commit;
