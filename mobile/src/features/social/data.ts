import { api, checked } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { supabase } from "../../lib/supabase";
import type { SocialMedia } from "./media";
import type { TaggedPerson } from "./people";
import type { SocialDraft } from "./composer";
export { pickSocialMedia } from "./picker";
export async function searchPeople(
  q: string,
  signal: AbortSignal,
): Promise<TaggedPerson[]> {
  const { data, error } = await supabase
    .rpc("search_accounts", { p_query: q })
    .select("id,username,display_name")
    .not("username", "is", null)
    .order("username")
    .limit(20)
    .abortSignal(signal);
  if (error || !Array.isArray(data))
    throw new Error(error?.message || "Accounts unavailable.");
  const rows = data as {
    id: string;
    username: string | null;
    display_name: string | null;
  }[];
  return rows.map((p) => ({
    id: p.id,
    username: p.username!,
    name: p.display_name || p.username!,
  }));
}
export async function signedSocial(path: string) {
  const { data, error } = await supabase.storage
    .from("social-media")
    .createSignedUrl(path, 300);
  if (error || !data?.signedUrl)
    throw new Error("Media unavailable. Refresh and retry.");
  return data.signedUrl;
}
export async function postSocial(
  kind: "post" | "story",
  id: string,
  draft: SocialDraft,
  uploaded: Map<string, string>,
  onProgress: (stage: string) => void = () => undefined,
) {
  const ticket = accountScope.capture();
  const table = kind === "post" ? "salon_posts" : "stories";
  const owner = kind === "post" ? "creator_id" : "user_id";
  onProgress("Checking this posting attempt…");
  const existing = await checked<{ id: string }[]>(
    supabase
      .from(table)
      .select("id")
      .eq("id", id)
      .eq(owner, ticket.id!)
      .limit(1),
  );
  accountScope.assert(ticket);
  if (existing.length) return;
  const media = [];
  for (const [index, m] of draft.media.entries()) {
    onProgress(
      `Uploading ${m.type === "video" ? "video" : "photo"} ${index + 1} of ${draft.media.length}…`,
    );
    if (typeof m.uri !== "string")
      throw new Error("Choose a photo or video from your device.");
    let path = uploaded.get(m.uri);
    if (!path) {
      const bytes = await (await fetch(m.uri)).arrayBuffer();
      accountScope.assert(ticket);
      if (bytes.byteLength > (m.type === "video" ? 50 : 8) * 1024 * 1024)
        throw new Error("This media file is too large.");
      const ticketUpload = await api<{ path: string; token: string }>(
        "/mobile/social-media",
        { mime: m.mime },
      );
      accountScope.assert(ticket);
      const result = await supabase.storage
        .from("social-media")
        .uploadToSignedUrl(ticketUpload.path, ticketUpload.token, bytes, {
          contentType: m.mime,
          upsert: false,
        });
      accountScope.assert(ticket);
      if (result.error) throw result.error;
      path = ticketUpload.path;
      uploaded.set(m.uri, path);
    }
    media.push({ path, type: m.type });
  }
  const common = {
    id,
    tags: draft.tags,
    mentioned_user_ids: draft.people.map((p) => p.id),
  };
  const record =
    kind === "post"
      ? { ...common, creator_id: ticket.id, body: draft.caption, media }
      : {
          ...common,
          user_id: ticket.id,
          caption: draft.caption,
          image_url: "",
          media_path: media[0].path,
          media_type: media[0].type,
        };
  onProgress("Publishing to your profile’s audience…");
  await checked(
    supabase
      .from(table)
      .insert<Record<string, unknown>>(record)
      .select("id")
      .single(),
  );
  accountScope.assert(ticket);
}
export type SocialPost = {
  id: string;
  userId: string;
  name: string;
  username: string | null;
  caption: string;
  createdAt: string;
  media: SocialMedia[];
  tags: string[];
  people: TaggedPerson[];
};
export async function socialPeople(
  ids: string[],
  signal: AbortSignal,
): Promise<TaggedPerson[]> {
  if (!ids.length) return [];
  const rows = await checked<
    { id: string; username: string | null; display_name: string | null }[]
  >(
    supabase
      .from("profiles")
      .select("id,username,display_name")
      .in("id", [...new Set(ids)])
      .abortSignal(signal),
  );
  return rows
    .filter((p) => p.username)
    .map((p) => ({
      id: p.id,
      username: p.username!,
      name: p.display_name || p.username!,
    }));
}
export async function listCommunity(
  signal: AbortSignal,
  limit = 24,
  id?: string,
): Promise<SocialPost[]> {
  const ticket = accountScope.capture();
  let q = supabase
    .from("salon_posts")
    .select("id,creator_id,body,created_at,media,tags,mentioned_user_ids")
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limit)
    .abortSignal(signal);
  if (id) q = q.eq("id", id);
  const rows = await checked<
    {
      id: string;
      creator_id: string;
      body: string;
      created_at: string;
      media: { path: string; type: "image" | "video" }[];
      tags: string[];
      mentioned_user_ids: string[];
    }[]
  >(q);
  if (!rows.length) return [];
  const profiles = await checked<
    { id: string; username: string | null; display_name: string | null }[]
  >(
    supabase
      .from("profiles")
      .select("id,username,display_name")
      .in("id", [...new Set(rows.map((p) => p.creator_id))])
      .abortSignal(signal),
  );
  const people = await socialPeople(
    rows.flatMap((p) => p.mentioned_user_ids),
    signal,
  );
  const result = await Promise.all(
    rows
      .filter((r) => profiles.some((p) => p.id === r.creator_id))
      .map(async (r) => {
        const owner = profiles.find((p) => p.id === r.creator_id)!;
        return {
          id: r.id,
          userId: r.creator_id,
          name: owner.display_name || owner.username || "LaQue member",
          username: owner.username,
          caption: r.body,
          createdAt: r.created_at,
          tags: r.tags,
          people: people.filter((p) => r.mentioned_user_ids.includes(p.id)),
          media: await Promise.all(
            r.media.map(async (m) => ({
              ...m,
              uri: await signedSocial(m.path),
            })),
          ),
        };
      }),
  );
  accountScope.assert(ticket);
  return result;
}
