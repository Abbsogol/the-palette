export type ActivityKind =
  "message" | "booking" | "design" | "follow" | "collection" | "other";
export type Activity = {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  read: boolean;
  design_id: string | null;
  comment_preview: string | null;
  created_at: string;
  actor?: {
    id: string;
    display_name: string | null;
    username?: string | null;
    avatar_url: string | null;
  } | null;
};
export type PushState = {
  state:
    | "checking"
    | "enabled"
    | "quiet"
    | "off"
    | "denied"
    | "unavailable"
    | "unknown";
  registered?: boolean;
  reason?: string;
};
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function activityDetails(n: Activity) {
  const name = n.actor?.display_name?.trim() || n.actor?.username || "Someone";
  let kind: ActivityKind = "other",
    title = "Activity update",
    body = "An update to your LaQue activity.";
  if (n.type === "new_message") {
    kind = "message";
    title = "New message";
    body = `${name} sent you a message.`;
  } else if (n.type === "booking_request") {
    kind = "booking";
    title = "Booking request";
    body = `${name} requested an appointment.`;
  } else if (n.type === "booking_confirmed") {
    kind = "booking";
    title = "Appointment confirmed";
    body = `${name} confirmed your appointment.`;
  } else if (n.type === "booking_declined") {
    kind = "booking";
    title = "Booking declined";
    body = `${name} declined your booking request.`;
  } else if (n.type === "appointment_reminder") {
    kind = "booking";
    title = "Appointment reminder";
    body = `Check your upcoming appointment with ${name}.`;
  } else if (n.type === "like") {
    kind = "design";
    title = "Design liked";
    body = `${name} liked your design.`;
  } else if (n.type === "comment") {
    kind = "design";
    title = "New comment";
    body = n.comment_preview
      ? `${name}: ${n.comment_preview.slice(0, 160)}`
      : `${name} commented on your design.`;
  } else if (n.type === "follow") {
    kind = "follow";
    title = "New follower";
    body = `${name} followed you.`;
  } else if (n.type === "moodboard_invite") {
    kind = "collection";
    title = "Collection invitation";
    body = `${name} invited you to a collection.`;
  }
  const path =
    kind === "message"
      ? "/messages"
      : kind === "booking"
        ? "/appointments"
        : kind === "design" && uuid.test(n.design_id || "")
          ? `/design/${n.design_id}`
          : kind === "follow" && uuid.test(n.actor_id)
            ? `/creator/${n.actor_id}`
            : null;
  return {
    kind,
    title,
    body,
    path,
    label:
      kind === "message"
        ? "Open inbox"
        : kind === "booking"
          ? "View bookings"
          : kind === "design"
            ? "View design"
            : kind === "follow"
              ? "View profile"
              : "View collections",
  };
}
export function activityDay(iso: string, now = Date.now()) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Earlier";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getTime() >= today.getTime()
    ? "Today"
    : date.getTime() >= yesterday.getTime()
      ? "Yesterday"
      : "Earlier";
}
export function activityTime(iso: string, now = Date.now()) {
  const instant = Date.parse(iso);
  if (!Number.isFinite(instant)) return "Time unavailable";
  const mins = Math.max(0, Math.floor((now - instant) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    ...(new Date(iso).getFullYear() !== new Date(now).getFullYear()
      ? { year: "numeric" }
      : {}),
  });
}
