-- First-party, opt-in screen analytics. No text, media, IP or device identifiers.
create table public.app_analytics_preferences (
 user_id uuid primary key references public.profiles_data(id) on delete cascade,
 enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table public.app_analytics_events (
 id uuid primary key, user_id uuid not null references public.profiles_data(id) on delete cascade,
 session_id uuid not null, screen text not null check(screen in('home','search','lab','messages','favorites','profile','design','booking','stories','updates','other')),
 platform text not null check(platform in('ios','android','web')), created_at timestamptz not null default now()
);
create index app_analytics_window on public.app_analytics_events(created_at,user_id);
create index app_analytics_user_window on public.app_analytics_events(user_id,created_at);
alter table public.app_analytics_preferences enable row level security;
alter table public.app_analytics_events enable row level security;
revoke all on public.app_analytics_preferences,public.app_analytics_events from public,anon,authenticated;
grant all on public.app_analytics_preferences,public.app_analytics_events to service_role;
create function public.app_analytics_record(p_user uuid,p_id uuid,p_session uuid,p_screen text,p_platform text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles_data where id=p_user and deletion_started_at is null for share;
 if not found or public.account_is_suspended(p_user) then return false; end if;
 perform 1 from public.app_analytics_preferences where user_id=p_user and enabled for update;
 if not found then return false; end if;
 if p_screen not in('home','search','lab','messages','favorites','profile','design','booking','stories','updates','other') or p_platform not in('ios','android','web') then raise exception 'INVALID_ANALYTICS_EVENT'; end if;
 if exists(select from public.app_analytics_events where id=p_id) then return false; end if;
 if (select count(*) from public.app_analytics_events where user_id=p_user and created_at>now()-interval '1 minute')>=30
 or(select count(*) from public.app_analytics_events where user_id=p_user and created_at>now()-interval '1 day')>=500 then return false; end if;
 insert into public.app_analytics_events(id,user_id,session_id,screen,platform) values(p_id,p_user,p_session,p_screen,p_platform) on conflict(id) do nothing;
 return found;
end $$;
create function public.app_analytics_preference(p_user uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles_data where id=p_user and deletion_started_at is null for share;
 if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 insert into public.app_analytics_preferences(user_id,enabled) values(p_user,p_enabled)
 on conflict(user_id) do update set enabled=excluded.enabled,updated_at=now();
 if not p_enabled then delete from public.app_analytics_events where user_id=p_user; end if;
end $$;
create function public.erase_account_analytics() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deletion_started_at is not null then
  delete from public.app_analytics_events where user_id=new.id;
  delete from public.app_analytics_preferences where user_id=new.id;
 end if;
 return new;
end $$;
create trigger erase_account_analytics after update of deletion_started_at on public.profiles_data for each row execute function public.erase_account_analytics();
create function public.prune_app_analytics() returns void language sql security definer set search_path='' as $$
 delete from public.app_analytics_events where created_at<now()-interval '30 days';
$$;
-- Current role is checked again at the aggregate boundary. No per-user data leaves it.
create function public.admin_analytics_overview(p_actor uuid,p_days integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare staff_role text; since timestamptz; today date:=(now() at time zone 'Asia/Dubai')::date; result jsonb; part jsonb;
begin
 if p_days not in(7,30) then raise exception 'INVALID_RANGE'; end if;
 select role into staff_role from public.admin_staff where user_id=p_actor and active;
 if staff_role is null or public.account_is_closed(p_actor) or public.account_is_suspended(p_actor) then raise exception 'ADMIN_FORBIDDEN'; end if;
 since:=(today-(p_days-1))::timestamp at time zone 'Asia/Dubai';
 perform public.prune_app_analytics();
 -- Exclude closed accounts, staff (including acceptance fixtures) and reserved test domains.
 -- IDs stay inside this service-only query.
 with eligible as (select p.id from public.profiles_data p where p.deletion_started_at is null
  and not exists(select from public.admin_staff s where s.user_id=p.id)
  and not exists(select from auth.users u where u.id=p.id and u.email like '%.example'))
 select case when staff_role='moderator' then jsonb_build_object(
  'designs',(select count(*) from public.designs where created_by in(select id from eligible)),
  'openReports',(select count(*) from public.mobile_reports where status='open' and reporter_id in(select id from eligible)))
 when staff_role='support' then jsonb_build_object(
  'users',(select count(*) from eligible),
  'bookings',(select count(*) from public.bookings where client_id in(select id from eligible)),
  'labProcessing',(select count(*) from public.generation_reservations where status='reserved' and user_id in(select id from eligible)))
 else jsonb_build_object(
  'users',(select count(*) from eligible),
  'creators',(select count(*) from public.profiles_data where account_type='creator' and id in(select id from eligible)),
  'designs',(select count(*) from public.designs where created_by in(select id from eligible)),
  'bookings',(select count(*) from public.bookings where client_id in(select id from eligible)),
  'openReports',(select count(*) from public.mobile_reports where status='open' and reporter_id in(select id from eligible)),
  'labProcessing',(select count(*) from public.generation_reservations where status='reserved' and user_id in(select id from eligible))) end into part;
 result:=jsonb_build_object('counts',part,'days',p_days,'timezone','Asia/Dubai','generatedAt',now(),'since',since);
 with eligible as (select p.id from public.profiles_data p where p.deletion_started_at is null and not exists(select from public.admin_staff s where s.user_id=p.id) and not exists(select from auth.users u where u.id=p.id and u.email like '%.example')),
 activity as (
  select created_at as at,'users' as metric from public.profiles_data where staff_role<>'moderator' and id in(select id from eligible) and created_at>=since
  union all select created_at,'designs' from public.designs where staff_role<>'support' and created_by in(select id from eligible) and created_at>=since
  union all select created_at,'bookings' from public.bookings where staff_role<>'moderator' and client_id in(select id from eligible) and created_at>=since
  union all select created_at,'lab' from public.generation_reservations where staff_role<>'moderator' and user_id in(select id from eligible) and created_at>=since
  union all select created_at,'reports' from public.mobile_reports where staff_role<>'support' and reporter_id in(select id from eligible) and created_at>=since
 ), summed as(select (at at time zone 'Asia/Dubai')::date as day,metric,count(*) n from activity group by 1,2),
 days as(select generate_series(today-(p_days-1),today,interval '1 day')::date as day),
 rows as(select d.day,case when staff_role='moderator' then jsonb_build_object('date',d.day,'designs',coalesce(sum(n) filter(where metric='designs'),0),'reports',coalesce(sum(n) filter(where metric='reports'),0))
 when staff_role='support' then jsonb_build_object('date',d.day,'users',coalesce(sum(n) filter(where metric='users'),0),'bookings',coalesce(sum(n) filter(where metric='bookings'),0),'lab',coalesce(sum(n) filter(where metric='lab'),0))
 else jsonb_build_object('date',d.day,'users',coalesce(sum(n) filter(where metric='users'),0),'designs',coalesce(sum(n) filter(where metric='designs'),0),'bookings',coalesce(sum(n) filter(where metric='bookings'),0),'lab',coalesce(sum(n) filter(where metric='lab'),0)) end as item
 from days d left join summed s on d.day=s.day group by d.day)
 select coalesce(jsonb_agg(item order by day),'[]') into part from rows;
 result:=result||jsonb_build_object('trend',part);
 if staff_role in('owner','support') then
  with eligible as(select p.id from public.profiles_data p where p.deletion_started_at is null and not exists(select from public.admin_staff s where s.user_id=p.id) and not exists(select from auth.users u where u.id=p.id and u.email like '%.example'))
  select jsonb_build_object('bookings',coalesce((select jsonb_agg(jsonb_build_object('label',status,'value',n)) from(select coalesce(status,'unknown') status,count(*) n from public.bookings where created_at>=since and client_id in(select id from eligible) group by 1 order by 1)b),'[]'),
  'lab',coalesce((select jsonb_agg(jsonb_build_object('label',status,'value',n)) from(select status,count(*) n from public.generation_reservations where created_at>=since and user_id in(select id from eligible) group by 1 order by 1)g),'[]'),
  'setup',jsonb_build_object('joined',(select count(*) from public.profiles_data where id in(select id from eligible) and created_at>=since),'completed',(select count(*) from public.profiles_data where id in(select id from eligible) and created_at>=since and onboarding_complete))) into part;
  result:=result||jsonb_build_object('operations',part);
 end if;
 if staff_role in('owner','moderator') then
  with eligible as(select p.id from public.profiles_data p where p.deletion_started_at is null and not exists(select from public.admin_staff s where s.user_id=p.id) and not exists(select from auth.users u where u.id=p.id and u.email like '%.example'))
  select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',n)),'[]') into part from(select case when is_published then 'published' else 'draft' end label,count(*) n from public.designs where created_at>=since and created_by in(select id from eligible) group by 1 order by 1)q;
  result:=result||jsonb_build_object('content',part);
 end if;
 if staff_role='owner' then
  with eligible as(select p.id from public.profiles_data p where p.deletion_started_at is null and not exists(select from public.admin_staff s where s.user_id=p.id) and not exists(select from auth.users u where u.id=p.id and u.email like '%.example')),
  e as(select * from public.app_analytics_events where created_at>=since and user_id in(select id from eligible)),
  returning_users as(select user_id from e group by user_id having count(distinct (created_at at time zone 'Asia/Dubai')::date)>1),
  days as(select generate_series(today-(p_days-1),today,interval '1 day')::date as day),
  daily as(select d.day,count(distinct e.user_id) as users,count(e.id) as views from days d left join e on (e.created_at at time zone 'Asia/Dubai')::date=d.day group by d.day)
  select jsonb_build_object('trackedUsers',(select count(distinct user_id) from e),'sessions',(select count(distinct (user_id,session_id)) from e),'views',(select count(*) from e),
   'returningUsers',(select count(*) from returning_users),'trackingSince',(select min(created_at) from public.app_analytics_events where user_id in(select id from eligible)),
   'screens',coalesce((select jsonb_agg(jsonb_build_object('label',screen,'value',n,'users',users) order by n desc,screen) from(select screen,count(*) n,count(distinct user_id) users from e group by screen)s),'[]'),
   'platforms',coalesce((select jsonb_agg(jsonb_build_object('label',platform,'value',n) order by n desc,platform) from(select platform,count(distinct (user_id,session_id)) n from e group by platform)p),'[]'),
   'daily',(select jsonb_agg(jsonb_build_object('date',day,'users',users,'views',views) order by day) from daily),
   'actions',jsonb_build_array(
    jsonb_build_object('label','Saved designs','value',(select count(*) from public.saved_designs where saved_at>=since and user_id in(select id from eligible))),
    jsonb_build_object('label','Creator follows','value',(select count(*) from public.follows where created_at>=since and follower_id in(select id from eligible))),
    jsonb_build_object('label','Published designs','value',(select count(*) from public.designs where created_at>=since and is_published and created_by in(select id from eligible))),
    jsonb_build_object('label','Booking requests','value',(select count(*) from public.bookings where created_at>=since and client_id in(select id from eligible))),
    jsonb_build_object('label','Lab requests','value',(select count(*) from public.generation_reservations where created_at>=since and user_id in(select id from eligible))))) into part;
  result:=result||jsonb_build_object('behavior',part);
 end if;
 return result;
end $$;
revoke all on function public.app_analytics_record(uuid,uuid,uuid,text,text),public.app_analytics_preference(uuid,boolean),public.erase_account_analytics(),public.prune_app_analytics(),public.admin_analytics_overview(uuid,integer) from public,anon,authenticated;
grant execute on function public.app_analytics_record(uuid,uuid,uuid,text,text),public.app_analytics_preference(uuid,boolean),public.prune_app_analytics(),public.admin_analytics_overview(uuid,integer) to service_role;
