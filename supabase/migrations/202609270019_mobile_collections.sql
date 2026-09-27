begin;
-- Preserve one association before enforcing idempotent adds. Duplicate rows
-- contain no independent user content.
delete from public.collection_designs a using public.collection_designs b
  where a.collection_id=b.collection_id and a.design_id=b.design_id and a.id>b.id;
alter table public.collection_designs add constraint collection_designs_collection_design_key unique(collection_id,design_id);
alter table public.collection_designs drop constraint collection_designs_collection_id_fkey;
alter table public.collection_designs add constraint collection_designs_collection_id_fkey foreign key(collection_id) references public.collections(id) on delete cascade;
create policy "Require visible collection design" on public.collection_designs as restrictive for insert to authenticated
  with check(exists(select from public.designs d where d.id=design_id));
notify pgrst,'reload schema';
commit;
