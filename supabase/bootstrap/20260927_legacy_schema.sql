-- Schema-only baseline exported with PostgreSQL 17 pg_dump on 2026-09-27.
-- Source: the-palette (faunikvhoommbebsmevg). Contains no application rows.
-- For an EMPTY isolated Supabase project only. Apply all subsequent migrations
-- in the SAME deployment before enabling application traffic.
-- Managed auth/storage schemas remain owned by Supabase.
-- Raw public schema SHA256: 6557e481470b16193a49bded325c4f7d0de8f876ba7ce57110e1d63ac0abe25b



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."decrement_comments"("design_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE designs SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = design_id;
$$;


ALTER FUNCTION "public"."decrement_comments"("design_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_credits"("user_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  update profiles_data
  set credit_balance = COALESCE(credit_balance, 0) - 1
  where id = user_id and COALESCE(credit_balance, 0) > 0;
$$;


ALTER FUNCTION "public"."decrement_credits"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_credits_by"("user_id" "uuid", "amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE profiles_data
  SET credit_balance = GREATEST(COALESCE(credit_balance, 0) - amount, 0)
  WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."decrement_credits_by"("user_id" "uuid", "amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_likes"("design_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE designs SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = design_id;
$$;


ALTER FUNCTION "public"."decrement_likes"("design_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_saves"("design_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE designs SET saves_count = GREATEST(COALESCE(saves_count, 0) - 1, 0) WHERE id = design_id;
$$;


ALTER FUNCTION "public"."decrement_saves"("design_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_own_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."delete_own_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."design_visible_to_viewer"("design_creator_id" "uuid", "viewer_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    viewer_id = design_creator_id
    OR NOT COALESCE((SELECT is_private FROM profiles_data WHERE id = design_creator_id), false)
    OR EXISTS (
      SELECT 1 FROM follows WHERE follower_id = viewer_id AND following_id = design_creator_id
    );
$$;


ALTER FUNCTION "public"."design_visible_to_viewer"("design_creator_id" "uuid", "viewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_no_blocked_messaging"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."enforce_no_blocked_messaging"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_weekly_upload_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."enforce_weekly_upload_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_comments"("design_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE designs SET comments_count = comments_count + 1 WHERE id = design_id;
$$;


ALTER FUNCTION "public"."increment_comments"("design_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_credits"("user_id" "uuid", "amount" integer) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  update profiles_data
  set credit_balance = COALESCE(credit_balance, 0) + amount
  where id = user_id;
$$;


ALTER FUNCTION "public"."increment_credits"("user_id" "uuid", "amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_likes"("design_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE designs SET likes_count = likes_count + 1 WHERE id = design_id;
$$;


ALTER FUNCTION "public"."increment_likes"("design_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_saves"("design_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE designs SET saves_count = COALESCE(saves_count, 0) + 1 WHERE id = design_id;
$$;


ALTER FUNCTION "public"."increment_saves"("design_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_self_vote"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from challenge_submissions where id = new.submission_id;

  if owner_id = new.user_id then
    raise exception 'CANNOT_VOTE_OWN_ENTRY';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_self_vote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."profiles_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."profiles_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_privileged_profile_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."protect_privileged_profile_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_entry_if_challenge_ended"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
end; $$;


ALTER FUNCTION "public"."reject_entry_if_challenge_ended"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tech_has_upcoming_booking"("p_client" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.bookings b
    where b.client_id = p_client and b.creator_id = auth.uid()
      and b.status in ('pending', 'confirmed')   -- was: = 'confirmed'
      and b.booking_date >= current_date);
$$;


ALTER FUNCTION "public"."tech_has_upcoming_booking"("p_client" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    CONSTRAINT "availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid",
    "blocked_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "booking_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deposit_paid" boolean DEFAULT false,
    "stripe_payment_intent" "text",
    "reminder_sent_at" timestamp with time zone,
    "reference_design_id" "uuid",
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'declined'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "caption" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "ends_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_booking_notes" (
    "user_id" "uuid" NOT NULL,
    "booking_notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_booking_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_health_notes" (
    "user_id" "uuid" NOT NULL,
    "allergies" "text",
    "product_sensitivities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "removal_needed" boolean DEFAULT false NOT NULL,
    "share_with_tech" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_health_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_designs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "design_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collection_designs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "muted_by" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_colours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "design_id" "uuid",
    "hex_code" "text",
    "brand_name" "text",
    "brand_code" "text",
    "colour_name" "text",
    "colour_order" integer DEFAULT 1
);


ALTER TABLE "public"."design_colours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "design_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "design_comments_body_check" CHECK ((("char_length"("body") > 0) AND ("char_length"("body") <= 500)))
);


ALTER TABLE "public"."design_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "design_id" "uuid",
    "image_url" "text" NOT NULL,
    "image_order" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."design_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_likes" (
    "user_id" "uuid" NOT NULL,
    "design_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."design_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "design_id" "uuid",
    "product_id" "uuid",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."design_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_tags" (
    "design_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."design_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."designs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "shape" "text",
    "length" "text",
    "occasion" "text",
    "technique" "text",
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "category" "text",
    "saves_count" integer DEFAULT 0,
    "is_curated" boolean DEFAULT false,
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "is_pinned" boolean DEFAULT false,
    "is_drop" boolean DEFAULT false,
    "boosted_until" timestamp with time zone,
    "source_generation_id" "uuid",
    "image_width" integer,
    "image_height" integer
);


ALTER TABLE "public"."designs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favourite_creators" (
    "user_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favourite_creators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_backfill_map" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "column_name" "text" NOT NULL,
    "row_id" "uuid",
    "old_url" "text" NOT NULL,
    "new_url" "text" NOT NULL,
    "old_bytes" bigint,
    "new_bytes" bigint,
    "in_w" integer,
    "in_h" integer,
    "out_w" integer,
    "out_h" integer,
    "perceptual_diff" numeric,
    "encoded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified_at" timestamp with time zone,
    "switched_at" timestamp with time zone
);


ALTER TABLE "public"."image_backfill_map" OWNER TO "postgres";


ALTER TABLE "public"."image_backfill_map" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."image_backfill_map_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moodboard_designs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "moodboard_id" "uuid" NOT NULL,
    "design_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."moodboard_designs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moodboard_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "moodboard_id" "uuid",
    "user_id" "uuid",
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."moodboard_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moodboards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "cover_image_url" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."moodboards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nail_lab_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text",
    "shape" "text",
    "length" "text",
    "colors" "text"[],
    "custom_text" "text",
    "prompt_used" "text",
    "reference_design_ids" "uuid"[],
    "reference_image_urls" "text"[],
    "has_used_free_regen" boolean DEFAULT false,
    "credits_used" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "free_regen_used" boolean DEFAULT false,
    "parent_generation_id" "uuid",
    "vibe" "text"[],
    "occasion" "text"[]
);


ALTER TABLE "public"."nail_lab_generations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "design_id" "uuid",
    "comment_preview" "text",
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['follow'::"text", 'like'::"text", 'comment'::"text", 'new_message'::"text", 'booking_request'::"text", 'booking_confirmed'::"text", 'booking_declined'::"text", 'appointment_reminder'::"text", 'moodboard_invite'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processed_webhook_events" (
    "event_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."processed_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "category" "text",
    "description" "text",
    "image_url" "text",
    "affiliate_url" "text" NOT NULL,
    "price_label" "text",
    "is_featured" boolean DEFAULT false,
    "is_published" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles_data" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "bio" "text",
    "location" "text",
    "avatar_url" "text",
    "account_type" "text" DEFAULT 'user'::"text",
    "is_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "weekly_uploads" integer DEFAULT 0,
    "week_reset_at" timestamp with time zone DEFAULT "now"(),
    "is_pro" boolean DEFAULT false,
    "phone_number" "text",
    "preferred_contact" "text",
    "booking_notes" "text",
    "booking_area" "text",
    "nail_shape" "text",
    "nail_length" "text",
    "nail_colors" "text"[],
    "nail_finishes" "text"[],
    "nail_techniques" "text"[],
    "occasions" "text"[],
    "budget_range" "text",
    "allergies" "text",
    "product_sensitivities" "text"[],
    "removal_needed" boolean DEFAULT false,
    "nail_condition" "text",
    "skin_undertone" "text",
    "hand_photo_url" "text",
    "credit_balance" integer DEFAULT 0,
    "onboarding_complete" boolean DEFAULT false,
    "specialties" "text"[],
    "username" "text",
    "subscription_tier" "text",
    "is_admin" boolean DEFAULT false,
    "is_private" boolean DEFAULT false,
    "message_permission" "text" DEFAULT 'everyone'::"text",
    "show_saves" boolean DEFAULT true,
    "referral_code" "text",
    "referred_by" "text",
    "email" "text",
    "stripe_customer_id" "text",
    "subscription_status" "text",
    CONSTRAINT "profiles_account_type_check" CHECK (("account_type" = ANY (ARRAY['user'::"text", 'creator'::"text", 'salon'::"text"]))),
    CONSTRAINT "username_format" CHECK ((("username" IS NULL) OR ("username" ~ '^[a-z0-9_.]{3,30}$'::"text")))
);


ALTER TABLE "public"."profiles_data" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles" WITH ("security_invoker"='false') AS
 SELECT "id",
    "display_name",
    "bio",
        CASE
            WHEN (("auth"."uid"() = "id") OR ("account_type" = ANY (ARRAY['creator'::"text", 'salon'::"text"]))) THEN "location"
            ELSE NULL::"text"
        END AS "location",
    "avatar_url",
    "account_type",
    "is_verified",
    "created_at",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "weekly_uploads"
            ELSE NULL::integer
        END AS "weekly_uploads",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "week_reset_at"
            ELSE NULL::timestamp with time zone
        END AS "week_reset_at",
    "is_pro",
        CASE
            WHEN (("auth"."uid"() = "id") OR ("account_type" = ANY (ARRAY['creator'::"text", 'salon'::"text"]))) THEN "phone_number"
            ELSE NULL::"text"
        END AS "phone_number",
        CASE
            WHEN (("auth"."uid"() = "id") OR ("account_type" = ANY (ARRAY['creator'::"text", 'salon'::"text"]))) THEN "preferred_contact"
            ELSE NULL::"text"
        END AS "preferred_contact",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "booking_notes"
            ELSE NULL::"text"
        END AS "booking_notes",
    "booking_area",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "nail_shape"
            ELSE NULL::"text"
        END AS "nail_shape",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "nail_length"
            ELSE NULL::"text"
        END AS "nail_length",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "nail_colors"
            ELSE NULL::"text"[]
        END AS "nail_colors",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "nail_finishes"
            ELSE NULL::"text"[]
        END AS "nail_finishes",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "nail_techniques"
            ELSE NULL::"text"[]
        END AS "nail_techniques",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "occasions"
            ELSE NULL::"text"[]
        END AS "occasions",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "budget_range"
            ELSE NULL::"text"
        END AS "budget_range",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "allergies"
            ELSE NULL::"text"
        END AS "allergies",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "product_sensitivities"
            ELSE NULL::"text"[]
        END AS "product_sensitivities",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "removal_needed"
            ELSE NULL::boolean
        END AS "removal_needed",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "nail_condition"
            ELSE NULL::"text"
        END AS "nail_condition",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "skin_undertone"
            ELSE NULL::"text"
        END AS "skin_undertone",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "hand_photo_url"
            ELSE NULL::"text"
        END AS "hand_photo_url",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "credit_balance"
            ELSE NULL::integer
        END AS "credit_balance",
    "onboarding_complete",
    "specialties",
    "username",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "subscription_tier"
            ELSE NULL::"text"
        END AS "subscription_tier",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "is_admin"
            ELSE NULL::boolean
        END AS "is_admin",
    "is_private",
    "message_permission",
    "show_saves",
    "referral_code",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "referred_by"
            ELSE NULL::"text"
        END AS "referred_by",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "email"
            ELSE NULL::"text"
        END AS "email",
        CASE
            WHEN ("auth"."uid"() = "id") THEN "stripe_customer_id"
            ELSE NULL::"text"
        END AS "stripe_customer_id"
   FROM "public"."profiles_data";


ALTER VIEW "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "reviewer_id" "uuid",
    "creator_id" "uuid",
    "rating" integer NOT NULL,
    "text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ref_id" "text"
);


ALTER TABLE "public"."rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salon_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."salon_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_designs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "design_id" "uuid" NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_designs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deposit_amount" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "image_url" "text" NOT NULL,
    "caption" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_likes" (
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "liked_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."story_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


ALTER TABLE ONLY "public"."availability"
    ADD CONSTRAINT "availability_creator_day_unique" UNIQUE ("creator_id", "day_of_week");



ALTER TABLE ONLY "public"."availability"
    ADD CONSTRAINT "availability_creator_id_day_of_week_key" UNIQUE ("creator_id", "day_of_week");



ALTER TABLE ONLY "public"."availability"
    ADD CONSTRAINT "availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_submissions"
    ADD CONSTRAINT "challenge_submissions_challenge_id_user_id_key" UNIQUE ("challenge_id", "user_id");



ALTER TABLE ONLY "public"."challenge_submissions"
    ADD CONSTRAINT "challenge_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_votes"
    ADD CONSTRAINT "challenge_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_votes"
    ADD CONSTRAINT "challenge_votes_submission_id_user_id_key" UNIQUE ("submission_id", "user_id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_booking_notes"
    ADD CONSTRAINT "client_booking_notes_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."client_health_notes"
    ADD CONSTRAINT "client_health_notes_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_designs"
    ADD CONSTRAINT "collection_designs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_client_id_creator_id_key" UNIQUE ("client_id", "creator_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_colours"
    ADD CONSTRAINT "design_colours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_comments"
    ADD CONSTRAINT "design_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_images"
    ADD CONSTRAINT "design_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_likes"
    ADD CONSTRAINT "design_likes_pkey" PRIMARY KEY ("user_id", "design_id");



ALTER TABLE ONLY "public"."design_products"
    ADD CONSTRAINT "design_products_design_id_product_id_key" UNIQUE ("design_id", "product_id");



ALTER TABLE ONLY "public"."design_products"
    ADD CONSTRAINT "design_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_tags"
    ADD CONSTRAINT "design_tags_pkey" PRIMARY KEY ("design_id", "tag_id");



ALTER TABLE ONLY "public"."designs"
    ADD CONSTRAINT "designs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favourite_creators"
    ADD CONSTRAINT "favourite_creators_pkey" PRIMARY KEY ("user_id", "creator_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "following_id");



ALTER TABLE ONLY "public"."image_backfill_map"
    ADD CONSTRAINT "image_backfill_map_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moodboard_designs"
    ADD CONSTRAINT "moodboard_designs_moodboard_id_design_id_key" UNIQUE ("moodboard_id", "design_id");



ALTER TABLE ONLY "public"."moodboard_designs"
    ADD CONSTRAINT "moodboard_designs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moodboard_members"
    ADD CONSTRAINT "moodboard_members_moodboard_id_user_id_key" UNIQUE ("moodboard_id", "user_id");



ALTER TABLE ONLY "public"."moodboard_members"
    ADD CONSTRAINT "moodboard_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moodboards"
    ADD CONSTRAINT "moodboards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nail_lab_generations"
    ADD CONSTRAINT "nail_lab_generations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processed_webhook_events"
    ADD CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles_data"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles_data"
    ADD CONSTRAINT "profiles_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."profiles_data"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rewards"
    ADD CONSTRAINT "rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salon_posts"
    ADD CONSTRAINT "salon_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_designs"
    ADD CONSTRAINT "saved_designs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_designs"
    ADD CONSTRAINT "saved_designs_user_id_design_id_key" UNIQUE ("user_id", "design_id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_pkey" PRIMARY KEY ("story_id", "user_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "designs_source_generation_id_unique" ON "public"."designs" USING "btree" ("source_generation_id") WHERE ("source_generation_id" IS NOT NULL);



CREATE UNIQUE INDEX "rewards_user_reason_ref_unique" ON "public"."rewards" USING "btree" ("user_id", "reason", "ref_id") WHERE ("ref_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "enforce_no_blocked_messaging_trg" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_no_blocked_messaging"();



CREATE OR REPLACE TRIGGER "prevent_self_vote_trg" BEFORE INSERT ON "public"."challenge_votes" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_self_vote"();



CREATE OR REPLACE TRIGGER "profiles_view_insert_trg" INSTEAD OF INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_view_insert"();



CREATE OR REPLACE TRIGGER "profiles_view_update_trg" INSTEAD OF UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_view_update"();



CREATE OR REPLACE TRIGGER "protect_privileged_profile_columns_trg" BEFORE INSERT OR UPDATE ON "public"."profiles_data" FOR EACH ROW EXECUTE FUNCTION "public"."protect_privileged_profile_columns"();



CREATE OR REPLACE TRIGGER "trg_enforce_weekly_upload_limit" BEFORE INSERT ON "public"."designs" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_weekly_upload_limit"();



CREATE OR REPLACE TRIGGER "trg_reject_entry_if_challenge_ended" BEFORE INSERT OR UPDATE ON "public"."challenge_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."reject_entry_if_challenge_ended"();



ALTER TABLE ONLY "public"."availability"
    ADD CONSTRAINT "availability_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_reference_design_id_fkey" FOREIGN KEY ("reference_design_id") REFERENCES "public"."designs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."challenge_submissions"
    ADD CONSTRAINT "challenge_submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_submissions"
    ADD CONSTRAINT "challenge_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_votes"
    ADD CONSTRAINT "challenge_votes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."challenge_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_votes"
    ADD CONSTRAINT "challenge_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_booking_notes"
    ADD CONSTRAINT "client_booking_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_health_notes"
    ADD CONSTRAINT "client_health_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_designs"
    ADD CONSTRAINT "collection_designs_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id");



ALTER TABLE ONLY "public"."collection_designs"
    ADD CONSTRAINT "collection_designs_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_colours"
    ADD CONSTRAINT "design_colours_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_comments"
    ADD CONSTRAINT "design_comments_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_comments"
    ADD CONSTRAINT "design_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_images"
    ADD CONSTRAINT "design_images_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_likes"
    ADD CONSTRAINT "design_likes_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_likes"
    ADD CONSTRAINT "design_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_products"
    ADD CONSTRAINT "design_products_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_products"
    ADD CONSTRAINT "design_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_tags"
    ADD CONSTRAINT "design_tags_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_tags"
    ADD CONSTRAINT "design_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."designs"
    ADD CONSTRAINT "designs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles_data"("id");



ALTER TABLE ONLY "public"."designs"
    ADD CONSTRAINT "designs_source_generation_id_fkey" FOREIGN KEY ("source_generation_id") REFERENCES "public"."nail_lab_generations"("id");



ALTER TABLE ONLY "public"."favourite_creators"
    ADD CONSTRAINT "favourite_creators_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favourite_creators"
    ADD CONSTRAINT "favourite_creators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moodboard_designs"
    ADD CONSTRAINT "moodboard_designs_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moodboard_designs"
    ADD CONSTRAINT "moodboard_designs_moodboard_id_fkey" FOREIGN KEY ("moodboard_id") REFERENCES "public"."moodboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moodboard_members"
    ADD CONSTRAINT "moodboard_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."moodboard_members"
    ADD CONSTRAINT "moodboard_members_moodboard_id_fkey" FOREIGN KEY ("moodboard_id") REFERENCES "public"."moodboards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moodboard_members"
    ADD CONSTRAINT "moodboard_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moodboards"
    ADD CONSTRAINT "moodboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nail_lab_generations"
    ADD CONSTRAINT "nail_lab_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles_data"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rewards"
    ADD CONSTRAINT "rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salon_posts"
    ADD CONSTRAINT "salon_posts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_designs"
    ADD CONSTRAINT "saved_designs_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_designs"
    ADD CONSTRAINT "saved_designs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete any design" ON "public"."designs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can insert any design" ON "public"."designs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update any design" ON "public"."designs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins delete any saved_designs" ON "public"."saved_designs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins manage challenges" ON "public"."challenges" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins manage design_products" ON "public"."design_products" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins manage tags" ON "public"."tags" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Anyone can read comments" ON "public"."design_comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can read likes" ON "public"."design_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view design colours" ON "public"."design_colours" FOR SELECT USING (true);



CREATE POLICY "Anyone can view design tags" ON "public"."design_tags" FOR SELECT USING (true);



CREATE POLICY "Anyone can view follows" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "Anyone can view stories" ON "public"."stories" FOR SELECT USING (true);



CREATE POLICY "Anyone can view story likes" ON "public"."story_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view tags" ON "public"."tags" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "actor_id"));



CREATE POLICY "Availability is public" ON "public"."availability" FOR SELECT USING (true);



CREATE POLICY "Board owner manages designs" ON "public"."moodboard_designs" USING ((EXISTS ( SELECT 1
   FROM "public"."moodboards"
  WHERE (("moodboards"."id" = "moodboard_designs"."moodboard_id") AND ("moodboards"."user_id" = "auth"."uid"())))));



CREATE POLICY "Client can cancel own booking" ON "public"."bookings" FOR UPDATE USING (("auth"."uid"() = "client_id"));



CREATE POLICY "Client can create booking" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "client_id"));



CREATE POLICY "Creator can update booking status" ON "public"."bookings" FOR UPDATE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Creator manages own availability" ON "public"."availability" USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Creator manages own notes" ON "public"."client_notes" USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Creator manages own services" ON "public"."services" USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Creators can delete own designs" ON "public"."designs" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Creators can insert own designs" ON "public"."designs" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Creators can update own designs" ON "public"."designs" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Delete own block" ON "public"."blocks" FOR DELETE USING (("auth"."uid"() = "blocker_id"));



CREATE POLICY "Design owners and admins manage colours" ON "public"."design_colours" USING ((EXISTS ( SELECT 1
   FROM "public"."designs"
  WHERE (("designs"."id" = "design_colours"."design_id") AND (("designs"."created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."designs"
  WHERE (("designs"."id" = "design_colours"."design_id") AND (("designs"."created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))))))));



CREATE POLICY "Design owners and admins manage images" ON "public"."design_images" USING ((EXISTS ( SELECT 1
   FROM "public"."designs"
  WHERE (("designs"."id" = "design_images"."design_id") AND (("designs"."created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."designs"
  WHERE (("designs"."id" = "design_images"."design_id") AND (("designs"."created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))))))));



CREATE POLICY "Design owners and admins manage tags" ON "public"."design_tags" USING ((EXISTS ( SELECT 1
   FROM "public"."designs"
  WHERE (("designs"."id" = "design_tags"."design_id") AND (("designs"."created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."designs"
  WHERE (("designs"."id" = "design_tags"."design_id") AND (("designs"."created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))))))));



CREATE POLICY "Insert own block" ON "public"."blocks" FOR INSERT WITH CHECK (("auth"."uid"() = "blocker_id"));



CREATE POLICY "Insert own review" ON "public"."reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Members can view their own memberships" ON "public"."moodboard_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("invited_by" = "auth"."uid"())));



CREATE POLICY "Moodboard owners can insert members" ON "public"."moodboard_members" FOR INSERT WITH CHECK (("invited_by" = "auth"."uid"()));



CREATE POLICY "Owners and members can delete" ON "public"."moodboard_members" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR ("invited_by" = "auth"."uid"())));



CREATE POLICY "Public board designs viewable" ON "public"."moodboard_designs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."moodboards"
  WHERE (("moodboards"."id" = "moodboard_designs"."moodboard_id") AND (("moodboards"."is_public" = true) OR ("moodboards"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Public boards viewable" ON "public"."moodboards" FOR SELECT USING ((("is_public" = true) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Public can read design_products" ON "public"."design_products" FOR SELECT USING (true);



CREATE POLICY "Public can read published or own designs" ON "public"."designs" FOR SELECT USING (((("is_published" = true) OR ("auth"."uid"() = "created_by")) AND "public"."design_visible_to_viewer"("created_by", "auth"."uid"())));



CREATE POLICY "Public can read published products" ON "public"."products" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Public read design_images" ON "public"."design_images" FOR SELECT USING (true);



CREATE POLICY "Public read reviews" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "Read own blocks" ON "public"."blocks" FOR SELECT USING (("auth"."uid"() = "blocker_id"));



CREATE POLICY "Service role can do everything" ON "public"."design_products" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can do everything" ON "public"."products" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Services are public" ON "public"."services" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Update own review" ON "public"."reviews" FOR UPDATE USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Users add own favourites" ON "public"."favourite_creators" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."design_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own stories" ON "public"."stories" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow as themselves" ON "public"."follows" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert own generations" ON "public"."nail_lab_generations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own comments" ON "public"."design_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles_data" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own stories" ON "public"."stories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like stories" ON "public"."story_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own likes" ON "public"."design_likes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can save designs" ON "public"."saved_designs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unfollow their own follows" ON "public"."follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can unlike stories" ON "public"."story_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unsave designs" ON "public"."saved_designs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own generations" ON "public"."nail_lab_generations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles_data" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own generations" ON "public"."nail_lab_generations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own saved designs" ON "public"."saved_designs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own boards" ON "public"."moodboards" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own favourites" ON "public"."favourite_creators" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users remove own favourites" ON "public"."favourite_creators" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "anyone can read challenges" ON "public"."challenges" FOR SELECT USING (true);



CREATE POLICY "anyone can read salon_posts" ON "public"."salon_posts" FOR SELECT USING (true);



CREATE POLICY "anyone can read submissions" ON "public"."challenge_submissions" FOR SELECT USING (true);



CREATE POLICY "anyone can read votes" ON "public"."challenge_votes" FOR SELECT USING (true);



ALTER TABLE "public"."availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_client_read" ON "public"."bookings" FOR SELECT USING ((("auth"."uid"() = "client_id") OR ("auth"."uid"() = "creator_id")));



CREATE POLICY "cbn_owner_all" ON "public"."client_booking_notes" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "cbn_tech_read" ON "public"."client_booking_notes" FOR SELECT USING ("public"."tech_has_upcoming_booking"("user_id"));



ALTER TABLE "public"."challenge_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenge_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chn_owner_all" ON "public"."client_health_notes" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "chn_tech_read" ON "public"."client_health_notes" FOR SELECT USING (("share_with_tech" AND "public"."tech_has_upcoming_booking"("user_id")));



ALTER TABLE "public"."client_booking_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_health_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collection_designs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collection_designs_policy" ON "public"."collection_designs" USING (("collection_id" IN ( SELECT "collections"."id"
   FROM "public"."collections"
  WHERE ("collections"."user_id" = "auth"."uid"())))) WITH CHECK (("collection_id" IN ( SELECT "collections"."id"
   FROM "public"."collections"
  WHERE ("collections"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collections_policy" ON "public"."collections" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_insert" ON "public"."conversations" FOR INSERT WITH CHECK ((("auth"."uid"() = "client_id") OR ("auth"."uid"() = "creator_id")));



CREATE POLICY "conversations_read" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() = "client_id") OR ("auth"."uid"() = "creator_id")));



CREATE POLICY "conversations_update" ON "public"."conversations" FOR UPDATE USING ((("auth"."uid"() = "client_id") OR ("auth"."uid"() = "creator_id")));



CREATE POLICY "creators manage their own posts" ON "public"."salon_posts" USING (("auth"."uid"() = "creator_id"));



ALTER TABLE "public"."design_colours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."designs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favourite_creators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image_backfill_map" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."client_id" = "auth"."uid"()) OR ("c"."creator_id" = "auth"."uid"())))))));



CREATE POLICY "messages_read" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."client_id" = "auth"."uid"()) OR ("c"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "messages_update" ON "public"."messages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."client_id" = "auth"."uid"()) OR ("c"."creator_id" = "auth"."uid"()))))));



ALTER TABLE "public"."moodboard_designs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moodboard_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moodboards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nail_lab_generations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."salon_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_designs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service role manages rewards" ON "public"."rewards" TO "service_role" USING (true);



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users manage own submissions" ON "public"."challenge_submissions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users manage own votes" ON "public"."challenge_votes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users read own rewards" ON "public"."rewards" FOR SELECT USING (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_comments"("design_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_comments"("design_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_comments"("design_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."decrement_credits"("user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decrement_credits"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_credits_by"("user_id" "uuid", "amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_credits_by"("user_id" "uuid", "amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_credits_by"("user_id" "uuid", "amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_likes"("design_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_likes"("design_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_likes"("design_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_saves"("design_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_saves"("design_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_saves"("design_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."design_visible_to_viewer"("design_creator_id" "uuid", "viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."design_visible_to_viewer"("design_creator_id" "uuid", "viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."design_visible_to_viewer"("design_creator_id" "uuid", "viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_no_blocked_messaging"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_no_blocked_messaging"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_no_blocked_messaging"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_weekly_upload_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_weekly_upload_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_weekly_upload_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_comments"("design_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_comments"("design_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_comments"("design_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_credits"("user_id" "uuid", "amount" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_credits"("user_id" "uuid", "amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_likes"("design_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_likes"("design_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_likes"("design_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_saves"("design_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_saves"("design_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_saves"("design_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_self_vote"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_self_vote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_self_vote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_privileged_profile_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_privileged_profile_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_privileged_profile_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_entry_if_challenge_ended"() TO "anon";
GRANT ALL ON FUNCTION "public"."reject_entry_if_challenge_ended"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_entry_if_challenge_ended"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tech_has_upcoming_booking"("p_client" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tech_has_upcoming_booking"("p_client" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tech_has_upcoming_booking"("p_client" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."availability" TO "anon";
GRANT ALL ON TABLE "public"."availability" TO "authenticated";
GRANT ALL ON TABLE "public"."availability" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_submissions" TO "anon";
GRANT ALL ON TABLE "public"."challenge_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_votes" TO "anon";
GRANT ALL ON TABLE "public"."challenge_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_votes" TO "service_role";



GRANT ALL ON TABLE "public"."challenges" TO "anon";
GRANT ALL ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT ALL ON TABLE "public"."client_booking_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."client_booking_notes" TO "service_role";



GRANT ALL ON TABLE "public"."client_health_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."client_health_notes" TO "service_role";



GRANT ALL ON TABLE "public"."client_notes" TO "anon";
GRANT ALL ON TABLE "public"."client_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."client_notes" TO "service_role";



GRANT ALL ON TABLE "public"."collection_designs" TO "anon";
GRANT ALL ON TABLE "public"."collection_designs" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_designs" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."design_colours" TO "anon";
GRANT ALL ON TABLE "public"."design_colours" TO "authenticated";
GRANT ALL ON TABLE "public"."design_colours" TO "service_role";



GRANT ALL ON TABLE "public"."design_comments" TO "anon";
GRANT ALL ON TABLE "public"."design_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."design_comments" TO "service_role";



GRANT ALL ON TABLE "public"."design_images" TO "anon";
GRANT ALL ON TABLE "public"."design_images" TO "authenticated";
GRANT ALL ON TABLE "public"."design_images" TO "service_role";



GRANT ALL ON TABLE "public"."design_likes" TO "anon";
GRANT ALL ON TABLE "public"."design_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."design_likes" TO "service_role";



GRANT ALL ON TABLE "public"."design_products" TO "anon";
GRANT ALL ON TABLE "public"."design_products" TO "authenticated";
GRANT ALL ON TABLE "public"."design_products" TO "service_role";



GRANT ALL ON TABLE "public"."design_tags" TO "anon";
GRANT ALL ON TABLE "public"."design_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."design_tags" TO "service_role";



GRANT ALL ON TABLE "public"."designs" TO "anon";
GRANT ALL ON TABLE "public"."designs" TO "authenticated";
GRANT ALL ON TABLE "public"."designs" TO "service_role";



GRANT ALL ON TABLE "public"."favourite_creators" TO "anon";
GRANT ALL ON TABLE "public"."favourite_creators" TO "authenticated";
GRANT ALL ON TABLE "public"."favourite_creators" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."image_backfill_map" TO "anon";
GRANT ALL ON TABLE "public"."image_backfill_map" TO "authenticated";
GRANT ALL ON TABLE "public"."image_backfill_map" TO "service_role";



GRANT ALL ON SEQUENCE "public"."image_backfill_map_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."image_backfill_map_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."image_backfill_map_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."moodboard_designs" TO "anon";
GRANT ALL ON TABLE "public"."moodboard_designs" TO "authenticated";
GRANT ALL ON TABLE "public"."moodboard_designs" TO "service_role";



GRANT ALL ON TABLE "public"."moodboard_members" TO "anon";
GRANT ALL ON TABLE "public"."moodboard_members" TO "authenticated";
GRANT ALL ON TABLE "public"."moodboard_members" TO "service_role";



GRANT ALL ON TABLE "public"."moodboards" TO "anon";
GRANT ALL ON TABLE "public"."moodboards" TO "authenticated";
GRANT ALL ON TABLE "public"."moodboards" TO "service_role";



GRANT ALL ON TABLE "public"."nail_lab_generations" TO "anon";
GRANT ALL ON TABLE "public"."nail_lab_generations" TO "authenticated";
GRANT ALL ON TABLE "public"."nail_lab_generations" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."processed_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."processed_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles_data" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles_data" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_data" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles_data" TO "anon";
GRANT SELECT("id") ON TABLE "public"."profiles_data" TO "authenticated";



GRANT SELECT,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."rewards" TO "anon";
GRANT ALL ON TABLE "public"."rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."rewards" TO "service_role";



GRANT ALL ON TABLE "public"."salon_posts" TO "anon";
GRANT ALL ON TABLE "public"."salon_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."salon_posts" TO "service_role";



GRANT ALL ON TABLE "public"."saved_designs" TO "anon";
GRANT ALL ON TABLE "public"."saved_designs" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_designs" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON TABLE "public"."story_likes" TO "anon";
GRANT ALL ON TABLE "public"."story_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."story_likes" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









SET search_path = public, extensions;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE POLICY "Service role can upload to nail-lab" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK ((bucket_id = 'nail-lab'::text));
CREATE POLICY "Users can upload to own avatar or story folder, admins anywhere" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'designs'::text) AND ((((storage.foldername(name))[1] = ANY (ARRAY['avatars'::text, 'stories'::text])) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))));
CREATE POLICY "Users can update own avatar or story folder, admins anywhere" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'designs'::text) AND ((((storage.foldername(name))[1] = ANY (ARRAY['avatars'::text, 'stories'::text])) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))));
CREATE POLICY "Users can view own nail-lab generations" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'nail-lab'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
INSERT INTO storage.buckets (id,name,public) VALUES ('designs','designs',true);
INSERT INTO storage.buckets (id,name,public) VALUES ('nail-lab','nail-lab',false);
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."messages";
