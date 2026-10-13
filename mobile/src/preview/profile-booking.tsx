// Keeps preview profile/chat navigation outside their shared view components.
import { useState, type ComponentProps } from "react";
import ProfilePreview from "./profiles";
import { ChatPreview } from "./chat";
import type { Booking } from "../lib/types";
export default function ProfileBookingPreview(
  p: ComponentProps<typeof ProfilePreview>,
) {
  const [chat, setChat] = useState<{
    draft?: string;
    booking?: Booking;
  } | null>(null);
  if (chat)
    return (
      <ChatPreview
        width={p.width}
        initialDraft={chat.draft}
        initialAppointment={chat.booking}
        contact={
          p.publicIdentity || {
            id: "sample-artist",
            name: "Kim",
            role: "creator",
          }
        }
        onBack={() => setChat(null)}
      />
    );
  return (
    <ProfilePreview
      {...p}
      onBookingChat={(draft, booking) => setChat({ draft, booking })}
    />
  );
}
