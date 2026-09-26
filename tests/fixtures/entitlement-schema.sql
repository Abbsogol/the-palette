-- Minimal dependency schema for entitlement tests, based on the inspected
-- production catalog (2026-09-26). No customer data. Supabase auth.users is
-- represented only by its ID; this is not a full RLS/production restore test.
create schema auth;
create table auth.users (id uuid primary key);
create role anon;
create role authenticated;
create role service_role;
create table public.profiles_data (
  id uuid not null,
  display_name text,
  bio text,
  location text,
  avatar_url text,
  account_type text default 'user'::text,
  is_verified boolean default false,
  created_at timestamp with time zone default now(),
  weekly_uploads integer default 0,
  week_reset_at timestamp with time zone default now(),
  is_pro boolean default false,
  phone_number text,
  preferred_contact text,
  booking_notes text,
  booking_area text,
  nail_shape text,
  nail_length text,
  nail_colors text[],
  nail_finishes text[],
  nail_techniques text[],
  occasions text[],
  budget_range text,
  allergies text,
  product_sensitivities text[],
  removal_needed boolean default false,
  nail_condition text,
  skin_undertone text,
  hand_photo_url text,
  credit_balance integer default 0,
  onboarding_complete boolean default false,
  specialties text[],
  username text,
  subscription_tier text,
  is_admin boolean default false,
  is_private boolean default false,
  message_permission text default 'everyone'::text,
  show_saves boolean default true,
  referral_code text,
  referred_by text,
  email text,
  stripe_customer_id text,
  subscription_status text
);
create table public.nail_lab_generations (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  image_url text,
  shape text,
  length text,
  colors text[],
  custom_text text,
  prompt_used text,
  reference_design_ids uuid[],
  reference_image_urls text[],
  has_used_free_regen boolean default false,
  credits_used integer default 1,
  created_at timestamp with time zone default now(),
  free_regen_used boolean default false,
  parent_generation_id uuid,
  vibe text[],
  occasion text[]
);
create table public.rewards (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  points integer not null,
  reason text not null,
  created_at timestamp with time zone default now(),
  ref_id text
);
create table public.processed_webhook_events (
  event_id text not null,
  created_at timestamp with time zone default now() not null
);
alter table public.nail_lab_generations add constraint nail_lab_generations_pkey PRIMARY KEY (id);
alter table public.processed_webhook_events add constraint processed_webhook_events_pkey PRIMARY KEY (event_id);
alter table public.profiles_data add constraint profiles_account_type_check CHECK (account_type = ANY (ARRAY['user'::text, 'creator'::text, 'salon'::text]));
alter table public.profiles_data add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles_data add constraint profiles_referral_code_key UNIQUE (referral_code);
alter table public.profiles_data add constraint profiles_username_key UNIQUE (username);
alter table public.profiles_data add constraint username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_.]{3,30}$'::text);
alter table public.rewards add constraint rewards_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX rewards_user_reason_ref_unique ON public.rewards USING btree (user_id, reason, ref_id) WHERE (ref_id IS NOT NULL);
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
 if current_user not in ('service_role', 'postgres') then
 if tg_op = 'INSERT' then
 new.credit_balance := 0;
 new.is_admin := false;
 new.subscription_tier := null;
 elsif tg_op = 'UPDATE' then
 new.credit_balance := old.credit_balance;
 new.is_admin := old.is_admin;
 new.subscription_tier := old.subscription_tier;
 end if;
 end if;
 return new;
end;
$function$;
CREATE TRIGGER protect_privileged_profile_columns_trg BEFORE INSERT OR UPDATE ON profiles_data FOR EACH ROW EXECUTE FUNCTION protect_privileged_profile_columns();
alter table public.nail_lab_generations add constraint nail_lab_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public.profiles_data add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.rewards add constraint rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
