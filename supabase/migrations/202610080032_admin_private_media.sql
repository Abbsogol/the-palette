-- Published private-bucket design bytes use the same RLS as their design rows.
-- No service-definer audience shortcut: drafts, privacy, blocks, moderation,
-- suspension and deletion are evaluated with the requesting viewer's identity.
create or replace function public.can_read_design_object(p_bucket text,p_path text)
returns boolean language sql stable security invoker set search_path='' as $$
 select p_bucket in('mobile-uploads','nail-lab') and exists(
  select from public.designs d
  where split_part(p_path,'/',1)=d.created_by::text
   and (split_part(d.image_url,'/storage/v1/object/public/'||p_bucket||'/',2)=p_path
    or exists(select from public.design_images i where i.design_id=d.id
     and split_part(i.image_url,'/storage/v1/object/public/'||p_bucket||'/',2)=p_path))
 );
$$;
revoke all on function public.can_read_design_object(text,text) from public;
grant execute on function public.can_read_design_object(text,text) to anon,authenticated;
alter policy "Shared design bytes" on storage.objects to anon,authenticated;
