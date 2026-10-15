-- A refund must also reverse pending credit holds, or failure/recovery could
-- resurrect a refunded credit. Preserve the existing policy for spent credits.
begin;

alter table public.generation_reservations add column credit_reversed boolean not null default false;

create or replace function public.apply_credit_payment(p_event_id text, p_payment_intent text, p_user_id uuid, p_credits integer,
  p_session_id text default null, p_refunded_credits integer default 0)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.credit_payments; balance integer; delta integer; owed integer; pending_reversal integer; hold record;
begin
  if p_event_id is null or p_event_id = '' or p_payment_intent is null or p_payment_intent = '' or p_user_id is null or p_credits is null
    or p_credits <= 0 or p_refunded_credits is null or p_refunded_credits < 0
    or p_refunded_credits > p_credits then raise exception 'Invalid credit payment'; end if;
  -- All credit/hold paths lock profile before ledger/reservations.
  select coalesce(credit_balance, 0) into strict balance from public.profiles_data where id = p_user_id for update;
  insert into public.processed_webhook_events(event_id) values (p_event_id) on conflict do nothing;
  if not found then
    select coalesce(credit_balance, 0) into strict balance from public.profiles_data where id = p_user_id;
    return balance;
  end if;
  insert into public.credit_payments(payment_intent, user_id, credits)
    values (p_payment_intent, p_user_id, p_credits) on conflict do nothing;
  select * into r from public.credit_payments where payment_intent = p_payment_intent for update;
  if r.user_id <> p_user_id or r.credits <> p_credits
    or (r.session_id is not null and p_session_id is not null and r.session_id <> p_session_id)
    then raise exception 'Payment metadata mismatch'; end if;
  select coalesce(credit_balance, 0) into strict balance from public.profiles_data where id = p_user_id for update;
  owed := greatest(r.refunded_credits, p_refunded_credits);
  if p_session_id is not null and not r.fulfilled then
    -- Retain an unpaid refund remainder if the refund arrived before checkout.
    balance := balance + r.credits - (owed - r.deducted_credits);
    r.deducted_credits := owed;
    r.fulfilled := true;
    r.session_id := p_session_id;
  elsif r.fulfilled then
    delta := least(balance, owed - r.refunded_credits);
    balance := balance - delta;
    r.deducted_credits := r.deducted_credits + delta;
    pending_reversal := owed - r.refunded_credits - delta;
    for hold in select id from public.generation_reservations
      where user_id=p_user_id and status='reserved' and parent_generation_id is null and not credit_reversed
      order by created_at,id for update loop
      exit when pending_reversal<=0;
      update public.generation_reservations set credit_reversed=true where id=hold.id;
      pending_reversal:=pending_reversal-1;
      r.deducted_credits:=r.deducted_credits+1;
    end loop;
  end if;
  update public.profiles_data set credit_balance = balance where id = p_user_id;
  update public.credit_payments set session_id = r.session_id, fulfilled = r.fulfilled,
    refunded_credits = owed, deducted_credits = r.deducted_credits, updated_at = now()
    where payment_intent = p_payment_intent;
  return balance;
end $$;

create or replace function public.release_generation(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.generation_reservations; account_id uuid;
begin
  select user_id into account_id from public.generation_reservations where id=p_id;
  perform 1 from public.profiles_data where id=account_id for update;
  select * into r from public.generation_reservations where id=p_id for update;
  if not found or r.status<>'reserved' then return false; end if;
  if r.parent_generation_id is null then
    if not r.credit_reversed then
      update public.profiles_data set credit_balance=coalesce(credit_balance,0)+1 where id=r.user_id;
    end if;
  else
    update public.nail_lab_generations set free_regen_used=false where id=r.parent_generation_id and user_id=r.user_id;
  end if;
  update public.generation_reservations set status='released' where id=p_id;
  return true;
end $$;

commit;
