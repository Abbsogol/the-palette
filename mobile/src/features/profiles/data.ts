import { supabase } from "../../lib/supabase";
import { checked } from "../../lib/api";
import { resolvePrivateImage } from "../../lib/designs";
import { accountScope } from "../../lib/account-scope";
import type { Booking, Design } from "../../lib/types";
import type {
  ProfileIdentity,
  ProfileDesign,
  ProfileAccount,
  ProfileStats,
  ProfileCollection,
  ProfileReview,
  ProfileService,
} from "./model";
const PAGE = 24;
export const PUBLIC_PROFILE_COLUMNS =
  "id,display_name,username,avatar_url,banner_url,bio,location,account_type,is_private,specialties";
export type IdentityRecord = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  bio: string | null;
  location: string | null;
  account_type: string;
  is_private: boolean;
  specialties: string[] | null;
};
export function identityModel(p: IdentityRecord): ProfileIdentity {
  return {
    id: p.id,
    name: p.display_name || p.username || "LaQue member",
    username:p.username,
    role:
      p.account_type === "salon"
        ? "salon"
        : ["creator", "nail_artist"].includes(p.account_type)
          ? "creator"
          : "user",
    avatar: p.avatar_url ? { uri: p.avatar_url } : null,
    cover: p.banner_url ? { uri: p.banner_url } : undefined,
    bio: p.bio,
    location: p.location,
    specialties: p.specialties || [],
    private: p.is_private,
  };
}
export function validateProfileId(id: string) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
    throw new Error("This profile link is invalid.");
}
export async function loadIdentity(
  id: string,
  signal: AbortSignal,
  owner = false,
) {
  validateProfileId(id);
  const record = await checked<IdentityRecord>(
    supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq("id", id)
      .abortSignal(signal)
      .single(),
  );
  const model = identityModel(record);
  const avatar = await resolvePrivateImage(record.avatar_url);
  return {
    ...model,
    location: !owner && model.role === "user" ? null : model.location,
    avatar: avatar ? { uri: avatar } : null,
  };
}
async function exactCount(
  request: PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>,
) {
  const ticket = accountScope.capture();
  const { count, error } = await request;
  accountScope.assert(ticket);
  if (error || count === null)
    throw new Error(error?.message || "Counts are unavailable.");
  return count;
}
export async function loadStats(
  id: string,
  owner: boolean,
  privateProfile: boolean,
  signal: AbortSignal,
  customer = false,
): Promise<ProfileStats> {
  let designs = supabase
    .from("designs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", id);
  if (!owner) designs = designs.eq("is_published", true);
  const [followers, total, following] = await Promise.all([
    exactCount(
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", id)
        .abortSignal(signal),
    ),
    !owner && privateProfile
      ? Promise.resolve(0)
      : exactCount(designs.abortSignal(signal)),
    owner || customer
      ? exactCount(
          supabase
            .from("follows")
            .select("following_id", { count: "exact", head: true })
            .eq("follower_id", id)
            .abortSignal(signal),
        )
      : Promise.resolve(undefined),
  ]);
  let rating: number | null = null;
  if (!owner && !privateProfile && !customer) {
    // Supabase caps rows. Page through the ratings so an average is never taken from only the first page.
    let sum = 0,
      count = 0,
      page = 0;
    while (true) {
      const rows = await checked<{ rating: number }[]>(
        supabase
          .from("reviews")
          .select("id,rating")
          .eq("creator_id", id)
          .order("id")
          .range(page * 500, page * 500 + 499)
          .abortSignal(signal),
      );
      rows.forEach((r) => {
        sum += r.rating;
        count++;
      });
      if (rows.length < 500) break;
      page++;
    }
    if (count) rating = Math.round((sum / count) * 10) / 10;
  }
  return { followers, designs: total, following, rating };
}
export async function designModels(
  records: Design[],
): Promise<ProfileDesign[]> {
  const ticket = accountScope.capture();
  const models = await Promise.all(
    records.map(async (d) => {
      let image: string | null = null;
      try {
        image = await resolvePrivateImage(d.image_url);
      } catch {
        /* Render an explicit unavailable image; never substitute a different design. */
      }
      return {
        id: d.id,
        title: d.title,
        category: d.category,
        image: image ? { uri: image } : null,
        published: !!d.is_published,
      };
    }),
  );
  accountScope.assert(ticket);
  return models;
}
export type ProfileContent = {
  designs: ProfileDesign[];
  collections: ProfileCollection[];
  services: ProfileService[];
  reviews: ProfileReview[];
  hasMore: boolean;
};
export async function loadContent(
  profile: ProfileIdentity,
  owner: boolean,
  tab: string,
  page: number,
  signal: AbortSignal,
): Promise<ProfileContent> {
  const empty: ProfileContent = {
    designs: [],
    collections: [],
    services: [],
    reviews: [],
    hasMore: false,
  };
  // Explicit public projection applies even when the owner opens their own public profile.
  if (!owner && profile.private) return empty;
  const from = page * PAGE,
    to = from + PAGE - 1;
  if (tab === "About") return empty;
  if (tab === "Collections") {
    if (!owner) throw new Error("Sign in to view your collections.");
    const rows = await checked<ProfileCollection[]>(
      supabase
        .from("collections")
        .select("id,name")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
        .abortSignal(signal),
    );
    return { ...empty, collections: rows, hasMore: rows.length === PAGE };
  }
  if (tab === "Services") {
    const rows = await checked<ProfileService[]>(
      supabase
        .from("services")
        .select("id,name,description,price,deposit_amount,duration_minutes")
        .eq("creator_id", profile.id)
        .eq("is_active", true)
        .order("created_at")
        .order("id")
        .range(from, to)
        .abortSignal(signal),
    );
    return { ...empty, services: rows, hasMore: rows.length === PAGE };
  }
  if (tab === "Reviews") {
    const rows = await checked<ProfileReview[]>(
      supabase
        .from("reviews")
        .select("id,rating,text,created_at")
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
        .abortSignal(signal),
    );
    return { ...empty, reviews: rows, hasMore: rows.length === PAGE };
  }
  let rows: Design[], rawCount: number;
  if (tab === "Saved") {
    if (!owner) throw new Error("Sign in to view your saved designs.");
    const saved = await checked<{ designs: Design | null }[]>(
      supabase
        .from("saved_designs")
        .select("designs(*)")
        .eq("user_id", profile.id)
        .order("saved_at", { ascending: false })
        .order("id")
        .range(from, to)
        .abortSignal(signal)
        .overrideTypes<{ designs: Design | null }[], { merge: false }>(),
    );
    rows = saved.flatMap((r) => (r.designs ? [r.designs] : []));
    rawCount = saved.length;
  } else {
    let q = supabase.from("designs").select("*").eq("created_by", profile.id);
    if (!owner) q = q.eq("is_published", true);
    rows = await checked<Design[]>(
      q
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
        .abortSignal(signal),
    );
    rawCount = rows.length;
  }
  return {
    ...empty,
    designs: await designModels(rows),
    hasMore: rawCount === PAGE,
  };
}
export function appointmentDate(
  b: Pick<Booking, "starts_at" | "booking_date" | "start_time" | "time_zone">,
) {
  if (b.starts_at && b.time_zone) {
    try {
      return `${new Intl.DateTimeFormat("en", { timeZone: b.time_zone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(b.starts_at))} · ${b.time_zone}`;
    } catch {
      /* Legacy records retain their written time and explicit zone. */
    }
  }
  return `${b.booking_date} · ${b.start_time.slice(0, 5)} · ${b.time_zone || "Time zone needs review"}`;
}
export async function loadAccount(
  id: string,
  signal: AbortSignal,
): Promise<ProfileAccount> {
  validateProfileId(id);
  const upcoming = () =>
    supabase
      .from("bookings")
      .select("*,services(*)", { count: "exact" })
      .or(`client_id.eq.${id},creator_id.eq.${id}`)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", new Date().toISOString());
  const [saved, favorites, collections, credit, bookingResponse] =
    await Promise.all([
      exactCount(
        supabase
          .from("saved_designs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", id)
          .abortSignal(signal),
      ),
      exactCount(
        supabase
          .from("favourite_creators")
          .select("creator_id", { count: "exact", head: true })
          .eq("user_id", id)
          .abortSignal(signal),
      ),
      exactCount(
        supabase
          .from("collections")
          .select("id", { count: "exact", head: true })
          .eq("user_id", id)
          .abortSignal(signal),
      ),
      checked<{ credit_balance: number | null }>(
        supabase
          .from("profiles")
          .select("credit_balance")
          .eq("id", id)
          .abortSignal(signal)
          .single(),
      ),
      upcoming().order("starts_at").limit(1).abortSignal(signal),
    ]);
  if (bookingResponse.error || bookingResponse.count === null)
    throw new Error(
      bookingResponse.error?.message || "Appointments could not load.",
    );
  const booking = bookingResponse.data?.[0] as Booking | undefined;
  let appointment: ProfileAccount["appointment"] = null;
  if (booking) {
    const otherId =
      booking.creator_id === id ? booking.client_id : booking.creator_id;
    const other = await loadIdentity(otherId, signal);
    appointment = {
      id: booking.id,
      name: other.name,
      subtitle: `${other.role === "user" ? "Customer" : other.role === "salon" ? "Salon" : "Nail Artist"}${other.location ? ` • ${other.location}` : ""}`,
      avatar: other.avatar,
      service: booking.services?.name || "Appointment",
      date: appointmentDate(booking),
      status: booking.status,
    };
  }
  return {
    saved,
    favorites,
    collections,
    credits: credit.credit_balance,
    upcoming: bookingResponse.count,
    appointment,
  };
}
export async function loadRelationships(
  viewer: string,
  target: string,
  designIds: string[],
  signal: AbortSignal,
) {
  const [favorites, follows, saved] = await Promise.all([
    checked<{ creator_id: string }[]>(
      supabase
        .from("favourite_creators")
        .select("creator_id")
        .eq("user_id", viewer)
        .eq("creator_id", target)
        .abortSignal(signal),
    ),
    checked<{ following_id: string }[]>(
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewer)
        .eq("following_id", target)
        .abortSignal(signal),
    ),
    designIds.length
      ? checked<{ design_id: string }[]>(
          supabase
            .from("saved_designs")
            .select("design_id")
            .eq("user_id", viewer)
            .in("design_id", designIds)
            .abortSignal(signal),
        )
      : Promise.resolve([]),
  ]);
  return {
    favorite: favorites.length > 0,
    following: follows.length > 0,
    saved: saved.map((v) => v.design_id),
  };
}
