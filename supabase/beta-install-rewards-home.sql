-- ONLY isolated LaQue beta atjwbdrvgljddedtwoqo. No prize activation or balance changes.
begin;
do $guard$ begin
 if not exists(select from public.admin_staff s join auth.users u on u.id=s.user_id
 where s.user_id='a92d4175-0da7-463a-a58e-7f067d5057e9' and s.role='owner' and s.active and u.email_confirmed_at is not null)
 then raise exception 'Expected verified beta Owner missing. Check the project.'; end if;
 if to_regprocedure('public.rewards_member_read(uuid,text,uuid,integer,uuid)') is null
 then raise exception 'Install Rewards migration 038 first.'; end if;
end $guard$;
do $install$ begin
 if not exists(select from supabase_migrations.schema_migrations where version='202610090039') then
 execute $migration$
-- Home discovery reuses competition visibility; no new entry or activation rules.
create function public.rewards_home_entries(p_user uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb; country text;
begin
 if p_user is null or p_offset<0 or p_offset>100000 or public.account_is_closed(p_user)
 or not exists(select from auth.users where id=p_user and email_confirmed_at is not null)
 then raise exception 'VERIFIED_ACCOUNT_REQUIRED'; end if;
 select country_code into country from public.profiles_data where id=p_user;
 select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id),'[]') into items from(
  select e.id,e.design_id,e.user_id,e.snapshot,e.created_at,p.display_name,p.username,
   (select count(*)::integer from public.reward_votes v where v.entry_id=e.id and not public.account_is_closed(v.user_id) and not public.account_is_suspended(v.user_id)) votes,
   exists(select from public.reward_votes v where v.entry_id=e.id and v.user_id=p_user) liked,
   (select rank from public.reward_results r where r.entry_id=e.id) rank,
   (select votes from public.reward_results r where r.entry_id=e.id) final_votes,
   jsonb_build_object('id',c.id,'title',c.title,'prize_label',c.prize_label,'status',c.status,'opens_at',c.opens_at,'votes_close_at',c.votes_close_at) campaign
  from public.reward_entries e join public.reward_campaigns c on c.id=e.campaign_id join public.profiles_data p on p.id=e.user_id
  where c.status in('published','paused','results') and c.reviewed_at is not null and c.opens_at<=now()
   and public.reward_country_matches(c.country_codes,p_user) and public.reward_entry_visible(e.id,p_user)
  order by e.created_at desc,e.id offset p_offset limit 26
 ) n;
 return jsonb_build_object('items',items,'country',country,'enabled',(select activation_enabled from public.reward_settings));
end $$;
revoke all on function public.rewards_home_entries(uuid,integer) from public,anon,authenticated;
grant execute on function public.rewards_home_entries(uuid,integer) to service_role;

$migration$;
 insert into supabase_migrations.schema_migrations(version,name,statements) values('202610090039','rewards_home_feed',array[]::text[]);
 end if;
end $install$;
select 'beta competition Home feed ready (039)' result,activation_enabled as prize_competitions_active from public.reward_settings;
commit;
