begin;
alter table public.profiles_data add column banner_url text, add column age_confirmed_at timestamptz, add column privacy_accepted_at timestamptz, add column privacy_policy_version text;
-- Append only the public banner to the existing masked profile projection.
do $$ declare definition text; begin
 select pg_get_viewdef('public.profiles'::regclass,true) into definition;
 definition:=regexp_replace(definition,';\s*$','');
 execute 'create or replace view public.profiles with(security_barrier=true) as select visible.*, media.banner_url from ('||definition||') visible join public.profiles_data media on media.id=visible.id';
end $$;
create function public.manage_profile_media() returns trigger language plpgsql security definer set search_path='' as $$
declare value text; old_value text; media_path text; slot text; job public.mobile_media_cleanup;
begin
 if public.account_is_closed(new.id) then new.banner_url:=null; end if;
 foreach slot in array array['avatar_url','banner_url'] loop
  value:=to_jsonb(new)->>slot;
  old_value:=case when tg_op='UPDATE' then to_jsonb(old)->>slot else null end;
  if value is distinct from old_value then
   if value like '%/storage/v1/object/public/designs/%' then
    media_path:=split_part(value,'/storage/v1/object/public/designs/',2);
    if split_part(media_path,'/',2)<>new.id::text or split_part(media_path,'/',1)<>(case when slot='avatar_url' then 'avatars' else 'banners' end) then raise exception 'PROFILE_MEDIA_OWNER_REQUIRED'; end if;
    insert into public.mobile_media_cleanup(bucket,path,user_id) values('designs',media_path,new.id) on conflict do nothing;
    select * into job from public.mobile_media_cleanup where bucket='designs' and mobile_media_cleanup.path=media_path for update;
    if job.user_id is distinct from new.id or job.state='deleting' or not exists(select from storage.objects where bucket_id='designs' and name=media_path) then raise exception 'PROFILE_MEDIA_UNAVAILABLE'; end if;
    update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket='designs' and mobile_media_cleanup.path=media_path;
   end if;
   if old_value is not null then
    update public.mobile_media_cleanup set state='pending',run_after=now()+interval '1 minute' where user_id=new.id and old_value like '%/storage/v1/object/public/'||bucket||'/'||mobile_media_cleanup.path;
   end if;
  end if;
 end loop;
 return new;
end $$;
create trigger manage_profile_media before insert or update on public.profiles_data for each row execute function public.manage_profile_media();
revoke all on function public.manage_profile_media() from public,anon,authenticated,service_role;
create or replace function public.claim_mobile_media_cleanup() returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.mobile_media_cleanup; result jsonb:='[]'; token uuid;
begin
 update public.mobile_media_cleanup q set state='pending',run_after=now() where q.bucket='social-media' and q.state='linked' and exists(select from public.stories s where s.media_path=q.path and s.created_at<=now()-interval '24 hours');
 for job in select * from public.mobile_media_cleanup where state in('pending','deleting') and run_after<=now() and(claim_until is null or claim_until<now()) order by run_after limit 20 for update skip locked loop
  if exists(select from public.designs where image_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path) or exists(select from public.design_images where image_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path)
   or exists(select from public.profiles_data where avatar_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path or banner_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path)
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

alter function public.account_storage_objects(uuid) rename to account_storage_objects_before_banners;
create function public.account_storage_objects(p_user_id uuid) returns table(bucket_id text,name text) language sql stable security definer set search_path='' as $$
 select * from public.account_storage_objects_before_banners(p_user_id) union all select o.bucket_id,o.name from storage.objects o where o.bucket_id='designs' and starts_with(o.name,'banners/'||p_user_id::text||'/') limit 500;
$$;
revoke all on function public.account_storage_objects_before_banners(uuid) from public,anon,authenticated,service_role;
revoke all on function public.account_storage_objects(uuid), public.claim_mobile_media_cleanup() from public,anon,authenticated;
grant execute on function public.account_storage_objects(uuid), public.claim_mobile_media_cleanup() to service_role;

-- 18+ is the product eligibility policy, not identity/age verification.
-- Only the authenticated server path may record the user's explicit attestation.
alter function public.complete_onboarding(uuid,jsonb) rename to complete_onboarding_before_age_policy;
create function public.complete_onboarding(p_user_id uuid,p_fields jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare prof public.profiles_data; result boolean;
begin
 select * into prof from public.profiles_data where id=p_user_id for update;
 if not found then raise no_data_found; end if;
 if public.account_is_closed(p_user_id) then raise exception 'ACCOUNT_CLOSED'; end if;
 if prof.onboarding_complete then return false; end if;
 if p_fields->'age_confirmed' is distinct from 'true'::jsonb or p_fields->'privacy_accepted' is distinct from 'true'::jsonb then raise exception 'AGE_AND_PRIVACY_CONFIRMATION_REQUIRED'; end if;
 result:=public.complete_onboarding_before_age_policy(p_user_id,p_fields);
 update public.profiles_data set age_confirmed_at=now(),privacy_accepted_at=now(),privacy_policy_version='2026-09-29' where id=p_user_id;
 return result;
end $$;
revoke all on function public.complete_onboarding_before_age_policy(uuid,jsonb), public.complete_onboarding(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.complete_onboarding_before_age_policy(uuid,jsonb) from service_role;
grant execute on function public.complete_onboarding(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
