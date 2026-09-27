-- Rehearse on the isolated, catalog-matched schema before production rollout.
-- Compatible with the preceding entitlement migration. No customer data export.
begin;

revoke create on schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Existing definitions use unqualified names; only the protected public schema
-- precedes pg_temp. Newly defined functions below qualify all application names.
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'decrement_comments','decrement_credits','decrement_credits_by','decrement_likes','decrement_saves',
      'delete_own_account','design_visible_to_viewer','enforce_no_blocked_messaging',
      'enforce_weekly_upload_limit','handle_new_user','increment_comments','increment_credits',
      'increment_likes','increment_saves','prevent_self_vote','profiles_view_insert','profiles_view_update',
      'protect_privileged_profile_columns','reject_entry_if_challenge_ended','tech_has_upcoming_booking')
  loop execute format('alter function %s set search_path = public, pg_temp',f); end loop;
end $$;

create or replace function public.increment_credits(user_id uuid, amount integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if amount is null or amount <= 0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;
  update public.profiles_data set credit_balance=coalesce(credit_balance,0)+amount where id=user_id;
end $$;
revoke all on function public.increment_credits(uuid,integer), public.decrement_credits(uuid), public.decrement_credits_by(uuid,integer) from public, anon, authenticated;
grant execute on function public.increment_credits(uuid,integer), public.decrement_credits(uuid), public.decrement_credits_by(uuid,integer) to service_role;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated, service_role;

-- Browser profile mutations already use allowlisted authenticated API routes.
-- Keep the masked definer view: security_invoker would expose/break its contract.
revoke insert, update, delete, truncate, references, trigger on public.profiles, public.profiles_data from public, anon, authenticated;
alter view public.profiles set (security_barrier=true);
-- Generation provenance, retry claims and credit usage are service-owned facts.
revoke insert, update, delete, truncate, references, trigger on public.nail_lab_generations from public, anon, authenticated;

-- Participants may update read receipts and mute preferences, never identity/content.
revoke update on public.conversations, public.messages, public.notifications from public, anon, authenticated;
grant update(muted_by) on public.conversations to authenticated;
grant update(is_read) on public.messages to authenticated;
grant update(read) on public.notifications to authenticated;
create or replace function public.guard_message_updates() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('postgres','service_role') then return new; end if;
  if tg_table_name='messages' then
    if new.sender_id=auth.uid() then raise exception 'ONLY_RECIPIENT_CAN_MARK_READ'; end if;
  else
    if array_remove(new.muted_by,auth.uid()) is distinct from array_remove(old.muted_by,auth.uid()) then
      raise exception 'CANNOT_CHANGE_OTHER_USER_MUTE';
    end if;
  end if;
  return new;
end $$;
create trigger guard_message_updates before update on public.messages for each row execute function public.guard_message_updates();
create trigger guard_conversation_updates before update on public.conversations for each row execute function public.guard_message_updates();

create or replace function public.enforce_no_blocked_messaging() returns trigger
language plpgsql security definer set search_path='' as $$
declare other_id uuid; permission text;
begin
  select case when c.client_id=new.sender_id then c.creator_id else c.client_id end into other_id
    from public.conversations c where c.id=new.conversation_id and new.sender_id in (c.client_id,c.creator_id);
  if other_id is null then raise exception 'INVALID_CONVERSATION_SENDER'; end if;
  if exists(select from public.blocks where (blocker_id=new.sender_id and blocked_id=other_id) or (blocker_id=other_id and blocked_id=new.sender_id)) then
    raise exception 'BLOCKED_CANNOT_MESSAGE';
  end if;
  select message_permission into permission from public.profiles_data where id=other_id;
  if permission='none' or (permission='followers' and not exists(select from public.follows where follower_id=new.sender_id and following_id=other_id)) then
    raise exception 'MESSAGING_NOT_ALLOWED';
  end if;
  new.is_read:=false;
  return new;
end $$;

create or replace function public.guard_booking_fields() returns trigger language plpgsql set search_path='' as $$
declare duration integer;
begin
  if current_user in ('postgres','service_role') then return new; end if;
  if tg_op='INSERT' then
    if new.client_id is distinct from auth.uid() or new.creator_id=new.client_id or
       new.status is distinct from 'pending' or coalesce(new.deposit_paid,false) or
       new.stripe_payment_intent is not null or new.reminder_sent_at is not null then
      raise exception 'INVALID_BOOKING_FIELDS';
    end if;
    select duration_minutes into duration from public.services where id=new.service_id and creator_id=new.creator_id and is_active=true;
    if duration is null or duration<=0 or new.end_time<=new.start_time or
       extract(epoch from (new.end_time-new.start_time))/60 <> duration then raise exception 'INVALID_BOOKING_SERVICE'; end if;
  else
    if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then raise exception 'BOOKING_FIELDS_ARE_IMMUTABLE'; end if;
    if new.status is distinct from old.status then
      if auth.uid()=old.client_id and old.status in ('pending','confirmed') and new.status='cancelled' then return new; end if;
      if auth.uid()=old.creator_id and old.status='pending' and new.status in ('confirmed','declined') then return new; end if;
      raise exception 'INVALID_BOOKING_TRANSITION';
    end if;
  end if;
  return new;
end $$;
create trigger guard_booking_fields before insert or update on public.bookings for each row execute function public.guard_booking_fields();

-- Existing permissive checks only proved invited_by == caller.
create policy "Require actual board ownership for invitations" on public.moodboard_members as restrictive for insert to authenticated
with check (invited_by=auth.uid() and exists(select from public.moodboards b where b.id=moodboard_id and b.user_id=auth.uid()));

-- RLS on a parent does not protect its child tables automatically. Restrictive
-- checks also constrain the existing owner ALL policies and future permissive ones.
do $$ declare t text; begin
  foreach t in array array['design_images','design_colours','design_tags','design_products','design_comments','design_likes'] loop
    execute format('create policy "Require visible parent design" on public.%I as restrictive for select to anon, authenticated using (exists(select from public.designs d where d.id=design_id))',t);
  end loop;
  foreach t in array array['design_comments','design_likes','saved_designs','moodboard_designs'] loop
    execute format('create policy "Require visible design on insert" on public.%I as restrictive for insert to authenticated with check (exists(select from public.designs d where d.id=design_id))',t);
  end loop;
end $$;
-- A like cannot be moved between designs to bypass insert checks or counters.
revoke update on public.design_likes from public, anon, authenticated;

create or replace function public.guard_design_fields() returns trigger language plpgsql set search_path='' as $$
declare admin boolean;
begin
  if current_user in ('postgres','service_role') then return new; end if;
  select coalesce(is_admin,false) into admin from public.profiles where id=auth.uid();
  if tg_op='INSERT' then
    if not coalesce(admin,false) and not exists(select from public.profiles where id=auth.uid() and account_type in ('creator','salon')) then raise exception 'CREATOR_ACCOUNT_REQUIRED'; end if;
    if coalesce(new.saves_count,0)<>0 or coalesce(new.likes_count,0)<>0 or coalesce(new.comments_count,0)<>0 or new.boosted_until is not null or new.source_generation_id is not null then
      raise exception 'SERVER_MANAGED_DESIGN_FIELDS';
    end if;
    if not coalesce(admin,false) and (coalesce(new.is_curated,false) or coalesce(new.is_drop,false)) then raise exception 'ADMIN_ONLY_DESIGN_FIELDS'; end if;
  else
    if row(new.id,new.created_by,new.created_at,new.boosted_until,new.source_generation_id,new.saves_count,new.likes_count,new.comments_count)
       is distinct from row(old.id,old.created_by,old.created_at,old.boosted_until,old.source_generation_id,old.saves_count,old.likes_count,old.comments_count) then
      raise exception 'SERVER_MANAGED_DESIGN_FIELDS';
    end if;
    if not coalesce(admin,false) and row(new.is_curated,new.is_drop) is distinct from row(old.is_curated,old.is_drop) then raise exception 'ADMIN_ONLY_DESIGN_FIELDS'; end if;
  end if;
  return new;
end $$;
create trigger guard_design_fields before insert or update on public.designs for each row execute function public.guard_design_fields();

-- Counters are effects of a real row mutation, never a browser-supplied delta.
create or replace function public.track_design_engagement() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; delta integer;
begin
  if tg_op='INSERT' then target:=new.design_id; delta:=1; else target:=old.design_id; delta:=-1; end if;
  if tg_table_name='design_likes' then update public.designs set likes_count=greatest(coalesce(likes_count,0)+delta,0) where id=target;
  elsif tg_table_name='saved_designs' then update public.designs set saves_count=greatest(coalesce(saves_count,0)+delta,0) where id=target;
  else update public.designs set comments_count=greatest(coalesce(comments_count,0)+delta,0) where id=target; end if;
  return null;
end $$;
create trigger track_design_likes after insert or delete on public.design_likes for each row execute function public.track_design_engagement();
create trigger track_design_saves after insert or delete on public.saved_designs for each row execute function public.track_design_engagement();
create trigger track_design_comments after insert or delete on public.design_comments for each row execute function public.track_design_engagement();
revoke all on function public.increment_likes(uuid),public.decrement_likes(uuid),public.increment_saves(uuid),public.decrement_saves(uuid),public.increment_comments(uuid),public.decrement_comments(uuid) from public,anon,authenticated,service_role;
-- Lock tables during initial reconciliation so concurrent engagement cannot be lost.
lock table public.designs,public.design_likes,public.saved_designs,public.design_comments in share row exclusive mode;
update public.designs d set likes_count=(select count(*) from public.design_likes where design_id=d.id),
 saves_count=(select count(*) from public.saved_designs where design_id=d.id),
 comments_count=(select count(*) from public.design_comments where design_id=d.id);

-- Quota accounting now belongs to the insertion transaction; the browser can
-- neither reset the profile counter nor omit/replay a finalize request to evade it.
create or replace function public.enforce_weekly_upload_limit() returns trigger
language plpgsql security definer set search_path='' as $$
declare prof public.profiles_data; used integer;
begin
  if new.created_by is null or new.source_generation_id is not null then return new; end if;
  select * into prof from public.profiles_data where id=new.created_by for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if prof.is_admin then return new; end if;
  used:=case when prof.week_reset_at is null or prof.week_reset_at<now()-interval '7 days' then 0 else coalesce(prof.weekly_uploads,0) end;
  if prof.subscription_tier is distinct from 'pro_creator' and used>=5 then raise exception 'WEEKLY_UPLOAD_LIMIT'; end if;
  update public.profiles_data set weekly_uploads=used+1,
    week_reset_at=case when prof.week_reset_at is null or prof.week_reset_at<now()-interval '7 days' then now() else prof.week_reset_at end
    where id=new.created_by;
  return new;
end $$;

-- Notifications are trusted effects of the underlying action. Browser clients
-- cannot forge appointment messages or arbitrary actor/recipient combinations.
revoke insert on public.notifications from public,anon,authenticated;
create or replace function public.notify_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; actor uuid; kind text; target uuid; preview text;
begin
  if tg_table_name in ('design_likes','design_comments') then
    select created_by into recipient from public.designs where id=new.design_id;
    actor:=new.user_id; target:=new.design_id;
    if tg_table_name='design_likes' then kind:='like'; else kind:='comment'; preview:=left(new.body,80); end if;
  elsif tg_table_name='follows' then recipient:=new.following_id; actor:=new.follower_id; kind:='follow';
  elsif tg_table_name='messages' then
    select case when client_id=new.sender_id then creator_id else client_id end into recipient from public.conversations where id=new.conversation_id;
    actor:=new.sender_id; kind:='new_message';
    update public.conversations set last_message_at=new.created_at where id=new.conversation_id;
  elsif tg_table_name='moodboard_members' then recipient:=new.user_id; actor:=new.invited_by; kind:='moodboard_invite';
  elsif tg_table_name='bookings' then
    if tg_op='INSERT' then recipient:=new.creator_id; actor:=new.client_id; kind:='booking_request';
    elsif new.status is distinct from old.status and new.status in ('confirmed','declined') then
      recipient:=new.client_id; actor:=new.creator_id; kind:='booking_'||new.status;
    else return null; end if;
  end if;
  if recipient is not null and recipient<>actor then
    insert into public.notifications(user_id,actor_id,type,design_id,comment_preview) values(recipient,actor,kind,target,preview);
  end if;
  return null;
end $$;
create trigger notify_design_like after insert on public.design_likes for each row execute function public.notify_activity();
create trigger notify_design_comment after insert on public.design_comments for each row execute function public.notify_activity();
create trigger notify_follow after insert on public.follows for each row execute function public.notify_activity();
create trigger notify_message after insert on public.messages for each row execute function public.notify_activity();
create trigger notify_board_invitation after insert on public.moodboard_members for each row execute function public.notify_activity();
create trigger notify_booking after insert or update on public.bookings for each row execute function public.notify_activity();

-- Immutable review identity; the client must actually own the appointment.
revoke update on public.reviews from public,anon,authenticated;
grant update(rating,text) on public.reviews to authenticated;
create policy "Require completed own appointment for review" on public.reviews as restrictive for insert to authenticated
with check (exists(select from public.bookings b where b.id=booking_id and b.client_id=auth.uid()
  and b.creator_id=reviews.creator_id and b.status='confirmed' and b.booking_date<current_date));

-- Trigger functions need no direct API EXECUTE grant. PostgreSQL triggers retain
-- their ability to execute them; clients cannot use them as exposed RPCs.
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype='trigger'::regtype
  loop execute format('revoke all on function %s from public, anon, authenticated',f); end loop;
end $$;
notify pgrst, 'reload schema';
commit;
