import { checked } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { supabase } from "../../lib/supabase";

// Keep one ID/body through a lost response; an existing row must confirm the same note.
export async function publishUpdate(id: string, body: string) {
  const ticket = accountScope.capture();
  if (!ticket.id) throw new Error("Sign in to publish an update.");
  const text = body.trim();
  if (!text || text.length > 2200)
    throw new Error("Write an update of up to 2,200 characters.");
  const rows = await checked<
    {
      id: string;
      creator_id: string;
      body: string;
      media: unknown;
    }[]
  >(
    supabase
      .from("salon_posts")
      .select("id,creator_id,body,media")
      .eq("id", id)
      .eq("creator_id", ticket.id)
      .limit(1),
  );
  accountScope.assert(ticket);
  const existing = rows[0];
  if (existing) {
    if (
      existing.id !== id ||
      existing.creator_id !== ticket.id ||
      existing.body !== text ||
      !Array.isArray(existing.media) ||
      existing.media.length !== 0
    )
      throw new Error(
        "This posting attempt does not match your update. Check Updates before trying again.",
      );
    return;
  }
  const posted = await checked<{ id: string } | null>(
    supabase
      .from("salon_posts")
      .insert({
        id,
        creator_id: ticket.id,
        body: text,
        media: [],
        tags: [],
        mentioned_user_ids: [],
      })
      .select("id")
      .single(),
  );
  accountScope.assert(ticket);
  if (posted?.id !== id)
    throw new Error(
      "Publishing could not be confirmed. Retry to check the same update.",
    );
}
