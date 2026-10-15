begin;
create table public.pinterest_connection (
 singleton boolean primary key default true check(singleton), access_cipher text, refresh_cipher text,
 expires_at timestamptz, refresh_expires_at timestamptz, account_name text, connected_by uuid,
 status text not null default 'disconnected' check(status in('connected','disconnected','reconnect')),
 paused boolean not null default true, version integer not null default 1, lease_token uuid, lease_until timestamptz
);
insert into public.pinterest_connection(singleton) values(true);
create table public.pinterest_boards (
 topic text primary key check(topic in('minimal','halloween')), board_id text not null check(board_id~'^[0-9]{1,30}$'),
 label text not null check(length(label) between 1 and 80), active boolean not null default false,
 verified_at timestamptz, connection_version integer
);
insert into public.pinterest_boards(topic,board_id,label) values('minimal','1107604170798182011','Minimal'),('halloween','1107604170798182008','Halloween');
create table public.pinterest_oauth_attempts (
 state_hash text primary key, owner_id uuid not null, browser_hash text not null,
 connection_version integer not null, reason text not null, expires_at timestamptz not null,
 consumed_at timestamptz
);
do $$ declare t text;begin
 foreach t in array array['pinterest_connection','pinterest_boards','pinterest_oauth_attempts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create function public.pinterest_admin_change(p_actor uuid,p_action text,p_reason text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v integer; st text; attempt public.pinterest_oauth_attempts;
begin
 perform 1 from public.admin_staff where user_id=p_actor and active and role='owner' for update;
 if not found or public.account_is_closed(p_actor) or public.account_is_suspended(p_actor) then raise exception 'ADMIN_FORBIDDEN'; end if;
 if length(trim(p_reason)) not between 5 and 1000 then raise exception 'REASON_REQUIRED'; end if;
 select version,status into v,st from public.pinterest_connection where singleton for update;
 case p_action
 when 'start' then
  delete from public.pinterest_oauth_attempts where expires_at<now()-interval '1 day';
  insert into public.pinterest_oauth_attempts(state_hash,owner_id,browser_hash,connection_version,reason,expires_at) values(p_data->>'stateHash',p_actor,p_data->>'browserHash',v,p_reason,now()+interval '10 minutes');
 when 'complete' then
  select * into attempt from public.pinterest_oauth_attempts where state_hash=p_data->>'stateHash' and owner_id=p_actor and consumed_at is not null for update;
  if not found or attempt.expires_at<now() or attempt.connection_version<>v then raise exception 'OAUTH_EXPIRED'; end if;
  update public.pinterest_connection set access_cipher=p_data->>'access',refresh_cipher=p_data->>'refresh',expires_at=(p_data->>'expires')::timestamptz,
   refresh_expires_at=(p_data->>'refreshExpires')::timestamptz,account_name=p_data->>'account',connected_by=p_actor,status='connected',paused=true,version=version+1,lease_token=null,lease_until=null where singleton;
  delete from public.pinterest_oauth_attempts where state_hash=attempt.state_hash;
  update public.pinterest_boards set active=false,verified_at=null;
 when 'disconnect' then
  update public.pinterest_connection set access_cipher=null,refresh_cipher=null,expires_at=null,refresh_expires_at=null,account_name=null,connected_by=null,status='disconnected',paused=true,version=version+1,lease_token=null,lease_until=null where singleton;
  delete from public.pinterest_oauth_attempts;
  update public.pinterest_boards set active=false,verified_at=null;
 when 'pause' then update public.pinterest_connection set paused=(p_data->>'paused')::boolean where singleton;
 when 'board' then
  if st<>'connected' or v<>(p_data->>'version')::integer then raise exception 'EDIT_CONFLICT'; end if;
  update public.pinterest_boards set board_id=p_data->>'boardId',label=p_data->>'label',active=(p_data->>'active')::boolean,
   verified_at=case when (p_data->>'active')::boolean then now() else null end,connection_version=v where topic=p_data->>'topic';
  if not found then raise exception 'INVALID_BOARD'; end if;
 else raise exception 'INVALID_ACTION';end case;
 insert into public.admin_actions(actor_id,actor_role,action,reason,details) values(p_actor,'owner','pinterest-'||p_action,p_reason,p_data-'access'-'refresh'-'stateHash'-'browserHash');
 return jsonb_build_object('ok',true);
end $$;
create function public.claim_pinterest_oauth(p_state text,p_browser text,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.pinterest_oauth_attempts;
begin
 update public.pinterest_oauth_attempts set consumed_at=now() where state_hash=p_state and browser_hash=p_browser and owner_id=p_owner and consumed_at is null and expires_at>now() returning * into a;
 if not found then return null;end if;return jsonb_build_object('reason',a.reason,'version',a.connection_version);
end $$;
create function public.claim_pinterest_refresh() returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();begin
 update public.pinterest_connection set lease_token=token,lease_until=now()+interval '30 seconds' where singleton and status='connected' and(lease_until is null or lease_until<now()) and expires_at<now()+interval '5 minutes';
 if not found then return null;end if;return token;
end $$;
create function public.finish_pinterest_refresh(p_lease uuid,p_data jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_data->>'status'='reconnect' then
 update public.pinterest_connection set status='reconnect',access_cipher=null,refresh_cipher=null,lease_token=null,lease_until=null where singleton and lease_token=p_lease;
 elsif p_data->>'status'='retry' then
 update public.pinterest_connection set lease_token=null,lease_until=now()+interval '30 seconds' where singleton and lease_token=p_lease;
 else
 update public.pinterest_connection set access_cipher=p_data->>'access',refresh_cipher=p_data->>'refresh',expires_at=(p_data->>'expires')::timestamptz,refresh_expires_at=(p_data->>'refreshExpires')::timestamptz,lease_token=null,lease_until=null where singleton and lease_token=p_lease;
 end if;return found;
end $$;
revoke all on function public.pinterest_admin_change(uuid,text,text,jsonb),public.claim_pinterest_oauth(text,text,uuid),public.claim_pinterest_refresh(),public.finish_pinterest_refresh(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.pinterest_admin_change(uuid,text,text,jsonb),public.claim_pinterest_oauth(text,text,uuid),public.claim_pinterest_refresh(),public.finish_pinterest_refresh(uuid,jsonb) to service_role;
commit;
