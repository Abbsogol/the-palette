-- DISPOSABLE REHEARSAL ONLY. Not a production migration or installer.
-- Match production metadata observed read-only on 15 October 2026. The
-- historical public schema + empty-beta managed export have these differences.
revoke all on public.client_health_notes,public.client_booking_notes from anon;
revoke truncate,references,trigger on public.profiles from anon,authenticated;
revoke truncate,references,trigger,maintain on storage.buckets,storage.buckets_analytics,storage.objects from anon,authenticated;
-- Empty-beta export contains this unregistered event-trigger helper; original
-- production does not. All release migrations enable their RLS explicitly.
drop function public.rls_auto_enable();
alter default privileges for role supabase_admin in schema public grant all on sequences to postgres,anon,authenticated,service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to postgres,anon,authenticated,service_role;
alter default privileges for role supabase_admin in schema public grant all on tables to postgres,anon,authenticated,service_role;
