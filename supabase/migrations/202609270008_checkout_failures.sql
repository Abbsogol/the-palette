begin;
create table public.checkout_failures (
  session_id text primary key,
  user_id uuid not null references public.profiles_data(id) on delete cascade,
  kind text not null check(kind in ('credits','boost','deposit')),
  status text not null check(status in ('failed','expired')),
  target_id uuid,
  created_at timestamptz not null default now()
);
alter table public.checkout_failures enable row level security;
revoke all on public.checkout_failures from public,anon,authenticated;
grant all on public.checkout_failures to service_role;

create function public.close_failed_checkout(p_session_id text,p_user_id uuid,p_kind text,p_status text,p_attempt_id uuid default null,p_target_id uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_session_id is null or p_session_id='' or p_kind not in ('credits','boost','deposit') or p_status not in ('failed','expired') or (p_kind='deposit' and p_target_id is null) then
    raise exception 'INVALID_CHECKOUT_FAILURE';
  end if;
  perform 1 from public.profiles_data where id=p_user_id for update;
  if not found then return false; end if;
  -- A stale failure must never reverse a recorded payment or release a newer
  -- checkout. Stripe's current session is also checked by the webhook route.
  if exists(select from public.credit_payments where session_id=p_session_id and fulfilled)
    or exists(select from public.order_payments where session_id=p_session_id and fulfilled) then return false; end if;
  insert into public.checkout_failures(session_id,user_id,kind,status,target_id) values(p_session_id,p_user_id,p_kind,p_status,p_target_id) on conflict do nothing;
  if not exists(select from public.checkout_failures where session_id=p_session_id and user_id=p_user_id and kind=p_kind and target_id is not distinct from p_target_id) then
    raise exception 'CHECKOUT_IDENTITY_MISMATCH';
  end if;
  if p_kind='deposit' then
    delete from public.deposit_checkouts where user_id=p_user_id
      and (session_id=p_session_id or (session_id is null and id=p_attempt_id));
  else
    delete from public.payment_checkouts where user_id=p_user_id
      and (session_id=p_session_id or (session_id is null and id=p_attempt_id));
  end if;
  return true;
end $$;
revoke all on function public.close_failed_checkout(text,uuid,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.close_failed_checkout(text,uuid,text,text,uuid,uuid) to service_role;
commit;
