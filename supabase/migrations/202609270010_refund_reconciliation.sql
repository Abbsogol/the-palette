begin;

-- A late deposit may have several refunds, including refunds created manually.
-- Track the full captured amount and serialize provider reads so an older worker
-- cannot overwrite a newer reconciliation after its lease has expired.
alter table public.order_payments
  add column refund_amount integer,
  add column refund_succeeded_amount integer not null default 0,
  add column refund_pending_amount integer not null default 0,
  add column refund_reconciliation_pending boolean not null default false,
  add column refund_check_token uuid,
  add column refund_check_until timestamptz;

create function public.claim_deposit_refund_check(p_intent text) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid; account_id uuid;
begin
  select user_id into account_id from public.order_payments where payment_intent=p_intent;
  perform 1 from public.profiles_data where id=account_id for update;
  if not found then return null; end if;
  update public.order_payments set refund_check_token=gen_random_uuid(),refund_check_until=now()+interval '2 minutes',
    refund_reconciliation_pending=true,needs_review=true
    where payment_intent=p_intent and kind='deposit' and refund_required
      and (refund_check_until is null or refund_check_until<now())
    returning refund_check_token into token;
  return token;
end $$;

create function public.finish_deposit_refund_check(p_intent text,p_token uuid,p_amount integer,
  p_succeeded integer,p_pending integer,p_failed boolean,p_requires_action boolean,p_refund_id text,p_created bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare next_status text;
begin
  if p_amount is null or p_amount<=0 or p_succeeded is null or p_pending is null or p_succeeded<0 or p_pending<0
    or p_succeeded+p_pending>p_amount or p_failed is null or p_requires_action is null or p_created is null then
    raise exception 'INVALID_REFUND_TOTALS';
  end if;
  next_status:=case when p_succeeded=p_amount then 'succeeded'
    when p_requires_action then 'requires_action'
    when p_failed and p_succeeded+p_pending<p_amount then 'failed' else 'pending' end;
  update public.order_payments set refund_amount=p_amount,refund_succeeded_amount=p_succeeded,refund_pending_amount=p_pending,
    refund_status=next_status,refund_id=coalesce(refund_id,p_refund_id),refund_event_created=greatest(refund_event_created,p_created),
    refunded=(next_status='succeeded'),needs_review=(next_status<>'succeeded'),refund_reconciliation_pending=false,refund_check_token=null,refund_check_until=null
    where payment_intent=p_intent and kind='deposit' and refund_required and refund_check_token=p_token and refund_check_until>now();
  return found;
end $$;

create function public.release_deposit_refund_check(p_intent text,p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.order_payments set refund_check_token=null,refund_check_until=null
    where payment_intent=p_intent and refund_check_token=p_token;
end $$;

-- A cancellation can commit after a reminder was claimed but before recipient
-- lookup finishes. Recheck at the final preparation boundary and skip the job.
create or replace function public.prepare_reminder_email(p_id uuid,p_token uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; job public.reminder_emails; booking public.bookings;
begin
  select * into job from public.reminder_emails where id=p_id;
  if not found then return null; end if;
  -- Keep the same booking -> outbox lock order as enqueue_booking_reminders.
  select * into booking from public.bookings where id=job.booking_id for share;
  if not found then return null; end if;
  if booking.status<>'confirmed' or booking.booking_date<=(now() at time zone 'UTC')::date then
    update public.reminder_emails set status='skipped',lease_until=null,claim_token=null
      where id=p_id and claim_token=p_token and status='pending';
    return null;
  end if;
  update public.reminder_emails set payload=coalesce(payload,p_payload)
    where id=p_id and claim_token=p_token and status='pending' and lease_until>now()
    returning payload into result;
  return result;
end $$;

revoke all on function public.claim_deposit_refund_check(text),public.finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint),public.release_deposit_refund_check(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_deposit_refund_check(text),public.finish_deposit_refund_check(text,uuid,integer,integer,integer,boolean,boolean,text,bigint),public.release_deposit_refund_check(text,uuid) to service_role;
commit;
