-- BETA ONLY: atjwbdrvgljddedtwoqo. Review and run in that project SQL editor.
-- Re-entrant installer: confirmed version records are not applied twice.
begin;
do $installer$
begin
 if not exists(select from supabase_migrations.schema_migrations where version='202610080034') then raise exception 'Expected beta migration 034 first'; end if;
 if not exists(select from supabase_migrations.schema_migrations where version='202610080035') then
  if to_regclass('public.lab_monthly_allowances') is not null then raise exception 'Lab schema exists without migration 035 record; inspect before reapplying'; end if;
  execute $migration202610080035$
-- Subscription-required Nail Lab. Store products start inactive until configured and verified.
alter table public.mobile_store_products add column if not exists price_usd_cents integer;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.mobile_store_products'::regclass and contype='c' and pg_get_constraintdef(oid) like '%credits%' loop
 execute format('alter table public.mobile_store_products drop constraint %I',c.conname); end loop;
end $$;
alter table public.mobile_store_products add constraint lab_product_units check(
 (kind='credits' and plan_id is null and credits in(5,15,30,40,100)) or
 (kind='subscription' and ((plan_id='premium' and credits in(5,15)) or(plan_id='pro_creator' and credits=20))));
update public.mobile_store_products set active=false;
insert into public.mobile_store_products(store,product_id,kind,plan_id,credits,active,price_usd_cents)
select store,id,kind,plan,units,false,price from unnest(array['APP_STORE','PLAY_STORE']) store
cross join(values('laque_lab_monthly_5','subscription','premium',15,500),('laque_lab_tokens_30','credits',null,30,1000),('laque_lab_tokens_100','credits',null,100,2500)) v(id,kind,plan,units,price)
on conflict(store,product_id) do nothing;

create table public.lab_monthly_allowances(
 user_id uuid not null references public.profiles_data(id) on delete cascade,
 store text not null,product_id text not null,period_start timestamptz not null,period_end timestamptz not null,
 used integer not null default 0 check(used between 0 and 15),revoked boolean not null default false,
 primary key(user_id,store,product_id,period_start),check(period_end>period_start));
alter table public.lab_monthly_allowances enable row level security;
revoke all on public.lab_monthly_allowances from public,anon,authenticated;
grant all on public.lab_monthly_allowances to service_role;
alter table public.generation_reservations add column lab_allowance_start timestamptz,
 add column lab_allowance_store text,add column lab_allowance_product text;

create function public.lab_subscription_status(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare allowance public.lab_monthly_allowances; balance integer; reviewing boolean;
begin
 select coalesce(p.credit_balance,0) into balance from public.profiles_data p where p.id=p_user_id and p.deletion_started_at is null;
 select coalesce(needs_review,false) into reviewing from public.mobile_billing_reconciliations where user_id=p_user_id;
 select a.* into allowance from public.lab_monthly_allowances a join public.mobile_entitlements e
 on e.user_id=a.user_id and e.store=a.store and e.product_id=a.product_id
 where a.user_id=p_user_id and not a.revoked and not e.refunded and e.expires_at>now()
 and a.period_start<=now() and a.period_end>now() and e.product_id='laque_lab_monthly_5'
 and a.period_start=(select max(latest.period_start) from public.lab_monthly_allowances latest where latest.user_id=a.user_id and latest.store=a.store and latest.product_id=a.product_id)
 order by a.period_start desc limit 1;
 return jsonb_build_object('active',allowance.user_id is not null and balance is not null and not public.account_is_suspended(p_user_id),
 'monthlyRemaining',case when allowance.user_id is not null then 15-allowance.used else 0 end,
 'purchasedTokens',coalesce(balance,0),'renewsAt',allowance.period_end,'store',allowance.store,'needsReview',coalesce(reviewing,false));
end $$;

alter function public.apply_mobile_store_transaction(uuid,jsonb,boolean) rename to apply_mobile_store_transaction_before_lab;
create function public.apply_mobile_store_transaction(p_user_id uuid,p_event jsonb,p_refund boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare product public.mobile_store_products;
begin
 select * into product from public.mobile_store_products where store=p_event->>'store' and product_id=p_event->>'product_id';
 if product.kind='subscription' and product.product_id='laque_lab_monthly_5' then
  -- The existing binding/receipt code still verifies ownership and idempotency.
  -- Suppress its pooled-credit grant: the verified snapshot supplies the monthly allowance.
  perform public.apply_mobile_store_transaction_before_lab(p_user_id,p_event||jsonb_build_object('period_type','TRIAL'),false);
  if not p_refund and p_event->>'type' in('INITIAL_PURCHASE','RENEWAL') then
   update public.mobile_store_transactions set granted=true where user_id=p_user_id and store=product.store
    and environment=p_event->>'environment' and transaction_id=p_event->>'transaction_id' and not refunded;
   update public.mobile_purchase_intents set status='completed',transaction_id=p_event->>'transaction_id'
    where user_id=p_user_id and store=product.store and product_id=product.product_id and status='pending'
    and created_at<=to_timestamp((p_event->>'purchased_at_ms')::bigint/1000.0);
  end if;
  if p_refund then
   update public.mobile_store_transactions set refunded=true where user_id=p_user_id and store=product.store and environment=p_event->>'environment' and transaction_id=p_event->>'transaction_id';
   update public.lab_monthly_allowances set revoked=true where user_id=p_user_id and store=product.store and product_id=product.product_id and period_start=to_timestamp((p_event->>'purchased_at_ms')::bigint/1000.0); end if;
 else perform public.apply_mobile_store_transaction_before_lab(p_user_id,p_event,p_refund); end if;
end $$;

alter function public.finish_mobile_billing(uuid,uuid,jsonb,jsonb) rename to finish_mobile_billing_before_lab;
create function public.finish_mobile_billing(p_user_id uuid,p_token uuid,p_entitlements jsonb,p_refunds jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare item jsonb; started timestamptz; ending timestamptz;
begin
 if not public.finish_mobile_billing_before_lab(p_user_id,p_token,p_entitlements,p_refunds) then return false; end if;
 for item in select * from jsonb_array_elements(p_entitlements) where value->>'product_id'='laque_lab_monthly_5' loop
  started:=(item->>'purchased_at')::timestamptz; ending:=(item->>'expires_at')::timestamptz;
  if started is null or ending is null or ending<=started then raise exception 'INVALID_LAB_PERIOD'; end if;
  insert into public.lab_monthly_allowances(user_id,store,product_id,period_start,period_end,revoked)
   values(p_user_id,item->>'store',item->>'product_id',started,ending,coalesce((item->>'refunded')::boolean,false))
   on conflict(user_id,store,product_id,period_start) do update set
   period_end=excluded.period_end,revoked=lab_monthly_allowances.revoked or excluded.revoked;
 end loop;
 return true;
end $$;

create or replace function public.reserve_generation(p_id uuid,p_user_id uuid,p_parent_id uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare a public.lab_monthly_allowances; status jsonb;
begin
 perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
 if not found or p_parent_id is not null or public.account_is_suspended(p_user_id) then return false; end if;
 status:=public.lab_subscription_status(p_user_id);
 if not (status->>'active')::boolean then return false; end if;
 select * into a from public.lab_monthly_allowances where user_id=p_user_id and store=status->>'store'
 and period_end=(status->>'renewsAt')::timestamptz and not revoked order by period_start desc limit 1 for update;
 if a.used<15 then
  update public.lab_monthly_allowances set used=used+1 where user_id=a.user_id and store=a.store and product_id=a.product_id and period_start=a.period_start;
  insert into public.generation_reservations(id,user_id,lab_allowance_start,lab_allowance_store,lab_allowance_product)
  values(p_id,p_user_id,a.period_start,a.store,a.product_id);
 else
  update public.profiles_data set credit_balance=credit_balance-1 where id=p_user_id and credit_balance>=1;
  if not found then return false; end if;
  insert into public.generation_reservations(id,user_id) values(p_id,p_user_id);
 end if;
 return true;
end $$;

alter function public.claim_generation(uuid,uuid,uuid,text) rename to claim_generation_before_lab;
create function public.claim_generation(p_id uuid,p_user_id uuid,p_parent_id uuid,p_hash text) returns text
language plpgsql security definer set search_path='' as $$
begin
 -- Previously accepted intents remain recoverable after subscription expiry.
 perform 1 from public.profiles_data where id=p_user_id for update;
 if not exists(select from public.generation_reservations where id=p_id) and
 not (public.lab_subscription_status(p_user_id)->>'active')::boolean then return 'subscription_required'; end if;
 if p_parent_id is not null then return 'unavailable'; end if;
 return public.claim_generation_before_lab(p_id,p_user_id,p_parent_id,p_hash);
end $$;

alter function public.release_generation(uuid) rename to release_generation_before_lab;
create function public.release_generation(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.generation_reservations; account_id uuid;
begin
 select user_id into account_id from public.generation_reservations where id=p_id;
 perform 1 from public.profiles_data where id=account_id for update;
 select * into r from public.generation_reservations where id=p_id for update;
 if not found or r.status<>'reserved' then return false; end if;
 if r.lab_allowance_start is null then return public.release_generation_before_lab(p_id); end if;
 -- Restore only to the same period, never into the purchased token balance or a renewal.
 update public.lab_monthly_allowances set used=greatest(0,used-1)
 where user_id=r.user_id and store=r.lab_allowance_store and product_id=r.lab_allowance_product and period_start=r.lab_allowance_start;
 update public.generation_reservations set status='released' where id=p_id;
 return true;
end $$;
-- Pooled token refunds must never mark a monthly allowance hold as a purchased-token hold.
create or replace function public.apply_credit_payment(p_event_id text, p_payment_intent text, p_user_id uuid, p_credits integer,
  p_session_id text default null, p_refunded_credits integer default 0)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.credit_payments; balance integer; delta integer; owed integer; pending_reversal integer; hold record;
begin
  if p_event_id is null or p_event_id = '' or p_payment_intent is null or p_payment_intent = '' or p_user_id is null or p_credits is null
    or p_credits <= 0 or p_refunded_credits is null or p_refunded_credits < 0
    or p_refunded_credits > p_credits then raise exception 'Invalid credit payment'; end if;
  -- All credit/hold paths lock profile before ledger/reservations.
  select coalesce(credit_balance, 0) into strict balance from public.profiles_data where id = p_user_id for update;
  insert into public.processed_webhook_events(event_id) values (p_event_id) on conflict do nothing;
  if not found then
    select coalesce(credit_balance, 0) into strict balance from public.profiles_data where id = p_user_id;
    return balance;
  end if;
  insert into public.credit_payments(payment_intent, user_id, credits)
    values (p_payment_intent, p_user_id, p_credits) on conflict do nothing;
  select * into r from public.credit_payments where payment_intent = p_payment_intent for update;
  if r.user_id <> p_user_id or r.credits <> p_credits
    or (r.session_id is not null and p_session_id is not null and r.session_id <> p_session_id)
    then raise exception 'Payment metadata mismatch'; end if;
  select coalesce(credit_balance, 0) into strict balance from public.profiles_data where id = p_user_id for update;
  owed := greatest(r.refunded_credits, p_refunded_credits);
  if p_session_id is not null and not r.fulfilled then
    -- Retain an unpaid refund remainder if the refund arrived before checkout.
    balance := balance + r.credits - (owed - r.deducted_credits);
    r.deducted_credits := owed;
    r.fulfilled := true;
    r.session_id := p_session_id;
  elsif r.fulfilled then
    delta := least(balance, owed - r.refunded_credits);
    balance := balance - delta;
    r.deducted_credits := r.deducted_credits + delta;
    pending_reversal := owed - r.refunded_credits - delta;
    for hold in select id from public.generation_reservations
      where user_id=p_user_id and status='reserved' and parent_generation_id is null and not credit_reversed and lab_allowance_start is null
      order by created_at,id for update loop
      exit when pending_reversal<=0;
      update public.generation_reservations set credit_reversed=true where id=hold.id;
      pending_reversal:=pending_reversal-1;
      r.deducted_credits:=r.deducted_credits+1;
    end loop;
  end if;
  update public.profiles_data set credit_balance = balance where id = p_user_id;
  update public.credit_payments set session_id = r.session_id, fulfilled = r.fulfilled,
    refunded_credits = owed, deducted_credits = r.deducted_credits, updated_at = now()
    where payment_intent = p_payment_intent;
  return balance;
end $$;


create function public.guard_generated_image_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='nail_lab_generations' and new.image_url is distinct from old.image_url then raise exception 'GENERATED_IMAGE_IMMUTABLE'; end if;
 if tg_table_name='designs' and old.source_generation_id is not null and
 (new.source_generation_id is distinct from old.source_generation_id or (new.image_url is distinct from old.image_url and auth.role() is distinct from 'service_role')) then raise exception 'GENERATED_IMAGE_IMMUTABLE'; end if;
 return new;
end $$;
create trigger generated_image_immutable before update on public.nail_lab_generations for each row execute function public.guard_generated_image_immutable();
create trigger published_generated_image_immutable before update on public.designs for each row execute function public.guard_generated_image_immutable();

create function public.admin_lab_summary(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare role text; total integer;
begin
 select s.role into role from public.admin_staff s join public.profiles_data p on p.id=s.user_id
 where s.user_id=p_actor and s.active and p.deletion_started_at is null and not public.account_is_suspended(p_actor);
 if role not in('owner','support') or role is null then raise exception 'ADMIN_FORBIDDEN'; end if;
 select count(distinct a.user_id)::integer into total from public.lab_monthly_allowances a join public.mobile_entitlements e
 on e.user_id=a.user_id and e.store=a.store and e.product_id=a.product_id join public.profiles_data p on p.id=a.user_id
 where not a.revoked and not e.refunded and e.expires_at>now() and a.period_start<=now() and a.period_end>now()
 and a.period_start=(select max(latest.period_start) from public.lab_monthly_allowances latest where latest.user_id=a.user_id and latest.store=a.store and latest.product_id=a.product_id)
 and p.deletion_started_at is null and not exists(select from public.admin_staff s where s.user_id=p.id)
 and not exists(select from auth.users u where u.id=p.id and u.email like '%.example');
 return jsonb_build_object('subscribers',total,'plan',jsonb_build_object('name','Nail Lab','monthlyUsd',5,'monthlyDesigns',15),
 'packs',jsonb_build_array(jsonb_build_object('designs',30,'usd',10),jsonb_build_object('designs',100,'usd',25)));
end $$;
revoke all on function public.lab_subscription_status(uuid),public.admin_lab_summary(uuid),public.guard_generated_image_immutable(),
 public.apply_mobile_store_transaction_before_lab(uuid,jsonb,boolean),public.finish_mobile_billing_before_lab(uuid,uuid,jsonb,jsonb),
 public.claim_generation_before_lab(uuid,uuid,uuid,text),public.release_generation_before_lab(uuid) from public,anon,authenticated,service_role;
grant execute on function public.lab_subscription_status(uuid),public.admin_lab_summary(uuid) to service_role;
revoke all on function public.apply_mobile_store_transaction(uuid,jsonb,boolean),public.finish_mobile_billing(uuid,uuid,jsonb,jsonb),public.claim_generation(uuid,uuid,uuid,text),public.release_generation(uuid) from public,anon,authenticated,service_role;
grant execute on function public.finish_mobile_billing(uuid,uuid,jsonb,jsonb),public.claim_generation(uuid,uuid,uuid,text),public.release_generation(uuid) to service_role;
alter function public.begin_mobile_purchase(uuid,uuid,text,text) rename to begin_mobile_purchase_before_lab;
create function public.begin_mobile_purchase(p_user_id uuid,p_id uuid,p_store text,p_product text) returns uuid language plpgsql security definer set search_path='' as $$
declare product public.mobile_store_products; status jsonb;
begin
 perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
 if not found or public.account_is_suspended(p_user_id) then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 select * into product from public.mobile_store_products where store=p_store and product_id=p_product and active;
 if not found or product.product_id not in('laque_lab_monthly_5','laque_lab_tokens_30','laque_lab_tokens_100') then raise exception 'PRODUCT_UNAVAILABLE'; end if;
 status:=public.lab_subscription_status(p_user_id);
 if product.kind='credits' and (not (status->>'active')::boolean or (status->>'monthlyRemaining')::integer>0) then raise exception 'USE_MONTHLY_ALLOWANCE_FIRST'; end if;
 return public.begin_mobile_purchase_before_lab(p_user_id,p_id,p_store,p_product);
end $$;
revoke all on function public.begin_mobile_purchase_before_lab(uuid,uuid,text,text),public.begin_mobile_purchase(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.begin_mobile_purchase(uuid,uuid,text,text) to service_role;
create function public.guard_generated_gallery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select from public.designs where id=new.design_id and source_generation_id is not null) then raise exception 'GENERATED_IMAGE_IMMUTABLE'; end if;
 return new;
end $$;
create trigger generated_gallery_immutable before insert or update on public.design_images for each row execute function public.guard_generated_gallery();
revoke all on function public.guard_generated_gallery() from public,anon,authenticated;
-- Internal legacy reservation implementations cannot bypass subscription enforcement.
revoke all on function public.reserve_generation_before_deletion_guard(uuid,uuid,uuid) from service_role;

$migration202610080035$;
  insert into supabase_migrations.schema_migrations(version,name,statements) values('202610080035','lab_subscription',array['Reviewed beta Lab installer']);
 end if;
 if not exists(select from supabase_migrations.schema_migrations where version='202610080036') then
  execute $migration202610080036$
-- RevenueCat identifies modern Google Play subscriptions as product:base-plan.
-- No products are activated by this migration. Keep Apple and Google identities distinct.
update public.mobile_store_products set active=false where store='PLAY_STORE' and product_id='laque_lab_monthly_5';
insert into public.mobile_store_products(store,product_id,kind,plan_id,credits,active,price_usd_cents)
values('PLAY_STORE','laque_lab_monthly_5:monthly','subscription','premium',15,false,500)
on conflict(store,product_id) do nothing;
create or replace function public.lab_subscription_status(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare allowance public.lab_monthly_allowances; balance integer; reviewing boolean;
begin
 select coalesce(p.credit_balance,0) into balance from public.profiles_data p where p.id=p_user_id and p.deletion_started_at is null;
 select coalesce(needs_review,false) into reviewing from public.mobile_billing_reconciliations where user_id=p_user_id;
 select a.* into allowance from public.lab_monthly_allowances a join public.mobile_entitlements e
 on e.user_id=a.user_id and e.store=a.store and e.product_id=a.product_id
 where a.user_id=p_user_id and not a.revoked and not e.refunded and e.expires_at>now()
 and a.period_start<=now() and a.period_end>now() and e.product_id in('laque_lab_monthly_5','laque_lab_monthly_5:monthly')
 and a.period_start=(select max(latest.period_start) from public.lab_monthly_allowances latest where latest.user_id=a.user_id and latest.store=a.store and latest.product_id=a.product_id)
 order by a.period_start desc limit 1;
 return jsonb_build_object('active',allowance.user_id is not null and balance is not null and not public.account_is_suspended(p_user_id),
 'monthlyRemaining',case when allowance.user_id is not null then 15-allowance.used else 0 end,
 'purchasedTokens',coalesce(balance,0),'renewsAt',allowance.period_end,'store',allowance.store,'needsReview',coalesce(reviewing,false));
end $$;

create or replace function public.apply_mobile_store_transaction(p_user_id uuid,p_event jsonb,p_refund boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare product public.mobile_store_products;
begin
 select * into product from public.mobile_store_products where store=p_event->>'store' and product_id=p_event->>'product_id';
 if product.kind='subscription' and product.product_id in('laque_lab_monthly_5','laque_lab_monthly_5:monthly') then
  -- The existing binding/receipt code still verifies ownership and idempotency.
  -- Suppress its pooled-credit grant: the verified snapshot supplies the monthly allowance.
  perform public.apply_mobile_store_transaction_before_lab(p_user_id,p_event||jsonb_build_object('period_type','TRIAL'),false);
  if not p_refund and p_event->>'type' in('INITIAL_PURCHASE','RENEWAL') then
   update public.mobile_store_transactions set granted=true where user_id=p_user_id and store=product.store
    and environment=p_event->>'environment' and transaction_id=p_event->>'transaction_id' and not refunded;
   update public.mobile_purchase_intents set status='completed',transaction_id=p_event->>'transaction_id'
    where user_id=p_user_id and store=product.store and product_id=product.product_id and status='pending'
    and created_at<=to_timestamp((p_event->>'purchased_at_ms')::bigint/1000.0);
  end if;
  if p_refund then
   update public.mobile_store_transactions set refunded=true where user_id=p_user_id and store=product.store and environment=p_event->>'environment' and transaction_id=p_event->>'transaction_id';
   update public.lab_monthly_allowances set revoked=true where user_id=p_user_id and store=product.store and product_id=product.product_id and period_start=to_timestamp((p_event->>'purchased_at_ms')::bigint/1000.0); end if;
 else perform public.apply_mobile_store_transaction_before_lab(p_user_id,p_event,p_refund); end if;
end $$;

create or replace function public.finish_mobile_billing(p_user_id uuid,p_token uuid,p_entitlements jsonb,p_refunds jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare item jsonb; started timestamptz; ending timestamptz;
begin
 if not public.finish_mobile_billing_before_lab(p_user_id,p_token,p_entitlements,p_refunds) then return false; end if;
 for item in select * from jsonb_array_elements(p_entitlements) where value->>'product_id' in('laque_lab_monthly_5','laque_lab_monthly_5:monthly') loop
  started:=(item->>'purchased_at')::timestamptz; ending:=(item->>'expires_at')::timestamptz;
  if started is null or ending is null or ending<=started then raise exception 'INVALID_LAB_PERIOD'; end if;
  insert into public.lab_monthly_allowances(user_id,store,product_id,period_start,period_end,revoked)
   values(p_user_id,item->>'store',item->>'product_id',started,ending,coalesce((item->>'refunded')::boolean,false))
   on conflict(user_id,store,product_id,period_start) do update set
   period_end=excluded.period_end,revoked=lab_monthly_allowances.revoked or excluded.revoked;
 end loop;
 return true;
end $$;

create or replace function public.begin_mobile_purchase(p_user_id uuid,p_id uuid,p_store text,p_product text) returns uuid language plpgsql security definer set search_path='' as $$
declare product public.mobile_store_products; status jsonb;
begin
 perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
 if not found or public.account_is_suspended(p_user_id) then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 select * into product from public.mobile_store_products where store=p_store and product_id=p_product and active;
 if not found or product.product_id not in('laque_lab_monthly_5','laque_lab_monthly_5:monthly','laque_lab_tokens_30','laque_lab_tokens_100') then raise exception 'PRODUCT_UNAVAILABLE'; end if;
 status:=public.lab_subscription_status(p_user_id);
 if product.kind='credits' and (not (status->>'active')::boolean or (status->>'monthlyRemaining')::integer>0) then raise exception 'USE_MONTHLY_ALLOWANCE_FIRST'; end if;
 return public.begin_mobile_purchase_before_lab(p_user_id,p_id,p_store,p_product);
end $$;

$migration202610080036$;
  insert into supabase_migrations.schema_migrations(version,name,statements) values('202610080036','lab_play_base_plan',array['Reviewed beta Lab installer']);
 end if;
end $installer$;
select 'beta Lab subscription ready (035 + 036)' as result;
commit;
