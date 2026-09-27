begin;
create table public.mobile_store_products (
  store text not null check(store in ('APP_STORE','PLAY_STORE')),product_id text not null,
  kind text not null check(kind in ('credits','subscription')),plan_id text check(plan_id in ('premium','pro_creator')),
  credits integer not null,active boolean not null default true,primary key(store,product_id),
  check((kind='credits' and plan_id is null and credits in (5,15,40)) or (kind='subscription' and ((plan_id='premium' and credits=5) or (plan_id='pro_creator' and credits=20))))
);
-- Purchase identities survive account deletion. They cannot be rebound or
-- restored into a second account and grant already-consumed credits again.
create table public.mobile_store_transactions (
  store text not null,environment text not null check(environment in ('SANDBOX','PRODUCTION')),transaction_id text not null,
  original_transaction_id text not null,user_id uuid not null,product_id text not null,kind text not null,credits integer not null,
  purchased_at bigint not null,refunded boolean not null default false,granted boolean not null default false,
  primary key(store,environment,transaction_id)
);
create table public.mobile_store_owners (
  store text not null,environment text not null,original_transaction_id text not null,user_id uuid not null,
  primary key(store,environment,original_transaction_id)
);
create table public.mobile_store_events (
  id text primary key,user_id uuid not null,payload jsonb not null,status text not null default 'pending' check(status in ('pending','applied','review')),
  created_at timestamptz not null default now()
);
create table public.mobile_billing_reconciliations (
  user_id uuid primary key,event_version bigint not null default 0,claim_version bigint,claim_token uuid,claim_until timestamptz,
  needs_review boolean not null default true,verified_at timestamptz,attempts integer not null default 0,retry_after timestamptz not null default now()
);
create table public.mobile_entitlements (
  user_id uuid not null,store text not null,product_id text not null,plan_id text not null,
  expires_at timestamptz not null,refunded boolean not null,verified_at timestamptz not null default now(),
  primary key(user_id,store,product_id)
);
create table public.mobile_purchase_intents (
  id uuid primary key,user_id uuid not null references public.profiles_data(id) on delete cascade,
  store text not null,product_id text not null,kind text not null,status text not null default 'pending' check(status in ('pending','completed','cancelled')),
  transaction_id text,created_at timestamptz not null default now()
);
create function public.begin_mobile_purchase(p_user_id uuid,p_id uuid,p_store text,p_product text) returns uuid
language plpgsql security definer set search_path='' as $$
declare product public.mobile_store_products; prior public.mobile_purchase_intents;
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  select * into prior from public.mobile_purchase_intents where id=p_id;
  if found then
    if row(prior.user_id,prior.store,prior.product_id) is distinct from row(p_user_id,p_store,p_product) or prior.status<>'pending' then raise exception 'PURCHASE_IDENTITY_MISMATCH'; end if;
    return prior.id;
  end if;
  select * into product from public.mobile_store_products where store=p_store and product_id=p_product and active;
  if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
  if exists(select from public.mobile_purchase_intents where user_id=p_user_id and status='pending')
    or exists(select from public.mobile_billing_reconciliations where user_id=p_user_id and needs_review) then raise exception 'PURCHASE_IN_PROGRESS'; end if;
  if product.kind='subscription' and (
    exists(select from public.subscription_checkouts where user_id=p_user_id)
    or exists(select from public.profiles_data where id=p_user_id and (subscription_tier is not null and subscription_tier<>'free' or stripe_subscription_id is not null and coalesce(subscription_status,'unknown') not in ('canceled','incomplete_expired')))
    or exists(select from public.mobile_entitlements where user_id=p_user_id and expires_at>now() and not refunded)
  ) then raise exception 'SUBSCRIPTION_ALREADY_ACTIVE'; end if;
  insert into public.mobile_purchase_intents(id,user_id,store,product_id,kind) values(p_id,p_user_id,p_store,p_product,product.kind);
  return p_id;
end $$;
alter function public.reserve_subscription_checkout_v2(uuid,text,text,text,text) rename to reserve_subscription_checkout_before_mobile;
create function public.reserve_subscription_checkout_v2(p_user_id uuid,p_plan_id text,p_email text,p_base_url text,p_price_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if exists(select from public.mobile_purchase_intents where user_id=p_user_id and status='pending' and kind='subscription')
    or exists(select from public.mobile_entitlements where user_id=p_user_id and expires_at>now() and not refunded) then raise exception 'SUBSCRIPTION_ALREADY_ACTIVE'; end if;
  return public.reserve_subscription_checkout_before_mobile(p_user_id,p_plan_id,p_email,p_base_url,p_price_id);
end $$;
alter table public.profiles_data add column stripe_subscription_tier text,add column mobile_subscription_tier text;
update public.profiles_data set stripe_subscription_tier=subscription_tier;

create function public.effective_subscription_tier(p_user_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select case when 'pro_creator'=any(tiers) then 'pro_creator' when 'premium'=any(tiers) then 'premium' else null end from (
    select array_agg(tier) tiers from (
      select stripe_subscription_tier tier from public.profiles_data where id=p_user_id
      union all select plan_id from public.mobile_entitlements where user_id=p_user_id and expires_at>now() and not refunded
    ) s
  ) s;
$$;
create function public.merge_mobile_entitlements() returns trigger
language plpgsql security definer set search_path='' as $$
declare mobile text;
begin
  if tg_argv[0]='stripe' then new.stripe_subscription_tier:=new.subscription_tier; end if;
  select case when bool_or(plan_id='pro_creator') then 'pro_creator' when bool_or(plan_id='premium') then 'premium' else null end
    into mobile from public.mobile_entitlements where user_id=new.id and expires_at>now() and not refunded;
  new.mobile_subscription_tier:=mobile;
  new.subscription_tier:=case when 'pro_creator' in (mobile,new.stripe_subscription_tier) then 'pro_creator'
    when 'premium' in (mobile,new.stripe_subscription_tier) then 'premium' else null end;
  return new;
end $$;
create trigger merge_stripe_mobile_entitlements before update of subscription_tier on public.profiles_data
  for each row execute function public.merge_mobile_entitlements('stripe');
create trigger refresh_mobile_entitlements before update of mobile_subscription_tier on public.profiles_data
  for each row execute function public.merge_mobile_entitlements('mobile');
create function public.refresh_mobile_entitlements(p_user_id uuid) returns void
language sql security definer set search_path='' as $$
  update public.profiles_data set mobile_subscription_tier=mobile_subscription_tier where id=p_user_id;
$$;

create function public.stage_mobile_store_event(p_id text,p_user_id uuid,p_payload jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare prior public.mobile_store_events;
begin
  select * into prior from public.mobile_store_events where id=p_id;
  if found then
    if prior.user_id<>p_user_id or prior.payload<>p_payload then raise exception 'STORE_EVENT_IDENTITY_MISMATCH'; end if;
    return prior.status<>'applied';
  end if;
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'STORE_ACCOUNT_UNAVAILABLE'; end if;
  insert into public.mobile_store_events(id,user_id,payload) values(p_id,p_user_id,p_payload) on conflict do nothing;
  if not found then
    select * into prior from public.mobile_store_events where id=p_id;
    if prior.user_id<>p_user_id or prior.payload<>p_payload then raise exception 'STORE_EVENT_IDENTITY_MISMATCH'; end if;
    return prior.status<>'applied';
  end if;
  insert into public.mobile_billing_reconciliations(user_id,event_version) values(p_user_id,1)
    on conflict(user_id) do update set event_version=mobile_billing_reconciliations.event_version+1,needs_review=true,retry_after=now();
  return true;
end $$;
create function public.claim_mobile_billing(p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid;
begin
  insert into public.mobile_billing_reconciliations(user_id) values(p_user_id) on conflict do nothing;
  update public.mobile_billing_reconciliations set claim_token=gen_random_uuid(),claim_version=event_version,attempts=attempts+1,claim_until=now()+interval '90 seconds',needs_review=true
    where user_id=p_user_id and (claim_until is null or claim_until<now()) returning claim_token into token;
  return token;
end $$;
create function public.release_mobile_billing(p_user_id uuid,p_token uuid) returns void
language sql security definer set search_path='' as $$
  update public.mobile_billing_reconciliations set claim_token=null,claim_until=null,retry_after=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)) where user_id=p_user_id and claim_token=p_token;
$$;

create function public.apply_mobile_store_transaction(p_user_id uuid,p_event jsonb,p_refund boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare product public.mobile_store_products; receipt public.mobile_store_transactions; payment text; event_id text; grant_it boolean;
begin
  select * into product from public.mobile_store_products where store=p_event->>'store' and product_id=p_event->>'product_id';
  if not found then raise exception 'UNKNOWN_STORE_PRODUCT'; end if;
  if p_event->>'environment' not in ('SANDBOX','PRODUCTION') or nullif(p_event->>'transaction_id','') is null or nullif(p_event->>'original_transaction_id','') is null or (p_event->>'purchased_at_ms')::bigint<0 then raise exception 'INVALID_STORE_TRANSACTION'; end if;
  insert into public.mobile_store_owners values(product.store,p_event->>'environment',p_event->>'original_transaction_id',p_user_id) on conflict do nothing;
  if exists(select from public.mobile_store_owners where store=product.store and environment=p_event->>'environment'
    and original_transaction_id=p_event->>'original_transaction_id' and user_id<>p_user_id) then raise exception 'STORE_PURCHASE_OWNED_BY_ANOTHER_ACCOUNT'; end if;
  insert into public.mobile_store_transactions(store,environment,transaction_id,original_transaction_id,user_id,product_id,kind,credits,purchased_at)
    values(product.store,p_event->>'environment',p_event->>'transaction_id',p_event->>'original_transaction_id',p_user_id,product.product_id,product.kind,product.credits,(p_event->>'purchased_at_ms')::bigint)
    on conflict do nothing;
  select * into strict receipt from public.mobile_store_transactions where store=product.store and environment=p_event->>'environment' and transaction_id=p_event->>'transaction_id' for update;
  if row(receipt.user_id,receipt.product_id,receipt.original_transaction_id) is distinct from row(p_user_id,product.product_id,p_event->>'original_transaction_id') then raise exception 'STORE_TRANSACTION_IDENTITY_MISMATCH'; end if;
  payment:='iap:'||receipt.environment||':'||receipt.store||':'||receipt.transaction_id;
  event_id:='iap:'||coalesce(p_event->>'id',payment)||case when p_refund then ':refund' else ':grant' end;
  grant_it:=not p_refund and p_event->>'type' in ('INITIAL_PURCHASE','RENEWAL','NON_RENEWING_PURCHASE') and coalesce(p_event->>'period_type','NORMAL')<>'TRIAL';
  -- Existing credit accounting also reverses reserved, unspent generation
  -- credits. It is monotone: a delayed purchase cannot undo a prior refund.
  if p_refund or grant_it then
    perform public.apply_credit_payment(event_id,payment,p_user_id,receipt.credits,
      case when grant_it then payment else null end,case when p_refund or receipt.refunded then receipt.credits else 0 end);
  end if;
  if grant_it and not receipt.granted then
    update public.mobile_purchase_intents set status='completed',transaction_id=receipt.transaction_id
      where user_id=p_user_id and store=receipt.store and product_id=receipt.product_id and status='pending'
      and created_at<=to_timestamp(receipt.purchased_at/1000.0);
  end if;
  update public.mobile_store_transactions set refunded=refunded or p_refund,granted=granted or grant_it
    where store=receipt.store and environment=receipt.environment and transaction_id=receipt.transaction_id;
end $$;

create function public.finish_mobile_billing(p_user_id uuid,p_token uuid,p_entitlements jsonb,p_refunds jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare claim public.mobile_billing_reconciliations; event public.mobile_store_events; item jsonb; product public.mobile_store_products;
begin
  perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
  if not found then raise exception 'STORE_ACCOUNT_UNAVAILABLE'; end if;
  select * into claim from public.mobile_billing_reconciliations where user_id=p_user_id for update;
  if p_token is null or claim.user_id is null or claim.claim_token is distinct from p_token or claim.claim_until is null or claim.claim_until<=now() or claim.claim_version is distinct from claim.event_version then return false; end if;
  for event in select * from public.mobile_store_events where user_id=p_user_id and status='pending' order by created_at,id for update loop
    if event.payload->>'type'='REFUND_REVERSED' or event.payload->>'type'='TRANSFER' then raise exception 'STORE_EVENT_REQUIRES_REVIEW'; end if;
    if event.payload->>'type' in ('INITIAL_PURCHASE','RENEWAL','NON_RENEWING_PURCHASE') then
      perform public.apply_mobile_store_transaction(p_user_id,event.payload,false);
    elsif event.payload->>'type'='CANCELLATION' and exists(select from public.mobile_store_products where store=event.payload->>'store' and product_id=event.payload->>'product_id' and kind='credits') then
      perform public.apply_mobile_store_transaction(p_user_id,event.payload,true);
    end if;
    update public.mobile_store_events set status='applied' where id=event.id;
  end loop;
  for item in select * from jsonb_array_elements(p_refunds) loop perform public.apply_mobile_store_transaction(p_user_id,item,true); end loop;
  delete from public.mobile_entitlements where user_id=p_user_id;
  for item in select * from jsonb_array_elements(p_entitlements) loop
    select * into product from public.mobile_store_products where store=item->>'store' and product_id=item->>'product_id' and kind='subscription';
    if not found then raise exception 'UNKNOWN_STORE_ENTITLEMENT'; end if;
    insert into public.mobile_entitlements(user_id,store,product_id,plan_id,expires_at,refunded)
      values(p_user_id,product.store,product.product_id,product.plan_id,(item->>'expires_at')::timestamptz,(item->>'refunded')::boolean);
  end loop;
  perform public.refresh_mobile_entitlements(p_user_id);
  update public.mobile_billing_reconciliations set needs_review=false,attempts=0,verified_at=now(),claim_token=null,claim_until=null where user_id=p_user_id;
  return true;
end $$;

alter function public.begin_account_deletion(uuid) rename to begin_account_deletion_before_store;
create function public.begin_account_deletion(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles_data where id=p_user_id for update;
  if exists(select from public.mobile_store_events where user_id=p_user_id and status<>'applied')
    or exists(select from public.mobile_purchase_intents where user_id=p_user_id and status='pending')
    or exists(select from public.mobile_billing_reconciliations where user_id=p_user_id and (needs_review or claim_until>now()))
    or exists(select from public.mobile_entitlements where user_id=p_user_id and expires_at>now() and not refunded) then raise exception 'STORE_BILLING_IN_PROGRESS'; end if;
  perform public.refresh_mobile_entitlements(p_user_id);
  perform public.begin_account_deletion_before_store(p_user_id);
end $$;

do $$ declare t text; begin
  foreach t in array array['mobile_store_products','mobile_store_transactions','mobile_store_owners','mobile_store_events','mobile_billing_reconciliations','mobile_entitlements','mobile_purchase_intents'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
revoke all on function public.effective_subscription_tier(uuid),public.merge_mobile_entitlements(),public.refresh_mobile_entitlements(uuid),public.stage_mobile_store_event(text,uuid,jsonb),public.claim_mobile_billing(uuid),public.release_mobile_billing(uuid,uuid),public.apply_mobile_store_transaction(uuid,jsonb,boolean),public.finish_mobile_billing(uuid,uuid,jsonb,jsonb),public.begin_account_deletion(uuid) from public,anon,authenticated;
revoke all on function public.begin_account_deletion_before_store(uuid) from public,anon,authenticated,service_role;
grant execute on function public.effective_subscription_tier(uuid),public.refresh_mobile_entitlements(uuid),public.stage_mobile_store_event(text,uuid,jsonb),public.claim_mobile_billing(uuid),public.release_mobile_billing(uuid,uuid),public.finish_mobile_billing(uuid,uuid,jsonb,jsonb),public.begin_account_deletion(uuid) to service_role;
-- Internal transaction writer is reachable only from the guarded finalizer.
revoke all on function public.apply_mobile_store_transaction(uuid,jsonb,boolean) from service_role;
revoke all on function public.begin_mobile_purchase(uuid,uuid,text,text),public.reserve_subscription_checkout_v2(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.begin_mobile_purchase(uuid,uuid,text,text),public.reserve_subscription_checkout_v2(uuid,text,text,text,text) to service_role;
revoke all on function public.reserve_subscription_checkout_before_mobile(uuid,text,text,text,text) from public,anon,authenticated,service_role;
create or replace function public.enforce_weekly_upload_limit() returns trigger
language plpgsql security definer set search_path='' as $$
declare prof public.profiles_data; used integer;
begin
  if new.created_by is null or new.source_generation_id is not null then return new; end if;
  select * into prof from public.profiles_data where id=new.created_by for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if prof.is_admin then return new; end if;
  used:=case when prof.week_reset_at is null or prof.week_reset_at<now()-interval '7 days' then 0 else coalesce(prof.weekly_uploads,0) end;
  if public.effective_subscription_tier(new.created_by) is distinct from 'pro_creator' and used>=5 then raise exception 'WEEKLY_UPLOAD_LIMIT'; end if;
  update public.profiles_data set weekly_uploads=used+1,
    week_reset_at=case when prof.week_reset_at is null or prof.week_reset_at<now()-interval '7 days' then now() else prof.week_reset_at end
    where id=new.created_by;
  return new;
end $$;
notify pgrst,'reload schema';
commit;
