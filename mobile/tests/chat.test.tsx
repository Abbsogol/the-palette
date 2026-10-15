import { ChatPreview } from "../src/preview/chat";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ChatView, type ChatViewProps } from "../src/features/chat/chat-view";
import {
  otherParticipant,
  upcomingAppointment,
} from "../src/features/chat/model";
import type { Booking } from "../src/lib/types";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const base = (): ChatViewProps => ({
  contact: { id: "artist", name: "Kim", role: "creator" },
  messages: [
    {
      id: "m1",
      own: false,
      text: "Chrome nails?",
      createdAt: "2026-09-29T12:00:00Z",
    },
    {
      id: "m2",
      own: true,
      text: "Yes",
      createdAt: "2026-09-29T12:01:00Z",
      design: { id: "design", title: "Chrome Marble", metadata: "Long" },
    },
  ],
  draft: "",
  ready: true,
  onDraft: jest.fn(),
  onRemoveAttachment: jest.fn(),
  onBack: jest.fn(),
  onRefresh: jest.fn(),
  onMore: jest.fn(),
  onSend: jest.fn(),
  onAction: jest.fn(),
});
test("search filters loaded messages, shared media links the original design, and the normal chat can be restored", async () => {
  const p = base();
  await render(<ChatView {...p} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Chat more options" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Search in conversation" }),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Search in conversation"),
    "unmatched",
  );
  expect(screen.getByText("No matching messages.")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Show all messages" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Chat more options" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Shared designs, photos & locations" }),
  );
  expect(screen.queryByText("Chrome nails?")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "View shared design Chrome Marble" }),
  );
  expect(p.onAction).toHaveBeenLastCalledWith("design", "design");
});
test("delete and block require their own clear confirmation, and menu exposes booking, favorites and mute", async () => {
  const p = base();
  await render(<ChatView {...p} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Chat more options" }),
  );
  expect(screen.getByRole("button", { name: "Book appointment" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add to favorites" })).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Mute notifications" }),
  );
  expect(p.onAction).toHaveBeenLastCalledWith("mute", undefined);
  await fireEvent.press(
    screen.getByRole("button", { name: "Chat more options" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Delete conversation" }),
  );
  expect(screen.getByText(/from your inbox only/)).toBeTruthy();
  expect(p.onAction).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole("button", { name: "Delete from my inbox" }),
  );
  expect(p.onAction).toHaveBeenLastCalledWith("delete", undefined);
  await fireEvent.press(
    screen.getByRole("button", { name: "Chat more options" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Block" }));
  expect(
    screen.getByText(/Existing appointments are not cancelled/),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Keep conversation" }),
  );
  expect(p.onAction).toHaveBeenCalledTimes(2);
});
test("client options do not offer creator booking, and the pinned appointment routes its actual ID", async () => {
  const p = base();
  p.contact!.role = "user";
  await render(
    <ChatView
      {...p}
      appointment={{
        id: "booking-42",
        status: "pending",
        title: "Gel",
        when: "2 PM · Asia/Dubai",
        location: "Dubai",
        relative: "Within 24 hours",
      }}
    />,
  );
  expect(screen.getByText("Awaiting confirmation")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "View appointment" }),
  );
  expect(p.onAction).toHaveBeenLastCalledWith("appointment", "booking-42");
  await fireEvent.press(
    screen.getByRole("button", { name: "Chat more options" }),
  );
  expect(screen.queryByRole("button", { name: "Book appointment" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Manage appointment" }),
  );
  expect(p.onAction).toHaveBeenLastCalledWith("appointment", "booking-42");
  expect(screen.queryByRole("button", { name: "Add to favorites" })).toBeNull();
});
test("composer disables empty sends and recovery editing, and error state does not reveal stale messages", async () => {
  const p = base();
  const view = await render(<ChatView {...p} />);
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  await view.rerender(<ChatView {...p} pending draft="Pending" />);
  expect(screen.getByLabelText("Write a message")).toHaveProp(
    "editable",
    false,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Retry sending" }));
  expect(p.onSend).toHaveBeenCalledTimes(1);
  await view.rerender(<ChatView {...p} error="Access changed" ready={false} />);
  expect(screen.queryByText("Chrome nails?")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(p.onRefresh).toHaveBeenCalledTimes(1);
});
test("appointment selection excludes other participants, cancelled, past and invalid times, and uses creator time zone", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  const b = {
    id: "valid",
    client_id: "me",
    creator_id: "artist",
    status: "confirmed",
    starts_at: "2026-09-30T10:00:00Z",
    time_zone: "Asia/Dubai",
    services: { name: "Gel Manicure" },
    location_snapshot: "Studio",
  } as Booking;
  const list: Booking[] = [
    { ...b, id: "other", client_id: "stranger" },
    { ...b, id: "cancelled", status: "cancelled" },
    { ...b, id: "past", starts_at: "2026-09-28T12:00:00Z" },
    { ...b, id: "invalid", starts_at: null },
    b,
  ];
  expect(upcomingAppointment(list, "me", "artist", now)).toMatchObject({
    id: "valid",
    when: "Sep 30, 2026 · 2:00 PM · Asia/Dubai",
    status: "confirmed",
  });
  expect(upcomingAppointment(list, "artist", "me", now)?.id).toBe("valid");
  expect(
    upcomingAppointment(list, "stranger-2", "artist", now),
  ).toBeUndefined();
  expect(
    upcomingAppointment(
      [{ ...b, time_zone: "Invalid/Time" }],
      "me",
      "artist",
      now,
    ),
  ).toBeUndefined();
  expect(() =>
    otherParticipant({ client_id: "me", creator_id: "artist" }, "stranger"),
  ).toThrow("cannot access");
});

// Both profile entry points use the actual public-profile component in the demo.
test("chat header and options identity open a client profile and preserve the chat draft on return", async () => {
  await render(
    <ChatPreview
      width={393}
      contact={{ id: "sample-keyvan", name: "keyvan", role: "user" }}
      onBack={jest.fn()}
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Write a message"),
    "Keep my draft",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "View keyvan profile" }),
  );
  expect(screen.getByTestId("public-profile")).toBeTruthy();
  expect(screen.getByRole("header", { name: "keyvan" })).toBeTruthy();
  expect(screen.getByText("NAIL LOVER")).toBeTruthy();
  expect(screen.queryByText("My Account")).toBeNull();
  expect(screen.queryByText("Private")).toBeNull();
  expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Book Appointment" })).toBeNull();
  expect(
    screen.getAllByRole("button", { name: "View Cathedral" }),
  ).toHaveLength(3);
  await fireEvent.press(screen.getByRole("button", { name: "Follow" }));
  expect(screen.getByRole("button", { name: "Following" })).toBeTruthy();
  expect(screen.getByText("848")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByLabelText("Write a message")).toHaveProp(
    "value",
    "Keep my draft",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Chat more options" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "View keyvan public profile" }),
  );
  expect(screen.getByRole("header", { name: "keyvan" })).toBeTruthy();
});
test("chat artist portfolio opens Services and retains the professional actions", async () => {
  await render(
    <ChatPreview
      width={393}
      contact={{ id: "sample-kim", name: "Kim", role: "creator" }}
      onBack={jest.fn()}
    />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Chat more options" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "View services & portfolio" }),
  );
  expect(screen.getByRole("header", { name: "Kim" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Services" })).toHaveProp(
    "accessibilityState",
    { selected: true },
  );
  expect(screen.getByRole("button", { name: "Book Appointment" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Message" })).toBeTruthy();
});
test("chat identity displays a changed profile photo and clears it when removed", async () => {
  const p = base();
  p.contact = {
    ...p.contact!,
    avatar: { uri: "https://images.test/first.webp" },
  };
  const view = await render(<ChatView {...p} />);
  expect(
    JSON.stringify(screen.getByLabelText("Kim profile photo").props.source),
  ).toContain("first.webp");
  await view.rerender(
    <ChatView
      {...p}
      contact={{
        ...p.contact!,
        avatar: { uri: "https://images.test/replacement.webp" },
      }}
    />,
  );
  expect(
    JSON.stringify(screen.getByLabelText("Kim profile photo").props.source),
  ).toContain("replacement.webp");
  await view.rerender(
    <ChatView {...p} contact={{ ...p.contact!, avatar: null }} />,
  );
  expect(screen.queryByLabelText("Kim profile photo")).toBeNull();
  expect(screen.getByText("K")).toBeTruthy();
});
