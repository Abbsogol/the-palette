begin;

-- OAuth grants and busy times never enter client-readable tables.
create table public.google_calendar_connections (
  user_id uuid primary key references public.profiles_data(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  revision bigint not null default 1,
  account_label text not null,
  last_oauth_attempt uuid,
  refresh_token_encrypted text not null,
  calendar_id text not null,
  source_calendars jsonb not null default '[]',
  status text not null default 'connected' check(status in ('connected','reconnect_required')),
  last_checked_at timestamptz,
  connected_at timestamptz not null default now()
);
create table public.google_calendar_oauth (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  state_hash text not null unique,
  return_url text not null,
  expires_at timestamptz not null default now()+interval '10 minutes',
  claimed_at timestamptz,
  grant_encrypted text,
  calendar_id text,
  error_code text
);
create table public.google_calendar_checks (
  booking_id uuid not null,
  action text not null check(action in ('request','confirm')),
  client_id uuid not null,
  creator_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  connection_revision bigint not null,
  expires_at timestamptz not null default now()+interval '20 seconds',
  primary key(booking_id,action)
);
create table public.google_calendar_jobs (
  user_id uuid not null references public.google_calendar_connections(user_id) on delete cascade,
  booking_id uuid not null,
  revision bigint not null default 1,
  completed_revision bigint not null default 0,
  retry_at timestamptz not null default now(),
  lease_until timestamptz,
  claim_token uuid,
  attempts integer not null default 0,
  last_error text,
  synced_at timestamptz,
  primary key(user_id,booking_id)
);
create index google_calendar_jobs_ready on public.google_calendar_jobs(retry_at) where revision>completed_revision;

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth enable row level security;
alter table public.google_calendar_checks enable row level security;
alter table public.google_calendar_jobs enable row level security;
revoke all on public.google_calendar_connections,public.google_calendar_oauth,public.google_calendar_checks,public.google_calendar_jobs from public,anon,authenticated;
grant all on public.google_calendar_connections,public.google_calendar_oauth,public.google_calendar_checks,public.google_calendar_jobs to service_role;

-- Callback stores a grant; only an authenticated, matching LaQue account may
-- finalize it. Claim is atomic and cannot replay a Google authorization code.
create function public.claim_google_calendar_oauth(p_hash text) returns public.google_calendar_oauth
language sql security definer set search_path='' as $$
  update public.google_calendar_oauth set claimed_at=now()
  where state_hash=p_hash and claimed_at is null and expires_at>now()
  returning *;
$$;
create function public.finish_google_calendar_connection(p_user_id uuid,p_attempt uuid,p_account text,p_token text,p_calendar text,p_sources jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare attempt public.google_calendar_oauth;
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  select * into attempt from public.google_calendar_oauth where id=p_attempt and user_id=p_user_id and expires_at>now() and grant_encrypted is not null for update;
  if not found then raise exception 'CALENDAR_AUTH_EXPIRED'; end if;
  perform 1 from public.google_calendar_connections where user_id=p_user_id for update;
  if exists(select from public.google_calendar_jobs where user_id=p_user_id and lease_until>now()) then raise exception 'CALENDAR_SYNC_BUSY'; end if;
  if exists(select from public.google_calendar_connections where user_id=p_user_id and account_label<>p_account) then raise exception 'DISCONNECT_OTHER_CALENDAR_FIRST'; end if;
  insert into public.google_calendar_connections(user_id,account_label,refresh_token_encrypted,calendar_id,source_calendars,last_oauth_attempt)
  values(p_user_id,p_account,p_token,p_calendar,p_sources,p_attempt)
  on conflict(user_id) do update set refresh_token_encrypted=excluded.refresh_token_encrypted,source_calendars=excluded.source_calendars,
    status='connected',last_oauth_attempt=p_attempt,revision=google_calendar_connections.revision+1;
  insert into public.google_calendar_jobs(user_id,booking_id)
    select p_user_id,id from public.bookings where p_user_id in(client_id,creator_id) and status='confirmed' and ends_at>now()
    on conflict(user_id,booking_id) do update set revision=google_calendar_jobs.revision+1,retry_at=now();
  delete from public.google_calendar_oauth where user_id=p_user_id;
end $$;
create function public.disconnect_google_calendar(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  perform 1 from public.google_calendar_connections where user_id=p_user_id for update;
  if exists(select from public.google_calendar_jobs where user_id=p_user_id and lease_until>now()) then raise exception 'CALENDAR_SYNC_BUSY'; end if;
  delete from public.google_calendar_connections where user_id=p_user_id;
  delete from public.google_calendar_oauth where user_id=p_user_id;
end $$;

-- A direct PostgREST write cannot bypass the connected creator's fresh check.
-- Runs after prevent_booking_overlap has computed canonical UTC instants.
create function public.guard_google_calendar_booking() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.google_calendar_connections; operation text;
begin
  if new.status not in ('pending','confirmed') then return new; end if;
  if tg_op='UPDATE' then
    if new.status=old.status then return new; end if;
    operation:='confirm';
  else operation:='request'; end if;
  select * into c from public.google_calendar_connections where user_id=new.creator_id for share;
  if not found then return new; end if;
  if c.status<>'connected' or not exists(select from public.google_calendar_checks v
    where v.booking_id=new.id and v.action=operation and v.client_id=new.client_id and v.creator_id=new.creator_id
      and v.service_id=new.service_id and v.starts_at=new.starts_at and v.ends_at=new.ends_at
      and v.connection_id=c.id and v.connection_revision=c.revision and v.expires_at>clock_timestamp()) then
    raise exception 'GOOGLE_CALENDAR_CHECK_REQUIRED';
  end if;
  delete from public.google_calendar_checks where booking_id=new.id and action=operation;
  return new;
end $$;
create trigger zz_google_calendar_booking before insert or update of status on public.bookings for each row execute function public.guard_google_calendar_booking();

-- One latest-state job per participant/booking. Preserve an active lease when
-- cancellation arrives during an event write so two workers cannot race.
create function public.enqueue_google_calendar_booking() returns trigger
language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
  if tg_op='DELETE' then b:=old; else b:=new; end if;
  if tg_op='UPDATE' and new.status=old.status then return null; end if;
  if tg_op='INSERT' and b.status<>'confirmed' then return null; end if;
  insert into public.google_calendar_jobs(user_id,booking_id)
    select user_id,b.id from public.google_calendar_connections where user_id in(b.client_id,b.creator_id)
    on conflict(user_id,booking_id) do update set revision=google_calendar_jobs.revision+1,retry_at=now();
  return null;
end $$;
create trigger enqueue_google_calendar_booking after insert or update of status or delete on public.bookings for each row execute function public.enqueue_google_calendar_booking();
create function public.claim_google_calendar_jobs(p_user_id uuid default null,p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  delete from public.google_calendar_oauth where expires_at<now();
  delete from public.google_calendar_checks where expires_at<now();
  with ready as (
    select j.user_id,j.booking_id from public.google_calendar_jobs j join public.google_calendar_connections c using(user_id)
    join public.profiles_data p on p.id=j.user_id
    where j.revision>j.completed_revision and j.retry_at<=now() and (j.lease_until is null or j.lease_until<now())
      and c.status='connected' and p.deletion_started_at is null and (p_user_id is null or j.user_id=p_user_id)
    order by j.retry_at,j.booking_id limit least(greatest(p_limit,1),5) for update of j,c skip locked
  ), claimed as (
    update public.google_calendar_jobs j set claim_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1
    from ready r where j.user_id=r.user_id and j.booking_id=r.booking_id returning j.*
  ) select coalesce(jsonb_agg(to_jsonb(c)),'[]') into result from claimed c;
  return result;
end $$;
create function public.finish_google_calendar_job(p_user_id uuid,p_booking_id uuid,p_claim uuid,p_revision bigint,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.google_calendar_jobs set
    completed_revision=case when p_error is null then greatest(completed_revision,p_revision) else completed_revision end,
    synced_at=case when p_error is null then now() else synced_at end,
    last_error=p_error,lease_until=null,claim_token=null,
    retry_at=case when p_error is null then now() else now()+least(3600,30*power(2,least(attempts,7))) * interval '1 second' end
    where user_id=p_user_id and booking_id=p_booking_id and claim_token=p_claim and lease_until>now();
  return found;
end $$;

revoke all on function public.claim_google_calendar_oauth(text),public.finish_google_calendar_connection(uuid,uuid,text,text,text,jsonb),public.disconnect_google_calendar(uuid),public.guard_google_calendar_booking(),public.enqueue_google_calendar_booking(),public.claim_google_calendar_jobs(uuid,integer),public.finish_google_calendar_job(uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.claim_google_calendar_oauth(text),public.finish_google_calendar_connection(uuid,uuid,text,text,text,jsonb),public.disconnect_google_calendar(uuid),public.claim_google_calendar_jobs(uuid,integer),public.finish_google_calendar_job(uuid,uuid,uuid,bigint,text) to service_role;
-- Aggregate in SQL so a REST row cap cannot hide pending updates on old accounts.
create function public.google_calendar_sync_status(p_user_id uuid) returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('pending',count(*),'syncFailed',coalesce(bool_or(last_error is not null),false))
  from public.google_calendar_jobs where user_id=p_user_id and revision>completed_revision;
$$;
revoke all on function public.google_calendar_sync_status(uuid) from public,anon,authenticated;
grant execute on function public.google_calendar_sync_status(uuid) to service_role;

-- Do not discard a pending cancellation update or an active Google write when
-- deleting an account. Explicit disconnect remains available if access is lost.
alter function public.begin_account_deletion(uuid) rename to begin_account_deletion_before_google_calendar;
create function public.begin_account_deletion(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  perform 1 from public.google_calendar_connections where user_id=p_user_id for update;
  if exists(select from public.google_calendar_jobs where user_id=p_user_id and (revision>completed_revision or lease_until>now())) then
    raise exception 'CALENDAR_SYNC_PENDING';
  end if;
  perform public.begin_account_deletion_before_google_calendar(p_user_id);
end $$;
revoke all on function public.begin_account_deletion_before_google_calendar(uuid) from public,anon,authenticated,service_role;
revoke all on function public.begin_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;
notify pgrst,'reload schema';
commit;
