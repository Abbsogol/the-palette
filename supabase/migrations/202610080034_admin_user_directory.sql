begin;
create function public.admin_user_directory(p_actor uuid,p_query text default '',p_type text default '',p_offset integer default 0,p_limit integer default 25,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; fields text[]; result jsonb;
begin
 select role into r from public.admin_staff where user_id=p_actor and active;
 if r not in('owner','support') or r is null or public.account_is_closed(p_actor) or public.account_is_suspended(p_actor) then raise exception 'ADMIN_FORBIDDEN';end if;
 if p_offset<0 or p_offset>250000 or p_limit<1 or p_limit>500 or length(p_query)>100 or p_type not in('','user','creator','salon') then raise exception 'INVALID_DIRECTORY_RANGE';end if;
 fields:=array['id','display_name','username','bio','avatar_url','banner_url','location','account_type','is_verified','created_at','onboarding_complete','is_private','specialties','phone_number','preferred_contact','booking_area','deletion_started_at'];
 if r='owner' then fields:=fields||array['credit_balance','booking_notes','nail_shape','nail_length','nail_colors','nail_finishes','nail_techniques','occasions','budget_range','allergies','product_sensitivities','removal_needed','nail_condition','skin_undertone','hand_photo_url','message_permission','show_saves','referral_code','referred_by','weekly_uploads','week_reset_at','age_confirmed_at','privacy_accepted_at','privacy_policy_version'];end if;
 select coalesce(jsonb_agg(value order by created_at desc,id),'[]'::jsonb) into result from (
 select p.id,p.created_at,
 (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(p)) where key=any(fields)) ||
 jsonb_build_object('email',u.email,'email_confirmed_at',u.email_confirmed_at,'last_sign_in_at',case when r='owner' then u.last_sign_in_at else null end,'suspended',coalesce(s.suspended,false)) value
 from public.profiles_data p left join auth.users u on u.id=p.id left join public.admin_suspensions s on s.user_id=p.id
 where (p_id is null or p.id=p_id) and(p_type='' or p.account_type=p_type)
 and(p_query='' or p.display_name ilike '%'||p_query||'%' or p.username ilike '%'||p_query||'%' or u.email ilike '%'||p_query||'%')
 order by p.created_at desc,p.id offset p_offset limit p_limit
 )q;
 return result;
end $$;
create function public.admin_export_log(p_actor uuid,p_role text,p_section text,p_reason text,p_count integer,p_account uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare r text;
begin
 select role into r from public.admin_staff where user_id=p_actor and active for share;
 if r is distinct from p_role or public.account_is_closed(p_actor) or public.account_is_suspended(p_actor) then raise exception 'ADMIN_FORBIDDEN';end if;
 if not(p_section=any(case r when 'owner' then array['overview','users','content','bookings','lab','credits','reports','activity'] when 'support' then array['overview','bookings','lab'] when 'moderator' then array['overview','content','reports'] else array[]::text[] end)) then raise exception 'ADMIN_FORBIDDEN';end if;
 if length(trim(p_reason)) not between 5 and 1000 or p_count<0 or p_count>5000 then raise exception 'INVALID_EXPORT';end if;
 insert into public.admin_actions(actor_id,actor_role,action,target_id,reason,details) values(p_actor,r,'export',coalesce(p_account::text,p_section),trim(p_reason),jsonb_build_object('section',p_section,'records',p_count));
end $$;
revoke all on function public.admin_user_directory(uuid,text,text,integer,integer,uuid),public.admin_export_log(uuid,text,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_user_directory(uuid,text,text,integer,integer,uuid),public.admin_export_log(uuid,text,text,text,integer,uuid) to service_role;
commit;
