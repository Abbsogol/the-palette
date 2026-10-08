-- LaQue is members-only. Keep authenticated RLS and service operations unchanged.
-- Revoke PUBLIC as well as anon: PUBLIC privileges are inherited by every role.
begin;
do $$
declare r record; c record; v_role text; v_priv text;
begin
  for r in select oid, oid::regclass as relation from pg_class
    where relnamespace='public'::regnamespace and relkind in ('r','p','v','m','f')
  loop
    -- Preserve existing effective permissions, never grant private raw columns.
    foreach v_role in array array['authenticated','service_role'] loop
      foreach v_priv in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
        if has_table_privilege(v_role,r.oid,v_priv) then
          execute format('grant %s on table %s to %I',v_priv,r.relation,v_role);
        end if;
      end loop;
      for c in select attname,attnum from pg_attribute
        where attrelid=r.oid and attnum>0 and not attisdropped and attacl is not null
      loop
        foreach v_priv in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
          if not has_table_privilege(v_role,r.oid,v_priv)
             and has_column_privilege(v_role,r.oid,c.attnum,v_priv) then
            execute format('grant %s (%I) on table %s to %I',v_priv,c.attname,r.relation,v_role);
          end if;
        end loop;
      end loop;
    end loop;
    execute format('revoke all on table %s from public,anon',r.relation);
    -- Table REVOKE does not remove legacy column-level grants (profiles_data.id).
    for c in select attname from pg_attribute
      where attrelid=r.oid and attnum>0 and not attisdropped and attacl is not null
    loop
      execute format('revoke all (%I) on table %s from public,anon',c.attname,r.relation);
    end loop;
  end loop;
  for r in select oid,oid::regprocedure as routine from pg_proc
    where pronamespace='public'::regnamespace and prokind='f'
  loop
    foreach v_role in array array['authenticated','service_role'] loop
      if has_function_privilege(v_role,r.oid,'EXECUTE') then
        execute format('grant execute on function %s to %I',r.routine,v_role);
      end if;
    end loop;
    execute format('revoke all on function %s from public,anon',r.routine);
  end loop;
  for r in select oid,oid::regclass as relation from pg_class
    where relnamespace='public'::regnamespace and relkind='S'
  loop
    foreach v_role in array array['authenticated','service_role'] loop
      foreach v_priv in array array['SELECT','UPDATE','USAGE'] loop
        if has_sequence_privilege(v_role,r.oid,v_priv) then
          execute format('grant %s on sequence %s to %I',v_priv,r.relation,v_role);
        end if;
      end loop;
    end loop;
    execute format('revoke all on sequence %s from public,anon',r.relation);
  end loop;
end $$;
-- Future migrations must explicitly grant their intended client permissions.
alter default privileges for role postgres in schema public revoke all on tables from public,anon;
alter default privileges for role postgres in schema public revoke all on sequences from public,anon;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon;
-- Deny new private media access without a session. Existing public-bucket URLs
-- and previously issued signed URLs cannot be recalled by a database policy.
drop policy if exists "LaQue media requires membership" on storage.objects;
create policy "LaQue media requires membership" on storage.objects
  as restrictive for all to anon using(false) with check(false);
notify pgrst, 'reload schema';
commit;
