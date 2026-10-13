-- Dedicated Stripe Lab sandbox. No legacy deposit credentials or store grants are changed.
begin;
create table public.lab_stripe_customers(
 user_id uuid primary key references public.profiles_data(id) on delete cascade,
 account_id text not null check(account_id='acct_1UOYhj2MrQDGVNuk'), customer_id text unique not null,
 claim_token uuid,claim_until timestamptz,needs_review boolean not null default false,verified_at timestamptz);
create table public.lab_stripe_checkouts(
 id uuid primary key,user_id uuid not null references public.profiles_data(id) on delete cascade,
 package text not null check(package in('monthly','tokens30','tokens100')),
 session_id text unique,subscription_id text unique,payment_intent text unique,
 status text not null default 'creating' check(status in('creating','open','paid','expired','failed')),
 created_at timestamptz not null default now(),expires_at timestamptz,
 refunded_units integer not null default 0 check(refunded_units>=0));
create table public.lab_stripe_subscriptions(
 id text primary key,user_id uuid not null references public.profiles_data(id) on delete cascade,
 customer_id text not null,status text not null,cancel_at_period_end boolean not null default false,
 updated_at timestamptz not null default now());
create table public.lab_stripe_invoices(
 id text primary key,user_id uuid not null references public.profiles_data(id) on delete cascade,
 subscription_id text not null references public.lab_stripe_subscriptions(id),
 payment_intent text unique,period_start timestamptz not null,period_end timestamptz not null,
 refunded boolean not null default false,fulfilled boolean not null default false,check(period_end>period_start));
do $$ declare t text; begin
 foreach t in array array['lab_stripe_customers','lab_stripe_checkouts','lab_stripe_subscriptions','lab_stripe_invoices'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

alter function public.lab_subscription_status(uuid) rename to lab_subscription_status_before_stripe;
create function public.lab_subscription_status(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; a public.lab_monthly_allowances; review boolean;
begin
 result:=public.lab_subscription_status_before_stripe(p_user_id);
 select needs_review into review from public.lab_stripe_customers where user_id=p_user_id;
 if coalesce(review,false) then return result||jsonb_build_object('active',false,'needsReview',true); end if;
 if (result->>'active')::boolean then return result; end if;
 select allowance.* into a from public.lab_monthly_allowances allowance
 join public.lab_stripe_invoices i on i.user_id=allowance.user_id and i.period_start=allowance.period_start and i.period_end=allowance.period_end
 join public.lab_stripe_subscriptions s on s.id=i.subscription_id
 join public.profiles_data p on p.id=s.user_id
 where allowance.user_id=p_user_id and allowance.store='STRIPE_LAB' and allowance.product_id='laque_lab_monthly_5'
 and s.status='active' and not allowance.revoked and not i.refunded and p.deletion_started_at is null
 and allowance.period_start<=now() and allowance.period_end>now()
 and not public.account_is_suspended(p_user_id)
 order by allowance.period_start desc limit 1;
 if a.user_id is not null then return result||jsonb_build_object('active',true,'monthlyRemaining',15-a.used,'renewsAt',a.period_end,'store','STRIPE_LAB'); end if;
 return result;
end $$;

create function public.bind_lab_stripe_customer(p_user_id uuid,p_customer text) returns text
language plpgsql security definer set search_path='' as $$
declare existing text;
begin
 perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
 if not found or public.account_is_suspended(p_user_id) or p_customer!~'^cus_[A-Za-z0-9]+$' then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 insert into public.lab_stripe_customers(user_id,account_id,customer_id)
 values(p_user_id,'acct_1UOYhj2MrQDGVNuk',p_customer) on conflict(user_id) do nothing;
 select customer_id into existing from public.lab_stripe_customers where user_id=p_user_id;
 return existing;
end $$;

create function public.begin_lab_stripe_checkout(p_user_id uuid,p_id uuid,p_package text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.lab_stripe_checkouts; bill_status jsonb;
begin
 perform 1 from public.profiles_data where id=p_user_id and deletion_started_at is null for update;
 if not found or public.account_is_suspended(p_user_id) then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 select * into existing from public.lab_stripe_checkouts where id=p_id;
 if found then
 if existing.user_id<>p_user_id or existing.package<>p_package then raise exception 'CHECKOUT_IDENTITY_MISMATCH'; end if;
 return to_jsonb(existing);
 end if;
 if p_package not in('monthly','tokens30','tokens100') then raise exception 'PRODUCT_UNAVAILABLE'; end if;
 if exists(select from public.lab_stripe_checkouts where user_id=p_user_id and status in('creating','open'))
 or exists(select from public.mobile_purchase_intents where user_id=p_user_id and status='pending')
 or exists(select from public.subscription_checkouts where user_id=p_user_id)
 then raise exception 'PURCHASE_PENDING'; end if;
 bill_status:=public.lab_subscription_status(p_user_id);
 if (bill_status->>'needsReview')::boolean then raise exception 'BILLING_REVIEW'; end if;
 if p_package='monthly' then
 if (bill_status->>'active')::boolean or exists(select from public.lab_stripe_subscriptions where user_id=p_user_id and status not in('canceled','incomplete_expired'))
 or exists(select from public.mobile_entitlements where user_id=p_user_id and not refunded and expires_at>now())
 or exists(select from public.profiles_data where id=p_user_id and stripe_subscription_id is not null and coalesce(subscription_status,'') not in('canceled','incomplete_expired'))
 then raise exception 'SUBSCRIPTION_EXISTS'; end if;
 elsif not (bill_status->>'active')::boolean or bill_status->>'store'<>'STRIPE_LAB' or (bill_status->>'monthlyRemaining')::integer>0 then raise exception 'USE_MONTHLY_ALLOWANCE_FIRST'; end if;
 insert into public.lab_stripe_checkouts(id,user_id,package) values(p_id,p_user_id,p_package) returning * into existing;
 return to_jsonb(existing);
end $$;

create function public.claim_lab_stripe_sync(p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();
begin
 perform 1 from public.profiles_data where id=p_user_id for update;
 update public.lab_stripe_customers set claim_token=token,claim_until=now()+interval '3 minutes'
 where user_id=p_user_id and (claim_until is null or claim_until<now());
 if not found then return null; end if;
 return token;
end $$;
create function public.release_lab_stripe_sync(p_user_id uuid,p_token uuid) returns void
language sql security definer set search_path='' as $$
 update public.lab_stripe_customers set claim_token=null,claim_until=null where user_id=p_user_id and claim_token=p_token;
$$;

-- Only verified provider snapshots reach this RPC. Customer, checkout, subscription
-- and payment ownership is checked again here. Profile is always the first lock.
create function public.finish_lab_stripe_sync(p_user_id uuid,p_token uuid,p_snapshot jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare customer public.lab_stripe_customers; checkout public.lab_stripe_checkouts;
 item jsonb; invoice jsonb; s public.lab_stripe_subscriptions; existing public.lab_stripe_invoices;
 closed boolean; review boolean:=coalesce((p_snapshot->>'review')::boolean,false); units integer; owed integer; balance integer; delta integer; ledger public.credit_payments;
begin
 select deletion_started_at is not null into closed from public.profiles_data where id=p_user_id for update;
 if not found then return false; end if;
 select * into customer from public.lab_stripe_customers where user_id=p_user_id for update;
 if customer.user_id is null or p_token is null or customer.claim_token is distinct from p_token or customer.claim_until is null or customer.claim_until<now() or p_snapshot->>'customerId' is distinct from customer.customer_id
 or p_snapshot->>'accountId' is distinct from customer.account_id then return false; end if;
 for item in select * from jsonb_array_elements(p_snapshot->'checkouts') loop
 select * into checkout from public.lab_stripe_checkouts where id=(item->>'id')::uuid for update;
 if not found or checkout.user_id<>p_user_id or checkout.package<>item->>'package'
 or (checkout.session_id is not null and checkout.session_id<>item->>'sessionId') then raise exception 'CHECKOUT_IDENTITY_MISMATCH'; end if;
 if checkout.status='paid' and item->>'status'<>'paid' then continue; end if;
 update public.lab_stripe_checkouts set session_id=item->>'sessionId',expires_at=(item->>'expiresAt')::timestamptz,
 status=item->>'status',subscription_id=coalesce(subscription_id,item->>'subscriptionId'),payment_intent=coalesce(payment_intent,item->>'paymentIntent') where id=checkout.id;
 if checkout.subscription_id is not null and checkout.subscription_id is distinct from item->>'subscriptionId'
 or checkout.payment_intent is not null and checkout.payment_intent is distinct from item->>'paymentIntent' then raise exception 'PAYMENT_IDENTITY_MISMATCH'; end if;
 if item->>'status'='paid' and checkout.package<>'monthly' then
 units:=case checkout.package when 'tokens30' then 30 else 100 end; owed:=(item->>'refundedUnits')::integer;
 if owed<0 or owed>units or item->>'paymentIntent' is null then raise exception 'INVALID_PAYMENT'; end if;
 select * into ledger from public.credit_payments where payment_intent='lab-stripe:'||customer.account_id||':'||(item->>'paymentIntent');
 if closed and ledger.payment_intent is null then review:=review or owed<units;
 else
 perform public.apply_credit_payment('lab-stripe:'||customer.account_id||':'||(item->>'paymentIntent')||':'||owed,
 'lab-stripe:'||customer.account_id||':'||(item->>'paymentIntent'),p_user_id,units,item->>'sessionId',owed);
 select * into ledger from public.credit_payments where payment_intent='lab-stripe:'||customer.account_id||':'||(item->>'paymentIntent');
 review:=review or ledger.deducted_credits<ledger.refunded_credits;
 end if;
 update public.lab_stripe_checkouts set refunded_units=greatest(refunded_units,owed) where id=checkout.id;
 end if;
 end loop;
 for item in select * from jsonb_array_elements(p_snapshot->'subscriptions') loop
 if not exists(select from public.lab_stripe_checkouts where user_id=p_user_id and subscription_id=item->>'id' and package='monthly' and status='paid') then raise exception 'UNBOUND_SUBSCRIPTION'; end if;
 select * into s from public.lab_stripe_subscriptions where id=item->>'id' for update;
 if found and (s.user_id<>p_user_id or s.customer_id<>customer.customer_id) then raise exception 'SUBSCRIPTION_IDENTITY_MISMATCH'; end if;
 insert into public.lab_stripe_subscriptions(id,user_id,customer_id,status,cancel_at_period_end)
 values(item->>'id',p_user_id,customer.customer_id,item->>'status',(item->>'cancelAtPeriodEnd')::boolean)
 on conflict(id) do update set status=case when lab_stripe_subscriptions.status in('canceled','incomplete_expired') then lab_stripe_subscriptions.status else excluded.status end,
 cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now();
 for invoice in select * from jsonb_array_elements(item->'invoices') loop
 select * into existing from public.lab_stripe_invoices where id=invoice->>'id' for update;
 if found and (existing.user_id<>p_user_id or existing.subscription_id<>item->>'id' or existing.period_start<>(invoice->>'periodStart')::timestamptz or existing.period_end<>(invoice->>'periodEnd')::timestamptz or existing.payment_intent is distinct from invoice->>'paymentIntent') then raise exception 'INVOICE_IDENTITY_MISMATCH'; end if;
 insert into public.lab_stripe_invoices(id,user_id,subscription_id,payment_intent,period_start,period_end,refunded,fulfilled)
 values(invoice->>'id',p_user_id,item->>'id',invoice->>'paymentIntent',(invoice->>'periodStart')::timestamptz,(invoice->>'periodEnd')::timestamptz,(invoice->>'refunded')::boolean,not closed)
 on conflict(id) do update set refunded=lab_stripe_invoices.refunded or excluded.refunded;
 if not closed then
 insert into public.lab_monthly_allowances(user_id,store,product_id,period_start,period_end,revoked)
 values(p_user_id,'STRIPE_LAB','laque_lab_monthly_5',(invoice->>'periodStart')::timestamptz,(invoice->>'periodEnd')::timestamptz,(invoice->>'refunded')::boolean)
 on conflict(user_id,store,product_id,period_start) do update set revoked=lab_monthly_allowances.revoked or excluded.revoked;
 else review:=review or (not coalesce(existing.fulfilled,false) and not (invoice->>'refunded')::boolean); end if;
 end loop;
 end loop;
 -- A later verified balance/correction can settle an earlier spent-token refund.
 -- Replaying a receipt still never grants twice or subtracts the same unit twice.
 for ledger in select * from public.credit_payments where user_id=p_user_id and payment_intent like 'lab-stripe:%' and refunded_credits>deducted_credits for update loop
 select credit_balance into balance from public.profiles_data where id=p_user_id;
 delta:=least(balance,ledger.refunded_credits-ledger.deducted_credits);
 if delta>0 then
 update public.profiles_data set credit_balance=credit_balance-delta where id=p_user_id;
 update public.credit_payments set deducted_credits=deducted_credits+delta,updated_at=now() where payment_intent=ledger.payment_intent;
 end if;
 end loop;
 review:=review and (closed or coalesce((p_snapshot->>'review')::boolean,false));
 -- Existing unresolved refund debt must continue blocking work on later snapshots.
 review:=review or exists(select from public.credit_payments where user_id=p_user_id and payment_intent like 'lab-stripe:%' and refunded_credits>deducted_credits);
 update public.lab_stripe_customers set needs_review=review,verified_at=now() where user_id=p_user_id;
 return true;
end $$;

alter function public.begin_mobile_purchase(uuid,uuid,text,text) rename to begin_mobile_purchase_before_stripe;
create function public.begin_mobile_purchase(p_user_id uuid,p_id uuid,p_store text,p_product text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles_data where id=p_user_id for update;
 if exists(select from public.lab_stripe_checkouts where user_id=p_user_id and status in('creating','open'))
 or exists(select from public.lab_stripe_subscriptions where user_id=p_user_id and status not in('canceled','incomplete_expired')) then raise exception 'STRIPE_PURCHASE_EXISTS'; end if;
 return public.begin_mobile_purchase_before_stripe(p_user_id,p_id,p_store,p_product);
end $$;
-- Closure is immediate. Physical erasure still waits for billing settlement.
alter function public.begin_account_deletion(uuid) rename to begin_account_deletion_before_lab_stripe;
create function public.begin_account_deletion(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles_data where id=p_user_id for update;
 if exists(select from public.lab_stripe_checkouts where user_id=p_user_id and status in('creating','open'))
 or exists(select from public.lab_stripe_subscriptions where user_id=p_user_id and status not in('canceled','incomplete_expired'))
 or exists(select from public.lab_stripe_customers where user_id=p_user_id and (needs_review or claim_until>now())) then raise exception 'BILLING_IN_PROGRESS'; end if;
 perform public.begin_account_deletion_before_lab_stripe(p_user_id);
end $$;
-- Same plan/allowance contract for Overview and Lab diagnostics; do not double count.
alter function public.admin_lab_summary(uuid) rename to admin_lab_summary_before_stripe;
create function public.admin_lab_summary(p_actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; total integer;
begin
 result:=public.admin_lab_summary_before_stripe(p_actor);
 select count(*) into total from public.profiles_data p
 where p.deletion_started_at is null and not exists(select from public.admin_staff where user_id=p.id)
 and not exists(select from auth.users where id=p.id and email like '%.example')
 and (public.lab_subscription_status(p.id)->>'active')::boolean;
 return result||jsonb_build_object('subscribers',total);
end $$;
do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace
 and (proname like '%lab_stripe%' or proname in('lab_subscription_status_before_stripe','begin_mobile_purchase_before_stripe','admin_lab_summary_before_stripe','begin_account_deletion_before_lab_stripe')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.signature::text not like '%before%' then execute format('grant execute on function %s to service_role',f.signature); end if;
 end loop;
end $$;
revoke all on function public.lab_subscription_status(uuid),public.admin_lab_summary(uuid),public.begin_mobile_purchase(uuid,uuid,text,text),public.begin_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.lab_subscription_status(uuid),public.admin_lab_summary(uuid),public.begin_mobile_purchase(uuid,uuid,text,text),public.begin_account_deletion(uuid) to service_role;
commit;
