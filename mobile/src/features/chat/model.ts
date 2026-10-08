import type { ImageSource } from "expo-image";
import type { Booking } from "../../lib/types";

export type ChatContact = {
  id: string;
  name: string;
  role?: "creator" | "salon" | "user";
  avatar?: ImageSource | number | null;
};
export type ChatMessage = {
  id: string;
  own: boolean;
  text: string;
  createdAt: string;
  read?: boolean;
  demo?: boolean;
  image?: ImageSource | null;
  mediaError?: string;
  design?: {
    id: string;
    title: string;
    metadata: string;
    image?: ImageSource | string | number | null;
  };
  location?: { name: string; address: string; image: ImageSource };
};
export type ChatAppointment = {
  id: string;
  title: string;
  status: "pending" | "confirmed";
  when: string;
  location: string;
  relative: string;
};
export type ChatAction =
  | "profile"
  | "portfolio"
  | "favorite"
  | "mute"
  | "report"
  | "report-message"
  | "block"
  | "delete"
  | "book"
  | "appointment"
  | "design"
  | "photo"
  | "share-design"
  | "discard";

export function otherParticipant(
  conversation: { client_id: string; creator_id: string },
  userId: string,
) {
  if (![conversation.client_id, conversation.creator_id].includes(userId))
    throw new Error("You cannot access this conversation.");
  return conversation.client_id === userId
    ? conversation.creator_id
    : conversation.client_id;
}
export function upcomingAppointment(
  bookings: Booking[],
  userId: string,
  otherId: string,
  now: number,
): ChatAppointment | undefined {
  const booking = bookings
    .filter(
      (b) =>
        ((b.client_id === userId && b.creator_id === otherId) ||
          (b.creator_id === userId && b.client_id === otherId)) &&
        ["pending", "confirmed"].includes(b.status) &&
        b.starts_at &&
        new Date(b.starts_at).getTime() > now &&
        b.time_zone,
    )
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!))[0];
  if (!booking) return;
  try {
    const start = new Date(booking.starts_at!);
    const days = Math.ceil((start.getTime() - now) / 86400000);
    return {
      id: booking.id,
      title: booking.services?.name || "Appointment",
      status: booking.status as "pending" | "confirmed",
      when: `${start.toLocaleDateString("en-US", { timeZone: booking.time_zone!, month: "short", day: "numeric", year: "numeric" })} · ${start.toLocaleTimeString("en-US", { timeZone: booking.time_zone!, hour: "numeric", minute: "2-digit" })} · ${booking.time_zone}`,
      location: booking.location_snapshot || "See appointment for location",
      relative: days === 1 ? "Within 24 hours" : `In ${days} days`,
    };
  } catch {
    return;
  }
}
export function messageDay(date: string, now = new Date()) {
  const d = new Date(date);
  return d.toDateString() === now.toDateString()
    ? "Today"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
export function joinedMessages(a: ChatMessage, b?: ChatMessage) {
  return (
    !!b &&
    !a.design &&
    !a.image &&
    !a.location &&
    !b.design &&
    !b.image &&
    !b.location &&
    a.own === b.own &&
    new Date(a.createdAt).toDateString() ===
      new Date(b.createdAt).toDateString() &&
    Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < 120000
  );
}
