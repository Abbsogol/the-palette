import { checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { resolvePrivateImage } from "../../lib/designs";
import { accountScope } from "../../lib/account-scope";
import type { Conversation, Message, Profile } from "../../lib/types";
import {
  messagePreview,
  type MessageContact,
  type ShareRecipient,
  type SharedDesign,
} from "./model";

type ContactProfile = Pick<
  Profile,
  "id" | "display_name" | "username" | "location" | "avatar_url"
> & { account_type: string };
export type InboxConversation = Conversation & {
  other?: ContactProfile;
  unread: boolean;
  latestMessage?: Message;
};
export async function loadInbox(
  userId: string,
  limit: number,
  signal: AbortSignal,
): Promise<InboxConversation[]> {
  const hidden = await checked<{ conversation_id: string }[]>(
    supabase
      .from("hidden_conversations")
      .select("conversation_id")
      .eq("user_id", userId)
      .abortSignal(signal),
  );
  // Both embeds are bounded per conversation; a busy chat cannot crowd other chats out.
  let request = supabase
    .from("conversations")
    .select(
      "*,latest:messages(id,conversation_id,sender_id,content,created_at,is_read,design_id,image_path),unread:messages(id)",
    )
    .or(`client_id.eq.${userId},creator_id.eq.${userId}`)
    .order("last_message_at", { ascending: false })
    .order("id")
    .order("created_at", { referencedTable: "latest", ascending: false })
    .order("id", { referencedTable: "latest", ascending: false })
    .limit(1, { referencedTable: "latest" })
    .neq("unread.sender_id", userId)
    .eq("unread.is_read", false)
    .limit(1, { referencedTable: "unread" })
    .limit(limit)
    .abortSignal(signal);
  if (hidden.length)
    request = request.not(
      "id",
      "in",
      `(${hidden.map((h) => h.conversation_id).join(",")})`,
    );
  const conversations =
    await checked<
      (Conversation & { latest: Message[]; unread: { id: string }[] })[]
    >(request);
  const ids = [
    ...new Set(
      conversations.map((c) =>
        c.client_id === userId ? c.creator_id : c.client_id,
      ),
    ),
  ];
  const profiles = ids.length
    ? await checked<ContactProfile[]>(
        supabase
          .from("profiles")
          .select("id,display_name,username,location,account_type,avatar_url")
          .in("id", ids)
          .abortSignal(signal),
      )
    : [];
  return conversations.map((c) => ({
    ...c,
    other: profiles.find(
      (p) => p.id === (c.client_id === userId ? c.creator_id : c.client_id),
    ),
    unread: !!c.unread?.length,
    latestMessage: c.latest?.[0],
  }));
}
export function contactForProfile(p: ContactProfile): MessageContact {
  const role =
    p.account_type === "salon"
      ? "salon"
      : ["creator", "nail_artist"].includes(p.account_type)
        ? "creator"
        : "user";
  return {
    id: p.id,
    name: p.display_name || p.username || "LaQue member",
    username: p.username,
    avatar: p.avatar_url ? { uri: p.avatar_url } : null,
    role,
    location: role === "user" ? undefined : p.location,
  };
}
export function inboxContact(
  c: InboxConversation,
  userId: string,
): ShareRecipient {
  const otherId = c.client_id === userId ? c.creator_id : c.client_id;
  return {
    ...(c.other ? contactForProfile(c.other) : { name: "Unavailable member" }),
    id: c.id,
    userId: otherId,
    conversationId: c.id,
    available: !!c.other,
    unread: c.unread,
    lastMessage: messagePreview(c.latestMessage, userId),
    lastMessageAt: c.latestMessage?.created_at,
  };
}
export async function loadShareDesign(
  id: string,
  signal: AbortSignal,
): Promise<SharedDesign> {
  const ticket = accountScope.capture();
  const record = await checked<{
    id: string;
    title: string;
    image_url: string | null;
    shape: string | null;
    length: string | null;
    category: string | null;
  }>(
    supabase
      .from("designs")
      .select("id,title,image_url,shape,length,category")
      .eq("id", id)

      .abortSignal(signal)
      .single(),
  );
  if (!record) throw new Error("This design is no longer available to share.");
  const image = await resolvePrivateImage(record.image_url);
  accountScope.assert(ticket);
  return {
    id: record.id,
    title: record.title,
    image,
    metadata: [record.shape, record.length, record.category]
      .filter(Boolean)
      .join(" · "),
  };
}
export async function discoverRecipients(
  text: string,
  limit: number,
  userId: string,
  signal: AbortSignal,
): Promise<ShareRecipient[]> {
  let query = supabase
    .from("profiles")
    .select("id,display_name,username,location,account_type,avatar_url")
    .in("account_type", ["creator", "nail_artist", "salon"])
    .neq("id", userId);
  if (text.trim())
    query = query.ilike(
      "display_name",
      `%${text.trim().replace(/[\\%_]/g, "\\$&")}%`,
    );
  const records = await checked<ContactProfile[]>(
    query.order("display_name").order("id").limit(limit).abortSignal(signal),
  );
  return records.map((p) => ({
    ...contactForProfile(p),
    id: `profile:${p.id}`,
    userId: p.id,
    available: true,
  }));
}
