-- Apply before deploying the matching routes. This is an additive migration;
-- existing balances and historical rewards are not rewritten.
begin;

create table public.generation_reservations (
  id uuid primary key,
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  parent_generation_id uuid,
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'released')),
  created_at timestamptz not null default now()
);
alter table public.generation_reservations enable row level security;
revoke all on public.generation_reservations from public, anon, authenticated;
grant all on public.generation_reservations to service_role;

create function public.reserve_generation(p_id uuid, p_user_id uuid, p_parent_id uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- A unique request token prevents a retry from reserving twice.
  insert into public.generation_reservations(id, user_id, parent_generation_id)
    values (p_id, p_user_id, p_parent_id);
  if p_parent_id is null then
    update public.profiles_data set credit_balance = credit_balance - 1
      where id = p_user_id and credit_balance >= 1;
  else
    update public.nail_lab_generations set free_regen_used = true
      where id = p_parent_id and user_id = p_user_id
        and free_regen_used = false and parent_generation_id is null;
  end if;
  if not found then
    delete from public.generation_reservations where id = p_id;
    return false;
  end if;
  return true;
end $$;

create function public.release_generation(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.generation_reservations;
begin
  select * into r from public.generation_reservations where id = p_id for update;
  if not found or r.status <> 'reserved' then return false; end if;
  if r.parent_generation_id is null then
    update public.profiles_data set credit_balance = coalesce(credit_balance, 0) + 1 where id = r.user_id;
  else
    update public.nail_lab_generations set free_regen_used = false
      where id = r.parent_generation_id and user_id = r.user_id;
  end if;
  update public.generation_reservations set status = 'released' where id = p_id;
  return true;
end $$;

create function public.complete_generation(p_id uuid, p_generation jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.generation_reservations; g public.nail_lab_generations;
begin
  select * into r from public.generation_reservations where id = p_id for update;
  if not found or r.status = 'released' then raise exception 'Reservation unavailable'; end if;
  if r.status = 'completed' then return r.id; end if;
  g := jsonb_populate_record(null::public.nail_lab_generations, p_generation);
  insert into public.nail_lab_generations
    (id, user_id, image_url, vibe, shape, length, colors, occasion, custom_text,
     prompt_used, reference_image_urls, credits_used, parent_generation_id)
  values (r.id, r.user_id, g.image_url, g.vibe, g.shape, g.length, g.colors, g.occasion,
    g.custom_text, g.prompt_used, '{}', case when r.parent_generation_id is null then 1 else 0 end,
    r.parent_generation_id);
  update public.generation_reservations set status = 'completed' where id = p_id;
  return r.id;
end $$;

create table public.credit_payments (
  payment_intent text primary key,
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  credits integer not null check (credits > 0),
  session_id text unique,
  fulfilled boolean not null default false,
  refunded_credits integer not null default 0 check (refunded_credits >= 0),
  deducted_credits integer not null default 0 check (deducted_credits >= 0),
  updated_at timestamptz not null default now(),
  check (deducted_credits <= refunded_credits and refunded_credits <= credits)
);
alter table public.credit_payments enable row level security;
revoke all on public.credit_payments from public, anon, authenticated;
grant all on public.credit_payments to service_role;

-- The ledger row serializes refunds and fulfillment for one PaymentIntent.
-- Refunds are cumulative; duplicate or older deliveries cannot debit twice.
create function public.apply_credit_payment(p_event_id text, p_payment_intent text, p_user_id uuid, p_credits integer,
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
  else
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

create function public.apply_referral(p_user_id uuid, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare inviter uuid; existing text;
begin
  select id into inviter from public.profiles_data where referral_code = p_code;
  if not found then return 'invalid'; end if;
  if inviter = p_user_id then return 'self'; end if;
  select referred_by into strict existing from public.profiles_data where id = p_user_id for update;
  if existing is not null and existing <> p_code then return 'already_referred'; end if;
  update public.profiles_data set referred_by = p_code where id = p_user_id;
  -- Also repairs a historical claim with a missing reward. The user lock
  -- serializes retries, and both awards commit or roll back with the claim.
  insert into public.rewards(user_id, points, reason, ref_id)
    select inviter, 50, 'invite_friend', p_user_id::text
    where not exists (select 1 from public.rewards where user_id = inviter and reason = 'invite_friend' and ref_id = p_user_id::text);
  insert into public.rewards(user_id, points, reason, ref_id)
    select p_user_id, 25, 'joined_via_invite', p_user_id::text
    where not exists (select 1 from public.rewards where user_id = p_user_id and reason = 'joined_via_invite' and ref_id = p_user_id::text);
  return 'applied';
end $$;

-- Retain the old signature for compatibility, but restrict callers and values.
create or replace function public.decrement_credits_by(user_id uuid, amount integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if amount is null or amount <= 0 then raise exception 'Amount must be positive'; end if;
  update public.profiles_data set credit_balance = greatest(coalesce(credit_balance, 0) - amount, 0) where id = user_id;
end $$;

revoke all on function public.reserve_generation(uuid, uuid, uuid), public.release_generation(uuid),
  public.complete_generation(uuid, jsonb), public.apply_credit_payment(text, text, uuid, integer, text, integer),
  public.apply_referral(uuid, text), public.decrement_credits_by(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_generation(uuid, uuid, uuid), public.release_generation(uuid),
  public.complete_generation(uuid, jsonb), public.apply_credit_payment(text, text, uuid, integer, text, integer),
  public.apply_referral(uuid, text), public.decrement_credits_by(uuid, integer) to service_role;

commit;
