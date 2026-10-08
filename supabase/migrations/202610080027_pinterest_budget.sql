-- Counters only: never store Pin payloads, media, titles or OAuth tokens here.
begin;
create table public.pinterest_request_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default clock_timestamp()
);
create index pinterest_usage_time on public.pinterest_request_usage(requested_at);
create index pinterest_usage_user_time on public.pinterest_request_usage(user_id, requested_at);
create table public.pinterest_request_gate (
  id boolean primary key default true check (id),
  blocked_until timestamptz not null default '-infinity'
);
insert into public.pinterest_request_gate(id) values(true);
alter table public.pinterest_request_usage enable row level security;
alter table public.pinterest_request_gate enable row level security;
revoke all on public.pinterest_request_usage, public.pinterest_request_gate from public, anon, authenticated;
grant all on public.pinterest_request_usage, public.pinterest_request_gate to service_role;
grant usage, select on sequence public.pinterest_request_usage_id_seq to service_role;

create function public.reserve_pinterest_request(p_user_id uuid, p_day_limit integer, p_minute_limit integer, p_user_limit integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t timestamptz;
begin
  if p_user_id is null or p_day_limit is null or p_day_limit not between 1 and 100 or
     p_minute_limit is null or p_minute_limit not between 1 and 5 or
     p_user_limit is null or p_user_limit not between 1 and 10 then
    raise exception 'Invalid Pinterest budget';
  end if;
  -- Lock one persistent row, serializing all instances and accounts.
  perform id from public.pinterest_request_gate where id=true for update;
  t := clock_timestamp();
  if not found then return jsonb_build_object('allowed',false); end if;
  if exists(select 1 from public.pinterest_request_gate where blocked_until > t) then
    return jsonb_build_object('allowed',false);
  end if;
  if (select count(*) from public.pinterest_request_usage where requested_at > t - interval '24 hours') >= p_day_limit or
     (select count(*) from public.pinterest_request_usage where requested_at > t - interval '1 minute') >= p_minute_limit or
     (select count(*) from public.pinterest_request_usage where user_id=p_user_id and requested_at > t - interval '24 hours') >= p_user_limit then
    return jsonb_build_object('allowed',false);
  end if;
  insert into public.pinterest_request_usage(user_id, requested_at) values(p_user_id,t);
  delete from public.pinterest_request_usage where requested_at < t - interval '25 hours';
  return jsonb_build_object('allowed',true);
end $$;
create function public.pause_pinterest_requests(p_seconds integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_seconds is null or p_seconds not between 1 and 604800 then raise exception 'Invalid Pinterest pause'; end if;
  update public.pinterest_request_gate set blocked_until=greatest(blocked_until,clock_timestamp()+make_interval(secs=>p_seconds)) where id=true;
end $$;
revoke all on function public.reserve_pinterest_request(uuid,integer,integer,integer), public.pause_pinterest_requests(integer) from public, anon, authenticated;
grant execute on function public.reserve_pinterest_request(uuid,integer,integer,integer), public.pause_pinterest_requests(integer) to service_role;
commit;
-- Rollback after setting PINTEREST_ENABLED=0:
-- drop function public.reserve_pinterest_request(uuid,integer,integer,integer);
-- drop function public.pause_pinterest_requests(integer);
-- drop table public.pinterest_request_usage, public.pinterest_request_gate;
