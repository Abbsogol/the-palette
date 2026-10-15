begin;

-- Signups may return a user without a session until email is confirmed. Carry
-- only the same unprivileged choices accepted by set-account-type into creation.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles_data(id,display_name,account_type)
  values (new.id,left(trim(new.raw_user_meta_data->>'display_name'),100),
    case when new.raw_user_meta_data->>'account_type' in ('user','creator','salon')
      then new.raw_user_meta_data->>'account_type' else 'user' end);
  return new;
end $$;

-- Membership confers read access, not owner powers or access to private designs.
-- The membership SELECT policy does not query boards, so this is nonrecursive.
create policy "Invited members read boards" on public.moodboards for select to authenticated
using (exists(select from public.moodboard_members m where m.moodboard_id=moodboards.id and m.user_id=auth.uid()));
create policy "Invited members read board designs" on public.moodboard_designs for select to authenticated
using (exists(select from public.moodboard_members m where m.moodboard_id=moodboard_designs.moodboard_id and m.user_id=auth.uid()));
create policy "Board entries require visible designs" on public.moodboard_designs as restrictive for select to anon,authenticated
using (exists(select from public.designs d where d.id=design_id));

-- A request id represents ONE user intent, including across lost responses.
-- A lease bounds credit holds after process termination. Completion and release
-- serialize under profile -> reservation locks, matching deletion/reservation.
alter table public.generation_reservations add column request_hash text;
alter table public.generation_reservations add column expires_at timestamptz;
update public.generation_reservations set expires_at=created_at+interval '2 minutes' where status='reserved';
alter table public.generation_reservations alter column expires_at set default now()+interval '2 minutes';

create or replace function public.release_generation(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.generation_reservations; account_id uuid;
begin
  select user_id into account_id from public.generation_reservations where id=p_id;
  perform 1 from public.profiles_data where id=account_id for update;
  select * into r from public.generation_reservations where id=p_id for update;
  if not found or r.status<>'reserved' then return false; end if;
  if r.parent_generation_id is null then
    update public.profiles_data set credit_balance=coalesce(credit_balance,0)+1 where id=r.user_id;
  else
    update public.nail_lab_generations set free_regen_used=false where id=r.parent_generation_id and user_id=r.user_id;
  end if;
  update public.generation_reservations set status='released' where id=p_id;
  return true;
end $$;

create function public.recover_generations(p_user_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare r record; recovered integer:=0;
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  for r in select id from public.generation_reservations where user_id=p_user_id and status='reserved' and expires_at<=now() loop
    if public.release_generation(r.id) then recovered:=recovered+1; end if;
  end loop;
  return recovered;
end $$;

create function public.claim_generation(p_id uuid,p_user_id uuid,p_parent_id uuid,p_hash text) returns text
language plpgsql security definer set search_path='' as $$
declare r public.generation_reservations;
begin
  if p_id is null or p_hash is null or length(p_hash)<>64 then raise exception 'INVALID_GENERATION_INTENT'; end if;
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then return 'unavailable'; end if;
  perform public.recover_generations(p_user_id);
  select * into r from public.generation_reservations where id=p_id for update;
  if found then
    if r.user_id<>p_user_id or r.request_hash is distinct from p_hash or r.parent_generation_id is distinct from p_parent_id then return 'conflict'; end if;
    return r.status;
  end if;
  if not public.reserve_generation(p_id,p_user_id,p_parent_id) then return 'insufficient'; end if;
  update public.generation_reservations set request_hash=p_hash where id=p_id;
  return 'claimed';
end $$;

create or replace function public.complete_generation(p_id uuid,p_generation jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.generation_reservations; g public.nail_lab_generations; account_id uuid;
begin
  select user_id into account_id from public.generation_reservations where id=p_id;
  perform 1 from public.profiles_data where id=account_id for update;
  select * into r from public.generation_reservations where id=p_id for update;
  if not found or r.status='released' then raise exception 'Reservation unavailable'; end if;
  if r.status='completed' then return r.id; end if;
  if r.expires_at<=now() then raise exception 'Reservation expired'; end if;
  g:=jsonb_populate_record(null::public.nail_lab_generations,p_generation);
  insert into public.nail_lab_generations
    (id,user_id,image_url,vibe,shape,length,colors,occasion,custom_text,prompt_used,reference_image_urls,credits_used,parent_generation_id)
  values (r.id,r.user_id,g.image_url,g.vibe,g.shape,g.length,g.colors,g.occasion,g.custom_text,g.prompt_used,'{}',
    case when r.parent_generation_id is null then 1 else 0 end,r.parent_generation_id);
  update public.generation_reservations set status='completed' where id=p_id;
  return r.id;
end $$;

-- Recovery is also part of deletion, so an abandoned generation cannot block it
-- forever. Existing billing and active-generation guards continue to apply.
alter function public.begin_account_deletion(uuid) rename to begin_account_deletion_before_generation_recovery;
create function public.begin_account_deletion(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.recover_generations(p_user_id);
  perform public.begin_account_deletion_before_generation_recovery(p_user_id);
end $$;
revoke all on function public.begin_account_deletion_before_generation_recovery(uuid) from public,anon,authenticated,service_role;

-- Claim, two in-app notifications, and durable email jobs commit together.
create table public.reminder_emails (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  other_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_role text not null check(recipient_role in ('client','creator')),
  status text not null default 'pending' check(status in ('pending','sent','skipped','needs_review')),
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  payload jsonb,
  lease_until timestamptz,
  claim_token uuid,
  retry_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(booking_id,user_id)
);
alter table public.reminder_emails enable row level security;
revoke all on public.reminder_emails from public,anon,authenticated;
grant all on public.reminder_emails to service_role;

create function public.enqueue_booking_reminders(p_date date) returns integer
language plpgsql security definer set search_path='' as $$
declare b public.bookings; total integer:=0;
begin
  for b in select * from public.bookings where booking_date=p_date and status='confirmed' and reminder_sent_at is null
    order by id for update skip locked loop
    insert into public.notifications(user_id,actor_id,type)
    values(b.client_id,b.creator_id,'appointment_reminder'),(b.creator_id,b.client_id,'appointment_reminder');
    insert into public.reminder_emails(booking_id,user_id,other_user_id,recipient_role)
    values(b.id,b.client_id,b.creator_id,'client'),(b.id,b.creator_id,b.client_id,'creator') on conflict do nothing;
    update public.bookings set reminder_sent_at=now() where id=b.id;
    total:=total+1;
  end loop;
  return total;
end $$;

create function public.claim_reminder_emails(p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  -- Do not replay an ambiguous email beyond the provider's idempotency window.
  update public.reminder_emails set status='needs_review'
    where status='pending' and first_attempt_at<now()-interval '23 hours';
  update public.reminder_emails r set status='skipped' from public.bookings b
    where r.booking_id=b.id and r.status='pending' and (b.status<>'confirmed' or b.booking_date<=(now() at time zone 'UTC')::date)
      and (r.lease_until is null or r.lease_until<now());
  with ready as (
    select id from public.reminder_emails where status='pending' and retry_at<=now() and (lease_until is null or lease_until<now())
    order by created_at,id limit least(greatest(p_limit,1),50) for update skip locked
  ), claimed as (
    update public.reminder_emails r set lease_until=now()+interval '2 minutes',claim_token=gen_random_uuid(),first_attempt_at=coalesce(first_attempt_at,now())
    from ready where r.id=ready.id returning r.*
  ) select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('booking_date',b.booking_date,'start_time',b.start_time,'service_name',s.name)),'[]')
    into result from claimed c join public.bookings b on b.id=c.booking_id left join public.services s on s.id=b.service_id;
  return result;
end $$;

create function public.prepare_reminder_email(p_id uuid,p_token uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  update public.reminder_emails set payload=coalesce(payload,p_payload)
    where id=p_id and claim_token=p_token and status='pending' and lease_until>now()
    returning payload into result;
  return result;
end $$;

create function public.finish_reminder_email(p_id uuid,p_token uuid,p_status text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('pending','sent','skipped') then raise exception 'INVALID_EMAIL_STATUS'; end if;
  update public.reminder_emails set status=p_status,lease_until=null,claim_token=null,retry_at=now()+interval '5 minutes',
    sent_at=case when p_status='sent' then now() else sent_at end
    where id=p_id and claim_token=p_token and status='pending';
  return found;
end $$;

revoke all on function public.recover_generations(uuid),public.claim_generation(uuid,uuid,uuid,text),public.begin_account_deletion(uuid),
  public.enqueue_booking_reminders(date),public.claim_reminder_emails(integer),public.prepare_reminder_email(uuid,uuid,jsonb),public.finish_reminder_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.recover_generations(uuid),public.claim_generation(uuid,uuid,uuid,text),public.begin_account_deletion(uuid),
  public.enqueue_booking_reminders(date),public.claim_reminder_emails(integer),public.prepare_reminder_email(uuid,uuid,jsonb),public.finish_reminder_email(uuid,uuid,text) to service_role;
commit;
