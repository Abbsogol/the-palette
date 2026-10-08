import { usePreviewMessages } from "./message-store";
import type { SharedDesign } from "../features/messages-ui/model";
import type { Booking } from "../lib/types";
import { useCurrentTime } from "../lib/clock";
import { upcomingAppointment } from "../features/chat/model";
import { useState } from "react";
import { BookingPreview, demoAppointment } from "./booking";
import ProfilePreview from "./profiles";
import { Text } from "react-native";
import { ChatView } from "../features/chat/chat-view";
import { chatAssets } from "../features/chat/assets";
import type {
  ChatAction,
  ChatContact,
  ChatMessage,
} from "../features/chat/model";
import { LabButton, LabSheet, s } from "../features/lab-ui/primitives";
function samples(): ChatMessage[] {
  const time = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return [
    { id: "1", own: false, text: "chon khatarie", createdAt: time(12, 30) },
    {
      id: "2",
      own: true,
      text: "Salam! Man khubam, merci 😊",
      createdAt: time(12, 32),
    },
    { id: "3", own: true, text: "Khodet chetori?", createdAt: time(12, 32) },
    {
      id: "4",
      own: false,
      text: "Mamnoon! Yek soal dashtam darbare nail design",
      createdAt: time(12, 35),
    },
    {
      id: "5",
      own: false,
      text: "Mituni ye design ba chrome finish va marble texture baram bezani?",
      createdAt: time(12, 35),
    },
    {
      id: "6",
      own: true,
      text: "Are hatman! Ye lahze check mikonam",
      createdAt: time(12, 36),
    },
    {
      id: "7",
      own: true,
      text: "",
      createdAt: time(12, 37),
      design: {
        id: "sample-chrome",
        title: "Chrome Marble Dream",
        metadata: "Coffin · Long · Chrome",
        image: chatAssets.design,
      },
    },
    {
      id: "8",
      own: false,
      text: "Vayyy khoshgele! 😍",
      createdAt: time(12, 38),
    },
    {
      id: "9",
      own: false,
      text: "In ro mikham, key mituni appointment bezari?",
      createdAt: time(12, 38),
    },
    {
      id: "10",
      own: true,
      text: "Farda ya pas farda khube!? Befrest tu calendar",
      createdAt: time(12, 39),
    },
    {
      id: "11",
      own: true,
      text: "",
      createdAt: time(12, 40),
      image: chatAssets.workspace,
    },
    {
      id: "12",
      own: true,
      text: "",
      createdAt: time(12, 41),
      location: {
        name: "Laque Nail Studio",
        address: "Kyiv, Ukraine",
        image: chatAssets.map,
      },
    },
  ].map((m) => ({ ...m, demo: true }));
}
export function ChatPreview({
  contact,
  width,
  onBack,
  initialDraft,
  initialSharedDesign,
  initialAppointment,
}: {
  contact: ChatContact;
  width: number;
  onBack: () => void;
  initialDraft?: string;
  initialSharedDesign?: SharedDesign;
  initialAppointment?: Booking;
}) {
  const shared = usePreviewMessages();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
      ...samples(),
      ...(shared?.deliveries
        .filter((d) => d.contact.id === contact.id)
        .map((d) => d.message) || []),
      ...(initialSharedDesign
        ? [
            {
              id: "demo-shared-design",
              own: true,
              text: "Shared a design",
              createdAt: new Date().toISOString(),
              demo: true,
              design: {
                ...initialSharedDesign,
                metadata: initialSharedDesign.metadata || "",
              },
            },
          ]
        : []),
    ]),
    [draft, setDraft] = useState(initialDraft || "");
  const [storedBooking, setStoredBooking] = useState(
    initialAppointment || demoAppointment(),
  );
  const [muted, setMuted] = useState(false),
    [favorite, setFavorite] = useState(false),
    [note, setNote] = useState("");
  const [photo, setPhoto] = useState(false);
  const [bookingOpen, setBookingOpen] = useState<"new" | "existing" | null>(
    null,
  );
  const [profileTab, setProfileTab] = useState<"Designs" | "Services" | null>(
    null,
  );
  const now = useCurrentTime();
  const appointment =
    contact.role !== "user"
      ? upcomingAppointment(
          [storedBooking],
          storedBooking.client_id,
          storedBooking.creator_id,
          now,
        )
      : undefined;
  const action = (kind: ChatAction) => {
    if (kind === "book" || kind === "appointment")
      return setBookingOpen(kind === "book" ? "new" : "existing");
    if (kind === "profile" || kind === "portfolio")
      setProfileTab(
        kind === "portfolio" && contact.role !== "user"
          ? "Services"
          : "Designs",
      );
    else if (kind === "mute") setMuted((v) => !v);
    else if (kind === "favorite") setFavorite((v) => !v);
    else if (kind === "photo") setPhoto(true);
    else if (kind === "share-design")
      setMessages((m) => [
        ...m,
        {
          id: `local-${Date.now()}`,
          own: true,
          text: "",
          createdAt: new Date().toISOString(),
          demo: true,
          design: {
            id: "sample-chrome",
            title: "Chrome Marble Dream",
            metadata: "Coffin · Long · Chrome",
            image: chatAssets.design,
          },
        },
      ]);
    else if (kind === "delete" || kind === "block") onBack();
    else
      setNote(
        kind === "design"
          ? "Chrome Marble Dream · Coffin · Long · Chrome. Shared designs open their full design page in the connected app."
          : kind.includes("report")
            ? "This is a sample conversation. Reporting in the connected app opens the safety form."
            : "This is a sample contact. Their profile and services open in the connected app.",
      );
  };
  if (profileTab)
    return (
      <ProfilePreview
        width={width}
        publicProfile
        initialTab={profileTab}
        publicIdentity={{
          ...contact,
          role: contact.role || "user",
          avatar: contact.avatar || null,
        }}
        onBookingChat={(draft, booking) => {
          if (draft) setDraft(draft);
          if (booking) setStoredBooking(booking);
          setProfileTab(null);
        }}
        onBack={() => setProfileTab(null)}
      />
    );
  return (
    <>
      {bookingOpen && (
        <BookingPreview
          width={width}
          artist={contact.name}
          initialAppointment={
            bookingOpen === "existing" ? storedBooking : undefined
          }
          onClose={() => setBookingOpen(null)}
          onChat={(draft, booking) => {
            if (draft) setDraft(draft);
            if (booking) setStoredBooking(booking);
          }}
        />
      )}
      <ChatView
        width={width}
        contact={contact}
        messages={messages}
        appointment={appointment}
        connection="Active now · sample"
        ready
        favorite={favorite}
        muted={muted}
        draft={draft}
        onDraft={setDraft}
        attachment={photo ? chatAssets.workspace : null}
        onRemoveAttachment={() => setPhoto(false)}
        onBack={onBack}
        onRefresh={() => undefined}
        onMore={() => undefined}
        onAction={action}
        preview
        onSend={() => {
          if (!draft.trim() && !photo) return;
          setMessages((m) => [
            ...m,
            {
              id: `local-${Date.now()}`,
              own: true,
              text: draft.trim(),
              createdAt: new Date().toISOString(),
              demo: true,
              image: photo ? chatAssets.workspace : undefined,
            },
          ]);
          setDraft("");
          setPhoto(false);
        }}
      />
      <LabSheet
        visible={!!note}
        title="Design preview"
        onClose={() => setNote("")}
      >
        <Text style={s.text}>{note}</Text>
        <LabButton title="Got it" onPress={() => setNote("")} />
      </LabSheet>
    </>
  );
}
