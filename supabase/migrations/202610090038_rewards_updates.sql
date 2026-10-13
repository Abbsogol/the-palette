-- Service-controlled official news and subscriber design promotions.
-- No generation grants, entry fees, referral requirements or payout execution.
begin;
alter table public.profiles_data add column country_code text check(country_code is null or country_code ~ '^[A-Z]{2}$');
create table public.official_updates (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 120),
 body text not null check(length(trim(body)) between 1 and 2200), country_codes text[] not null default '{}',
 status text not null default 'draft' check(status in('draft','published','archived')),
 version integer not null default 1, created_by uuid not null, created_at timestamptz not null default now(), published_at timestamptz
);
create table public.reward_settings(singleton boolean primary key default true check(singleton), activation_enabled boolean not null default false);
insert into public.reward_settings values(true,false);
create table public.reward_campaigns (
 id uuid primary key default gen_random_uuid(), title text not null, theme text not null, description text not null,
 prize_type text not null check(prize_type in('cash','products','gift_cards')), prize_label text not null,
 rules text not null, country_codes text[] not null default '{}',
 opens_at timestamptz not null, entries_close_at timestamptz not null, votes_close_at timestamptz not null, award_at timestamptz not null,
 winner_count integer not null default 1 check(winner_count between 1 and 10),
 status text not null default 'draft' check(status in('draft','published','paused','results','archived')),
 version integer not null default 1, review_reference text, reviewed_by uuid, reviewed_at timestamptz,
 created_by uuid not null, created_at timestamptz not null default now(), published_at timestamptz, results_at timestamptz,
 check(opens_at < entries_close_at and entries_close_at <= votes_close_at and votes_close_at <= award_at)
);
create table public.reward_entries (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.reward_campaigns(id),
 user_id uuid references public.profiles_data(id) on delete set null, design_id uuid references public.designs(id) on delete set null,
 generation_id uuid, country_code text, snapshot jsonb not null,
 disqualified boolean not null default false, disqualification_reason text,
 rules_version integer not null, created_at timestamptz not null default now(),
 unique(campaign_id,user_id,design_id), unique(campaign_id,user_id,generation_id)
);
create index on public.reward_entries(campaign_id,user_id);
create table public.reward_votes (
 entry_id uuid not null references public.reward_entries(id) on delete cascade, user_id uuid not null references public.profiles_data(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(entry_id,user_id)
);
create table public.reward_results (
 campaign_id uuid not null references public.reward_campaigns(id), entry_id uuid not null references public.reward_entries(id),
 rank integer not null, votes integer not null, published_at timestamptz not null default now(),
 primary key(campaign_id,rank), unique(campaign_id,entry_id)
);
do $$ declare t text; begin
 foreach t in array array['official_updates','reward_settings','reward_campaigns','reward_entries','reward_votes','reward_results'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function public.reward_country_valid(p_code text) returns boolean language sql immutable set search_path='' as $$
 select p_code=any(string_to_array('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',' '));
$$;
create function public.reward_country_matches(p_codes text[],p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select cardinality(p_codes)=0 or exists(select from public.profiles_data p where p.id=p_user and p.country_code=any(p_codes));
$$;
create function public.reward_entry_visible(p_entry uuid,p_viewer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.reward_entries e join public.designs d on d.id=e.design_id join public.profiles_data p on p.id=e.user_id
 where e.id=p_entry and not e.disqualified and d.created_by=e.user_id and d.is_published and not p.is_private
 and p.deletion_started_at is null and not public.account_is_suspended(p.id) and not public.admin_content_hidden('design',d.id)
 and not exists(select from public.blocks b where (b.blocker_id=p_viewer and b.blocked_id=p.id) or(b.blocked_id=p_viewer and b.blocker_id=p.id)));
$$;
-- The country is private profile information and is modified through a service API.
-- Lock country changes during participation in an unfinished round.
create function public.reward_profile_country(p_user uuid,p_country text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.reward_country_valid(p_country) then raise exception 'INVALID_COUNTRY'; end if;
 perform 1 from public.profiles_data where id=p_user and deletion_started_at is null for update;
 if not found or public.account_is_suspended(p_user) then raise exception 'REWARDS_FORBIDDEN'; end if;
 if exists(select from public.reward_entries e join public.reward_campaigns c on c.id=e.campaign_id
 where e.user_id=p_user and c.status in('published','paused') and c.votes_close_at>now())
 and exists(select from public.profiles_data where id=p_user and country_code is distinct from p_country) then raise exception 'COUNTRY_LOCKED'; end if;
 update public.profiles_data set country_code=p_country where id=p_user;
end $$;

create function public.rewards_admin_change(p_actor uuid,p_section text,p_id uuid,p_action text,p_version integer,p_reason text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare staff_role text; c public.reward_campaigns; n public.official_updates; countries text[]; changed uuid; result jsonb; row record; pos integer:=0;
begin
 if p_reason is null or length(trim(p_reason)) not between 5 and 1000 then raise exception 'REASON_REQUIRED'; end if;
 select role into staff_role from public.admin_staff where user_id=p_actor and active for update;
 if staff_role is null or staff_role not in('owner','moderator') or public.account_is_closed(p_actor) or public.account_is_suspended(p_actor) then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_section not in('updates','rewards') then raise exception 'ADMIN_FORBIDDEN'; end if;
 if p_action='save' then
  select coalesce(array_agg(value),array[]::text[]) into countries from jsonb_array_elements_text(p_data->'countryCodes');
  if cardinality(countries)>30 or exists(select from unnest(countries) code where not public.reward_country_valid(code)) then raise exception 'INVALID_COUNTRY'; end if;
  if p_section='updates' then
   if p_id is null or p_version=0 then
    insert into public.official_updates(id,title,body,country_codes,created_by) values(coalesce(p_id,gen_random_uuid()),p_data->>'title',p_data->>'body',countries,p_actor) returning * into n;
   else
    select * into n from public.official_updates where id=p_id for update;
    if not found or n.version<>p_version then raise exception 'EDIT_CONFLICT'; end if;
    if n.status<>'draft' then raise exception 'DRAFT_REQUIRED'; end if;
    update public.official_updates set title=p_data->>'title',body=p_data->>'body',country_codes=countries,version=version+1 where id=p_id returning * into n;
   end if;
   changed:=n.id; result:=to_jsonb(n);
  else
   if length(trim(p_data->>'title')) not between 1 and 120 or length(trim(p_data->>'rules')) not between 20 and 12000 then raise exception 'INVALID_CAMPAIGN'; end if;
   if p_id is null or p_version=0 then
    insert into public.reward_campaigns(id,title,theme,description,prize_type,prize_label,rules,country_codes,opens_at,entries_close_at,votes_close_at,award_at,winner_count,created_by)
    values(coalesce(p_id,gen_random_uuid()),p_data->>'title',p_data->>'theme',p_data->>'description',p_data->>'prizeType',p_data->>'prizeLabel',p_data->>'rules',countries,
      (p_data->>'opensAt')::timestamptz,(p_data->>'entriesCloseAt')::timestamptz,(p_data->>'votesCloseAt')::timestamptz,(p_data->>'awardAt')::timestamptz,(p_data->>'winnerCount')::integer,p_actor) returning * into c;
   else
    select * into c from public.reward_campaigns where id=p_id for update;
    if not found or c.version<>p_version then raise exception 'EDIT_CONFLICT'; end if;
    if c.status<>'draft' then raise exception 'DRAFT_REQUIRED'; end if;
    update public.reward_campaigns set title=p_data->>'title',theme=p_data->>'theme',description=p_data->>'description',prize_type=p_data->>'prizeType',prize_label=p_data->>'prizeLabel',rules=p_data->>'rules',country_codes=countries,
      opens_at=(p_data->>'opensAt')::timestamptz,entries_close_at=(p_data->>'entriesCloseAt')::timestamptz,votes_close_at=(p_data->>'votesCloseAt')::timestamptz,award_at=(p_data->>'awardAt')::timestamptz,winner_count=(p_data->>'winnerCount')::integer,
      version=version+1,review_reference=null,reviewed_by=null,reviewed_at=null where id=p_id returning * into c;
   end if;
   changed:=c.id; result:=to_jsonb(c);
  end if;
 else
  changed:=p_id;
  if p_section='updates' then
   select * into n from public.official_updates where id=p_id for update;
   if not found or n.version<>p_version then raise exception 'EDIT_CONFLICT'; end if;
   if p_action='publish' and n.status='draft' then
    update public.official_updates set status='published',published_at=now(),version=version+1 where id=p_id returning * into n;
   elsif p_action='archive' and n.status in('draft','published') then
    update public.official_updates set status='archived',version=version+1 where id=p_id returning * into n;
   else raise exception 'INVALID_STATE'; end if;
   result:=to_jsonb(n);
  else
   select * into c from public.reward_campaigns where id=p_id for update;
   if not found or c.version<>p_version then raise exception 'EDIT_CONFLICT'; end if;
   if p_action='review' then
    if staff_role<>'owner' or c.status<>'draft' or length(trim(p_data->>'reference')) not between 10 and 1000 then raise exception 'REVIEW_REQUIRED'; end if;
    update public.reward_campaigns set review_reference=p_data->>'reference',reviewed_at=now(),reviewed_by=p_actor,version=version+1 where id=p_id returning * into c;
   elsif p_action='publish' then
    if c.status<>'draft' or c.reviewed_at is null or not (select activation_enabled from public.reward_settings) then raise exception 'ACTIVATION_DISABLED'; end if;
    if c.entries_close_at<=now() then raise exception 'INVALID_DATES'; end if;
    update public.reward_campaigns set status='published',published_at=now(),version=version+1 where id=p_id returning * into c;
   elsif p_action='pause' and c.status='published' then
    update public.reward_campaigns set status='paused',version=version+1 where id=p_id returning * into c;
   elsif p_action='resume' and c.status='paused' then
    if not (select activation_enabled from public.reward_settings) then raise exception 'ACTIVATION_DISABLED'; end if;
    update public.reward_campaigns set status='published',version=version+1 where id=p_id returning * into c;
   elsif p_action='archive' and c.status in('draft','published','paused','results') then
    update public.reward_campaigns set status='archived',version=version+1 where id=p_id returning * into c;
   elsif p_action='disqualify' and c.status in('published','paused') then
    update public.reward_entries set disqualified=true,disqualification_reason=p_reason where campaign_id=c.id and id=(p_data->>'entryId')::uuid;
    if not found then raise exception 'ENTRY_UNAVAILABLE'; end if;
    update public.reward_campaigns set version=version+1 where id=p_id returning * into c;
   elsif p_action='restore-entry' and c.status in('published','paused') then
    update public.reward_entries set disqualified=false,disqualification_reason=null where campaign_id=c.id and id=(p_data->>'entryId')::uuid;
    if not found then raise exception 'ENTRY_UNAVAILABLE'; end if;
    update public.reward_campaigns set version=version+1 where id=p_id returning * into c;
   elsif p_action='results' then
    if staff_role<>'owner' or c.status<>'published' or c.votes_close_at>now() or c.reviewed_at is null then raise exception 'RESULTS_NOT_READY'; end if;
    -- Freeze only valid votes. Fixed tie-breaker: earlier entry, then UUID.
    -- One winning design per entrant, to spread support among freelance designers.
    for row in
     with ranked as (
      select e.id,e.user_id,e.created_at,count(v.user_id)::integer votes
      from public.reward_entries e left join public.reward_votes v on v.entry_id=e.id and not public.account_is_closed(v.user_id) and not public.account_is_suspended(v.user_id)
      where e.campaign_id=c.id and public.reward_entry_visible(e.id,e.user_id) group by e.id
     ), per_person as(select *,row_number() over(partition by user_id order by votes desc,created_at,id) person_rank from ranked)
     select * from per_person where person_rank=1 order by votes desc,created_at,id limit c.winner_count
    loop
     pos:=pos+1;
     insert into public.reward_results(campaign_id,entry_id,rank,votes) values(c.id,row.id,pos,row.votes);
    end loop;
    if pos<>c.winner_count then raise exception 'INSUFFICIENT_ELIGIBLE_ENTRIES'; end if;
    update public.reward_campaigns set status='results',results_at=now(),version=version+1 where id=p_id returning * into c;
   else raise exception 'INVALID_STATE'; end if;
   result:=to_jsonb(c);
  end if;
 end if;
 insert into public.admin_actions(actor_id,actor_role,action,target_id,reason,details)
 values(p_actor,staff_role,p_section||'-'||p_action,changed::text,p_reason,jsonb_build_object('version',result->'version','countryCodes',result->'country_codes','entryId',p_data->'entryId'));
 return result;
end $$;

create function public.rewards_member_action(p_user uuid,p_campaign uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles_data; c public.reward_campaigns; d public.designs; g public.nail_lab_generations; e public.reward_entries; n integer;
begin
 select * into p from public.profiles_data where id=p_user and deletion_started_at is null for update;
 if not found or public.account_is_suspended(p_user) or not exists(select from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'VERIFIED_ACCOUNT_REQUIRED'; end if;
 select * into c from public.reward_campaigns where id=p_campaign for update;
 if not found or c.status<>'published' or c.reviewed_at is null or not public.reward_country_matches(c.country_codes,p_user) then raise exception 'CAMPAIGN_UNAVAILABLE'; end if;
 if not (select activation_enabled from public.reward_settings) then raise exception 'ACTIVATION_DISABLED'; end if;
 if p_action='submit' then
  select * into e from public.reward_entries where campaign_id=c.id and user_id=p_user and design_id=(p_data->>'designId')::uuid;
  if found then return jsonb_build_object('entryId',e.id,'alreadySubmitted',true); end if;
  if now()<c.opens_at or now()>=c.entries_close_at then raise exception 'ENTRIES_CLOSED'; end if;
  if not p.onboarding_complete or p.age_confirmed_at is null or p.privacy_accepted_at is null or p.is_private or nullif(trim(p.display_name),'') is null or nullif(trim(p.username),'') is null or nullif(trim(p.location),'') is null then raise exception 'COMPLETE_PUBLIC_PROFILE_REQUIRED'; end if;
  if p_data->'acceptedRules' is distinct from 'true'::jsonb or (p_data->>'rulesVersion')::integer is distinct from c.version then raise exception 'RULES_ACCEPTANCE_REQUIRED'; end if;
  if not (public.lab_subscription_status(p_user)->>'active')::boolean or (public.lab_subscription_status(p_user)->>'needsReview')::boolean then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  select count(*) into n from public.reward_entries where campaign_id=c.id and user_id=p_user;
  if n>=3 then raise exception 'ENTRY_LIMIT'; end if;
  select * into d from public.designs where id=(p_data->>'designId')::uuid and created_by=p_user and is_published for update;
  if not found or public.admin_content_hidden('design',d.id) or d.source_generation_id is null or nullif(trim(d.title),'') is null or nullif(trim(d.shape),'') is null or nullif(trim(d.length),'') is null then raise exception 'PUBLISHED_LAB_DESIGN_REQUIRED'; end if;
  select * into g from public.nail_lab_generations where id=d.source_generation_id and user_id=p_user;
  if not found or g.image_url is null or not exists(select from public.generation_reservations r where r.id=g.id and r.user_id=p_user and r.status='completed') then raise exception 'CONFIRMED_GENERATION_REQUIRED'; end if;
  -- Use the server-confirmed immutable Lab original, not a client-supplied image.
  update public.designs set image_url=g.image_url where id=d.id;
  insert into public.reward_entries(campaign_id,user_id,design_id,generation_id,country_code,snapshot,rules_version)
  values(c.id,p_user,d.id,g.id,p.country_code,jsonb_build_object('title',d.title,'image_url',g.image_url,'shape',d.shape,'length',d.length,'category',d.category),c.version) returning * into e;
  return jsonb_build_object('entryId',e.id);
 elsif p_action='vote' then
  if now()<c.opens_at or now()>=c.votes_close_at then raise exception 'VOTING_CLOSED'; end if;
  select * into e from public.reward_entries where id=(p_data->>'entryId')::uuid and campaign_id=c.id;
  if not found or not public.reward_entry_visible(e.id,p_user) then raise exception 'ENTRY_UNAVAILABLE'; end if;
  if e.user_id=p_user then raise exception 'SELF_VOTE'; end if;
  if p_data->'liked' is distinct from 'true'::jsonb and p_data->'liked' is distinct from 'false'::jsonb then raise exception 'INVALID_VOTE'; end if;
  if (p_data->>'liked')::boolean then
   insert into public.reward_votes(entry_id,user_id) values(e.id,p_user) on conflict do nothing;
  else delete from public.reward_votes where entry_id=e.id and user_id=p_user; end if;
  return jsonb_build_object('ok',true);
 else raise exception 'INVALID_ACTION'; end if;
end $$;

-- Server-controlled reads filter country on every request, including shared URLs.
create function public.rewards_member_read(p_user uuid,p_section text,p_id uuid default null,p_offset integer default 0,p_entry uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.reward_campaigns; items jsonb; own_items jsonb; winners jsonb; country text; mine jsonb; candidates jsonb; result jsonb;
begin
 if p_offset<0 or p_offset>100000 or public.account_is_closed(p_user) then raise exception 'REWARDS_FORBIDDEN'; end if;
 select country_code into country from public.profiles_data where id=p_user;
 if p_section='country' then return jsonb_build_object('country',country); end if;
 if p_section='updates' then
  select coalesce(jsonb_agg(to_jsonb(n)),'[]') into items from(
   select id,title,body,published_at from public.official_updates where status='published' and public.reward_country_matches(country_codes,p_user)
   order by published_at desc,id offset p_offset limit 25) n;
  return jsonb_build_object('items',items,'country',country);
 end if;
 if p_id is null then
  select coalesce(jsonb_agg(to_jsonb(n)),'[]') into items from(
   select id,title,theme,description,prize_type,prize_label,country_codes,opens_at,entries_close_at,votes_close_at,award_at,winner_count,status,version,results_at
   from public.reward_campaigns where status in('published','paused','results') and reviewed_at is not null and public.reward_country_matches(country_codes,p_user)
   order by created_at desc,id offset p_offset limit 25) n;
  select coalesce(jsonb_agg(to_jsonb(n)),'[]') into winners from(
   select rc.id campaign_id,rc.title campaign_title,e.id entry_id,e.design_id,e.user_id,e.snapshot,p.display_name,p.username,r.rank,r.votes,rc.results_at
   from public.reward_results r join public.reward_campaigns rc on rc.id=r.campaign_id join public.reward_entries e on e.id=r.entry_id join public.profiles_data p on p.id=e.user_id
   where rc.status='results' and rc.results_at>now()-interval '30 days' and public.reward_country_matches(rc.country_codes,p_user) and public.reward_entry_visible(e.id,p_user)
   order by rc.results_at desc,r.rank limit 30) n;
  return jsonb_build_object('items',items,'winners',winners,'country',country,'enabled',(select activation_enabled from public.reward_settings));
 end if;
 select * into c from public.reward_campaigns where id=p_id and status in('published','paused','results') and reviewed_at is not null and public.reward_country_matches(country_codes,p_user);
 if not found then raise exception 'CAMPAIGN_UNAVAILABLE'; end if;
 select coalesce(jsonb_agg(to_jsonb(n)),'[]') into items from(
  select e.id,e.design_id,e.user_id,e.snapshot,e.created_at,p.display_name,p.username,p.avatar_url,
   (select count(*)::integer from public.reward_votes v where v.entry_id=e.id and not public.account_is_closed(v.user_id) and not public.account_is_suspended(v.user_id)) votes,
   exists(select from public.reward_votes v where v.entry_id=e.id and v.user_id=p_user) liked,
   (select rank from public.reward_results r where r.entry_id=e.id) rank,
   (select votes from public.reward_results r where r.entry_id=e.id) final_votes
  from public.reward_entries e join public.profiles_data p on p.id=e.user_id
  where e.campaign_id=c.id and public.reward_entry_visible(e.id,p_user) and (p_entry is null or e.id=p_entry)
  order by rank nulls last,votes desc,e.created_at,e.id offset p_offset limit 25) n;
 select coalesce(jsonb_agg(to_jsonb(n)),'[]') into own_items from(
  select e.id,e.design_id,e.user_id,e.snapshot,e.created_at,p.display_name,p.username,p.avatar_url,
   (select count(*)::integer from public.reward_votes v where v.entry_id=e.id and not public.account_is_closed(v.user_id) and not public.account_is_suspended(v.user_id)) votes,
   false liked,(select rank from public.reward_results r where r.entry_id=e.id) rank,(select votes from public.reward_results r where r.entry_id=e.id) final_votes
  from public.reward_entries e join public.profiles_data p on p.id=e.user_id where e.campaign_id=c.id and e.user_id=p_user and public.reward_entry_visible(e.id,p_user) order by e.created_at,e.id) n;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'designId',e.design_id,'disqualified',e.disqualified)),'[]') into mine from public.reward_entries e where e.campaign_id=c.id and e.user_id=p_user;
 select coalesce(jsonb_agg(to_jsonb(n)),'[]') into candidates from(
  select d.id,d.title,g.image_url,d.shape,d.length from public.designs d join public.nail_lab_generations g on g.id=d.source_generation_id and g.user_id=p_user
  where d.created_by=p_user and d.is_published and not public.admin_content_hidden('design',d.id)
   and exists(select from public.generation_reservations r where r.id=g.id and r.user_id=p_user and r.status='completed')
   and not exists(select from public.reward_entries e where e.campaign_id=c.id and e.user_id=p_user and e.generation_id=g.id)
  order by d.created_at desc,d.id limit 50) n;
 result:=to_jsonb(c)-'review_reference'-'reviewed_by'-'reviewed_at'-'created_by';
 return jsonb_build_object('campaign',result,'items',items,'ownItems',own_items,'myEntries',mine,'candidates',candidates,'country',country,
 'enabled',(select activation_enabled from public.reward_settings),'subscription',public.lab_subscription_status(p_user),
 'profileComplete',exists(select from public.profiles_data p where p.id=p_user and p.onboarding_complete and not p.is_private and p.age_confirmed_at is not null and p.privacy_accepted_at is not null and nullif(trim(p.display_name),'') is not null and nullif(trim(p.username),'') is not null and nullif(trim(p.location),'') is not null),
 'verified',exists(select from auth.users where id=p_user and email_confirmed_at is not null));
end $$;
-- Review only submitted entries; never expose private or closed authors' Lab originals.
create function public.rewards_admin_entries(p_actor uuid,p_campaign uuid,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
 if p_offset<0 or p_offset>100000 or not exists(select from public.admin_staff where user_id=p_actor and active and role in('owner','moderator'))
 or public.account_is_closed(p_actor) or public.account_is_suspended(p_actor) then raise exception 'ADMIN_FORBIDDEN'; end if;
 select coalesce(jsonb_agg(to_jsonb(n)),'[]') into items from(
 select e.id,e.user_id,e.design_id,e.created_at,e.disqualified,e.disqualification_reason,
 case when p.id is not null and not p.is_private and not public.account_is_closed(p.id) and not public.account_is_suspended(p.id) and d.is_published
 then e.snapshot else jsonb_build_object('title','Unavailable design') end snapshot,
 p.display_name,p.username,
 (select count(*)::int from public.reward_votes v where v.entry_id=e.id and not public.account_is_closed(v.user_id) and not public.account_is_suspended(v.user_id)) votes
 from public.reward_entries e left join public.profiles_data p on p.id=e.user_id left join public.designs d on d.id=e.design_id
 where e.campaign_id=p_campaign order by e.created_at,e.id offset p_offset limit 26) n;
 return items;
end $$;
revoke all on function public.rewards_admin_entries(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.rewards_admin_entries(uuid,uuid,integer) to service_role;
-- Branch before accessing table-specific fields: generation rows have no source_generation_id.
create or replace function public.guard_generated_image_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='nail_lab_generations' then
  if new.image_url is distinct from old.image_url then raise exception 'GENERATED_IMAGE_IMMUTABLE'; end if;
 elsif tg_table_name='designs' then
  if old.source_generation_id is not null and
   (new.source_generation_id is distinct from old.source_generation_id or (new.image_url is distinct from old.image_url and auth.role() is distinct from 'service_role')) then raise exception 'GENERATED_IMAGE_IMMUTABLE'; end if;
 end if;
 return new;
end $$;
-- Freeze submitted design metadata/image; unpublish or delete remains an owner right.
create function public.guard_competition_design() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select from public.reward_entries where design_id=old.id) and
 (new.image_url is distinct from old.image_url or new.source_generation_id is distinct from old.source_generation_id or new.created_by is distinct from old.created_by
 or new.title is distinct from old.title or new.shape is distinct from old.shape or new.length is distinct from old.length or new.category is distinct from old.category
 or new.description is distinct from old.description or new.technique is distinct from old.technique or new.occasion is distinct from old.occasion) then raise exception 'COMPETITION_DESIGN_LOCKED'; end if;
 return new;
end $$;
create trigger competition_design_frozen before update on public.designs for each row execute function public.guard_competition_design();
-- Close/deletion never becomes an automatic Rewards personal-data archive.
create function public.clear_closed_rewards_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deletion_started_at is not null and old.deletion_started_at is null then
  update public.reward_entries set user_id=null,design_id=null,generation_id=null,country_code=null,snapshot='{}' where user_id=new.id;
  delete from public.reward_votes where user_id=new.id;
  new.country_code:=null;
 end if;
 return new;
end $$;
create trigger clear_closed_rewards_profile before update of deletion_started_at on public.profiles_data for each row execute function public.clear_closed_rewards_profile();
revoke all on function public.clear_closed_rewards_profile() from public,anon,authenticated;
revoke all on function public.reward_country_valid(text),public.reward_country_matches(text[],uuid),public.reward_entry_visible(uuid,uuid),public.reward_profile_country(uuid,text),
 public.rewards_admin_change(uuid,text,uuid,text,integer,text,jsonb),public.rewards_member_action(uuid,uuid,text,jsonb),public.rewards_member_read(uuid,text,uuid,integer,uuid),public.guard_competition_design() from public,anon,authenticated;
grant execute on function public.reward_country_valid(text),public.reward_country_matches(text[],uuid),public.reward_entry_visible(uuid,uuid),public.reward_profile_country(uuid,text),
 public.rewards_admin_change(uuid,text,uuid,text,integer,text,jsonb),public.rewards_member_action(uuid,uuid,text,jsonb),public.rewards_member_read(uuid,text,uuid,integer,uuid) to service_role;
commit;
