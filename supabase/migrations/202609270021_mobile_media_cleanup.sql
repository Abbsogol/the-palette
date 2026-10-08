begin;
create table public.mobile_media_cleanup (
  bucket text not null check(bucket in ('designs','mobile-uploads')),path text not null,user_id uuid not null,
  state text not null default 'pending' check(state in ('pending','linked','deleting')),run_after timestamptz not null default now()+interval '1 day',
  claim_token uuid,claim_until timestamptz,primary key(bucket,path)
);
alter table public.mobile_media_cleanup enable row level security;
revoke all on public.mobile_media_cleanup from public,anon,authenticated;
grant all on public.mobile_media_cleanup to service_role;
create function public.manage_mobile_design_image() returns trigger
language plpgsql security definer set search_path='' as $$
declare job public.mobile_media_cleanup;
begin
  if tg_op<>'DELETE' then
    select * into job from public.mobile_media_cleanup where user_id=new.created_by
      and new.image_url like '%/storage/v1/object/public/'||bucket||'/'||path for update;
    if found then
      if job.state='deleting' then raise exception 'IMAGE_UPLOAD_EXPIRED'; end if;
      if not exists(select from storage.objects where bucket_id=job.bucket and name=job.path) then raise exception 'IMAGE_UPLOAD_UNAVAILABLE'; end if;
      update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket=job.bucket and path=job.path;
    end if;
  end if;
  if tg_op='DELETE' or (tg_op='UPDATE' and new.image_url is distinct from old.image_url) then
    update public.mobile_media_cleanup set state='pending',run_after=now()+interval '1 minute'
      where user_id=old.created_by and old.image_url like '%/storage/v1/object/public/'||bucket||'/'||path;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger manage_mobile_design_image before insert or update of image_url or delete on public.designs for each row execute function public.manage_mobile_design_image();
-- Taking the same queue lock as the cleaner prevents attaching a photo
-- between the cleaner's reference check and its Storage deletion.
create function public.manage_mobile_message_image() returns trigger
language plpgsql security definer set search_path='' as $$
declare job public.mobile_media_cleanup;
begin
  if new.image_path is null then return new; end if;
  select * into job from public.mobile_media_cleanup where bucket='mobile-uploads' and path=new.image_path for update;
  if found then
    if job.state='deleting' then raise exception 'IMAGE_UPLOAD_EXPIRED'; end if;
    if job.user_id is distinct from new.sender_id then raise exception 'IMAGE_OWNER_MISMATCH'; end if;
    update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket=job.bucket and path=job.path;
  end if;
  return new;
end $$;
create trigger manage_mobile_message_image before insert on public.messages for each row execute function public.manage_mobile_message_image();
revoke all on function public.manage_mobile_message_image() from public,anon,authenticated;
create function public.claim_mobile_media_cleanup() returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.mobile_media_cleanup; result jsonb:='[]'; token uuid;
begin
  for job in select * from public.mobile_media_cleanup where state in ('pending','deleting') and run_after<=now()
    and (claim_until is null or claim_until<now()) order by run_after limit 20 for update skip locked loop
    if exists(select from public.designs where image_url like '%/storage/v1/object/public/'||job.bucket||'/'||job.path)
      or (job.bucket='mobile-uploads' and exists(select from public.messages where image_path=job.path)) then
      update public.mobile_media_cleanup set state='linked',claim_token=null,claim_until=null where bucket=job.bucket and path=job.path;
    else
      token:=gen_random_uuid();
      update public.mobile_media_cleanup set state='deleting',claim_token=token,claim_until=now()+interval '2 minutes' where bucket=job.bucket and path=job.path;
      result:=result||jsonb_build_array(jsonb_build_object('bucket',job.bucket,'path',job.path,'token',token));
    end if;
  end loop;
  return result;
end $$;
create function public.finish_mobile_media_cleanup(p_bucket text,p_path text,p_token uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_success then delete from public.mobile_media_cleanup where bucket=p_bucket and path=p_path and claim_token=p_token;
  else update public.mobile_media_cleanup set claim_token=null,claim_until=null,run_after=now()+interval '5 minutes' where bucket=p_bucket and path=p_path and claim_token=p_token; end if;
end $$;
revoke all on function public.manage_mobile_design_image(),public.claim_mobile_media_cleanup(),public.finish_mobile_media_cleanup(text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_mobile_media_cleanup(),public.finish_mobile_media_cleanup(text,text,uuid,boolean) to service_role;
notify pgrst,'reload schema';
commit;
