begin;

-- Existing appointments have no trustworthy zone. Do not infer one from a
-- visitor's browser or silently reinterpret historical wall-clock dates.
create table public.creator_booking_settings (
  creator_id uuid primary key references public.profiles_data(id) on delete cascade,
  time_zone text not null
);
alter table public.creator_booking_settings enable row level security;
revoke all on public.creator_booking_settings from public,anon,authenticated;
grant select on public.creator_booking_settings to anon,authenticated;
grant all on public.creator_booking_settings to service_role;
create policy "Appointment timezone is public" on public.creator_booking_settings for select using(true);
-- The authenticated API and service-owned RPC validate all seven days and the
-- zone in one transaction; direct writes must not bypass that boundary.
revoke insert,update,delete,truncate,references,trigger on public.availability from public,anon,authenticated;
alter table public.bookings add column time_zone text, add column starts_at timestamptz, add column ends_at timestamptz;
alter table public.bookings add constraint booking_instant_order check(starts_at is null or ends_at>starts_at);

-- Return an instant only when the wall time has exactly one interpretation.
-- Offsets on either side of the date also catch non-hour DST changes.
create function public.booking_local_instant(p_date date,p_time time,p_zone text) returns timestamptz
language plpgsql stable set search_path='' as $$
declare wall timestamp:=p_date+p_time; guess timestamptz; result timestamptz; matches integer;
begin
  if p_zone is null or not exists(select from pg_catalog.pg_timezone_names where name=p_zone and (name='UTC' or name like '%/%')) then return null; end if;
  guess:=wall at time zone p_zone;
  select count(*),min(candidate) into matches,result from (
    select distinct (wall-((sample at time zone p_zone)-(sample at time zone 'UTC'))) at time zone 'UTC' as candidate
    from unnest(array[guess-interval '2 days',guess,guess+interval '2 days']) sample
  ) candidates where candidate at time zone p_zone=wall;
  if matches<>1 then return null; end if;
  return result;
end $$;

create function public.save_creator_availability(p_user_id uuid,p_time_zone text,p_schedule jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare day jsonb;
begin
  perform 1 from public.profiles_data where id=p_user_id and account_type in ('creator','nail_artist','salon') and deletion_started_at is null for update;
  if not found then raise exception 'CREATOR_REQUIRED'; end if;
  if p_time_zone is null or not exists(select from pg_catalog.pg_timezone_names where name=p_time_zone and (name='UTC' or name like '%/%')) then raise exception 'INVALID_TIME_ZONE'; end if;
  if jsonb_typeof(p_schedule) is distinct from 'array' or jsonb_array_length(p_schedule)<>7 then raise exception 'INVALID_AVAILABILITY'; end if;
  if (select count(distinct (item->>'day_of_week')::integer) from jsonb_array_elements(p_schedule) item)<>7 then raise exception 'INVALID_AVAILABILITY'; end if;
  for day in select * from jsonb_array_elements(p_schedule) loop
    if (day->>'day_of_week')::integer not between 0 and 6 or jsonb_typeof(day->'is_active') is distinct from 'boolean'
      or day->>'start_time' is null or day->>'end_time' is null or (day->>'start_time')::time >= (day->>'end_time')::time then raise exception 'INVALID_AVAILABILITY'; end if;
    insert into public.availability(creator_id,day_of_week,start_time,end_time,is_active)
      values(p_user_id,(day->>'day_of_week')::integer,(day->>'start_time')::time,(day->>'end_time')::time,(day->>'is_active')::boolean)
      on conflict(creator_id,day_of_week) do update set start_time=excluded.start_time,end_time=excluded.end_time,is_active=excluded.is_active;
  end loop;
  insert into public.creator_booking_settings values(p_user_id,p_time_zone)
    on conflict(creator_id) do update set time_zone=excluded.time_zone;
end $$;

-- Same creator lock as availability changes, then snapshot zone and instants
-- before conflict detection. Client-supplied timestamp fields are overwritten.
create or replace function public.prevent_booking_overlap() returns trigger
language plpgsql security definer set search_path='' as $$
declare caller text:=current_setting('role',true); zone text; creator public.profiles_data;
begin
  select * into creator from public.profiles_data where id=new.creator_id for update;
  if tg_op='INSERT' then
    if caller in ('authenticated','anon') then
      if creator.id is null or creator.deletion_started_at is not null or creator.account_type not in ('creator','nail_artist','salon')
        or (creator.is_private and not exists(select from public.follows where follower_id=new.client_id and following_id=new.creator_id)) then
        raise exception 'CREATOR_NOT_BOOKABLE';
      end if;
      select time_zone into zone from public.creator_booking_settings where creator_id=new.creator_id;
      if zone is null then raise exception 'CREATOR_TIME_ZONE_REQUIRED'; end if;
      if new.time_zone is not null and new.time_zone<>zone then raise exception 'CREATOR_TIME_ZONE_CHANGED'; end if;
      new.time_zone:=zone;
      if exists(select from public.bookings where creator_id=new.creator_id and starts_at is null and status in ('pending','confirmed')
        and booking_date>=(now() at time zone zone)::date-1) then raise exception 'LEGACY_BOOKING_TIME_REVIEW_REQUIRED'; end if;
    end if;
    if new.time_zone is not null then
      new.starts_at:=public.booking_local_instant(new.booking_date,new.start_time,new.time_zone);
      new.ends_at:=public.booking_local_instant(new.booking_date,new.end_time,new.time_zone);
      if new.starts_at is null or new.ends_at is null or new.ends_at-new.starts_at<>new.end_time-new.start_time then
        raise exception 'BOOKING_TIME_AMBIGUOUS_OR_UNAVAILABLE'; end if;
    else new.starts_at:=null; new.ends_at:=null;
    end if;
  end if;
  if tg_op='UPDATE' and caller in ('authenticated','anon') and new.status='confirmed' and old.status<>'confirmed'
    and (new.starts_at is null or new.starts_at<=now()) then raise exception 'BOOKING_DATE_UNAVAILABLE'; end if;
  if new.status not in ('pending','confirmed') then return new; end if;
  if tg_op='UPDATE' and row(new.creator_id,new.booking_date,new.start_time,new.end_time,new.status,new.starts_at,new.ends_at)
    is not distinct from row(old.creator_id,old.booking_date,old.start_time,old.end_time,old.status,old.starts_at,old.ends_at) then return new; end if;
  if exists(select from public.bookings b where b.creator_id=new.creator_id and b.id<>new.id and b.status in ('pending','confirmed') and
    (case when new.starts_at is not null and b.starts_at is not null then new.starts_at<b.ends_at and b.starts_at<new.ends_at
      else b.booking_date=new.booking_date and b.start_time<new.end_time and new.start_time<b.end_time end)) then raise exception 'BOOKING_SLOT_UNAVAILABLE'; end if;
  return new;
end $$;

create or replace function public.validate_booking_availability() returns trigger
language plpgsql set search_path='' as $$
declare hours public.availability;
begin
  if current_user in ('postgres','service_role') then return new; end if;
  if new.starts_at is null or new.starts_at<=now() or new.booking_date>(now() at time zone new.time_zone)::date+365 then raise exception 'BOOKING_DATE_UNAVAILABLE'; end if;
  select * into hours from public.availability where creator_id=new.creator_id and day_of_week=extract(dow from new.booking_date)::integer and is_active=true;
  if not found or new.start_time<hours.start_time or new.end_time>hours.end_time or new.start_time>=new.end_time
    or mod(extract(epoch from (new.start_time-hours.start_time))::numeric,1800)<>0 then raise exception 'BOOKING_SLOT_UNAVAILABLE'; end if;
  return new;
end $$;

create function public.booking_available_slots(p_creator_id uuid,p_date date,p_service_id uuid)
returns table(start_time time,end_time time,starts_at timestamptz,ends_at timestamptz,available boolean)
language plpgsql stable security definer set search_path='' as $$
declare zone text; hours public.availability; duration integer; slot timestamp; finish timestamp; instant timestamptz; finish_instant timestamptz;
begin
  select time_zone into zone from public.creator_booking_settings where creator_id=p_creator_id;
  if zone is null then raise exception 'CREATOR_TIME_ZONE_REQUIRED'; end if;
  if p_date<(now() at time zone zone)::date or p_date>(now() at time zone zone)::date+365 then return; end if;
  if exists(select from public.bookings b where b.creator_id=p_creator_id and b.starts_at is null and b.status in ('pending','confirmed')
    and b.booking_date>=(now() at time zone zone)::date-1) then raise exception 'LEGACY_BOOKING_TIME_REVIEW_REQUIRED'; end if;
  select duration_minutes into duration from public.services where id=p_service_id and creator_id=p_creator_id and is_active;
  if duration is null or duration<=0 then return; end if;
  select * into hours from public.availability where creator_id=p_creator_id and day_of_week=extract(dow from p_date)::integer and is_active;
  if not found then return; end if;
  for slot in select generate_series(p_date+hours.start_time,p_date+hours.end_time-duration*interval '1 minute',interval '30 minutes') loop
    finish:=slot+duration*interval '1 minute';
    instant:=public.booking_local_instant(p_date,slot::time,zone); finish_instant:=public.booking_local_instant(finish::date,finish::time,zone);
    if instant is null or finish_instant is null or finish_instant-instant<>duration*interval '1 minute' or instant<=now() then continue; end if;
    start_time:=slot::time;end_time:=case when finish::date>p_date then '24:00'::time else finish::time end;starts_at:=instant;ends_at:=finish_instant;
    available:=not exists(select from public.bookings b where b.creator_id=p_creator_id and b.status in ('pending','confirmed') and b.starts_at<finish_instant and instant<b.ends_at);
    return next;
  end loop;
end $$;

create or replace function public.booking_busy_slots(p_creator_id uuid,p_date date)
returns table(start_time time,end_time time) language sql stable security definer set search_path='' as $$
  select b.start_time,b.end_time from public.bookings b join public.creator_booking_settings s on s.creator_id=b.creator_id
    where b.creator_id=p_creator_id and b.booking_date=p_date and b.status in ('pending','confirmed')
    and p_date between (now() at time zone s.time_zone)::date and (now() at time zone s.time_zone)::date+365;
$$;

-- An old UTC-day check could reject a future west-coast appointment or accept
-- a same-day appointment that has already started. Keep the checkout identity.
create or replace function public.reserve_deposit_checkout(p_user_id uuid,p_booking_id uuid,p_base_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare booking public.bookings; offer public.services; attempt public.deposit_checkouts;
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  select * into booking from public.bookings where id=p_booking_id and client_id=p_user_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if booking.status not in ('pending','confirmed') or booking.deposit_paid or booking.starts_at is null or booking.starts_at<=now() then raise exception 'BOOKING_NOT_PAYABLE'; end if;
  select * into strict offer from public.services where id=booking.service_id;
  if offer.deposit_amount is null or offer.deposit_amount<=0 then raise exception 'NO_DEPOSIT_REQUIRED'; end if;
  select * into attempt from public.deposit_checkouts where booking_id=p_booking_id;
  if not found then
    insert into public.deposit_checkouts(booking_id,user_id,amount,service_name,base_url)
      values(p_booking_id,p_user_id,round(offer.deposit_amount*100),offer.name,p_base_url) returning * into attempt;
  end if;
  return to_jsonb(attempt);
end $$;

drop policy "Require completed own appointment for review" on public.reviews;
create policy "Require completed own appointment for review" on public.reviews as restrictive for insert to authenticated
with check(exists(select from public.bookings b where b.id=booking_id and b.client_id=auth.uid() and b.creator_id=reviews.creator_id
  and b.status='confirmed' and b.ends_at is not null and b.ends_at<now()));

-- The creator may use shared client notes before and during an appointment.
-- A local calendar date cannot prove that an appointment is still upcoming;
-- unknown legacy instants fail closed until reconciled.
create or replace function public.tech_has_upcoming_booking(p_client uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select from public.bookings b where b.client_id=p_client and b.creator_id=auth.uid()
    and b.status in ('pending','confirmed') and b.ends_at>now());
$$;

-- Preserve old call signature for deployed workers, but p_date is now ignored:
-- each booking's recorded creator zone determines its own tomorrow.
create or replace function public.enqueue_booking_reminders(p_date date default null) returns integer
language plpgsql security definer set search_path='' as $$
declare b public.bookings; total integer:=0;
begin
  for b in select * from public.bookings where status='confirmed' and reminder_sent_at is null and starts_at>now()
    and booking_date=(now() at time zone time_zone)::date+1 order by id for update skip locked loop
    insert into public.notifications(user_id,actor_id,type) values(b.client_id,b.creator_id,'appointment_reminder'),(b.creator_id,b.client_id,'appointment_reminder');
    insert into public.reminder_emails(booking_id,user_id,other_user_id,recipient_role)
      values(b.id,b.client_id,b.creator_id,'client'),(b.id,b.creator_id,b.client_id,'creator') on conflict do nothing;
    update public.bookings set reminder_sent_at=now() where id=b.id;total:=total+1;
  end loop;
  return total;
end $$;

create or replace function public.claim_reminder_emails(p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  update public.reminder_emails set status='needs_review' where status='pending' and first_attempt_at<now()-interval '23 hours';
  update public.reminder_emails r set status='skipped' from public.bookings b where r.booking_id=b.id and r.status='pending'
    and (b.status<>'confirmed' or b.starts_at is null or b.starts_at<=now()) and (r.lease_until is null or r.lease_until<now());
  with ready as (
    select id from public.reminder_emails where status='pending' and retry_at<=now() and (lease_until is null or lease_until<now())
      order by created_at,id limit least(greatest(p_limit,1),50) for update skip locked
  ), claimed as (
    update public.reminder_emails r set lease_until=now()+interval '2 minutes',claim_token=gen_random_uuid(),first_attempt_at=coalesce(first_attempt_at,now())
      from ready where r.id=ready.id returning r.*
  ) select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('booking_date',b.booking_date,'start_time',b.start_time,'time_zone',b.time_zone,'service_name',s.name)),'[]')
    into result from claimed c join public.bookings b on b.id=c.booking_id left join public.services s on s.id=b.service_id;
  return result;
end $$;

create or replace function public.prepare_reminder_email(p_id uuid,p_token uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; job public.reminder_emails; booking public.bookings;
begin
  select * into job from public.reminder_emails where id=p_id;
  if not found then return null; end if;
  select * into booking from public.bookings where id=job.booking_id for share;
  if not found then return null; end if;
  if booking.status<>'confirmed' or booking.starts_at is null or booking.starts_at<=now() then
    update public.reminder_emails set status='skipped',lease_until=null,claim_token=null where id=p_id and claim_token=p_token and status='pending';
    return null;
  end if;
  update public.reminder_emails set payload=coalesce(payload,p_payload) where id=p_id and claim_token=p_token and status='pending' and lease_until>now() returning payload into result;
  return result;
end $$;

revoke all on function public.booking_local_instant(date,time,text) from public,anon;
grant execute on function public.booking_local_instant(date,time,text) to authenticated,service_role;
revoke all on function public.save_creator_availability(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_creator_availability(uuid,text,jsonb) to service_role;
revoke all on function public.booking_available_slots(uuid,date,uuid) from public,anon;
grant execute on function public.booking_available_slots(uuid,date,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
