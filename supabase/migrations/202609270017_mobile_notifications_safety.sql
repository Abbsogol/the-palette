begin;
create table public.mobile_push_registrations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles_data(id) on delete cascade,
  installation_id uuid not null, token text not null unique check(length(token)<=250), platform text not null check(platform in ('ios','android')),
  enabled boolean not null default true, expires_at timestamptz not null default now()+interval '24 hours',
  unique(user_id,installation_id)
);
create table public.mobile_notification_outbox (
  id uuid primary key default gen_random_uuid(), registration_id uuid not null references public.mobile_push_registrations(id) on delete cascade,
  user_id uuid not null references public.profiles_data(id) on delete cascade, kind text not null check(kind in ('message','booking')),
  target_id uuid not null, event_key text not null, status text not null default 'pending' check(status in ('pending','receipt','delivered','failed','skipped')),
  attempts integer not null default 0, retry_at timestamptz not null default now(), ticket_id text,
  claim_token uuid, claim_until timestamptz, last_error text, created_at timestamptz not null default now(),
  unique(registration_id,event_key)
);
create table public.hidden_conversations (
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  hidden_at timestamptz not null default now(), primary key(user_id,conversation_id)
);
create table public.mobile_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid references public.profiles_data(id) on delete set null,
  target_type text not null check(target_type in ('profile','design','message')), target_id uuid not null,
  reason text not null check(length(reason) between 3 and 2000), status text not null default 'open' check(status in ('open','reviewed','resolved')),
  created_at timestamptz not null default now(), unique(reporter_id,target_type,target_id)
);
alter table public.mobile_push_registrations enable row level security;
alter table public.mobile_notification_outbox enable row level security;
alter table public.hidden_conversations enable row level security;
alter table public.mobile_reports enable row level security;
revoke all on public.mobile_push_registrations,public.mobile_notification_outbox,public.hidden_conversations,public.mobile_reports from public,anon,authenticated;
grant all on public.mobile_push_registrations,public.mobile_notification_outbox,public.hidden_conversations,public.mobile_reports to service_role;
grant select,insert,delete on public.hidden_conversations to authenticated;
create policy "Own hidden conversation state" on public.hidden_conversations for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select from public.conversations c where c.id=conversation_id and auth.uid() in (c.client_id,c.creator_id)));
grant select on public.mobile_reports to authenticated;
create policy "Reports visible to reporter and administrators" on public.mobile_reports for select to authenticated
  using(reporter_id=auth.uid() or exists(select from public.profiles_data p where p.id=auth.uid() and p.is_admin));

create function public.register_mobile_push(p_user_id uuid,p_installation uuid,p_token text,p_platform text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' or length(p_token)>250 or p_platform not in ('ios','android') then raise exception 'INVALID_PUSH_TOKEN'; end if;
  -- Token transfer drops old queued deliveries rather than reassigning them.
  delete from public.mobile_push_registrations where (token=p_token or installation_id=p_installation) and user_id<>p_user_id;
  insert into public.mobile_push_registrations(user_id,installation_id,token,platform)
    values(p_user_id,p_installation,p_token,p_platform)
    on conflict(user_id,installation_id) do update set token=excluded.token,platform=excluded.platform,enabled=true,expires_at=now()+interval '24 hours'
    returning id into result;
  return result;
end $$;
create function public.enqueue_mobile_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; actor uuid; kind text; target uuid; event text;
begin
  if tg_table_name='messages' then
    select case when client_id=new.sender_id then creator_id else client_id end into recipient from public.conversations where id=new.conversation_id;
    actor:=new.sender_id;kind:='message';target:=new.conversation_id;event:='message:'||new.id;
    delete from public.hidden_conversations where conversation_id=target and user_id=recipient;
  else
    if tg_op='UPDATE' and new.status=old.status then return null; end if;
    kind:='booking';target:=new.id;event:='booking:'||new.id||':'||new.status;
    if tg_op='INSERT' then actor:=new.client_id;recipient:=new.creator_id;
    else actor:=coalesce(auth.uid(),new.creator_id);recipient:=case when actor=new.client_id then new.creator_id else new.client_id end; end if;
  end if;
  if recipient is null or exists(select from public.blocks where (blocker_id=actor and blocked_id=recipient) or (blocker_id=recipient and blocked_id=actor)) then return null; end if;
  insert into public.mobile_notification_outbox(registration_id,user_id,kind,target_id,event_key)
    select id,user_id,kind,target,event from public.mobile_push_registrations where user_id=recipient and enabled and expires_at>now() on conflict do nothing;
  return null;
end $$;
create trigger mobile_message_notification after insert on public.messages for each row execute function public.enqueue_mobile_activity();
create trigger mobile_booking_notification after insert or update of status on public.bookings for each row execute function public.enqueue_mobile_activity();

create function public.claim_mobile_notifications(p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  update public.mobile_notification_outbox o set status='skipped' from public.mobile_push_registrations r
    where o.registration_id=r.id and o.status in ('pending','receipt') and (not r.enabled or r.user_id<>o.user_id or r.expires_at<=now());
  with ready as (
    select o.id from public.mobile_notification_outbox o join public.mobile_push_registrations r on r.id=o.registration_id
      where o.status in ('pending','receipt') and o.retry_at<=now() and (o.claim_until is null or o.claim_until<now())
        and r.enabled and r.user_id=o.user_id and r.expires_at>now()
      order by o.created_at limit least(greatest(p_limit,1),50) for update of o skip locked
  ), claimed as (
    update public.mobile_notification_outbox o set claim_token=gen_random_uuid(),claim_until=now()+interval '2 minutes',attempts=attempts+1
      from ready where o.id=ready.id returning o.*
  ) select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('token',r.token)),'[]') into result
    from claimed c join public.mobile_push_registrations r on r.id=c.registration_id;
  return result;
end $$;
create function public.finish_mobile_notification(p_id uuid,p_claim uuid,p_status text,p_ticket text default null,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('pending','receipt','delivered','failed','skipped') then raise exception 'INVALID_DELIVERY_STATUS'; end if;
  update public.mobile_notification_outbox set status=case when attempts>=12 and p_status in ('pending','receipt') then 'failed' else p_status end,
    ticket_id=coalesce(p_ticket,ticket_id),last_error=left(p_error,500),claim_token=null,claim_until=null,
    retry_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer))
    where id=p_id and claim_token=p_claim and claim_until>now();
  return found;
end $$;

revoke all on function public.register_mobile_push(uuid,uuid,text,text),public.enqueue_mobile_activity(),public.claim_mobile_notifications(integer),public.finish_mobile_notification(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.register_mobile_push(uuid,uuid,text,text),public.claim_mobile_notifications(integer),public.finish_mobile_notification(uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
