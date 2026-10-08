-- Allow a usable pilot account budget inside the unchanged shared 100/day and 5/minute ceilings.
begin;
create or replace function public.reserve_pinterest_request_batch(p_user_id uuid, p_day_limit integer,
  p_minute_limit integer, p_user_limit integer, p_request_count integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t timestamptz;
  paused timestamptz;
  retry_at timestamptz := '-infinity';
  candidate timestamptz;
  reason text;
  used integer;
begin
  if p_user_id is null or p_day_limit is null or p_day_limit not between 1 and 100 or
     p_minute_limit is null or p_minute_limit not between 1 and 5 or
     p_user_limit is null or p_user_limit not between 1 and 30 or
     p_request_count is null or p_request_count not between 1 and 2 then
    raise exception 'Invalid Pinterest budget';
  end if;
  select blocked_until into paused from public.pinterest_request_gate where id=true for update;
  if not found then return jsonb_build_object('allowed',false); end if;
  t := clock_timestamp();
  if paused > t then
    retry_at := paused; reason := 'provider';
  end if;
  select count(*) into used from public.pinterest_request_usage where requested_at > t - interval '24 hours';
  if used + p_request_count > p_day_limit then
    select requested_at + interval '24 hours' into candidate from public.pinterest_request_usage
      where requested_at > t - interval '24 hours' order by requested_at
      offset greatest(0, used + p_request_count - p_day_limit - 1) limit 1;
    if candidate > retry_at then retry_at := candidate; reason := 'day'; end if;
    if candidate is null then return jsonb_build_object('allowed',false,'reason','configuration'); end if;
  end if;
  select count(*) into used from public.pinterest_request_usage
    where user_id=p_user_id and requested_at > t - interval '24 hours';
  if used + p_request_count > p_user_limit then
    select requested_at + interval '24 hours' into candidate from public.pinterest_request_usage
      where user_id=p_user_id and requested_at > t - interval '24 hours' order by requested_at
      offset greatest(0, used + p_request_count - p_user_limit - 1) limit 1;
    if candidate > retry_at then retry_at := candidate; reason := 'user'; end if;
    if candidate is null then return jsonb_build_object('allowed',false,'reason','configuration'); end if;
  end if;
  select count(*) into used from public.pinterest_request_usage where requested_at > t - interval '1 minute';
  if used + p_request_count > p_minute_limit then
    select requested_at + interval '1 minute' into candidate from public.pinterest_request_usage
      where requested_at > t - interval '1 minute' order by requested_at
      offset greatest(0, used + p_request_count - p_minute_limit - 1) limit 1;
    if candidate > retry_at then retry_at := candidate; reason := 'minute'; end if;
    if candidate is null then return jsonb_build_object('allowed',false,'reason','configuration'); end if;
  end if;
  if retry_at > t then
    return jsonb_build_object('allowed',false,'reason',reason,'retryAt',retry_at);
  end if;
  insert into public.pinterest_request_usage(user_id, requested_at)
    select p_user_id,t from generate_series(1,p_request_count);
  delete from public.pinterest_request_usage where requested_at < t - interval '25 hours';
  return jsonb_build_object('allowed',true);
end $$;
commit;
-- Rollback: lower PINTEREST_USER_DAILY_LIMIT to 10, then restore the batch function from migration 028.
-- Keep usage counters and provider pauses unchanged.
