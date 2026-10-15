begin;

-- Refund requests are not completed money movements. Keep their provider state
-- separate from the monotonic record of entitlements already reversed.
create table public.payment_refund_states (
  payment_intent text primary key,
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  kind text not null check(kind in ('credits','boost','deposit')),
  target_id uuid, units integer not null,
  amount integer, succeeded_amount integer not null default 0, pending_amount integer not null default 0,
  applied_succeeded_amount integer not null default 0,
  status text not null default 'refund_pending' check(status in ('none','refund_pending','refunded','partially_refunded','payment_review')),
  needs_review boolean not null default true,
  check_token uuid, check_until timestamptz, updated_at timestamptz not null default now()
);
alter table public.payment_refund_states enable row level security;
revoke all on public.payment_refund_states from public,anon,authenticated;
grant all on public.payment_refund_states to service_role;

create function public.claim_payment_refund_check(p_intent text,p_user_id uuid,p_kind text,p_target_id uuid,p_units integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare state public.payment_refund_states; token uuid;
begin
  if p_intent is null or p_intent='' or p_kind is null or p_kind not in ('credits','boost','deposit')
    or p_units is null or (p_kind='credits' and p_units<=0) or (p_kind='boost' and p_units not in (1,3,7))
    or (p_kind='deposit' and p_units<>0) or (p_kind<>'credits' and p_target_id is null) then raise exception 'INVALID_REFUND_IDENTITY'; end if;
  perform 1 from public.profiles_data where id=p_user_id for update;
  if not found then raise exception 'REFUND_ACCOUNT_UNAVAILABLE'; end if;
  if exists(select from public.credit_payments where payment_intent=p_intent and
      (p_kind<>'credits' or user_id<>p_user_id or credits<>p_units))
    or exists(select from public.order_payments where payment_intent=p_intent and
      row(user_id,kind,target_id,units) is distinct from row(p_user_id,p_kind,p_target_id,p_units)) then raise exception 'REFUND_IDENTITY_MISMATCH'; end if;
  if (p_kind='boost' and not exists(select from public.designs where id=p_target_id and created_by=p_user_id))
    or (p_kind='deposit' and not exists(select from public.bookings where id=p_target_id and client_id=p_user_id)) then raise exception 'REFUND_TARGET_UNAVAILABLE'; end if;
  insert into public.payment_refund_states(payment_intent,user_id,kind,target_id,units)
    values(p_intent,p_user_id,p_kind,p_target_id,p_units) on conflict do nothing;
  select * into strict state from public.payment_refund_states where payment_intent=p_intent for update;
  if row(state.user_id,state.kind,state.target_id,state.units) is distinct from row(p_user_id,p_kind,p_target_id,p_units) then
    raise exception 'REFUND_IDENTITY_MISMATCH'; end if;
  if state.check_until is not null and state.check_until>=now() then return null; end if;
  token:=gen_random_uuid();
  update public.payment_refund_states set check_token=token,check_until=now()+interval '2 minutes',needs_review=true,status='payment_review' where payment_intent=p_intent;
  return token;
end $$;

create function public.finish_payment_refund_check(p_intent text,p_token uuid,p_amount integer,p_succeeded integer,p_pending integer,
  p_failed boolean,p_requires_action boolean,p_event_id text) returns boolean
language plpgsql security definer set search_path='' as $$
declare state public.payment_refund_states; next_status text; effect_key text;
begin
  if p_amount is null or p_amount<=0 or p_succeeded is null or p_pending is null or p_succeeded<0 or p_pending<0
    or p_succeeded+p_pending>p_amount or p_failed is null or p_requires_action is null or p_event_id is null then raise exception 'INVALID_REFUND_TOTALS'; end if;
  select * into state from public.payment_refund_states where payment_intent=p_intent;
  if not found then return false; end if;
  perform 1 from public.profiles_data where id=state.user_id for update;
  select * into strict state from public.payment_refund_states where payment_intent=p_intent for update;
  if p_token is null or state.check_token is distinct from p_token or state.check_until is null or state.check_until<=now() then return false; end if;
  if exists(select from public.order_payments where payment_intent=p_intent and refund_required) then raise exception 'REFUND_OBLIGATION_CHANGED'; end if;
  if state.amount is not null and state.amount<>p_amount then raise exception 'REFUND_AMOUNT_MISMATCH'; end if;
  next_status:=case when p_succeeded<state.applied_succeeded_amount then 'payment_review'
    when p_succeeded=p_amount then 'refunded'
    when p_failed or p_requires_action then 'payment_review'
    when p_pending>0 then 'refund_pending'
    when p_succeeded>0 then 'partially_refunded' else 'none' end;
  -- The same Stripe event can be retried after another refund has progressed.
  -- Key effects by cumulative successful amount, not by a stale event snapshot.
  effect_key:='refund-total:'||p_intent||':'||p_succeeded;
  if state.kind='credits' and p_succeeded>state.applied_succeeded_amount then
    perform public.apply_credit_payment(effect_key,p_intent,state.user_id,state.units,null,
      round(state.units::numeric*p_succeeded/p_amount)::integer);
  elsif state.kind in ('deposit','boost') and p_succeeded=p_amount then
    perform public.apply_order_payment(effect_key,p_intent,state.user_id,state.kind,state.target_id,state.units,null,true);
  end if;
  update public.payment_refund_states set amount=p_amount,succeeded_amount=p_succeeded,pending_amount=p_pending,
    applied_succeeded_amount=greatest(applied_succeeded_amount,p_succeeded),status=next_status,
    needs_review=(next_status in ('payment_review','refund_pending')),check_token=null,check_until=null,updated_at=now()
    where payment_intent=p_intent;
  -- This table owns refund review state. Do not overwrite an independent order
  -- review reason or leave a duplicated review flag after a manual resolution.
  insert into public.processed_webhook_events(event_id) values(p_event_id) on conflict do nothing;
  return true;
end $$;

create function public.release_payment_refund_check(p_intent text,p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.payment_refund_states set check_token=null,check_until=null where payment_intent=p_intent and check_token=p_token;
end $$;

-- A pending manual refund can predate the delayed checkout that establishes a
-- late-deposit obligation. Keep that earlier review row in sync with the late
-- refund's aggregate, so it cannot block deletion forever after full success.
alter function public.finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint)
  rename to finish_deposit_refund_before_generic_sync;
create function public.finish_deposit_refund_check(p_intent text,p_token uuid,p_amount integer,
  p_succeeded integer,p_pending integer,p_failed boolean,p_requires_action boolean,p_refund_id text,p_created bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare account_id uuid; saved boolean; receipt public.order_payments;
begin
  select user_id into account_id from public.order_payments where payment_intent=p_intent;
  perform 1 from public.profiles_data where id=account_id for update;
  perform 1 from public.payment_refund_states where payment_intent=p_intent for update;
  saved:=public.finish_deposit_refund_before_generic_sync(p_intent,p_token,p_amount,p_succeeded,p_pending,p_failed,p_requires_action,p_refund_id,p_created);
  if not saved then return false; end if;
  select * into strict receipt from public.order_payments where payment_intent=p_intent;
  update public.payment_refund_states set amount=p_amount,succeeded_amount=p_succeeded,pending_amount=p_pending,
    applied_succeeded_amount=greatest(applied_succeeded_amount,p_succeeded),
    status=case when receipt.refunded then 'refunded' when receipt.refund_status='pending' then 'refund_pending' else 'payment_review' end,
    needs_review=receipt.needs_review,check_token=null,check_until=null,updated_at=now() where payment_intent=p_intent;
  return true;
end $$;
revoke all on function public.finish_deposit_refund_before_generic_sync(text,uuid,integer,integer,integer,boolean,boolean,text,bigint) from public,anon,authenticated,service_role;
revoke all on function public.finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint) from public,anon,authenticated;
grant execute on function public.finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint) to service_role;

alter function public.begin_account_deletion(uuid) rename to begin_account_deletion_before_payment_refund_check;
create function public.begin_account_deletion(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if exists(select from public.payment_refund_states where user_id=p_user_id and (needs_review or check_until>now())) then
    raise exception 'BILLING_IN_PROGRESS'; end if;
  perform public.begin_account_deletion_before_payment_refund_check(p_user_id);
end $$;
revoke all on function public.begin_account_deletion_before_payment_refund_check(uuid) from public,anon,authenticated,service_role;
revoke all on function public.begin_account_deletion(uuid),public.claim_payment_refund_check(text,uuid,text,uuid,integer),public.finish_payment_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text),public.release_payment_refund_check(text,uuid) from public,anon,authenticated;
grant execute on function public.begin_account_deletion(uuid),public.claim_payment_refund_check(text,uuid,text,uuid,integer),public.finish_payment_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text),public.release_payment_refund_check(text,uuid) to service_role;
commit;
