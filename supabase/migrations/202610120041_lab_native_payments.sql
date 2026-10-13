-- Native PaymentSheet uses the existing verified Lab ledger and purchase locks.
begin;
alter table public.lab_stripe_checkouts add column surface text not null default 'hosted' check(surface in ('hosted','native'));
alter function public.begin_lab_stripe_checkout(uuid,uuid,text) rename to begin_lab_stripe_checkout_before_native;
create function public.begin_lab_stripe_checkout(p_user_id uuid,p_id uuid,p_package text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 item:=public.begin_lab_stripe_checkout_before_native(p_user_id,p_id,p_package);
 if item->>'surface'<>'hosted' then raise exception 'CHECKOUT_IDENTITY_MISMATCH'; end if;
 return item;
end $$;
create function public.begin_lab_stripe_native_checkout(p_user_id uuid,p_id uuid,p_package text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; existing public.lab_stripe_checkouts;
begin
 perform 1 from public.profiles_data where id=p_user_id for update;
 select * into existing from public.lab_stripe_checkouts where id=p_id;
 if found then
 if existing.user_id<>p_user_id or existing.package<>p_package or existing.surface<>'native' then raise exception 'CHECKOUT_IDENTITY_MISMATCH'; end if;
 -- Revalidate suspension/deletion even when resuming an existing payment.
 if public.account_is_suspended(p_user_id) or exists(select from public.profiles_data where id=p_user_id and deletion_started_at is not null) then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
 return to_jsonb(existing);
 end if;
 item:=public.begin_lab_stripe_checkout_before_native(p_user_id,p_id,p_package);
 -- session_id is the legacy receipt-reference column, not a Stripe session for native payments.
 update public.lab_stripe_checkouts set surface='native',session_id='native:'||p_id::text where id=p_id returning * into existing;
 return to_jsonb(existing);
end $$;
create function public.bind_lab_stripe_native_resource(p_user_id uuid,p_id uuid,p_resource text) returns void
language plpgsql security definer set search_path='' as $$
declare item public.lab_stripe_checkouts;
begin
 perform 1 from public.profiles_data where id=p_user_id for update;
 select * into item from public.lab_stripe_checkouts where id=p_id and user_id=p_user_id and surface='native' for update;
 if not found then raise exception 'CHECKOUT_IDENTITY_MISMATCH'; end if;
 if item.package='monthly' then
 if p_resource!~'^sub_[A-Za-z0-9]+$' or item.subscription_id is not null and item.subscription_id<>p_resource then raise exception 'PAYMENT_IDENTITY_MISMATCH'; end if;
 update public.lab_stripe_checkouts set subscription_id=p_resource where id=p_id;
 else
 if p_resource!~'^pi_[A-Za-z0-9]+$' or item.payment_intent is not null and item.payment_intent<>p_resource then raise exception 'PAYMENT_IDENTITY_MISMATCH'; end if;
 update public.lab_stripe_checkouts set payment_intent=p_resource where id=p_id;
 end if;
end $$;
revoke all on function public.begin_lab_stripe_checkout_before_native(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.begin_lab_stripe_checkout(uuid,uuid,text),public.begin_lab_stripe_native_checkout(uuid,uuid,text),public.bind_lab_stripe_native_resource(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_lab_stripe_checkout(uuid,uuid,text),public.begin_lab_stripe_native_checkout(uuid,uuid,text),public.bind_lab_stripe_native_resource(uuid,uuid,text) to service_role;
commit;
