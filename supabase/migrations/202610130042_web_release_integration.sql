begin;

-- Retain the atomic onboarding/age/entitlement chain while saving the web
-- redesign's private health fields in the existing RLS-controlled table.
alter function public.complete_onboarding(uuid,jsonb) rename to complete_onboarding_before_web;
create function public.complete_onboarding(p_user_id uuid,p_fields jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare completed boolean;
begin
 completed:=public.complete_onboarding_before_web(p_user_id,p_fields-array['allergies','product_sensitivities','removal_needed']);
 if completed then
  update public.profiles_data set privacy_policy_version='2026-10-13' where id=p_user_id;
  insert into public.client_health_notes(user_id,allergies,product_sensitivities,removal_needed)
  values(p_user_id,nullif(p_fields->>'allergies',''),
   array(select jsonb_array_elements_text(coalesce(p_fields->'product_sensitivities','[]'::jsonb))),
   coalesce((p_fields->>'removal_needed')::boolean,false))
  on conflict(user_id) do update set allergies=excluded.allergies,product_sensitivities=excluded.product_sensitivities,removal_needed=excluded.removal_needed,updated_at=now();
 end if;
 return completed;
end $$;
revoke all on function public.complete_onboarding_before_web(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.complete_onboarding(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_onboarding(uuid,jsonb) to service_role;

-- New web hand photos use private, owner-scoped objects. Saving the stable
-- reference claims the upload; replacing/removing it releases its old object.
create function public.manage_private_hand_photo() returns trigger
language plpgsql security definer set search_path='' as $$
declare media_path text; old_path text; job public.mobile_media_cleanup;
begin
 if public.account_is_closed(new.id) then new.hand_photo_url:=null; end if;
 if tg_op='UPDATE' and new.hand_photo_url is not distinct from old.hand_photo_url then return new; end if;
 if new.hand_photo_url is not null then
  media_path:=split_part(new.hand_photo_url,'/storage/v1/object/public/mobile-uploads/',2);
  if media_path !~ ('^'||new.id::text||'/hand-photos/[a-zA-Z0-9_.-]+$') then raise exception 'PRIVATE_HAND_PHOTO_OWNER_REQUIRED'; end if;
  select * into job from public.mobile_media_cleanup where bucket='mobile-uploads' and path=media_path for update;
  if not found or job.user_id is distinct from new.id or job.state='deleting' or not exists(select from storage.objects where bucket_id='mobile-uploads' and name=media_path) then raise exception 'PRIVATE_HAND_PHOTO_UNAVAILABLE'; end if;
  update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket='mobile-uploads' and path=media_path;
 end if;
 if tg_op='UPDATE' and old.hand_photo_url is not null then
  old_path:=split_part(old.hand_photo_url,'/storage/v1/object/public/mobile-uploads/',2);
  update public.mobile_media_cleanup set state='pending',run_after=now()+interval '1 minute' where bucket='mobile-uploads' and user_id=new.id and path=old_path;
 end if;
 return new;
end $$;
create trigger manage_private_hand_photo before insert or update of hand_photo_url on public.profiles_data for each row execute function public.manage_private_hand_photo();
revoke all on function public.manage_private_hand_photo() from public,anon,authenticated,service_role;

create or replace function public.claim_mobile_media_cleanup() returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.mobile_media_cleanup; result jsonb:='[]'; token uuid;
begin
 update public.mobile_media_cleanup q set state='pending',run_after=now() where q.bucket='social-media' and q.state='linked' and exists(select from public.stories s where s.media_path=q.path and s.created_at<=now()-interval '24 hours');
 for job in select * from public.mobile_media_cleanup where state in('pending','deleting') and run_after<=now() and(claim_until is null or claim_until<now()) order by run_after limit 20 for update skip locked loop
  if exists(select from public.designs where image_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path) or exists(select from public.design_images where image_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path)
   or exists(select from public.profiles_data where avatar_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path or banner_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path or split_part(hand_photo_url,'/storage/v1/object/public/'||job.bucket||'/',2)=job.path)
   or(job.bucket='mobile-uploads' and exists(select from public.messages where image_path=job.path))
   or(job.bucket='social-media' and (exists(select from public.salon_posts where media @> jsonb_build_array(jsonb_build_object('path',job.path))) or exists(select from public.stories where media_path=job.path and created_at>now()-interval '24 hours'))) then
   update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket=job.bucket and path=job.path;
  else
   token:=gen_random_uuid(); update public.mobile_media_cleanup set state='deleting',claim_token=token,claim_until=now()+interval '2 minutes' where bucket=job.bucket and path=job.path;
   result:=result||jsonb_build_array(jsonb_build_object('bucket',job.bucket,'path',job.path,'token',token));
  end if;
 end loop;
 return result;
end $$;
revoke all on function public.claim_mobile_media_cleanup() from public,anon,authenticated;
grant execute on function public.claim_mobile_media_cleanup() to service_role;
notify pgrst,'reload schema';
commit;
