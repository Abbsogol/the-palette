-- Refunds cannot debit a credit grant which has not been fulfilled.
begin;

create or replace function public.apply_credit_payment(p_event_id text, p_payment_intent text, p_user_id uuid, p_credits integer,
  p_session_id text default null, p_refunded_credits integer default 0)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.credit_payments; balance integer; delta integer; owed integer;
begin
  if p_event_id is null or p_event_id = '' or p_payment_intent is null or p_payment_intent = '' or p_user_id is null or p_credits is null
    or p_credits <= 0 or p_refunded_credits is null or p_refunded_credits < 0
    or p_refunded_credits > p_credits then raise exception 'Invalid credit payment'; end if;
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
  end if;
  update public.profiles_data set credit_balance = balance where id = p_user_id;
  update public.credit_payments set session_id = r.session_id, fulfilled = r.fulfilled,
    refunded_credits = owed, deducted_credits = r.deducted_credits, updated_at = now()
    where payment_intent = p_payment_intent;
  return balance;
end $$;

commit;
