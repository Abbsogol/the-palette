-- Terminal checkout recovery and exhausted subscription collection.
begin;

create or replace function public.apply_subscription_event(p_event_id text,p_user_id uuid,p_subscription_id text,p_customer_id text,p_plan_id text,p_status text,
  p_created bigint,p_attempt_id uuid default null,p_session_id text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare applied boolean;
begin
  applied:=public.apply_subscription_event_before_ownership_history(p_event_id,p_user_id,p_subscription_id,p_customer_id,p_plan_id,p_status,p_created,p_attempt_id,p_session_id);
  if applied then
    insert into public.subscription_accounts(subscription_id,user_id,customer_id) values(p_subscription_id,p_user_id,p_customer_id) on conflict do nothing;
    if not exists(select from public.subscription_accounts where subscription_id=p_subscription_id and user_id=p_user_id and customer_id=p_customer_id) then raise exception 'SUBSCRIPTION_IDENTITY_MISMATCH'; end if;
  end if;
  if applied and p_status='unpaid' then
    update public.profiles_data set subscription_tier=null where id=p_user_id and stripe_subscription_id=p_subscription_id;
  end if;
  return applied;
end $$;

-- Preserve the customer/subscription identity: unpaid plans can still invoice,
-- so lack of paid access must never mean deletion or another subscription is safe.
update public.profiles_data set subscription_tier=null where subscription_status='unpaid';

create or replace function public.begin_account_deletion_before_generation_recovery(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists(select from public.generation_reservations where user_id=p_user_id and status='reserved') then
    raise exception 'GENERATION_IN_PROGRESS';
  end if;
  if exists(select from public.profiles_data where id=p_user_id and subscription_tier is not null and subscription_tier<>'free')
    or exists(select from public.profiles_data where id=p_user_id and stripe_subscription_id is not null
      and coalesce(subscription_status,'unknown') not in ('canceled','incomplete_expired'))
    or exists(select from public.subscription_checkouts where user_id=p_user_id)
    or exists(select from public.deposit_checkouts where user_id=p_user_id)
    or exists(select from public.payment_checkouts where user_id=p_user_id)
    or exists(select from public.order_payments where user_id=p_user_id and needs_review) then raise exception 'BILLING_IN_PROGRESS'; end if;
  update public.profiles_data set deletion_started_at=coalesce(deletion_started_at,now()) where id=p_user_id;
end $$;

create or replace function public.reserve_subscription_checkout(p_user_id uuid,p_plan_id text,p_email text,p_base_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prof public.profiles_data;
begin
  select * into prof from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  if prof.stripe_subscription_id is not null and coalesce(prof.subscription_status,'unknown') not in ('canceled','incomplete_expired') then
    raise exception 'ALREADY_SUBSCRIBED';
  end if;
  return public.reserve_subscription_checkout_before_deletion_guard(p_user_id,p_plan_id,p_email,p_base_url);
end $$;

-- Called only after verifying current Stripe session + subscription identity.
-- Exact attempt/session matching protects a newer checkout from delayed events.
create or replace function public.expire_subscription_checkout(p_user_id uuid,p_id uuid,p_session_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_session_id is null or p_session_id='' then raise exception 'INVALID_CHECKOUT_SESSION'; end if;
  perform 1 from public.profiles_data where id=p_user_id for update;
  delete from public.subscription_checkouts where user_id=p_user_id and id=p_id
    and (session_id=p_session_id or session_id is null);
  return found;
end $$;

create function public.close_terminal_subscription_checkout(p_user_id uuid,p_attempt_id uuid,p_session_id text,
  p_subscription_id text,p_customer_id text,p_status text) returns boolean
language plpgsql security definer set search_path='' as $$
declare attempt public.subscription_checkouts;
begin
  if p_status is null or p_status not in ('canceled','incomplete_expired') or p_subscription_id is null or p_subscription_id=''
    or p_customer_id is null or p_customer_id='' or p_session_id is null or p_session_id='' then
    raise exception 'INVALID_TERMINAL_SUBSCRIPTION';
  end if;
  perform 1 from public.profiles_data where id=p_user_id for update;
  if not found then return false; end if;
  select * into attempt from public.subscription_checkouts where user_id=p_user_id and id=p_attempt_id for update;
  if not found then return false; end if;
  if (attempt.session_id is not null and attempt.session_id<>p_session_id)
    or (attempt.customer_id is not null and attempt.customer_id<>p_customer_id) then return false; end if;
  insert into public.subscription_cancellations(subscription_id,user_id,customer_id)
    values(p_subscription_id,p_user_id,p_customer_id) on conflict do nothing;
  insert into public.subscription_accounts(subscription_id,user_id,customer_id)
    values(p_subscription_id,p_user_id,p_customer_id) on conflict do nothing;
  if not exists(select from public.subscription_cancellations where subscription_id=p_subscription_id and user_id=p_user_id and customer_id=p_customer_id)
    or not exists(select from public.subscription_accounts where subscription_id=p_subscription_id and user_id=p_user_id and customer_id=p_customer_id) then
    raise exception 'SUBSCRIPTION_IDENTITY_MISMATCH';
  end if;
  update public.profiles_data set subscription_tier=null,subscription_status=p_status
    where id=p_user_id and stripe_subscription_id=p_subscription_id and stripe_customer_id=p_customer_id;
  delete from public.subscription_checkouts where user_id=p_user_id and id=p_attempt_id;
  return true;
end $$;
revoke all on function public.close_terminal_subscription_checkout(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.close_terminal_subscription_checkout(uuid,uuid,text,text,text,text) to service_role;
commit;
