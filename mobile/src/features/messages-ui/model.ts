import type { ImageSource } from "expo-image";
import type { Message } from "../../lib/types";
export type MessageContact = {
  id: string;
  name: string;
  avatar?: ImageSource | number | null;
  username?: string | null;
  location?: string | null;
  role?: "user" | "creator" | "salon";
  unread?: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
};
export const contactFilters = [
  "All contacts",
  "Nail artists",
  "Salons",
  "Clients",
  "Unread",
] as const;
export type ContactFilter = (typeof contactFilters)[number];
export function filterContacts(
  contacts: MessageContact[],
  input: string,
  filter: ContactFilter,
) {
  const query = input.trim().toLocaleLowerCase();
  return contacts.filter((contact) => {
    const matchesRole =
      filter === "All contacts" ||
      (filter === "Nail artists" && contact.role === "creator") ||
      (filter === "Salons" && contact.role === "salon") ||
      (filter === "Clients" && contact.role === "user") ||
      (filter === "Unread" && contact.unread);
    const matchesSearch =
      !query ||
      (query.startsWith("@")
        ? !!contact.username?.toLocaleLowerCase().includes(query.slice(1))
        : [contact.name, contact.username, contact.location].some((value) =>
            value?.toLocaleLowerCase().includes(query),
          ));
    return matchesRole && matchesSearch;
  });
}

export function contactRoleLabel(role: MessageContact["role"]) {
  return role === "creator"
    ? "NAIL ARTIST"
    : role === "salon"
      ? "SALON"
      : role === "user"
        ? "CLIENT"
        : undefined;
}

export type ShareRecipient = MessageContact & {
  userId: string;
  conversationId?: string;
  available?: boolean;
};
export type SharedDesign = {
  id: string;
  title: string;
  metadata?: string;
  image?: ImageSource | string | number | null;
};
export function messagePreview(message: Message | undefined, userId: string) {
  if (!message) return "Start a conversation";
  const body = message.design_id
    ? "Shared a design"
    : message.image_path
      ? "Sent a photo"
      : message.content.trim().replace(/\s+/g, " ");
  return `${message.sender_id === userId ? "You: " : ""}${body || "Message"}`;
}
export function inboxTime(value?: string, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  });
}
