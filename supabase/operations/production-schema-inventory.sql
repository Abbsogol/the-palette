-- READ ONLY. Run in the ORIGINAL production project's SQL editor, not beta.
-- Schema definitions only: no application rows, email addresses, tokens,
-- password hashes or function bodies are returned. Save the result privately.
select jsonb_build_object(
  'captured_at', current_timestamp,
  'database_version', current_setting('server_version'),
  'migration_history_present', to_regclass('supabase_migrations.schema_migrations') is not null,
  'extensions', (select jsonb_agg(jsonb_build_object('name',extname,'version',extversion) order by extname) from pg_extension),
  'relations', (select jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', c.relname, 'kind', c.relkind,
    'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
    'owner',pg_get_userbyid(c.relowner),'options',c.reloptions,
    'acl', c.relacl::text,
    'view_hash', case when c.relkind in('v','m') then md5(pg_get_viewdef(c.oid,true)) end,
    'columns', (select jsonb_agg(jsonb_build_object(
      'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'acl',a.attacl::text,
      'default_hash',md5(pg_get_expr(d.adbin,d.adrelid))) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints', (select jsonb_agg(jsonb_build_object('name',conname,'hash',md5(pg_get_constraintdef(oid,true)),'validated',convalidated) order by conname) from pg_constraint where conrelid=c.oid),
    'indexes', (select jsonb_agg(jsonb_build_object('name',ic.relname,'hash',md5(pg_get_indexdef(i.indexrelid))) order by ic.relname) from pg_index i join pg_class ic on ic.oid=i.indexrelid where i.indrelid=c.oid),
    'policies', (select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
      'roles',(select jsonb_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end order by r) from unnest(p.polroles) r),
      'using_hash',md5(pg_get_expr(p.polqual,p.polrelid)), 'check_hash',md5(pg_get_expr(p.polwithcheck,p.polrelid))) order by p.polname)
      from pg_policy p where p.polrelid=c.oid),
    'triggers', (select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'hash',md5(pg_get_triggerdef(oid,true))) order by tgname) from pg_trigger where tgrelid=c.oid and not tgisinternal)
  ) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in('public','auth','storage') and c.relkind in('r','p','v','m','S')),
  'functions', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'signature',p.oid::regprocedure::text,
    'body_hash',md5(pg_get_functiondef(p.oid)), 'owner',pg_get_userbyid(p.proowner), 'definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl::text)
    order by n.nspname,p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in('public','auth','storage') and p.prokind='f'),
  'default_privileges', (select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',coalesce(n.nspname,''),
    'type',d.defaclobjtype,'acl',d.defaclacl::text) order by pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype)
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in('public','auth','storage') or d.defaclnamespace=0),
  'publication_tables',(select jsonb_agg(jsonb_build_object('publication',pubname,'schema',schemaname,'table',tablename)
    order by pubname,schemaname,tablename) from pg_publication_tables where schemaname='public')
) as inventory;
