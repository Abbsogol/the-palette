-- Test-only reconstruction of the public catalog captured 2026-09-26.
-- Contains no user data. Auth helpers and Storage tables are minimal stand-ins;
-- this is NOT a complete Supabase schema export or a restore certification.
create schema auth;
create schema storage;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
-- Roles are cluster-wide: normalize even when Phase 1 already created them.
-- Only loaded by the guarded disposable local test harness.
alter role anon nobypassrls;
alter role authenticated nobypassrls;
alter role service_role bypassrls;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner_id text, metadata jsonb);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;
grant all on storage.buckets to service_role;
insert into storage.buckets(id,name,public) values ('designs','designs',true),('nail-lab','nail-lab',false);

create table public."availability" (
  "id" uuid default gen_random_uuid() not null,
  "creator_id" uuid not null,
  "day_of_week" integer not null,
  "start_time" time without time zone not null,
  "end_time" time without time zone not null,
  "is_active" boolean default true
);
alter table public."availability" enable row level security;
create table public."blocks" (
  "id" uuid default gen_random_uuid() not null,
  "blocker_id" uuid,
  "blocked_id" uuid,
  "created_at" timestamp with time zone default now()
);
alter table public."blocks" enable row level security;
create table public."bookings" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "creator_id" uuid not null,
  "service_id" uuid,
  "booking_date" date not null,
  "start_time" time without time zone not null,
  "end_time" time without time zone not null,
  "status" text default 'pending'::text,
  "notes" text,
  "created_at" timestamp with time zone default now(),
  "deposit_paid" boolean default false,
  "stripe_payment_intent" text,
  "reminder_sent_at" timestamp with time zone,
  "reference_design_id" uuid
);
alter table public."bookings" enable row level security;
create table public."challenge_submissions" (
  "id" uuid default gen_random_uuid() not null,
  "challenge_id" uuid not null,
  "user_id" uuid not null,
  "image_url" text not null,
  "caption" text,
  "created_at" timestamp with time zone default now()
);
alter table public."challenge_submissions" enable row level security;
create table public."challenge_votes" (
  "id" uuid default gen_random_uuid() not null,
  "submission_id" uuid not null,
  "user_id" uuid not null,
  "created_at" timestamp with time zone default now()
);
alter table public."challenge_votes" enable row level security;
create table public."challenges" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "description" text,
  "ends_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now()
);
alter table public."challenges" enable row level security;
create table public."client_booking_notes" (
  "user_id" uuid not null,
  "booking_notes" text,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."client_booking_notes" enable row level security;
create table public."client_health_notes" (
  "user_id" uuid not null,
  "allergies" text,
  "product_sensitivities" text[] default '{}'::text[] not null,
  "removal_needed" boolean default false not null,
  "share_with_tech" boolean default false not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."client_health_notes" enable row level security;
create table public."client_notes" (
  "id" uuid default gen_random_uuid() not null,
  "booking_id" uuid not null,
  "creator_id" uuid not null,
  "client_id" uuid not null,
  "note" text default ''::text not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."client_notes" enable row level security;
create table public."collection_designs" (
  "id" uuid default gen_random_uuid() not null,
  "collection_id" uuid not null,
  "design_id" uuid not null,
  "added_at" timestamp with time zone default now()
);
alter table public."collection_designs" enable row level security;
create table public."collections" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "name" text not null,
  "created_at" timestamp with time zone default now()
);
alter table public."collections" enable row level security;
create table public."conversations" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "creator_id" uuid not null,
  "last_message_at" timestamp with time zone default now(),
  "created_at" timestamp with time zone default now(),
  "muted_by" uuid[] default '{}'::uuid[] not null
);
alter table public."conversations" enable row level security;
create table public."design_colours" (
  "id" uuid default gen_random_uuid() not null,
  "design_id" uuid,
  "hex_code" text,
  "brand_name" text,
  "brand_code" text,
  "colour_name" text,
  "colour_order" integer default 1
);
alter table public."design_colours" enable row level security;
create table public."design_comments" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "design_id" uuid,
  "body" text not null,
  "created_at" timestamp with time zone default now()
);
alter table public."design_comments" enable row level security;
create table public."design_images" (
  "id" uuid default gen_random_uuid() not null,
  "design_id" uuid,
  "image_url" text not null,
  "image_order" integer default 1,
  "created_at" timestamp with time zone default now()
);
alter table public."design_images" enable row level security;
create table public."design_likes" (
  "user_id" uuid not null,
  "design_id" uuid not null,
  "created_at" timestamp with time zone default now()
);
alter table public."design_likes" enable row level security;
create table public."design_products" (
  "id" uuid default gen_random_uuid() not null,
  "design_id" uuid,
  "product_id" uuid,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now()
);
alter table public."design_products" enable row level security;
create table public."design_tags" (
  "design_id" uuid not null,
  "tag_id" uuid not null
);
alter table public."design_tags" enable row level security;
create table public."designs" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "description" text,
  "image_url" text,
  "shape" text,
  "length" text,
  "occasion" text,
  "technique" text,
  "is_published" boolean default false,
  "created_at" timestamp with time zone default now(),
  "created_by" uuid,
  "category" text,
  "saves_count" integer default 0,
  "is_curated" boolean default false,
  "likes_count" integer default 0,
  "comments_count" integer default 0,
  "is_pinned" boolean default false,
  "is_drop" boolean default false,
  "boosted_until" timestamp with time zone,
  "source_generation_id" uuid,
  "image_width" integer,
  "image_height" integer
);
alter table public."designs" enable row level security;
create table public."favourite_creators" (
  "user_id" uuid not null,
  "creator_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public."favourite_creators" enable row level security;
create table public."follows" (
  "follower_id" uuid not null,
  "following_id" uuid not null,
  "created_at" timestamp with time zone default now()
);
alter table public."follows" enable row level security;
create table public."image_backfill_map" (
  "id" bigint not null,
  "table_name" text not null,
  "column_name" text not null,
  "row_id" uuid,
  "old_url" text not null,
  "new_url" text not null,
  "old_bytes" bigint,
  "new_bytes" bigint,
  "in_w" integer,
  "in_h" integer,
  "out_w" integer,
  "out_h" integer,
  "perceptual_diff" numeric,
  "encoded_at" timestamp with time zone default now() not null,
  "verified_at" timestamp with time zone,
  "switched_at" timestamp with time zone
);
alter table public."image_backfill_map" enable row level security;
create table public."messages" (
  "id" uuid default gen_random_uuid() not null,
  "conversation_id" uuid not null,
  "sender_id" uuid not null,
  "content" text not null,
  "is_read" boolean default false,
  "created_at" timestamp with time zone default now()
);
alter table public."messages" enable row level security;
create table public."moodboard_designs" (
  "id" uuid default gen_random_uuid() not null,
  "moodboard_id" uuid not null,
  "design_id" uuid not null,
  "added_at" timestamp with time zone default now()
);
alter table public."moodboard_designs" enable row level security;
create table public."moodboard_members" (
  "id" uuid default gen_random_uuid() not null,
  "moodboard_id" uuid,
  "user_id" uuid,
  "invited_by" uuid,
  "created_at" timestamp with time zone default now()
);
alter table public."moodboard_members" enable row level security;
create table public."moodboards" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "name" text not null,
  "description" text,
  "cover_image_url" text,
  "is_public" boolean default false,
  "created_at" timestamp with time zone default now()
);
alter table public."moodboards" enable row level security;
create table public."nail_lab_generations" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "image_url" text,
  "shape" text,
  "length" text,
  "colors" text[],
  "custom_text" text,
  "prompt_used" text,
  "reference_design_ids" uuid[],
  "reference_image_urls" text[],
  "has_used_free_regen" boolean default false,
  "credits_used" integer default 1,
  "created_at" timestamp with time zone default now(),
  "free_regen_used" boolean default false,
  "parent_generation_id" uuid,
  "vibe" text[],
  "occasion" text[]
);
alter table public."nail_lab_generations" enable row level security;
create table public."notifications" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "actor_id" uuid not null,
  "type" text not null,
  "design_id" uuid,
  "comment_preview" text,
  "read" boolean default false not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public."notifications" enable row level security;
create table public."processed_webhook_events" (
  "event_id" text not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public."processed_webhook_events" enable row level security;
create table public."products" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "brand" text,
  "category" text,
  "description" text,
  "image_url" text,
  "affiliate_url" text not null,
  "price_label" text,
  "is_featured" boolean default false,
  "is_published" boolean default true,
  "created_at" timestamp with time zone default now()
);
alter table public."products" enable row level security;
create table public."profiles_data" (
  "id" uuid not null,
  "display_name" text,
  "bio" text,
  "location" text,
  "avatar_url" text,
  "account_type" text default 'user'::text,
  "is_verified" boolean default false,
  "created_at" timestamp with time zone default now(),
  "weekly_uploads" integer default 0,
  "week_reset_at" timestamp with time zone default now(),
  "is_pro" boolean default false,
  "phone_number" text,
  "preferred_contact" text,
  "booking_notes" text,
  "booking_area" text,
  "nail_shape" text,
  "nail_length" text,
  "nail_colors" text[],
  "nail_finishes" text[],
  "nail_techniques" text[],
  "occasions" text[],
  "budget_range" text,
  "allergies" text,
  "product_sensitivities" text[],
  "removal_needed" boolean default false,
  "nail_condition" text,
  "skin_undertone" text,
  "hand_photo_url" text,
  "credit_balance" integer default 0,
  "onboarding_complete" boolean default false,
  "specialties" text[],
  "username" text,
  "subscription_tier" text,
  "is_admin" boolean default false,
  "is_private" boolean default false,
  "message_permission" text default 'everyone'::text,
  "show_saves" boolean default true,
  "referral_code" text,
  "referred_by" text,
  "email" text,
  "stripe_customer_id" text,
  "subscription_status" text
);
alter table public."profiles_data" enable row level security;
create table public."reviews" (
  "id" uuid default gen_random_uuid() not null,
  "booking_id" uuid,
  "reviewer_id" uuid,
  "creator_id" uuid,
  "rating" integer not null,
  "text" text,
  "created_at" timestamp with time zone default now()
);
alter table public."reviews" enable row level security;
create table public."rewards" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "points" integer not null,
  "reason" text not null,
  "created_at" timestamp with time zone default now(),
  "ref_id" text
);
alter table public."rewards" enable row level security;
create table public."salon_posts" (
  "id" uuid default gen_random_uuid() not null,
  "creator_id" uuid not null,
  "body" text not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."salon_posts" enable row level security;
create table public."saved_designs" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "design_id" uuid not null,
  "saved_at" timestamp with time zone default now()
);
alter table public."saved_designs" enable row level security;
create table public."services" (
  "id" uuid default gen_random_uuid() not null,
  "creator_id" uuid not null,
  "name" text not null,
  "description" text,
  "duration_minutes" integer default 60 not null,
  "price" numeric default 0 not null,
  "is_active" boolean default true,
  "created_at" timestamp with time zone default now(),
  "deposit_amount" numeric default 0
);
alter table public."services" enable row level security;
create table public."stories" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "image_url" text not null,
  "caption" text,
  "created_at" timestamp with time zone default now()
);
alter table public."stories" enable row level security;
create table public."story_likes" (
  "story_id" uuid not null,
  "user_id" uuid not null,
  "liked_at" timestamp with time zone default now()
);
alter table public."story_likes" enable row level security;
create table public."tags" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null
);
alter table public."tags" enable row level security;
alter table public."availability" add constraint "availability_creator_day_unique" UNIQUE (creator_id, day_of_week);
alter table public."availability" add constraint "availability_creator_id_day_of_week_key" UNIQUE (creator_id, day_of_week);
alter table public."availability" add constraint "availability_day_of_week_check" CHECK (day_of_week >= 0 AND day_of_week <= 6);
alter table public."availability" add constraint "availability_pkey" PRIMARY KEY (id);
alter table public."blocks" add constraint "blocks_blocker_id_blocked_id_key" UNIQUE (blocker_id, blocked_id);
alter table public."blocks" add constraint "blocks_pkey" PRIMARY KEY (id);
alter table public."bookings" add constraint "bookings_pkey" PRIMARY KEY (id);
alter table public."bookings" add constraint "bookings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text, 'cancelled'::text]));
alter table public."challenge_submissions" add constraint "challenge_submissions_challenge_id_user_id_key" UNIQUE (challenge_id, user_id);
alter table public."challenge_submissions" add constraint "challenge_submissions_pkey" PRIMARY KEY (id);
alter table public."challenge_votes" add constraint "challenge_votes_pkey" PRIMARY KEY (id);
alter table public."challenge_votes" add constraint "challenge_votes_submission_id_user_id_key" UNIQUE (submission_id, user_id);
alter table public."challenges" add constraint "challenges_pkey" PRIMARY KEY (id);
alter table public."client_booking_notes" add constraint "client_booking_notes_pkey" PRIMARY KEY (user_id);
alter table public."client_health_notes" add constraint "client_health_notes_pkey" PRIMARY KEY (user_id);
alter table public."client_notes" add constraint "client_notes_booking_id_key" UNIQUE (booking_id);
alter table public."client_notes" add constraint "client_notes_pkey" PRIMARY KEY (id);
alter table public."collection_designs" add constraint "collection_designs_pkey" PRIMARY KEY (id);
alter table public."collections" add constraint "collections_pkey" PRIMARY KEY (id);
alter table public."conversations" add constraint "conversations_client_id_creator_id_key" UNIQUE (client_id, creator_id);
alter table public."conversations" add constraint "conversations_pkey" PRIMARY KEY (id);
alter table public."design_colours" add constraint "design_colours_pkey" PRIMARY KEY (id);
alter table public."design_comments" add constraint "design_comments_body_check" CHECK (char_length(body) > 0 AND char_length(body) <= 500);
alter table public."design_comments" add constraint "design_comments_pkey" PRIMARY KEY (id);
alter table public."design_images" add constraint "design_images_pkey" PRIMARY KEY (id);
alter table public."design_likes" add constraint "design_likes_pkey" PRIMARY KEY (user_id, design_id);
alter table public."design_products" add constraint "design_products_design_id_product_id_key" UNIQUE (design_id, product_id);
alter table public."design_products" add constraint "design_products_pkey" PRIMARY KEY (id);
alter table public."design_tags" add constraint "design_tags_pkey" PRIMARY KEY (design_id, tag_id);
alter table public."designs" add constraint "designs_pkey" PRIMARY KEY (id);
alter table public."favourite_creators" add constraint "favourite_creators_pkey" PRIMARY KEY (user_id, creator_id);
alter table public."follows" add constraint "follows_pkey" PRIMARY KEY (follower_id, following_id);
alter table public."image_backfill_map" add constraint "image_backfill_map_pkey" PRIMARY KEY (id);
alter table public."messages" add constraint "messages_pkey" PRIMARY KEY (id);
alter table public."moodboard_designs" add constraint "moodboard_designs_moodboard_id_design_id_key" UNIQUE (moodboard_id, design_id);
alter table public."moodboard_designs" add constraint "moodboard_designs_pkey" PRIMARY KEY (id);
alter table public."moodboard_members" add constraint "moodboard_members_moodboard_id_user_id_key" UNIQUE (moodboard_id, user_id);
alter table public."moodboard_members" add constraint "moodboard_members_pkey" PRIMARY KEY (id);
alter table public."moodboards" add constraint "moodboards_pkey" PRIMARY KEY (id);
alter table public."nail_lab_generations" add constraint "nail_lab_generations_pkey" PRIMARY KEY (id);
alter table public."notifications" add constraint "notifications_pkey" PRIMARY KEY (id);
alter table public."notifications" add constraint "notifications_type_check" CHECK (type = ANY (ARRAY['follow'::text, 'like'::text, 'comment'::text, 'new_message'::text, 'booking_request'::text, 'booking_confirmed'::text, 'booking_declined'::text, 'appointment_reminder'::text, 'moodboard_invite'::text]));
alter table public."processed_webhook_events" add constraint "processed_webhook_events_pkey" PRIMARY KEY (event_id);
alter table public."products" add constraint "products_pkey" PRIMARY KEY (id);
alter table public."profiles_data" add constraint "profiles_account_type_check" CHECK (account_type = ANY (ARRAY['user'::text, 'creator'::text, 'salon'::text]));
alter table public."profiles_data" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."profiles_data" add constraint "profiles_referral_code_key" UNIQUE (referral_code);
alter table public."profiles_data" add constraint "profiles_username_key" UNIQUE (username);
alter table public."profiles_data" add constraint "username_format" CHECK (username IS NULL OR username ~ '^[a-z0-9_.]{3,30}$'::text);
alter table public."reviews" add constraint "reviews_booking_id_key" UNIQUE (booking_id);
alter table public."reviews" add constraint "reviews_pkey" PRIMARY KEY (id);
alter table public."reviews" add constraint "reviews_rating_check" CHECK (rating >= 1 AND rating <= 5);
alter table public."rewards" add constraint "rewards_pkey" PRIMARY KEY (id);
alter table public."salon_posts" add constraint "salon_posts_pkey" PRIMARY KEY (id);
alter table public."saved_designs" add constraint "saved_designs_pkey" PRIMARY KEY (id);
alter table public."saved_designs" add constraint "saved_designs_user_id_design_id_key" UNIQUE (user_id, design_id);
alter table public."services" add constraint "services_pkey" PRIMARY KEY (id);
alter table public."stories" add constraint "stories_pkey" PRIMARY KEY (id);
alter table public."story_likes" add constraint "story_likes_pkey" PRIMARY KEY (story_id, user_id);
alter table public."tags" add constraint "tags_name_key" UNIQUE (name);
alter table public."tags" add constraint "tags_pkey" PRIMARY KEY (id);
alter table public."availability" add constraint "availability_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."blocks" add constraint "blocks_blocked_id_fkey" FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."blocks" add constraint "blocks_blocker_id_fkey" FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."bookings" add constraint "bookings_client_id_fkey" FOREIGN KEY (client_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."bookings" add constraint "bookings_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."bookings" add constraint "bookings_reference_design_id_fkey" FOREIGN KEY (reference_design_id) REFERENCES designs(id) ON DELETE SET NULL;
alter table public."bookings" add constraint "bookings_service_id_fkey" FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
alter table public."challenge_submissions" add constraint "challenge_submissions_challenge_id_fkey" FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;
alter table public."challenge_submissions" add constraint "challenge_submissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."challenge_votes" add constraint "challenge_votes_submission_id_fkey" FOREIGN KEY (submission_id) REFERENCES challenge_submissions(id) ON DELETE CASCADE;
alter table public."challenge_votes" add constraint "challenge_votes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."client_booking_notes" add constraint "client_booking_notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."client_health_notes" add constraint "client_health_notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."client_notes" add constraint "client_notes_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public."client_notes" add constraint "client_notes_client_id_fkey" FOREIGN KEY (client_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."client_notes" add constraint "client_notes_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."collection_designs" add constraint "collection_designs_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES collections(id);
alter table public."collection_designs" add constraint "collection_designs_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id);
alter table public."conversations" add constraint "conversations_client_id_fkey" FOREIGN KEY (client_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."conversations" add constraint "conversations_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."design_colours" add constraint "design_colours_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."design_comments" add constraint "design_comments_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."design_comments" add constraint "design_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."design_images" add constraint "design_images_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."design_likes" add constraint "design_likes_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."design_likes" add constraint "design_likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."design_products" add constraint "design_products_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."design_products" add constraint "design_products_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public."design_tags" add constraint "design_tags_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."design_tags" add constraint "design_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
alter table public."designs" add constraint "designs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles_data(id);
alter table public."designs" add constraint "designs_source_generation_id_fkey" FOREIGN KEY (source_generation_id) REFERENCES nail_lab_generations(id);
alter table public."favourite_creators" add constraint "favourite_creators_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."favourite_creators" add constraint "favourite_creators_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."follows" add constraint "follows_follower_id_fkey" FOREIGN KEY (follower_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."follows" add constraint "follows_following_id_fkey" FOREIGN KEY (following_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."messages" add constraint "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table public."messages" add constraint "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."moodboard_designs" add constraint "moodboard_designs_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."moodboard_designs" add constraint "moodboard_designs_moodboard_id_fkey" FOREIGN KEY (moodboard_id) REFERENCES moodboards(id) ON DELETE CASCADE;
alter table public."moodboard_members" add constraint "moodboard_members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id);
alter table public."moodboard_members" add constraint "moodboard_members_moodboard_id_fkey" FOREIGN KEY (moodboard_id) REFERENCES moodboards(id) ON DELETE CASCADE;
alter table public."moodboard_members" add constraint "moodboard_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."moodboards" add constraint "moodboards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."nail_lab_generations" add constraint "nail_lab_generations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."notifications" add constraint "notifications_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."notifications" add constraint "notifications_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."profiles_data" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."reviews" add constraint "reviews_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public."reviews" add constraint "reviews_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."reviews" add constraint "reviews_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."rewards" add constraint "rewards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."salon_posts" add constraint "salon_posts_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."saved_designs" add constraint "saved_designs_design_id_fkey" FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE;
alter table public."saved_designs" add constraint "saved_designs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."services" add constraint "services_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."stories" add constraint "stories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles_data(id) ON DELETE CASCADE;
alter table public."story_likes" add constraint "story_likes_story_id_fkey" FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;
alter table public."story_likes" add constraint "story_likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX designs_source_generation_id_unique ON public.designs USING btree (source_generation_id) WHERE (source_generation_id IS NOT NULL);
CREATE UNIQUE INDEX rewards_user_reason_ref_unique ON public.rewards USING btree (user_id, reason, ref_id) WHERE (ref_id IS NOT NULL);
create view public."profiles" as  SELECT id,
 display_name,
 bio,
 CASE
 WHEN ((auth.uid() = id) OR (account_type = ANY (ARRAY['creator'::text, 'salon'::text]))) THEN location
 ELSE NULL::text
 END AS location,
 avatar_url,
 account_type,
 is_verified,
 created_at,
 CASE
 WHEN (auth.uid() = id) THEN weekly_uploads
 ELSE NULL::integer
 END AS weekly_uploads,
 CASE
 WHEN (auth.uid() = id) THEN week_reset_at
 ELSE NULL::timestamp with time zone
 END AS week_reset_at,
 is_pro,
 CASE
 WHEN ((auth.uid() = id) OR (account_type = ANY (ARRAY['creator'::text, 'salon'::text]))) THEN phone_number
 ELSE NULL::text
 END AS phone_number,
 CASE
 WHEN ((auth.uid() = id) OR (account_type = ANY (ARRAY['creator'::text, 'salon'::text]))) THEN preferred_contact
 ELSE NULL::text
 END AS preferred_contact,
 CASE
 WHEN (auth.uid() = id) THEN booking_notes
 ELSE NULL::text
 END AS booking_notes,
 booking_area,
 CASE
 WHEN (auth.uid() = id) THEN nail_shape
 ELSE NULL::text
 END AS nail_shape,
 CASE
 WHEN (auth.uid() = id) THEN nail_length
 ELSE NULL::text
 END AS nail_length,
 CASE
 WHEN (auth.uid() = id) THEN nail_colors
 ELSE NULL::text[]
 END AS nail_colors,
 CASE
 WHEN (auth.uid() = id) THEN nail_finishes
 ELSE NULL::text[]
 END AS nail_finishes,
 CASE
 WHEN (auth.uid() = id) THEN nail_techniques
 ELSE NULL::text[]
 END AS nail_techniques,
 CASE
 WHEN (auth.uid() = id) THEN occasions
 ELSE NULL::text[]
 END AS occasions,
 CASE
 WHEN (auth.uid() = id) THEN budget_range
 ELSE NULL::text
 END AS budget_range,
 CASE
 WHEN (auth.uid() = id) THEN allergies
 ELSE NULL::text
 END AS allergies,
 CASE
 WHEN (auth.uid() = id) THEN product_sensitivities
 ELSE NULL::text[]
 END AS product_sensitivities,
 CASE
 WHEN (auth.uid() = id) THEN removal_needed
 ELSE NULL::boolean
 END AS removal_needed,
 CASE
 WHEN (auth.uid() = id) THEN nail_condition
 ELSE NULL::text
 END AS nail_condition,
 CASE
 WHEN (auth.uid() = id) THEN skin_undertone
 ELSE NULL::text
 END AS skin_undertone,
 CASE
 WHEN (auth.uid() = id) THEN hand_photo_url
 ELSE NULL::text
 END AS hand_photo_url,
 CASE
 WHEN (auth.uid() = id) THEN credit_balance
 ELSE NULL::integer
 END AS credit_balance,
 onboarding_complete,
 specialties,
 username,
 CASE
 WHEN (auth.uid() = id) THEN subscription_tier
 ELSE NULL::text
 END AS subscription_tier,
 CASE
 WHEN (auth.uid() = id) THEN is_admin
 ELSE NULL::boolean
 END AS is_admin,
 is_private,
 message_permission,
 show_saves,
 referral_code,
 CASE
 WHEN (auth.uid() = id) THEN referred_by
 ELSE NULL::text
 END AS referred_by,
 CASE
 WHEN (auth.uid() = id) THEN email
 ELSE NULL::text
 END AS email,
 CASE
 WHEN (auth.uid() = id) THEN stripe_customer_id
 ELSE NULL::text
 END AS stripe_customer_id
 FROM profiles_data;
CREATE OR REPLACE FUNCTION public.decrement_comments(design_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 UPDATE designs SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = design_id;
$function$
;
CREATE OR REPLACE FUNCTION public.decrement_credits(user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 update profiles_data
 set credit_balance = COALESCE(credit_balance, 0) - 1
 where id = user_id and COALESCE(credit_balance, 0) > 0;
$function$
;
CREATE OR REPLACE FUNCTION public.decrement_credits_by(user_id uuid, amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
 UPDATE profiles_data
 SET credit_balance = GREATEST(COALESCE(credit_balance, 0) - amount, 0)
 WHERE id = user_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.decrement_likes(design_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 UPDATE designs SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = design_id;
$function$
;
CREATE OR REPLACE FUNCTION public.decrement_saves(design_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 UPDATE designs SET saves_count = GREATEST(COALESCE(saves_count, 0) - 1, 0) WHERE id = design_id;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 delete from auth.users where id = auth.uid();
end;
$function$
;
CREATE OR REPLACE FUNCTION public.design_visible_to_viewer(design_creator_id uuid, viewer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
 SELECT
 viewer_id = design_creator_id
 OR NOT COALESCE((SELECT is_private FROM profiles_data WHERE id = design_creator_id), false)
 OR EXISTS (
 SELECT 1 FROM follows WHERE follower_id = viewer_id AND following_id = design_creator_id
 );
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_no_blocked_messaging()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 other_id uuid;
begin
 select case when client_id = new.sender_id then creator_id else client_id end
 into other_id
 from conversations
 where id = new.conversation_id;

 if other_id is null then
 return new;
 end if;

 if exists (
 select 1 from blocks
 where (blocker_id = new.sender_id and blocked_id = other_id)
 or (blocker_id = other_id and blocked_id = new.sender_id)
 ) then
 raise exception 'BLOCKED_CANNOT_MESSAGE';
 end if;

 return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_weekly_upload_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 prof profiles_data%rowtype;
 effective_uploads int;
begin
 if new.created_by is null then
 return new;
 end if;

 select * into prof from profiles_data where id = new.created_by;

 if not found or prof.subscription_tier = 'pro_creator' then
 return new;
 end if;

 if prof.week_reset_at is null or prof.week_reset_at < (now() - interval '7 days') then
 effective_uploads := 0;
 else
 effective_uploads := coalesce(prof.weekly_uploads, 0);
 end if;

 if effective_uploads >= 5 then
 raise exception 'WEEKLY_UPLOAD_LIMIT';
 end if;

 return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
 insert into public.profiles (id, display_name)
 values (new.id, new.raw_user_meta_data->>'display_name');
 return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.increment_comments(design_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 UPDATE designs SET comments_count = comments_count + 1 WHERE id = design_id;
$function$
;
CREATE OR REPLACE FUNCTION public.increment_credits(user_id uuid, amount integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 update profiles_data
 set credit_balance = COALESCE(credit_balance, 0) + amount
 where id = user_id;
$function$
;
CREATE OR REPLACE FUNCTION public.increment_likes(design_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 UPDATE designs SET likes_count = likes_count + 1 WHERE id = design_id;
$function$
;
CREATE OR REPLACE FUNCTION public.increment_saves(design_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 UPDATE designs SET saves_count = COALESCE(saves_count, 0) + 1 WHERE id = design_id;
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_self_vote()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
 owner_id uuid;
begin
 select user_id into owner_id from challenge_submissions where id = new.submission_id;

 if owner_id = new.user_id then
 raise exception 'CANNOT_VOTE_OWN_ENTRY';
 end if;

 return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.profiles_view_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
 new.account_type := coalesce(new.account_type, 'user');
 new.is_verified := coalesce(new.is_verified, false);
 new.created_at := coalesce(new.created_at, now());
 new.weekly_uploads := coalesce(new.weekly_uploads, 0);
 new.week_reset_at := coalesce(new.week_reset_at, now());
 new.is_pro := coalesce(new.is_pro, false);
 new.removal_needed := coalesce(new.removal_needed, false);
 new.credit_balance := coalesce(new.credit_balance, 0);
 new.onboarding_complete := coalesce(new.onboarding_complete, false);
 new.is_admin := coalesce(new.is_admin, false);
 new.is_private := coalesce(new.is_private, false);
 new.message_permission := coalesce(new.message_permission, 'everyone');
 new.show_saves := coalesce(new.show_saves, true);

 insert into public.profiles_data (
 id, display_name, bio, location, avatar_url, account_type, is_verified, created_at,
 weekly_uploads, week_reset_at, is_pro, phone_number, preferred_contact, booking_notes,
 booking_area, nail_shape, nail_length, nail_colors, nail_finishes, nail_techniques,
 occasions, budget_range, allergies, product_sensitivities, removal_needed, nail_condition,
 skin_undertone, hand_photo_url, credit_balance, onboarding_complete, specialties, username,
 subscription_tier, is_admin, is_private, message_permission, show_saves, referral_code,
 referred_by, email, stripe_customer_id
 )
 values (
 new.id, new.display_name, new.bio, new.location, new.avatar_url, new.account_type, new.is_verified, new.created_at,
 new.weekly_uploads, new.week_reset_at, new.is_pro, new.phone_number, new.preferred_contact, new.booking_notes,
 new.booking_area, new.nail_shape, new.nail_length, new.nail_colors, new.nail_finishes, new.nail_techniques,
 new.occasions, new.budget_range, new.allergies, new.product_sensitivities, new.removal_needed, new.nail_condition,
 new.skin_undertone, new.hand_photo_url, new.credit_balance, new.onboarding_complete, new.specialties, new.username,
 new.subscription_tier, new.is_admin, new.is_private, new.message_permission, new.show_saves, new.referral_code,
 new.referred_by, new.email, new.stripe_customer_id
 );
 return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.profiles_view_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
 update public.profiles_data set
 display_name = new.display_name,
 bio = new.bio,
 location = new.location,
 avatar_url = new.avatar_url,
 account_type = new.account_type,
 is_verified = new.is_verified,
 created_at = new.created_at,
 weekly_uploads = new.weekly_uploads,
 week_reset_at = new.week_reset_at,
 is_pro = new.is_pro,
 phone_number = new.phone_number,
 preferred_contact = new.preferred_contact,
 booking_notes = new.booking_notes,
 booking_area = new.booking_area,
 nail_shape = new.nail_shape,
 nail_length = new.nail_length,
 nail_colors = new.nail_colors,
 nail_finishes = new.nail_finishes,
 nail_techniques = new.nail_techniques,
 occasions = new.occasions,
 budget_range = new.budget_range,
 allergies = new.allergies,
 product_sensitivities = new.product_sensitivities,
 removal_needed = new.removal_needed,
 nail_condition = new.nail_condition,
 skin_undertone = new.skin_undertone,
 hand_photo_url = new.hand_photo_url,
 credit_balance = new.credit_balance,
 onboarding_complete = new.onboarding_complete,
 specialties = new.specialties,
 username = new.username,
 subscription_tier = new.subscription_tier,
 is_admin = new.is_admin,
 is_private = new.is_private,
 message_permission = new.message_permission,
 show_saves = new.show_saves,
 referral_code = new.referral_code,
 referred_by = new.referred_by,
 email = new.email,
 stripe_customer_id = new.stripe_customer_id
 where id = old.id;
 return new;
end;
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.reject_entry_if_challenge_ended()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if (TG_OP = 'INSERT') then
 if exists (select 1 from public.challenges c
 where c.id = new.challenge_id and c.ends_at <= now()) then
 raise exception 'CHALLENGE_ENDED';
 end if;
 elsif (TG_OP = 'UPDATE') then
 if exists (select 1 from public.challenges c
 where c.id in (old.challenge_id, new.challenge_id) and c.ends_at <= now()) then
 raise exception 'CHALLENGE_ENDED';
 end if;
 end if;
 return new;
end; $function$
;
CREATE OR REPLACE FUNCTION public.tech_has_upcoming_booking(p_client uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select exists (select 1 from public.bookings b
 where b.client_id = p_client and b.creator_id = auth.uid()
 and b.status in ('pending', 'confirmed') -- was: = 'confirmed'
 and b.booking_date >= current_date);
$function$
;
revoke all on function public."decrement_comments"(design_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."decrement_comments"(design_id uuid) to public;
grant execute on function public."decrement_comments"(design_id uuid) to anon;
grant execute on function public."decrement_comments"(design_id uuid) to authenticated;
grant execute on function public."decrement_comments"(design_id uuid) to service_role;
revoke all on function public."decrement_credits"(user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."decrement_credits"(user_id uuid) to service_role;
revoke all on function public."decrement_credits_by"(user_id uuid, amount integer) from public, anon, authenticated, service_role;
grant execute on function public."decrement_credits_by"(user_id uuid, amount integer) to public;
grant execute on function public."decrement_credits_by"(user_id uuid, amount integer) to anon;
grant execute on function public."decrement_credits_by"(user_id uuid, amount integer) to authenticated;
grant execute on function public."decrement_credits_by"(user_id uuid, amount integer) to service_role;
revoke all on function public."decrement_likes"(design_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."decrement_likes"(design_id uuid) to public;
grant execute on function public."decrement_likes"(design_id uuid) to anon;
grant execute on function public."decrement_likes"(design_id uuid) to authenticated;
grant execute on function public."decrement_likes"(design_id uuid) to service_role;
revoke all on function public."decrement_saves"(design_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."decrement_saves"(design_id uuid) to public;
grant execute on function public."decrement_saves"(design_id uuid) to anon;
grant execute on function public."decrement_saves"(design_id uuid) to authenticated;
grant execute on function public."decrement_saves"(design_id uuid) to service_role;
revoke all on function public."delete_own_account"() from public, anon, authenticated, service_role;
grant execute on function public."delete_own_account"() to public;
grant execute on function public."delete_own_account"() to anon;
grant execute on function public."delete_own_account"() to authenticated;
grant execute on function public."delete_own_account"() to service_role;
revoke all on function public."design_visible_to_viewer"(design_creator_id uuid, viewer_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."design_visible_to_viewer"(design_creator_id uuid, viewer_id uuid) to public;
grant execute on function public."design_visible_to_viewer"(design_creator_id uuid, viewer_id uuid) to anon;
grant execute on function public."design_visible_to_viewer"(design_creator_id uuid, viewer_id uuid) to authenticated;
grant execute on function public."design_visible_to_viewer"(design_creator_id uuid, viewer_id uuid) to service_role;
revoke all on function public."enforce_no_blocked_messaging"() from public, anon, authenticated, service_role;
grant execute on function public."enforce_no_blocked_messaging"() to public;
grant execute on function public."enforce_no_blocked_messaging"() to anon;
grant execute on function public."enforce_no_blocked_messaging"() to authenticated;
grant execute on function public."enforce_no_blocked_messaging"() to service_role;
revoke all on function public."enforce_weekly_upload_limit"() from public, anon, authenticated, service_role;
grant execute on function public."enforce_weekly_upload_limit"() to public;
grant execute on function public."enforce_weekly_upload_limit"() to anon;
grant execute on function public."enforce_weekly_upload_limit"() to authenticated;
grant execute on function public."enforce_weekly_upload_limit"() to service_role;
revoke all on function public."handle_new_user"() from public, anon, authenticated, service_role;
grant execute on function public."handle_new_user"() to public;
grant execute on function public."handle_new_user"() to anon;
grant execute on function public."handle_new_user"() to authenticated;
grant execute on function public."handle_new_user"() to service_role;
revoke all on function public."increment_comments"(design_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."increment_comments"(design_id uuid) to public;
grant execute on function public."increment_comments"(design_id uuid) to anon;
grant execute on function public."increment_comments"(design_id uuid) to authenticated;
grant execute on function public."increment_comments"(design_id uuid) to service_role;
revoke all on function public."increment_credits"(user_id uuid, amount integer) from public, anon, authenticated, service_role;
grant execute on function public."increment_credits"(user_id uuid, amount integer) to service_role;
revoke all on function public."increment_likes"(design_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."increment_likes"(design_id uuid) to public;
grant execute on function public."increment_likes"(design_id uuid) to anon;
grant execute on function public."increment_likes"(design_id uuid) to authenticated;
grant execute on function public."increment_likes"(design_id uuid) to service_role;
revoke all on function public."increment_saves"(design_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."increment_saves"(design_id uuid) to public;
grant execute on function public."increment_saves"(design_id uuid) to anon;
grant execute on function public."increment_saves"(design_id uuid) to authenticated;
grant execute on function public."increment_saves"(design_id uuid) to service_role;
revoke all on function public."prevent_self_vote"() from public, anon, authenticated, service_role;
grant execute on function public."prevent_self_vote"() to public;
grant execute on function public."prevent_self_vote"() to anon;
grant execute on function public."prevent_self_vote"() to authenticated;
grant execute on function public."prevent_self_vote"() to service_role;
revoke all on function public."profiles_view_insert"() from public, anon, authenticated, service_role;
grant execute on function public."profiles_view_insert"() to public;
grant execute on function public."profiles_view_insert"() to anon;
grant execute on function public."profiles_view_insert"() to authenticated;
grant execute on function public."profiles_view_insert"() to service_role;
revoke all on function public."profiles_view_update"() from public, anon, authenticated, service_role;
grant execute on function public."profiles_view_update"() to public;
grant execute on function public."profiles_view_update"() to anon;
grant execute on function public."profiles_view_update"() to authenticated;
grant execute on function public."profiles_view_update"() to service_role;
revoke all on function public."protect_privileged_profile_columns"() from public, anon, authenticated, service_role;
grant execute on function public."protect_privileged_profile_columns"() to public;
grant execute on function public."protect_privileged_profile_columns"() to anon;
grant execute on function public."protect_privileged_profile_columns"() to authenticated;
grant execute on function public."protect_privileged_profile_columns"() to service_role;
revoke all on function public."reject_entry_if_challenge_ended"() from public, anon, authenticated, service_role;
grant execute on function public."reject_entry_if_challenge_ended"() to public;
grant execute on function public."reject_entry_if_challenge_ended"() to anon;
grant execute on function public."reject_entry_if_challenge_ended"() to authenticated;
grant execute on function public."reject_entry_if_challenge_ended"() to service_role;
revoke all on function public."tech_has_upcoming_booking"(p_client uuid) from public, anon, authenticated, service_role;
grant execute on function public."tech_has_upcoming_booking"(p_client uuid) to authenticated;
grant execute on function public."tech_has_upcoming_booking"(p_client uuid) to service_role;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER trg_reject_entry_if_challenge_ended BEFORE INSERT OR UPDATE ON challenge_submissions FOR EACH ROW EXECUTE FUNCTION reject_entry_if_challenge_ended();
CREATE TRIGGER prevent_self_vote_trg BEFORE INSERT ON challenge_votes FOR EACH ROW EXECUTE FUNCTION prevent_self_vote();
CREATE TRIGGER trg_enforce_weekly_upload_limit BEFORE INSERT ON designs FOR EACH ROW EXECUTE FUNCTION enforce_weekly_upload_limit();
CREATE TRIGGER enforce_no_blocked_messaging_trg BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION enforce_no_blocked_messaging();
CREATE TRIGGER profiles_view_insert_trg INSTEAD OF INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION profiles_view_insert();
CREATE TRIGGER profiles_view_update_trg INSTEAD OF UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION profiles_view_update();
CREATE TRIGGER protect_privileged_profile_columns_trg BEFORE INSERT OR UPDATE ON profiles_data FOR EACH ROW EXECUTE FUNCTION protect_privileged_profile_columns();
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."availability" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."availability" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."availability" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."blocks" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."blocks" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."blocks" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bookings" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bookings" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."bookings" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenge_submissions" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenge_submissions" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenge_submissions" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenge_votes" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenge_votes" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenge_votes" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenges" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenges" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."challenges" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."client_booking_notes" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."client_booking_notes" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."client_health_notes" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."client_health_notes" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."client_notes" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."client_notes" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."client_notes" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."collection_designs" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."collection_designs" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."collection_designs" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."collections" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."collections" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."collections" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."conversations" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."conversations" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."conversations" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_colours" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_colours" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_colours" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_comments" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_comments" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_comments" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_images" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_images" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_images" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_likes" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_likes" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_likes" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_products" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_products" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_products" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_tags" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_tags" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."design_tags" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."designs" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."designs" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."designs" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."favourite_creators" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."favourite_creators" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."favourite_creators" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."follows" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."follows" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."follows" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."image_backfill_map" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."image_backfill_map" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."image_backfill_map" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."messages" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."messages" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."messages" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboard_designs" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboard_designs" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboard_designs" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboard_members" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboard_members" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboard_members" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboards" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboards" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."moodboards" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."nail_lab_generations" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."nail_lab_generations" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."nail_lab_generations" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notifications" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notifications" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."notifications" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."processed_webhook_events" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."processed_webhook_events" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."processed_webhook_events" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."products" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."products" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."products" to service_role;
grant SELECT on public."profiles" to anon;
grant SELECT, UPDATE on public."profiles" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."profiles" to service_role;
grant DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE on public."profiles_data" to anon;
grant DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE on public."profiles_data" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."profiles_data" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."reviews" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."reviews" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."reviews" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."rewards" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."rewards" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."rewards" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."salon_posts" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."salon_posts" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."salon_posts" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."saved_designs" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."saved_designs" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."saved_designs" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."services" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."services" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."services" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."stories" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."stories" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."stories" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."story_likes" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."story_likes" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."story_likes" to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."tags" to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."tags" to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public."tags" to service_role;
create policy "Availability is public" on public."availability" as PERMISSIVE for SELECT to "public" using (true);
create policy "Creator manages own availability" on public."availability" as PERMISSIVE for ALL to "public" using ((auth.uid() = creator_id));
create policy "Delete own block" on public."blocks" as PERMISSIVE for DELETE to "public" using ((auth.uid() = blocker_id));
create policy "Insert own block" on public."blocks" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = blocker_id));
create policy "Read own blocks" on public."blocks" as PERMISSIVE for SELECT to "public" using ((auth.uid() = blocker_id));
create policy "Client can cancel own booking" on public."bookings" as PERMISSIVE for UPDATE to "public" using ((auth.uid() = client_id));
create policy "Client can create booking" on public."bookings" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = client_id));
create policy "Creator can update booking status" on public."bookings" as PERMISSIVE for UPDATE to "public" using ((auth.uid() = creator_id));
create policy "bookings_client_read" on public."bookings" as PERMISSIVE for SELECT to "public" using (((auth.uid() = client_id) OR (auth.uid() = creator_id)));
create policy "anyone can read submissions" on public."challenge_submissions" as PERMISSIVE for SELECT to "public" using (true);
create policy "users manage own submissions" on public."challenge_submissions" as PERMISSIVE for ALL to "public" using ((auth.uid() = user_id));
create policy "anyone can read votes" on public."challenge_votes" as PERMISSIVE for SELECT to "public" using (true);
create policy "users manage own votes" on public."challenge_votes" as PERMISSIVE for ALL to "public" using ((auth.uid() = user_id));
create policy "Admins manage challenges" on public."challenges" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
create policy "anyone can read challenges" on public."challenges" as PERMISSIVE for SELECT to "public" using (true);
create policy "cbn_owner_all" on public."client_booking_notes" as PERMISSIVE for ALL to "public" using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "cbn_tech_read" on public."client_booking_notes" as PERMISSIVE for SELECT to "public" using (tech_has_upcoming_booking(user_id));
create policy "chn_owner_all" on public."client_health_notes" as PERMISSIVE for ALL to "public" using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "chn_tech_read" on public."client_health_notes" as PERMISSIVE for SELECT to "public" using ((share_with_tech AND tech_has_upcoming_booking(user_id)));
create policy "Creator manages own notes" on public."client_notes" as PERMISSIVE for ALL to "public" using ((auth.uid() = creator_id));
create policy "collection_designs_policy" on public."collection_designs" as PERMISSIVE for ALL to "public" using ((collection_id IN ( SELECT collections.id
 FROM collections
 WHERE (collections.user_id = auth.uid())))) with check ((collection_id IN ( SELECT collections.id
 FROM collections
 WHERE (collections.user_id = auth.uid()))));
create policy "collections_policy" on public."collections" as PERMISSIVE for ALL to "public" using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "conversations_insert" on public."conversations" as PERMISSIVE for INSERT to "public" with check (((auth.uid() = client_id) OR (auth.uid() = creator_id)));
create policy "conversations_read" on public."conversations" as PERMISSIVE for SELECT to "public" using (((auth.uid() = client_id) OR (auth.uid() = creator_id)));
create policy "conversations_update" on public."conversations" as PERMISSIVE for UPDATE to "public" using (((auth.uid() = client_id) OR (auth.uid() = creator_id)));
create policy "Anyone can view design colours" on public."design_colours" as PERMISSIVE for SELECT to "public" using (true);
create policy "Design owners and admins manage colours" on public."design_colours" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
 FROM designs
 WHERE ((designs.id = design_colours.design_id) AND ((designs.created_by = auth.uid()) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))))))) with check ((EXISTS ( SELECT 1
 FROM designs
 WHERE ((designs.id = design_colours.design_id) AND ((designs.created_by = auth.uid()) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))))));
create policy "Anyone can read comments" on public."design_comments" as PERMISSIVE for SELECT to "public" using (true);
create policy "Users can delete their own comments" on public."design_comments" as PERMISSIVE for DELETE to "public" using ((auth.uid() = user_id));
create policy "Users can insert their own comments" on public."design_comments" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = user_id));
create policy "Design owners and admins manage images" on public."design_images" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
 FROM designs
 WHERE ((designs.id = design_images.design_id) AND ((designs.created_by = auth.uid()) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))))))) with check ((EXISTS ( SELECT 1
 FROM designs
 WHERE ((designs.id = design_images.design_id) AND ((designs.created_by = auth.uid()) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))))));
create policy "Public read design_images" on public."design_images" as PERMISSIVE for SELECT to "public" using (true);
create policy "Anyone can read likes" on public."design_likes" as PERMISSIVE for SELECT to "public" using (true);
create policy "Users can manage their own likes" on public."design_likes" as PERMISSIVE for ALL to "public" using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Admins manage design_products" on public."design_products" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
create policy "Public can read design_products" on public."design_products" as PERMISSIVE for SELECT to "public" using (true);
create policy "Service role can do everything" on public."design_products" as PERMISSIVE for ALL to "service_role" using (true) with check (true);
create policy "Anyone can view design tags" on public."design_tags" as PERMISSIVE for SELECT to "public" using (true);
create policy "Design owners and admins manage tags" on public."design_tags" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
 FROM designs
 WHERE ((designs.id = design_tags.design_id) AND ((designs.created_by = auth.uid()) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))))))) with check ((EXISTS ( SELECT 1
 FROM designs
 WHERE ((designs.id = design_tags.design_id) AND ((designs.created_by = auth.uid()) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))))));
create policy "Admins can delete any design" on public."designs" as PERMISSIVE for DELETE to "public" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
create policy "Admins can insert any design" on public."designs" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
create policy "Admins can update any design" on public."designs" as PERMISSIVE for UPDATE to "public" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
create policy "Creators can delete own designs" on public."designs" as PERMISSIVE for DELETE to "public" using ((auth.uid() = created_by));
create policy "Creators can insert own designs" on public."designs" as PERMISSIVE for INSERT to "authenticated" with check ((created_by = auth.uid()));
create policy "Creators can update own designs" on public."designs" as PERMISSIVE for UPDATE to "authenticated" using ((created_by = auth.uid()));
create policy "Public can read published or own designs" on public."designs" as PERMISSIVE for SELECT to "public" using ((((is_published = true) OR (auth.uid() = created_by)) AND design_visible_to_viewer(created_by, auth.uid())));
create policy "Users add own favourites" on public."favourite_creators" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = user_id));
create policy "Users read own favourites" on public."favourite_creators" as PERMISSIVE for SELECT to "public" using ((auth.uid() = user_id));
create policy "Users remove own favourites" on public."favourite_creators" as PERMISSIVE for DELETE to "public" using ((auth.uid() = user_id));
create policy "Anyone can view follows" on public."follows" as PERMISSIVE for SELECT to "public" using (true);
create policy "Users can follow as themselves" on public."follows" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = follower_id));
create policy "Users can unfollow their own follows" on public."follows" as PERMISSIVE for DELETE to "public" using ((auth.uid() = follower_id));
create policy "messages_insert" on public."messages" as PERMISSIVE for INSERT to "public" with check (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
 FROM conversations c
 WHERE ((c.id = messages.conversation_id) AND ((c.client_id = auth.uid()) OR (c.creator_id = auth.uid())))))));
create policy "messages_read" on public."messages" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
 FROM conversations c
 WHERE ((c.id = messages.conversation_id) AND ((c.client_id = auth.uid()) OR (c.creator_id = auth.uid()))))));
create policy "messages_update" on public."messages" as PERMISSIVE for UPDATE to "public" using ((EXISTS ( SELECT 1
 FROM conversations c
 WHERE ((c.id = messages.conversation_id) AND ((c.client_id = auth.uid()) OR (c.creator_id = auth.uid()))))));
create policy "Board owner manages designs" on public."moodboard_designs" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
 FROM moodboards
 WHERE ((moodboards.id = moodboard_designs.moodboard_id) AND (moodboards.user_id = auth.uid())))));
create policy "Public board designs viewable" on public."moodboard_designs" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
 FROM moodboards
 WHERE ((moodboards.id = moodboard_designs.moodboard_id) AND ((moodboards.is_public = true) OR (moodboards.user_id = auth.uid()))))));
create policy "Members can view their own memberships" on public."moodboard_members" as PERMISSIVE for SELECT to "public" using (((user_id = auth.uid()) OR (invited_by = auth.uid())));
create policy "Moodboard owners can insert members" on public."moodboard_members" as PERMISSIVE for INSERT to "public" with check ((invited_by = auth.uid()));
create policy "Owners and members can delete" on public."moodboard_members" as PERMISSIVE for DELETE to "public" using (((user_id = auth.uid()) OR (invited_by = auth.uid())));
create policy "Public boards viewable" on public."moodboards" as PERMISSIVE for SELECT to "public" using (((is_public = true) OR (auth.uid() = user_id)));
create policy "Users manage own boards" on public."moodboards" as PERMISSIVE for ALL to "public" using ((auth.uid() = user_id));
create policy "Users can insert own generations" on public."nail_lab_generations" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = user_id));
create policy "Users can update own generations" on public."nail_lab_generations" as PERMISSIVE for UPDATE to "public" using ((auth.uid() = user_id));
create policy "Users can view own generations" on public."nail_lab_generations" as PERMISSIVE for SELECT to "public" using ((auth.uid() = user_id));
create policy "Authenticated users can insert notifications" on public."notifications" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = actor_id));
create policy "Users can read own notifications" on public."notifications" as PERMISSIVE for SELECT to "public" using ((auth.uid() = user_id));
create policy "Users can update own notifications" on public."notifications" as PERMISSIVE for UPDATE to "public" using ((auth.uid() = user_id));
create policy "Public can read published products" on public."products" as PERMISSIVE for SELECT to "public" using ((is_published = true));
create policy "Service role can do everything" on public."products" as PERMISSIVE for ALL to "service_role" using (true) with check (true);
create policy "Users can insert their own profile" on public."profiles_data" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = id));
create policy "Users can update their own profile" on public."profiles_data" as PERMISSIVE for UPDATE to "public" using ((auth.uid() = id));
create policy "Insert own review" on public."reviews" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = reviewer_id));
create policy "Public read reviews" on public."reviews" as PERMISSIVE for SELECT to "public" using (true);
create policy "Update own review" on public."reviews" as PERMISSIVE for UPDATE to "public" using ((auth.uid() = reviewer_id));
create policy "service role manages rewards" on public."rewards" as PERMISSIVE for ALL to "service_role" using (true);
create policy "users read own rewards" on public."rewards" as PERMISSIVE for SELECT to "public" using ((auth.uid() = user_id));
create policy "anyone can read salon_posts" on public."salon_posts" as PERMISSIVE for SELECT to "public" using (true);
create policy "creators manage their own posts" on public."salon_posts" as PERMISSIVE for ALL to "public" using ((auth.uid() = creator_id));
create policy "Admins delete any saved_designs" on public."saved_designs" as PERMISSIVE for DELETE to "public" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
create policy "Users can save designs" on public."saved_designs" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = user_id));
create policy "Users can unsave designs" on public."saved_designs" as PERMISSIVE for DELETE to "public" using ((auth.uid() = user_id));
create policy "Users can view their own saved designs" on public."saved_designs" as PERMISSIVE for SELECT to "public" using ((auth.uid() = user_id));
create policy "Creator manages own services" on public."services" as PERMISSIVE for ALL to "public" using ((auth.uid() = creator_id));
create policy "Services are public" on public."services" as PERMISSIVE for SELECT to "public" using ((is_active = true));
create policy "Anyone can view stories" on public."stories" as PERMISSIVE for SELECT to "public" using (true);
create policy "Users can delete their own stories" on public."stories" as PERMISSIVE for DELETE to "public" using ((auth.uid() = user_id));
create policy "Users can insert their own stories" on public."stories" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = user_id));
create policy "Anyone can view story likes" on public."story_likes" as PERMISSIVE for SELECT to "public" using (true);
create policy "Users can like stories" on public."story_likes" as PERMISSIVE for INSERT to "public" with check ((auth.uid() = user_id));
create policy "Users can unlike stories" on public."story_likes" as PERMISSIVE for DELETE to "public" using ((auth.uid() = user_id));
create policy "Admins manage tags" on public."tags" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
create policy "Anyone can view tags" on public."tags" as PERMISSIVE for SELECT to "public" using (true);
create policy "Service role can upload to nail-lab" on storage."objects" as PERMISSIVE for INSERT to "service_role" with check ((bucket_id = 'nail-lab'::text));
create policy "Users can update own avatar or story folder, admins anywhere" on storage."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'designs'::text) AND ((((storage.foldername(name))[1] = ANY (ARRAY['avatars'::text, 'stories'::text])) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))));
create policy "Users can upload to own avatar or story folder, admins anywhere" on storage."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'designs'::text) AND ((((storage.foldername(name))[1] = ANY (ARRAY['avatars'::text, 'stories'::text])) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))));
create policy "Users can view own nail-lab generations" on storage."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'nail-lab'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
