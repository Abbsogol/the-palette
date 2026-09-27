begin;
alter table public.messages add column design_id uuid references public.designs(id) on delete set null, add column image_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mobile-uploads','mobile-uploads',false,8388608,array['image/webp'])
  on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/webp'];
create function public.can_read_mobile_image(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select split_part(p_name,'/',1)=auth.uid()::text or exists(
    select from public.messages m join public.conversations c on c.id=m.conversation_id
      where m.image_path=p_name and auth.uid() in (c.client_id,c.creator_id));
$$;
create policy "Private mobile image access" on storage.objects for select to authenticated using(bucket_id='mobile-uploads' and public.can_read_mobile_image(name));
-- Only the validating upload API can create these objects. Existing policies
-- for other buckets must not make this new bucket publicly writable/readable.
create policy "Restrict mobile image access" on storage.objects as restrictive for select to anon,authenticated
  using(bucket_id<>'mobile-uploads' or public.can_read_mobile_image(name));
create policy "Restrict mobile uploads to API" on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'mobile-uploads');
create policy "Restrict mobile file changes to API" on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'mobile-uploads');
create policy "Restrict mobile file deletion to API" on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'mobile-uploads');
create function public.validate_mobile_message() returns trigger
language plpgsql set search_path='' as $$
begin
  if current_user in ('postgres','service_role') then return new; end if;
  if length(new.content)>4000 then raise exception 'MESSAGE_TOO_LONG'; end if;
  if new.design_id is not null and not exists(select from public.designs where id=new.design_id and is_published) then raise exception 'SHARED_DESIGN_UNAVAILABLE'; end if;
  if new.image_path is not null and (
    new.image_path not like auth.uid()::text||'/messages/'||new.conversation_id::text||'/%'
    or not exists(select from storage.objects where bucket_id='mobile-uploads' and name=new.image_path)
  ) then raise exception 'SHARED_IMAGE_UNAVAILABLE'; end if;
  return new;
end $$;
create trigger validate_mobile_message before insert on public.messages for each row execute function public.validate_mobile_message();

-- Account cleanup discovers byte ownership for this bucket as well.
alter function public.account_storage_objects(uuid) rename to account_storage_objects_before_mobile;
create function public.account_storage_objects(p_user_id uuid) returns table(bucket_id text,name text)
language sql stable security definer set search_path='' as $$
  select * from public.account_storage_objects_before_mobile(p_user_id)
  union all select o.bucket_id,o.name from storage.objects o where o.bucket_id='mobile-uploads' and split_part(o.name,'/',1)=p_user_id::text limit 500;
$$;
revoke all on function public.can_read_mobile_image(text),public.validate_mobile_message(),public.account_storage_objects(uuid) from public,anon,authenticated;
grant execute on function public.can_read_mobile_image(text) to anon,authenticated;
revoke all on function public.account_storage_objects_before_mobile(uuid) from public,anon,authenticated,service_role;
grant execute on function public.account_storage_objects(uuid) to service_role;
notify pgrst,'reload schema';
commit;
