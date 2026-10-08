import type { ImageProps } from "expo-image";
import { accountScope } from "../../lib/account-scope";
import { resolvePrivateImage } from "../../lib/designs";
import { signedSocial, socialPeople } from "../social/data";
import type { TaggedPerson } from "../social/people";
import { supabase } from "../../lib/supabase";
import { checked } from "../../lib/api";
import type { Design, Profile } from "../../lib/types";
import type { HomeCategory, HomeSort, HomeTab } from "./home-main-view";

export type HomePreferences = Pick<
  Profile,
  "nail_shape" | "occasions" | "nail_techniques"
>;
export function rankForYou(
  designs: Design[],
  preferences?: HomePreferences | null,
) {
  const score = (d: Design) => {
    let result = Math.min((d.saves_count || 0) * 0.1, 2);
    if (
      preferences?.nail_shape &&
      d.shape?.toLowerCase() === preferences.nail_shape.toLowerCase()
    )
      result += 3;
    for (const [values, field, weight] of [
      [preferences?.occasions, d.occasion, 2],
      [preferences?.nail_techniques, d.technique, 1.5],
    ] as const) {
      const terms = (field || "")
        .toLowerCase()
        .split(",")
        .map((term) => term.trim())
        .filter(Boolean);
      for (const value of values || [])
        if (
          value.trim() &&
          terms.some(
            (term) =>
              term.includes(value.toLowerCase()) ||
              value.toLowerCase().includes(term),
          )
        )
          result += weight;
    }
    return result;
  };
  return [...designs].sort(
    (a, b) =>
      score(b) - score(a) ||
      b.created_at.localeCompare(a.created_at) ||
      a.id.localeCompare(b.id),
  );
}
async function followedIds(userId: string, signal: AbortSignal) {
  // Paginate follow edges rather than silently dropping creators beyond PostgREST's row cap.
  const ids: string[] = [];
  for (let page = 0; ; page++) {
    const rows = await checked<{ following_id: string }[]>(
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .order("following_id")
        .range(page * 500, page * 500 + 499)
        .abortSignal(signal),
    );
    ids.push(...rows.map((row) => row.following_id));
    if (rows.length < 500) return ids;
  }
}
export async function listHomeDesigns(
  kind: "trending" | "week" | "library",
  signal: AbortSignal,
  options: {
    tab: HomeTab;
    category: HomeCategory;
    sort: HomeSort;
    limit: number;
    userId?: string;
    preferences?: HomePreferences | null;
  },
) {
  if (options.tab === "Updates" || options.tab === "Community") return [];
  let query = supabase.from("designs").select("*").eq("is_published", true);
  if (kind === "week")
    query = query.gte(
      "created_at",
      new Date(Date.now() - 7 * 86400000).toISOString(),
    );
  if (options.tab === "Following") {
    if (!options.userId) return [];
    const ids = await followedIds(options.userId, signal);
    if (!ids.length) return [];
    query = query.in("created_by", ids);
  }
  if (options.category !== "All") {
    // Match the same category vocabulary as the existing web feed.
    query =
      options.category === "Colourful"
        ? query.or("category.ilike.%colour%,category.ilike.%color%")
        : query.ilike("category", `%${options.category}%`);
  }
  const popular =
    kind === "trending" || (kind !== "week" && options.sort === "Most saved");
  const records = await checked<Design[]>(
    query
      .order(popular ? "saves_count" : "created_at", { ascending: false })
      .order("id")
      .limit(options.limit)
      .abortSignal(signal),
  );
  return kind !== "week" && !popular && options.sort === "For you"
    ? rankForYou(records, options.preferences)
    : records;
}
export async function homeCommunityCounts(signal: AbortSignal) {
  const [artists, posts] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("account_type", ["creator", "salon"])
      .abortSignal(signal),
    supabase
      .from("salon_posts")
      .select("id", { count: "exact", head: true })
      .abortSignal(signal),
  ]);
  if (
    artists.error ||
    posts.error ||
    artists.count === null ||
    posts.count === null
  )
    throw new Error("Community totals are unavailable.");
  return { artists: artists.count, posts: posts.count };
}
export type HomeStoryRecord = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  media_path?: string | null;
  media_type?: "image" | "video";
  tags?: string[];
  mentioned_user_ids?: string[];
  people?: TaggedPerson[];
  created_at: string;
  name: string;
  avatar_url?: string | null;
};
export async function listHomeStories(signal: AbortSignal, userId?: string) {
  let query = supabase
    .from("stories")
    .select(
      "id,user_id,image_url,caption,created_at,media_path,media_type,tags,mentioned_user_ids",
    )
    .gte("created_at", new Date(Date.now() - 86400000).toISOString());
  if (userId) query = query.eq("user_id", userId);
  const stories = await checked<Omit<HomeStoryRecord, "name">[]>(
    query
      .order("created_at", { ascending: false })
      .limit(200)
      .abortSignal(signal),
  );
  if (!stories.length) return [];
  const profiles = await checked<
    Pick<Profile, "id" | "display_name" | "avatar_url">[]
  >(
    supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", [...new Set(stories.map((story) => story.user_id))])
      .abortSignal(signal),
  );
  const names = new Map(
    profiles.map((profile) => [profile.id, profile.display_name || "Creator"]),
  );
  const people = await socialPeople(
    stories.flatMap((s) => s.mentioned_user_ids || []),
    signal,
  );
  return Promise.all(
    stories
      .filter((story) => names.has(story.user_id))
      .map(async (story) => ({
        ...story,
        image_url: story.media_path
          ? await signedSocial(story.media_path)
          : story.image_url,
        name: names.get(story.user_id)!,
        avatar_url: profiles.find((p) => p.id === story.user_id)?.avatar_url,
        people: people.filter((p) => story.mentioned_user_ids?.includes(p.id)),
      })),
  );
}
export type HomeUpdate = {
  id: string;
  creator_id: string;
  body: string;
  created_at: string;
  name: string;
  username?: string | null;
  avatar?: ImageProps["source"] | null;
};
export async function listHomeUpdates(
  userId: string,
  limit: number,
  signal: AbortSignal,
) {
  const ticket = accountScope.capture();
  const ids = [...new Set([userId, ...(await followedIds(userId, signal))])];
  accountScope.assert(ticket);
  const posts = await checked<Omit<HomeUpdate, "name">[]>(
    supabase
      .from("salon_posts")
      .select("id,creator_id,body,created_at")
      .eq("media", "[]")
      .in("creator_id", ids)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(limit)
      .abortSignal(signal),
  );
  accountScope.assert(ticket);
  if (!posts.length) return [];
  const profiles = await checked<
    Pick<Profile, "id" | "display_name" | "username" | "avatar_url">[]
  >(
    supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", [...new Set(posts.map((post) => post.creator_id))])
      .abortSignal(signal),
  );
  const authors = new Map(
    await Promise.all(
      profiles.map(async (profile) => {
        const avatar = await resolvePrivateImage(profile.avatar_url).catch(
          () => null,
        );
        return [
          profile.id,
          {
            name: profile.display_name || profile.username || "LaQue member",
            username: profile.username,
            avatar: avatar ? { uri: avatar } : null,
          },
        ] as const;
      }),
    ),
  );
  accountScope.assert(ticket);
  return posts
    .filter((post) => authors.has(post.creator_id))
    .map((post) => ({ ...post, ...authors.get(post.creator_id)! }));
}
