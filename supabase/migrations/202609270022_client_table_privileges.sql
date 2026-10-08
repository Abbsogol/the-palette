-- Row-level security does not restrict TRUNCATE, REFERENCES, TRIGGER or MAINTAIN.
-- Client roles need only the row operations already granted by earlier migrations.
begin;
revoke truncate, references, trigger, maintain on all tables in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from public, anon, authenticated;
-- Storage is managed by Supabase; preserve its row/API permissions while removing
-- table administration privileges from end-user roles on the object catalog.
revoke truncate, references, trigger, maintain on storage.objects from public, anon, authenticated;
commit;
