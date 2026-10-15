-- Metadata only; no application rows or database mutations.
-- Save the JSON result privately; inspect it before sharing.
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
'captured_at', now(),
'version', current_setting('server_version'),
'relations', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT n.nspname AS schema_name,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m','S') ORDER BY 1,2) x),
'columns', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity,identity_generation FROM information_schema.columns WHERE table_schema IN ('public','storage') ORDER BY 1,2,4) x),
'policies', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname) x),
'constraints', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT n.nspname AS schema_name,c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid,true) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY 1,2,3) x),
'indexes', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname) x),
'functions', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT n.nspname AS schema_name,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef AS security_definer,p.proconfig,p.proacl,pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY 1,2,3) x),
'views', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM pg_views WHERE schemaname='public' ORDER BY viewname) x),
'enums', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT n.nspname AS schema_name,t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' ORDER BY 1,2,4) x),
'grants', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM information_schema.table_privileges WHERE table_schema IN ('public','storage') ORDER BY table_schema,table_name,grantee,privilege_type) x),
'routine_grants', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM information_schema.routine_privileges WHERE routine_schema='public' ORDER BY routine_name,grantee,privilege_type) x),
'triggers', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT n.nspname AS schema_name,c.relname,t.tgname,pg_get_triggerdef(t.oid,true) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') AND NOT t.tgisinternal ORDER BY 1,2,3) x),
'extensions', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT extname,extversion FROM pg_extension ORDER BY extname) x),
'publications', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM pg_publication_tables WHERE schemaname='public' ORDER BY pubname,tablename) x)
) AS catalog;
ROLLBACK;
