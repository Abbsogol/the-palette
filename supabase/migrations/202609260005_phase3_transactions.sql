begin;

-- New values are protected by the already service-only profile write boundary.
alter table public.profiles_data add column deletion_started_at timestamptz;
alter table public.profiles_data add constraint credit_balance_nonnegative check(credit_balance>=0) not valid;

-- A profile lock gives an account one published code, even on concurrent first requests.
create function public.ensure_referral_code(p_user_id uuid,p_candidate text) returns text
language plpgsql security definer set search_path='' as $$
declare existing text;
begin
  if p_candidate !~ '^[A-Z2-9]{8}$' then raise exception 'INVALID_REFERRAL_CODE'; end if;
  select referral_code into strict existing from public.profiles_data where id=p_user_id for update;
  if existing is not null then return existing; end if;
  update public.profiles_data set referral_code=p_candidate where id=p_user_id;
  return p_candidate;
end $$;

-- Serialize with checkout/generation reservation before any destructive cleanup.
create function public.begin_account_deletion(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists(select from public.generation_reservations where user_id=p_user_id and status='reserved') then
    raise exception 'GENERATION_IN_PROGRESS';
  end if;
  if exists(select from public.profiles_data where id=p_user_id and subscription_tier is not null and subscription_tier<>'free')
    or exists(select from public.subscription_checkouts where user_id=p_user_id)
    or exists(select from public.deposit_checkouts where user_id=p_user_id)
    or exists(select from public.payment_checkouts where user_id=p_user_id)
    or exists(select from public.order_payments where user_id=p_user_id and needs_review) then raise exception 'BILLING_IN_PROGRESS'; end if;
  update public.profiles_data set deletion_started_at=coalesce(deletion_started_at,now()) where id=p_user_id;
end $$;

alter function public.reserve_generation(uuid,uuid,uuid) rename to reserve_generation_before_deletion_guard;
create function public.reserve_generation(p_id uuid,p_user_id uuid,p_parent_id uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare deleting timestamptz;
begin
  select deletion_started_at into deleting from public.profiles_data where id=p_user_id for update;
  if not found or deleting is not null then return false; end if;
  return public.reserve_generation_before_deletion_guard(p_id,p_user_id,p_parent_id);
end $$;
alter function public.reserve_subscription_checkout(uuid,text,text,text) rename to reserve_subscription_checkout_before_deletion_guard;
create function public.reserve_subscription_checkout(p_user_id uuid,p_plan_id text,p_email text,p_base_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  return public.reserve_subscription_checkout_before_deletion_guard(p_user_id,p_plan_id,p_email,p_base_url);
end $$;
alter function public.delete_account(uuid) rename to delete_account_before_inflight_guard;
create function public.delete_account(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.begin_account_deletion(p_user_id);
  perform public.delete_account_before_inflight_guard(p_user_id);
end $$;
-- PL/pgSQL resolves the replacement public wrapper at execution time.
create or replace function public.delete_own_account() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  perform public.delete_account(auth.uid());
end $$;

-- Trusted service writes still need to honor the deletion gate for new work.
create function public.guard_deleted_account_work() returns trigger language plpgsql security definer set search_path='' as $$
declare account_id uuid;
begin
  account_id:=case when tg_table_name='designs' then (to_jsonb(new)->>'created_by')::uuid else (to_jsonb(new)->>'user_id')::uuid end;
  if exists(select from public.profiles_data where id=account_id and deletion_started_at is not null) then raise exception 'ACCOUNT_DELETION_IN_PROGRESS'; end if;
  return new;
end $$;
create trigger guard_deleted_account_work before insert on public.designs for each row execute function public.guard_deleted_account_work();

-- Concurrency is enforced in the DB, not by the browser's availability query.
create function public.prevent_booking_overlap() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status not in ('pending','confirmed') then return new; end if;
  if tg_op='UPDATE' and row(new.creator_id,new.booking_date,new.start_time,new.end_time,new.status)
    is not distinct from row(old.creator_id,old.booking_date,old.start_time,old.end_time,old.status) then return new; end if;
  perform 1 from public.profiles_data where id=new.creator_id for update;
  if exists(select from public.bookings b where b.creator_id=new.creator_id and b.id<>new.id
    and b.booking_date=new.booking_date and b.status in ('pending','confirmed')
    and b.start_time<new.end_time and new.start_time<b.end_time) then raise exception 'BOOKING_SLOT_UNAVAILABLE'; end if;
  return new;
end $$;
create trigger prevent_booking_overlap before insert or update on public.bookings for each row execute function public.prevent_booking_overlap();

-- Reveal occupied time ranges, never client identities or booking notes.
create function public.booking_busy_slots(p_creator_id uuid,p_date date)
returns table(start_time time,end_time time) language sql stable security definer set search_path='' as $$
  select b.start_time,b.end_time from public.bookings b where b.creator_id=p_creator_id and b.booking_date=p_date
    and b.status in ('pending','confirmed') and p_date between current_date and current_date+365;
$$;
revoke all on function public.booking_busy_slots(uuid,date) from public,anon;
grant execute on function public.booking_busy_slots(uuid,date) to authenticated,service_role;

-- Retain verified ownership after a subscriber switches to a newer subscription.
create table public.subscription_accounts (
  subscription_id text primary key,user_id uuid not null references public.profiles_data(id) on delete cascade,customer_id text not null
);
alter table public.subscription_accounts enable row level security;
revoke all on public.subscription_accounts from public,anon,authenticated;
grant all on public.subscription_accounts to service_role;
insert into public.subscription_accounts(subscription_id,user_id,customer_id)
  select stripe_subscription_id,id,stripe_customer_id from public.profiles_data
  where stripe_subscription_id is not null and stripe_customer_id is not null;
alter function public.apply_subscription_event(text,uuid,text,text,text,text,bigint,uuid,text) rename to apply_subscription_event_before_ownership_history;
create function public.apply_subscription_event(p_event_id text,p_user_id uuid,p_subscription_id text,p_customer_id text,p_plan_id text,p_status text,
  p_created bigint,p_attempt_id uuid default null,p_session_id text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare applied boolean;
begin
  applied:=public.apply_subscription_event_before_ownership_history(p_event_id,p_user_id,p_subscription_id,p_customer_id,p_plan_id,p_status,p_created,p_attempt_id,p_session_id);
  if applied then
    insert into public.subscription_accounts(subscription_id,user_id,customer_id) values(p_subscription_id,p_user_id,p_customer_id) on conflict do nothing;
    if not exists(select from public.subscription_accounts where subscription_id=p_subscription_id and user_id=p_user_id and customer_id=p_customer_id) then raise exception 'SUBSCRIPTION_IDENTITY_MISMATCH'; end if;
  end if;
  return applied;
end $$;
revoke all on function public.apply_subscription_event_before_ownership_history(text,uuid,text,text,text,text,bigint,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.apply_subscription_event(text,uuid,text,text,text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.apply_subscription_event(text,uuid,text,text,text,text,bigint,uuid,text) to service_role;

create table public.subscription_credit_grants (
  invoice_id text primary key,
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  subscription_id text not null, period_start bigint not null,period_end bigint not null,
  credits integer not null check(credits>0), created_at timestamptz not null default now(),
  unique(subscription_id,period_start),check(period_end>period_start)
);
alter table public.subscription_credit_grants enable row level security;
revoke all on public.subscription_credit_grants from public,anon,authenticated;
grant all on public.subscription_credit_grants to service_role;
create function public.grant_subscription_credits(p_event_id text,p_invoice_id text,p_user_id uuid,p_subscription_id text,p_customer_id text,
  p_period_start bigint,p_period_end bigint,p_plan_id text) returns boolean
language plpgsql security definer set search_path='' as $$
declare prof public.profiles_data; amount integer;
begin
  amount:=case p_plan_id when 'premium' then 5 when 'pro_creator' then 20 else null end;
  if amount is null or p_period_start is null or p_period_end<=p_period_start then raise exception 'INVALID_INVOICE_PERIOD'; end if;
  select * into prof from public.profiles_data where id=p_user_id for update;
  if not found then return false; end if;
  -- Invoice may arrive before checkout. Ask Stripe to retry rather than lose
  -- the earned grant by marking it processed before the binding exists.
  if not exists(select from public.subscription_accounts where subscription_id=p_subscription_id and user_id=p_user_id and customer_id=p_customer_id)
    and (prof.stripe_customer_id is distinct from p_customer_id or prof.stripe_subscription_id is distinct from p_subscription_id) then
    raise exception 'SUBSCRIPTION_NOT_BOUND';
  end if;
  insert into public.processed_webhook_events(event_id) values(p_event_id) on conflict do nothing;
  if not found then return false; end if;
  insert into public.subscription_credit_grants(invoice_id,user_id,subscription_id,period_start,period_end,credits)
    values(p_invoice_id,p_user_id,p_subscription_id,p_period_start,p_period_end,amount) on conflict do nothing;
  if not found then return false; end if;
  update public.profiles_data set credit_balance=coalesce(credit_balance,0)+amount where id=p_user_id;
  return true;
end $$;

-- Deposit and promotion receipts are committed with their effects. A receipt
-- per event alone cannot deduplicate two different events for the same payment.
create table public.order_payments (
  payment_intent text primary key,user_id uuid not null references public.profiles_data(id) on delete cascade,
  kind text not null check(kind in ('boost','deposit')),target_id uuid not null,units integer not null default 0,
  fulfilled boolean not null default false,refunded boolean not null default false,needs_review boolean not null default false,
  refund_required boolean not null default false,refund_id text unique,refund_status text,refund_event_created bigint not null default 0,
  session_id text unique,boost_start timestamptz,boost_end timestamptz,created_at timestamptz not null default now()
);
alter table public.order_payments enable row level security;
revoke all on public.order_payments from public,anon,authenticated;
grant all on public.order_payments to service_role;
create function public.apply_order_payment(p_event_id text,p_intent text,p_user_id uuid,p_kind text,p_target_id uuid,
  p_units integer default 0,p_session_id text default null,p_refunded boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare receipt public.order_payments; until_at timestamptz; removed interval; booking public.bookings;
begin
  if p_intent is null or p_intent='' or p_kind is null or p_kind not in ('boost','deposit') or (p_kind='boost' and p_units not in (1,3,7)) then raise exception 'INVALID_PAYMENT'; end if;
  -- Lock the target before its ledger: distinct payments serialize as well.
  if p_kind='boost' then
    select boosted_until into until_at from public.designs where id=p_target_id and created_by=p_user_id for update;
  else
    select * into booking from public.bookings where id=p_target_id and client_id=p_user_id for update;
  end if;
  if not found then raise exception 'PAYMENT_TARGET_UNAVAILABLE'; end if;
  insert into public.processed_webhook_events(event_id) values(p_event_id) on conflict do nothing;
  if not found then return false; end if;
  insert into public.order_payments(payment_intent,user_id,kind,target_id,units)
    values(p_intent,p_user_id,p_kind,p_target_id,p_units) on conflict do nothing;
  select * into strict receipt from public.order_payments where payment_intent=p_intent for update;
  if row(receipt.user_id,receipt.kind,receipt.target_id,receipt.units) is distinct from row(p_user_id,p_kind,p_target_id,p_units)
    or (receipt.session_id is not null and p_session_id is not null and receipt.session_id<>p_session_id) then raise exception 'PAYMENT_IDENTITY_MISMATCH'; end if;
  if p_refunded and not receipt.refunded then
    if p_kind='deposit' then
      update public.bookings set deposit_paid=false where id=p_target_id and stripe_payment_intent=p_intent;
    elsif receipt.fulfilled then
      removed:=greatest(receipt.boost_end-greatest(now(),receipt.boost_start),interval '0');
      update public.designs set boosted_until=greatest(now(),boosted_until-removed) where id=p_target_id;
      -- Shift later grants by only the refunded grant's unused time.
      update public.order_payments set boost_start=greatest(now(),boost_start-removed),boost_end=boost_end-removed
        where kind='boost' and target_id=p_target_id and not refunded and payment_intent<>p_intent and boost_start>=receipt.boost_end;
    end if;
    receipt.refunded:=true;
  end if;
  if p_session_id is not null and not receipt.fulfilled then
    if not receipt.refunded then
      if p_kind='boost' then
        receipt.boost_start:=greatest(now(),until_at);
        receipt.boost_end:=receipt.boost_start+make_interval(days=>p_units);
        update public.designs set boosted_until=receipt.boost_end where id=p_target_id;
      elsif booking.status not in ('pending','confirmed') then
        -- Commit a durable refund obligation before calling Stripe. Webhook
        -- retries resume it, including a crash after Stripe accepted the refund.
        receipt.refund_required:=true;
        receipt.needs_review:=true;
      elsif booking.deposit_paid and booking.stripe_payment_intent is distinct from p_intent then
        receipt.needs_review:=true;
      else
        update public.bookings set deposit_paid=true,stripe_payment_intent=p_intent where id=p_target_id;
      end if;
    end if;
    receipt.fulfilled:=true;receipt.session_id:=p_session_id;
    if p_kind='deposit' then delete from public.deposit_checkouts where booking_id=p_target_id and (session_id=p_session_id or session_id is null); end if;
  end if;
  update public.order_payments set fulfilled=receipt.fulfilled,refunded=receipt.refunded,session_id=receipt.session_id,
    boost_start=receipt.boost_start,boost_end=receipt.boost_end,needs_review=receipt.needs_review,
    refund_required=receipt.refund_required where payment_intent=p_intent;
  return true;
end $$;

create function public.record_deposit_refund(p_intent text,p_refund_id text,p_status text,p_created bigint) returns void
language plpgsql security definer set search_path='' as $$
declare receipt public.order_payments;
begin
  if p_refund_id is null or p_status is null or p_status not in ('pending','requires_action','succeeded','failed','canceled') or p_created is null then
    raise exception 'INVALID_REFUND';
  end if;
  select * into strict receipt from public.order_payments where payment_intent=p_intent and kind='deposit' and refund_required for update;
  if receipt.refund_id is not null and receipt.refund_id<>p_refund_id then raise exception 'REFUND_IDENTITY_MISMATCH'; end if;
  if p_created<receipt.refund_event_created then return; end if;
  if p_created=receipt.refund_event_created and receipt.refund_status in ('succeeded','failed','canceled') and p_status in ('pending','requires_action') then return; end if;
  update public.order_payments set refund_id=p_refund_id,refund_status=p_status,refund_event_created=p_created,
    refunded=(p_status='succeeded'),needs_review=(p_status<>'succeeded') where payment_intent=p_intent;
end $$;

create table public.deposit_checkouts (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),user_id uuid not null references public.profiles_data(id) on delete cascade,
  amount integer not null check(amount>0),service_name text not null,base_url text not null,
  session_id text unique,created_at timestamptz not null default now()
);
alter table public.deposit_checkouts enable row level security;
revoke all on public.deposit_checkouts from public,anon,authenticated;
grant all on public.deposit_checkouts to service_role;
create function public.reserve_deposit_checkout(p_user_id uuid,p_booking_id uuid,p_base_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare booking public.bookings; offer public.services; attempt public.deposit_checkouts;
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  select * into booking from public.bookings where id=p_booking_id and client_id=p_user_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if booking.status not in ('pending','confirmed') or booking.deposit_paid or booking.booking_date<current_date then raise exception 'BOOKING_NOT_PAYABLE'; end if;
  select * into strict offer from public.services where id=booking.service_id;
  if offer.deposit_amount is null or offer.deposit_amount<=0 then raise exception 'NO_DEPOSIT_REQUIRED'; end if;
  select * into attempt from public.deposit_checkouts where booking_id=p_booking_id;
  if not found then
    insert into public.deposit_checkouts(booking_id,user_id,amount,service_name,base_url)
      values(p_booking_id,p_user_id,round(offer.deposit_amount*100),offer.name,p_base_url) returning * into attempt;
  end if;
  return to_jsonb(attempt);
end $$;

-- Durable pending one-time checkouts also protect account deletion from a
-- charge that could otherwise complete after the account has disappeared.
create table public.payment_checkouts (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles_data(id) on delete cascade,
  scope text not null,params jsonb not null,session_id text unique,created_at timestamptz not null default now(),unique(user_id,scope),
  -- A payable promotion must retain its target until fulfillment or expiry.
  -- The FK also closes the race between the route's ownership read and deletion.
  design_id uuid references public.designs(id) on delete restrict
);
alter table public.payment_checkouts enable row level security;
revoke all on public.payment_checkouts from public,anon,authenticated;
grant all on public.payment_checkouts to service_role;
create function public.reserve_payment_checkout(p_user_id uuid,p_scope text,p_params jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare attempt public.payment_checkouts;
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  select * into attempt from public.payment_checkouts where user_id=p_user_id and scope=p_scope;
  if not found then
    insert into public.payment_checkouts(user_id,scope,params,design_id)
      values(p_user_id,p_scope,p_params,case when p_params->'metadata'->>'type'='boost' then (p_params->'metadata'->>'designId')::uuid end)
      returning * into attempt;
  end if;
  return to_jsonb(attempt);
end $$;
create function public.settle_payment_checkout(p_user_id uuid,p_attempt_id uuid,p_session_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from public.payment_checkouts where id=p_attempt_id and user_id=p_user_id and (session_id is null or session_id=p_session_id);
end $$;

-- All new routines are service-only; trigger implementations are not callable APIs.
revoke all on function public.reserve_generation_before_deletion_guard(uuid,uuid,uuid),public.reserve_subscription_checkout_before_deletion_guard(uuid,text,text,text),
  public.delete_account_before_inflight_guard(uuid) from public,anon,authenticated,service_role;
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
    ('ensure_referral_code','begin_account_deletion','reserve_generation','reserve_subscription_checkout','delete_account','guard_deleted_account_work',
     'prevent_booking_overlap','grant_subscription_credits','apply_order_payment','record_deposit_refund','reserve_deposit_checkout','reserve_payment_checkout','settle_payment_checkout') loop
    execute format('revoke all on function %s from public,anon,authenticated',f);
    execute format('grant execute on function %s to service_role',f);
  end loop;
end $$;
commit;
