import { supabase } from "../../lib/supabase";
import { checked } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { resolvePrivateImage, setSaved } from "../../lib/designs";
import type { Design } from "../../lib/types";
import {
  folderName,
  type FavoriteAction,
  type FavoritesLibrary,
} from "./model";
type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;
async function pages<T>(
  load: (from: number, to: number) => PageResult<T>,
  signal: AbortSignal,
) {
  const ticket = accountScope.capture(),
    result: T[] = [];
  for (let from = 0; ; from += 100) {
    if (signal.aborted) throw new Error("Request cancelled.");
    accountScope.assert(ticket);
    const rows = await checked<T[]>(load(from, from + 99));
    accountScope.assert(ticket);
    result.push(...rows);
    if (rows.length < 100) return result;
  }
}
export async function loadFavorites(
  userId: string,
  signal: AbortSignal,
): Promise<FavoritesLibrary> {
  const ticket = accountScope.capture();
  if (ticket.id !== userId) throw new Error("Sign in to continue.");
  const [saved, folders, favorites] = await Promise.all([
    pages<{ design_id: string }>(
      (a, b) =>
        supabase
          .from("saved_designs")
          .select("design_id")
          .eq("user_id", userId)
          .order("saved_at", { ascending: false })
          .order("id")
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    pages<{ id: string; name: string }>(
      (a, b) =>
        supabase
          .from("collections")
          .select("id,name")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    pages<{ creator_id: string }>(
      (a, b) =>
        supabase
          .from("favourite_creators")
          .select("creator_id")
          .eq("user_id", userId)
          .order("creator_id")
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
  ]);
  accountScope.assert(ticket);
  const members: { collection_id: string; design_id: string }[] = [];
  for (let i = 0; i < folders.length; i += 50) {
    members.push(
      ...(await pages<{ collection_id: string; design_id: string }>(
        (a, b) =>
          supabase
            .from("collection_designs")
            .select("collection_id,design_id")
            .in(
              "collection_id",
              folders.slice(i, i + 50).map((f) => f.id),
            )
            .order("added_at", { ascending: false })
            .order("id")
            .range(a, b)
            .abortSignal(signal),
        signal,
      )),
    );
  }
  const ids = [
    ...new Set([
      ...saved.map((s) => s.design_id),
      ...members.map((m) => m.design_id),
    ]),
  ];
  const records: Design[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    accountScope.assert(ticket);
    records.push(
      ...(await checked<Design[]>(
        supabase
          .from("designs")
          .select("*")
          .in("id", ids.slice(i, i + 50))
          .abortSignal(signal),
      )),
    );
  }
  const designs: FavoritesLibrary["designs"] = [];
  // Resolve private images in bounded groups. Missing/private content is never replaced with another user's cached asset.
  for (let i = 0; i < records.length; i += 12) {
    designs.push(
      ...(await Promise.all(
        records.slice(i, i + 12).map(async (d) => ({
          id: d.id,
          title: d.title,
          image: await resolvePrivateImage(d.image_url).catch(() => null),
          attributes: [d.shape, d.length, d.category].filter(
            (v): v is string => !!v,
          ),
          saved: saved.some((s) => s.design_id === d.id),
        })),
      )),
    );
    accountScope.assert(ticket);
  }
  designs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const profiles: FavoritesLibrary["profiles"] = [];
  for (let i = 0; i < favorites.length; i += 50) {
    const rows = await checked<
      {
        id: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
        account_type: string;
        location: string | null;
      }[]
    >(
      supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url,account_type,location")
        .in(
          "id",
          favorites.slice(i, i + 50).map((f) => f.creator_id),
        )
        .abortSignal(signal),
    );
    for (const p of rows) {
      accountScope.assert(ticket);
      profiles.push({
        id: p.id,
        name: p.display_name || p.username || "LaQue member",
        image: await resolvePrivateImage(p.avatar_url).catch(() => null),
        kind:
          p.account_type === "salon"
            ? "SALON"
            : ["creator", "nail_artist"].includes(p.account_type)
              ? "NAIL ARTIST"
              : "MEMBER",
        location: p.account_type === "user" ? null : p.location,
        saved: true,
      });
    }
  }
  accountScope.assert(ticket);
  return {
    designs,
    savedIds: saved.map((s) => s.design_id),
    profiles,
    folders: folders.map((f) => ({
      ...f,
      designIds: members
        .filter((m) => m.collection_id === f.id)
        .map((m) => m.design_id),
    })),
  };
}
export async function changeFavorite(userId: string, action: FavoriteAction) {
  const ticket = accountScope.capture();
  if (ticket.id !== userId) throw new Error("Sign in to continue.");
  accountScope.assert(ticket);
  if (action.kind === "create")
    await checked(
      supabase
        .from("collections")
        .upsert(
          { id: action.id, user_id: userId, name: folderName(action.name) },
          { onConflict: "id" },
        )
        .select("id")
        .single(),
    );
  else if (action.kind === "save-design")
    await setSaved(userId, action.designId, action.saved);
  else if (action.kind === "remove-profile")
    await checked(
      supabase
        .from("favourite_creators")
        .delete()
        .eq("user_id", userId)
        .eq("creator_id", action.profileId)
        .select("creator_id"),
    );
  else {
    // RLS remains authoritative; explicit ownership also prevents a stale folder selection from appearing successful.
    await checked(
      supabase
        .from("collections")
        .select("id")
        .eq("id", action.folderId)
        .eq("user_id", userId)
        .single(),
    );
    accountScope.assert(ticket);
    if (action.kind === "rename")
      await checked(
        supabase
          .from("collections")
          .update({ name: folderName(action.name) })
          .eq("id", action.folderId)
          .eq("user_id", userId)
          .select("id")
          .single(),
      );
    if (action.kind === "delete")
      await checked(
        supabase
          .from("collections")
          .delete()
          .eq("id", action.folderId)
          .eq("user_id", userId)
          .select("id")
          .single(),
      );
    if (action.kind === "add" && action.designIds.length)
      await checked(
        supabase
          .from("collection_designs")
          .upsert(
            [...new Set(action.designIds)].map((id) => ({
              collection_id: action.folderId,
              design_id: id,
            })),
            { onConflict: "collection_id,design_id", ignoreDuplicates: true },
          )
          .select("id"),
      );
    if (action.kind === "remove")
      await checked(
        supabase
          .from("collection_designs")
          .delete()
          .eq("collection_id", action.folderId)
          .eq("design_id", action.designId)
          .select("id"),
      );
  }
  accountScope.assert(ticket);
}
