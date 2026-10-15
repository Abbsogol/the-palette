begin;
-- The browser's displayed slots are not an authorization boundary. Validate
-- direct inserts as well; existing appointments can still be cancelled when
-- the creator later changes working hours. The creator time zone is not stored
-- yet. Reject dates that are past in every time zone; do not reject a visitor's
-- valid local "today" simply because UTC has crossed midnight. Exact local-day
-- and elapsed-time validation remains a release gate pending that data model.
create function public.validate_booking_availability() returns trigger
language plpgsql set search_path='' as $$
declare hours public.availability;
begin
  if current_user in ('postgres','service_role') then return new; end if;
  if new.booking_date < (now() at time zone 'UTC')::date-1 then raise exception 'BOOKING_DATE_UNAVAILABLE'; end if;
  select * into hours from public.availability where creator_id=new.creator_id
    and day_of_week=extract(dow from new.booking_date)::integer and is_active=true;
  if not found or new.start_time<hours.start_time or new.end_time>hours.end_time
    or new.start_time>=new.end_time or mod(extract(epoch from (new.start_time-hours.start_time))::numeric,1800)<>0 then
    raise exception 'BOOKING_SLOT_UNAVAILABLE';
  end if;
  return new;
end $$;
create trigger validate_booking_availability before insert on public.bookings
  for each row execute function public.validate_booking_availability();
revoke all on function public.validate_booking_availability() from public,anon,authenticated;
commit;
