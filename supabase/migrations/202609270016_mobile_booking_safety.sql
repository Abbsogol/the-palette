begin;

-- Old appointments retain NULL snapshots: historical prices/location cannot be
-- reconstructed from a mutable service. New appointments freeze review terms.
alter table public.bookings add column price_snapshot numeric,
  add column deposit_snapshot numeric, add column location_snapshot text;
create function public.snapshot_booking_terms() returns trigger
language plpgsql security definer set search_path='' as $$
declare offer public.services; service_location text;
begin
  select * into offer from public.services where id=new.service_id and creator_id=new.creator_id for share;
  if found then
    if current_setting('role',true)='authenticated' and ((new.price_snapshot is not null and new.price_snapshot is distinct from offer.price)
      or (new.deposit_snapshot is not null and new.deposit_snapshot is distinct from offer.deposit_amount)) then raise exception 'BOOKING_TERMS_CHANGED'; end if;
    select coalesce(nullif(booking_area,''),location) into service_location from public.profiles_data where id=new.creator_id for share;
    if current_setting('role',true)='authenticated' and new.location_snapshot is not null and new.location_snapshot is distinct from coalesce(service_location,'') then raise exception 'BOOKING_TERMS_CHANGED'; end if;
    new.price_snapshot:=offer.price; new.deposit_snapshot:=offer.deposit_amount;
    new.location_snapshot:=service_location;
  end if;
  return new;
end $$;
create trigger a_snapshot_booking_terms before insert on public.bookings for each row execute function public.snapshot_booking_terms();

-- All clients (including the web app) cross the same cancellation boundary.
-- No refund is promised for legacy/elapsed appointments with unknown instants.
create function public.obligate_booking_refund() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('cancelled','declined') and old.status in ('pending','confirmed') and old.starts_at>now() then
    update public.order_payments set refund_required=true,needs_review=true,
      refund_event_version=refund_event_version+1,refund_reconciliation_pending=true
      where kind='deposit' and target_id=new.id and not refunded;
  end if;
  return null;
end $$;
create trigger obligate_booking_refund after update of status on public.bookings for each row execute function public.obligate_booking_refund();

create or replace function public.guard_booking_fields() returns trigger language plpgsql set search_path='' as $$
declare duration integer;
begin
  if current_user in ('postgres','service_role') then return new; end if;
  if tg_op='INSERT' then
    if new.client_id is distinct from auth.uid() or new.creator_id=new.client_id or
       new.status is distinct from 'pending' or coalesce(new.deposit_paid,false) or
       new.stripe_payment_intent is not null or new.reminder_sent_at is not null then raise exception 'INVALID_BOOKING_FIELDS'; end if;
    select duration_minutes into duration from public.services where id=new.service_id and creator_id=new.creator_id and is_active=true;
    if duration is null or duration<=0 or new.end_time<=new.start_time or extract(epoch from (new.end_time-new.start_time))/60<>duration then raise exception 'INVALID_BOOKING_SERVICE'; end if;
  else
    if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then raise exception 'BOOKING_FIELDS_ARE_IMMUTABLE'; end if;
    if new.status is distinct from old.status then
      if auth.uid()=old.client_id and old.status in ('pending','confirmed') and new.status='cancelled' then return new; end if;
      if auth.uid()=old.creator_id and old.starts_at>now() and old.status in ('pending','confirmed') and new.status='cancelled' then return new; end if;
      if auth.uid()=old.creator_id and old.status='pending' and new.status in ('confirmed','declined') then return new; end if;
      raise exception 'INVALID_BOOKING_TRANSITION';
    end if;
  end if;
  return new;
end $$;

create function public.cancel_mobile_booking(p_booking_id uuid) returns public.bookings
language plpgsql set search_path='' as $$
declare booking public.bookings;
begin
  select * into booking from public.bookings where id=p_booking_id and auth.uid() in (client_id,creator_id) for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if booking.status='cancelled' then return booking; end if;
  if booking.status not in ('pending','confirmed') or booking.starts_at is null or booking.starts_at<=now() then raise exception 'BOOKING_NOT_CANCELLABLE'; end if;
  update public.bookings set status='cancelled' where id=p_booking_id returning * into booking;
  return booking;
end $$;

create or replace function public.reserve_deposit_checkout(p_user_id uuid,p_booking_id uuid,p_base_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare booking public.bookings; offer public.services; attempt public.deposit_checkouts; deposit numeric;
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  select * into booking from public.bookings where id=p_booking_id and client_id=p_user_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if booking.status not in ('pending','confirmed') or booking.deposit_paid or booking.starts_at is null or booking.starts_at<=now() then raise exception 'BOOKING_NOT_PAYABLE'; end if;
  select * into strict offer from public.services where id=booking.service_id;
  deposit:=coalesce(booking.deposit_snapshot,offer.deposit_amount);
  if deposit is null or deposit<=0 then raise exception 'NO_DEPOSIT_REQUIRED'; end if;
  select * into attempt from public.deposit_checkouts where booking_id=p_booking_id;
  if not found then
    insert into public.deposit_checkouts(booking_id,user_id,amount,service_name,base_url)
      values(p_booking_id,p_user_id,round(deposit*100),offer.name,p_base_url) returning * into attempt;
  end if;
  return to_jsonb(attempt);
end $$;

-- Return context is fixed before creating a provider checkout so a retry from
-- another device cannot mutate Stripe's idempotent request parameters.
alter table public.deposit_checkouts add column return_context text check(return_context in ('web','laque','laque-dev'));
create function public.bind_deposit_return(p_attempt_id uuid,p_user_id uuid,p_context text) returns text
language plpgsql security definer set search_path='' as $$
declare bound text;
begin
  if p_context not in ('web','laque','laque-dev') or p_context is null then raise exception 'INVALID_RETURN_CONTEXT'; end if;
  update public.deposit_checkouts set return_context=coalesce(return_context,case when session_id is not null then 'web' else p_context end)
    where id=p_attempt_id and user_id=p_user_id returning return_context into bound;
  if not found then raise exception 'CHECKOUT_UNAVAILABLE'; end if;
  return bound;
end $$;

alter function public.begin_account_deletion(uuid) rename to begin_account_deletion_before_mobile_bookings;
create function public.begin_account_deletion(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if exists(select from public.bookings b where p_user_id in (b.client_id,b.creator_id) and b.status in ('pending','confirmed') and (b.ends_at is null or b.ends_at>now()))
    or exists(select from public.order_payments p join public.bookings b on b.id=p.target_id where p.kind='deposit' and p_user_id in (b.client_id,b.creator_id)
      and p.refund_required and (p.refund_status is distinct from 'succeeded' or p.refund_reconciliation_pending)) then raise exception 'BILLING_IN_PROGRESS: BOOKING_OR_REFUND_IN_PROGRESS'; end if;
  perform public.begin_account_deletion_before_mobile_bookings(p_user_id);
end $$;

revoke all on function public.snapshot_booking_terms(),public.obligate_booking_refund(),public.cancel_mobile_booking(uuid),public.bind_deposit_return(uuid,uuid,text),public.begin_account_deletion(uuid) from public,anon,authenticated;
revoke all on function public.begin_account_deletion_before_mobile_bookings(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancel_mobile_booking(uuid) to authenticated;
grant execute on function public.bind_deposit_return(uuid,uuid,text),public.begin_account_deletion(uuid) to service_role;
notify pgrst,'reload schema';
commit;
