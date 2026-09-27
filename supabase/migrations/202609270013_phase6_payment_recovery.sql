begin;

-- Persist incoming refund uncertainty before making the first provider call.
-- Each event also advances a version so an older in-flight provider snapshot
-- cannot clear a newer event that has not yet been successfully reconciled.
alter table public.payment_refund_states add column event_version bigint not null default 0,
  add column claim_version bigint;
alter table public.order_payments add column refund_event_version bigint not null default 0,
  add column refund_claim_version bigint;

create function public.mark_payment_refund_pending(p_intent text) returns boolean
language plpgsql security definer set search_path='' as $$
declare account_id uuid; payment_kind text; target uuid; units integer; late boolean;
begin
  if p_intent is null or p_intent='' then return false; end if;
  select user_id,kind,target_id,s.units into account_id,payment_kind,target,units
    from public.payment_refund_states s where payment_intent=p_intent;
  if not found then
    select user_id,kind,target_id,p.units into account_id,payment_kind,target,units
      from public.order_payments p where payment_intent=p_intent;
  end if;
  if not found then
    select user_id,'credits',null::uuid,credits into account_id,payment_kind,target,units
      from public.credit_payments where payment_intent=p_intent;
  end if;
  if account_id is null then return false; end if;
  perform 1 from public.profiles_data where id=account_id for update;
  if not found then return false; end if;
  select refund_required into late from public.order_payments where payment_intent=p_intent;
  if not coalesce(late,false) then
    insert into public.payment_refund_states(payment_intent,user_id,kind,target_id,units)
      values(p_intent,account_id,payment_kind,target,units) on conflict do nothing;
  end if;
  -- Match the profile -> generic ledger -> order lock order used by finish.
  update public.payment_refund_states set event_version=event_version+1,needs_review=true,status='payment_review',updated_at=now()
    where payment_intent=p_intent;
  if coalesce(late,false) then
    update public.order_payments set refund_event_version=refund_event_version+1,
      refund_reconciliation_pending=true,needs_review=true where payment_intent=p_intent;
  end if;
  return true;
end $$;

alter function public.claim_payment_refund_check(text,uuid,text,uuid,integer) rename to claim_payment_refund_before_event_guard;
create function public.claim_payment_refund_check(p_intent text,p_user_id uuid,p_kind text,p_target_id uuid,p_units integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid;
begin
  token:=public.claim_payment_refund_before_event_guard(p_intent,p_user_id,p_kind,p_target_id,p_units);
  if token is not null then
    update public.payment_refund_states set claim_version=event_version where payment_intent=p_intent and check_token=token;
  end if;
  return token;
end $$;

alter function public.finish_payment_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text) rename to finish_payment_refund_before_event_guard;
create function public.finish_payment_refund_check(p_intent text,p_token uuid,p_amount integer,p_succeeded integer,p_pending integer,
  p_failed boolean,p_requires_action boolean,p_event_id text) returns boolean
language plpgsql security definer set search_path='' as $$
declare account_id uuid; state public.payment_refund_states;
begin
  select user_id into account_id from public.payment_refund_states where payment_intent=p_intent;
  perform 1 from public.profiles_data where id=account_id for update;
  select * into state from public.payment_refund_states where payment_intent=p_intent for update;
  if not found or state.claim_version is distinct from state.event_version then return false; end if;
  return public.finish_payment_refund_before_event_guard(p_intent,p_token,p_amount,p_succeeded,p_pending,p_failed,p_requires_action,p_event_id);
end $$;

alter function public.claim_deposit_refund_check(text) rename to claim_deposit_refund_before_event_guard;
create function public.claim_deposit_refund_check(p_intent text) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid;
begin
  token:=public.claim_deposit_refund_before_event_guard(p_intent);
  if token is not null then
    update public.order_payments set refund_claim_version=refund_event_version where payment_intent=p_intent and refund_check_token=token;
  end if;
  return token;
end $$;

alter function public.finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint) rename to finish_deposit_refund_before_event_guard;
create function public.finish_deposit_refund_check(p_intent text,p_token uuid,p_amount integer,
  p_succeeded integer,p_pending integer,p_failed boolean,p_requires_action boolean,p_refund_id text,p_created bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare account_id uuid; receipt public.order_payments;
begin
  select user_id into account_id from public.order_payments where payment_intent=p_intent;
  perform 1 from public.profiles_data where id=account_id for update;
  perform 1 from public.payment_refund_states where payment_intent=p_intent for update;
  select * into receipt from public.order_payments where payment_intent=p_intent for update;
  if not found or receipt.refund_claim_version is distinct from receipt.refund_event_version then return false; end if;
  return public.finish_deposit_refund_before_event_guard(p_intent,p_token,p_amount,p_succeeded,p_pending,p_failed,p_requires_action,p_refund_id,p_created);
end $$;

revoke all on function public.claim_payment_refund_before_event_guard(text,uuid,text,uuid,integer),
  public.finish_payment_refund_before_event_guard(text,uuid,integer,integer,integer,boolean,boolean,text),
  public.claim_deposit_refund_before_event_guard(text),
  public.finish_deposit_refund_before_event_guard(text,uuid,integer,integer,integer,boolean,boolean,text,bigint) from public,anon,authenticated,service_role;
revoke all on function public.mark_payment_refund_pending(text),public.claim_payment_refund_check(text,uuid,text,uuid,integer),
  public.finish_payment_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text),public.claim_deposit_refund_check(text),
  public.finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint) from public,anon,authenticated;
grant execute on function public.mark_payment_refund_pending(text),public.claim_payment_refund_check(text,uuid,text,uuid,integer),
  public.finish_payment_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text),public.claim_deposit_refund_check(text),
  public.finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint) to service_role;
commit;
