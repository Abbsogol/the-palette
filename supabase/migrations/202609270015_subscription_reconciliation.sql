-- Read Stripe only after acquiring a lease; fence its result before applying it.
-- Stripe event timestamps have second precision and cannot order concurrent reads.
begin;

-- Preserve exact server-verified Prices after deployment configuration changes.
-- Unknown legacy Prices require reconciliation; never infer a tier from metadata.
create table public.subscription_prices (
  price_id text primary key,
  plan_id text not null check(plan_id in ('premium','pro_creator'))
);
alter table public.subscription_prices enable row level security;
revoke all on public.subscription_prices from public,anon,authenticated;
grant select on public.subscription_prices to service_role;
create function public.resolve_subscription_price(p_price_id text,p_plan_id text default null) returns text
language plpgsql security definer set search_path='' as $$
declare stored text;
begin
  if coalesce(p_price_id,'')='' then return null; end if;
  if p_plan_id is not null then
    if p_plan_id not in ('premium','pro_creator') then raise exception 'INVALID_SUBSCRIPTION_PLAN'; end if;
    insert into public.subscription_prices(price_id,plan_id) values(p_price_id,p_plan_id) on conflict do nothing;
  end if;
  select plan_id into stored from public.subscription_prices where price_id=p_price_id;
  if p_plan_id is not null and stored<>p_plan_id then raise exception 'SUBSCRIPTION_PRICE_CONFLICT'; end if;
  return stored;
end $$;

create table public.subscription_reconciliations (
  subscription_id text primary key,
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  customer_id text not null,
  claim_token uuid,
  claim_until timestamptz,
  needs_review boolean not null default true
);
alter table public.subscription_reconciliations enable row level security;
revoke all on public.subscription_reconciliations from public,anon,authenticated;
grant all on public.subscription_reconciliations to service_role;

create function public.subscription_owner_matches(p_subscription_id text,p_customer_id text,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select from public.subscription_accounts where subscription_id=p_subscription_id and customer_id=p_customer_id and user_id=p_user_id)
    or exists(select from public.profiles_data where stripe_subscription_id=p_subscription_id and stripe_customer_id=p_customer_id and id=p_user_id)
    or exists(select from public.subscription_reconciliations where subscription_id=p_subscription_id and customer_id=p_customer_id and user_id=p_user_id);
$$;

create function public.claim_subscription_reconciliation(p_subscription_id text,p_customer_id text,p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; owner_customer text; prof public.profiles_data; claim public.subscription_reconciliations; token uuid;
begin
  if coalesce(p_subscription_id,'')='' or coalesce(p_customer_id,'')='' then raise exception 'SUBSCRIPTION_IDENTITY_MISMATCH'; end if;
  select user_id,customer_id into owner_id,owner_customer from public.subscription_accounts where subscription_id=p_subscription_id;
  if owner_id is null then
    select id,stripe_customer_id into owner_id,owner_customer from public.profiles_data where stripe_subscription_id=p_subscription_id;
  end if;
  if owner_id is null then
    select user_id,customer_id into owner_id,owner_customer from public.subscription_reconciliations where subscription_id=p_subscription_id;
  end if;
  if owner_customer is not null and owner_customer<>p_customer_id then raise exception 'SUBSCRIPTION_IDENTITY_MISMATCH'; end if;
  owner_id:=coalesce(owner_id,p_user_id);
  if owner_id is null then raise exception 'SUBSCRIPTION_ACCOUNT_NOT_BOUND'; end if;
  -- Same profile-first order as checkout, renewal credit grants and deletion.
  select * into prof from public.profiles_data where id=owner_id for update;
  if not found then return jsonb_build_object('status','deleted'); end if;
  if prof.deletion_started_at is not null then raise exception 'ACCOUNT_DELETION_IN_PROGRESS'; end if;
  insert into public.subscription_reconciliations(subscription_id,user_id,customer_id)
    values(p_subscription_id,owner_id,p_customer_id) on conflict do nothing;
  select * into strict claim from public.subscription_reconciliations where subscription_id=p_subscription_id for update;
  if claim.user_id<>owner_id or claim.customer_id<>p_customer_id then raise exception 'SUBSCRIPTION_IDENTITY_MISMATCH'; end if;
  if claim.claim_token is not null and claim.claim_until>clock_timestamp() then return jsonb_build_object('status','busy'); end if;
  token:=gen_random_uuid();
  update public.subscription_reconciliations set claim_token=token,claim_until=clock_timestamp()+interval '2 minutes',needs_review=true
    where subscription_id=p_subscription_id;
  return jsonb_build_object('status','claimed','token',token,'userId',owner_id,'customerId',p_customer_id);
end $$;

-- Access revocation never depends on recognizing a paid Price.
create or replace function public.apply_subscription_event_before_ownership_history(p_event_id text,p_user_id uuid,p_subscription_id text,
  p_customer_id text,p_plan_id text,p_status text,p_created bigint,p_attempt_id uuid default null,p_session_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare prof public.profiles_data; attempt public.subscription_checkouts; terminal boolean;
begin
  if p_subscription_id is null or p_customer_id is null or p_created is null or p_created<0
    or p_status is null or p_status not in ('active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused') then
    raise exception 'INVALID_SUBSCRIPTION_EVENT';
  end if;
  select * into prof from public.profiles_data where id=p_user_id for update;
  -- Deleted accounts must not make Stripe retry forever.
  if not found then return false; end if;
  -- Only the fenced finisher can call this state reconciliation. A duplicate
  -- delivery may now observe a different current state; its receipt is an audit
  -- record, not permission to ignore that state. Invoice grants dedupe separately.
  insert into public.processed_webhook_events(event_id) values(p_event_id) on conflict do nothing;
  if p_status in ('canceled','incomplete_expired') then
    insert into public.subscription_cancellations(subscription_id,user_id,customer_id)
      values(p_subscription_id,p_user_id,p_customer_id) on conflict do nothing;
  end if;
  if exists(select from public.subscription_cancellations where subscription_id=p_subscription_id
    and user_id=p_user_id and customer_id=p_customer_id) then p_status:='canceled'; end if;
  select * into attempt from public.subscription_checkouts where user_id=p_user_id;
  if p_session_id is not null then
    if p_attempt_id is not null then
      if attempt.id is distinct from p_attempt_id then
        -- A successful checkout consumes its attempt. Redelivery still reads
        -- fresh provider state for this exact already-bound billing identity.
        -- It cannot bind an old checkout over a newer subscription or consume
        -- a different checkout (the final delete still matches p_attempt_id).
        if prof.stripe_subscription_id is distinct from p_subscription_id or
          prof.stripe_customer_id is distinct from p_customer_id then return false; end if;
      elsif (attempt.session_id is not null and attempt.session_id<>p_session_id) or
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
  if p_status in ('active','trialing','past_due') and (p_plan_id is null or p_plan_id not in ('premium','pro_creator')) then
    raise exception 'INVALID_SUBSCRIPTION_PLAN';
  end if;
  update public.profiles_data set stripe_subscription_id=p_subscription_id,stripe_customer_id=p_customer_id,
    subscription_tier=case when terminal then null when p_status in ('active','trialing','past_due') then p_plan_id else null end,
    subscription_status=p_status,subscription_event_created=case when prof.stripe_subscription_id=p_subscription_id then greatest(p_created,prof.subscription_event_created) else p_created end where id=p_user_id;
  if p_session_id is not null then
    delete from public.subscription_checkouts where user_id=p_user_id and id=p_attempt_id;
  end if;
  return true;
end $$;

create function public.finish_subscription_reconciliation(p_subscription_id text,p_token uuid,p_event_id text,p_plan_id text,p_status text,
  p_created bigint,p_attempt_id uuid default null,p_session_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare claim public.subscription_reconciliations; owner_id uuid; prof public.profiles_data; applied boolean;
begin
  select user_id into owner_id from public.subscription_reconciliations where subscription_id=p_subscription_id;
  select * into prof from public.profiles_data where id=owner_id for update;
  if not found then raise exception 'SUBSCRIPTION_CLAIM_LOST'; end if;
  select * into claim from public.subscription_reconciliations where subscription_id=p_subscription_id for update;
  if claim.claim_token is distinct from p_token or p_token is null or claim.claim_until<=clock_timestamp() then raise exception 'SUBSCRIPTION_CLAIM_LOST'; end if;
  if prof.deletion_started_at is not null then raise exception 'ACCOUNT_DELETION_IN_PROGRESS'; end if;
  -- The lease orders current provider reads. Keep created as a watermark only;
  -- a delayed event can observe a recovery newer than a high-timestamp event.
  applied:=public.apply_subscription_event(p_event_id,claim.user_id,p_subscription_id,claim.customer_id,p_plan_id,p_status,
    greatest(p_created,prof.subscription_event_created),p_attempt_id,p_session_id);
  update public.subscription_reconciliations set claim_token=null,claim_until=null,needs_review=false where subscription_id=p_subscription_id;
  return applied;
end $$;

create function public.release_subscription_reconciliation(p_subscription_id text,p_token uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  -- A failed/ambiguous provider read remains reviewable even after lease expiry.
  update public.subscription_reconciliations set claim_token=null,claim_until=null
    where subscription_id=p_subscription_id and claim_token=p_token;
end $$;

alter function public.begin_account_deletion(uuid) rename to begin_account_deletion_before_subscription_check;
create function public.begin_account_deletion(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if exists(select from public.subscription_reconciliations where user_id=p_user_id and needs_review) then raise exception 'BILLING_IN_PROGRESS'; end if;
  perform public.begin_account_deletion_before_subscription_check(p_user_id);
end $$;

-- Freeze every Stripe create parameter before its first external side effect.
alter table public.subscription_checkouts add column price_id text;
create function public.reserve_subscription_checkout_v2(p_user_id uuid,p_plan_id text,p_email text,p_base_url text,p_price_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior boolean; attempt jsonb;
begin
  if coalesce(p_price_id,'')='' then raise exception 'INVALID_SUBSCRIPTION_PRICE'; end if;
  perform 1 from public.profiles_data where id=p_user_id for update;
  if exists(select from public.subscription_reconciliations where user_id=p_user_id and needs_review) then raise exception 'BILLING_IN_PROGRESS'; end if;
  prior:=exists(select from public.subscription_checkouts where user_id=p_user_id);
  perform public.resolve_subscription_price(p_price_id,p_plan_id);
  attempt:=public.reserve_subscription_checkout(p_user_id,p_plan_id,p_email,p_base_url);
  if not prior then
    update public.subscription_checkouts set price_id=p_price_id where user_id=p_user_id returning to_jsonb(subscription_checkouts.*) into attempt;
  end if;
  -- Existing ambiguous attempts have unknown original Prices. Do not invent
  -- parameters for a replay under their already-used idempotency key.
  return attempt;
end $$;

revoke all on function public.apply_subscription_event(text,uuid,text,text,text,text,bigint,uuid,text),public.reserve_subscription_checkout(uuid,text,text,text),
  public.begin_account_deletion_before_subscription_check(uuid) from public,anon,authenticated,service_role;
revoke all on function public.claim_subscription_reconciliation(text,text,uuid),public.finish_subscription_reconciliation(text,uuid,text,text,text,bigint,uuid,text),
  public.release_subscription_reconciliation(text,uuid),public.reserve_subscription_checkout_v2(uuid,text,text,text,text),public.begin_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.claim_subscription_reconciliation(text,text,uuid),public.finish_subscription_reconciliation(text,uuid,text,text,text,bigint,uuid,text),
  public.release_subscription_reconciliation(text,uuid),public.reserve_subscription_checkout_v2(uuid,text,text,text,text),public.begin_account_deletion(uuid) to service_role;
revoke all on function public.resolve_subscription_price(text,text),public.subscription_owner_matches(text,text,uuid) from public,anon,authenticated;
grant execute on function public.resolve_subscription_price(text,text),public.subscription_owner_matches(text,text,uuid) to service_role;
commit;
