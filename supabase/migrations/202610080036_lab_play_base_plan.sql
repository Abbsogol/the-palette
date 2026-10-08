-- RevenueCat identifies modern Google Play subscriptions as product:base-plan.
-- No products are activated by this migration. Keep Apple and Google identities distinct.
begin;
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
commit;
