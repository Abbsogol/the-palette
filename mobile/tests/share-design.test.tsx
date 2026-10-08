import HomeDesignPreview from "../src/preview/home-main";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  ShareDesignView,
  type ShareViewProps,
} from "../src/features/messages-ui/share-view";
import { ShareDesignPreview } from "../src/preview/share-design";
import { messagePreview, inboxTime } from "../src/features/messages-ui/model";
import { MessagesView } from "../src/features/messages-ui/messages-view";
import type { Message } from "../src/lib/types";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const kim = {
  id: "chat1",
  userId: "kim",
  name: "Kim",
  role: "creator" as const,
  location: "Dubai",
  conversationId: "chat1",
};
const client = {
  id: "chat2",
  userId: "client",
  name: "keyvan",
  role: "user" as const,
  conversationId: "chat2",
};
const props = (): ShareViewProps => ({
  design: { id: "design", title: "Rose Chrome", metadata: "Almond · Chrome" },
  recipients: [kim, client],
  source: "recent",
  search: "",
  onSelect: jest.fn(),
  onSend: jest.fn(),
  onSearch: jest.fn(),
  onSource: jest.fn(),
  onBack: jest.fn(),
  onRetry: jest.fn(),
  onMore: jest.fn(),
  onOpenChat: jest.fn(),
});
test("choosing a recipient does not send until the explicit named send action", async () => {
  const p = props();
  const view = await render(<ShareDesignView {...p} />);
  expect(
    screen.getByRole("button", { name: "Choose a recipient" }),
  ).toBeDisabled();
  await fireEvent.press(screen.getByRole("radio", { name: "Select Kim" }));
  expect(p.onSelect).toHaveBeenCalledWith(kim);
  expect(p.onSend).not.toHaveBeenCalled();
  await view.rerender(<ShareDesignView {...p} selected={kim} />);
  expect(screen.getByRole("radio", { name: "Select Kim" })).toBeChecked();
  await fireEvent.press(screen.getByRole("button", { name: "Send to Kim" }));
  expect(p.onSend).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole("button", { name: "Clear recipient" }),
  );
  expect(p.onSelect).toHaveBeenLastCalledWith(undefined);
});
test("recipient filters compose with search, new discovery is explicit and unavailable recipients are disabled", async () => {
  const p = props();
  const view = await render(<ShareDesignView {...p} />);
  await fireEvent.press(
    screen.getByRole("radio", { name: "Recipients: Clients" }),
  );
  expect(screen.queryByRole("radio", { name: "Select Kim" })).toBeNull();
  await view.rerender(<ShareDesignView {...p} search="not here" />);
  expect(screen.getByText(/No chats match/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("tab", { name: "Artists & salons" }));
  expect(p.onSource).toHaveBeenCalledWith("discover");
  await view.rerender(
    <ShareDesignView
      {...p}
      source="discover"
      recipients={[{ ...kim, available: false }]}
    />,
  );
  expect(screen.getByRole("radio", { name: "Select Kim" })).toBeDisabled();
  expect(
    screen.queryByRole("radio", { name: "Recipients: Clients" }),
  ).toBeNull();
});
test.each([
  { busy: true },
  { loading: true },
  { designLoading: true },
  { designError: "Unavailable" },
  { error: "Offline" },
])("loading/errors prevent stale sends: %o", async (state) => {
  const p = props();
  await render(<ShareDesignView {...p} selected={kim} {...state} />);
  expect(screen.getByRole("button", { name: "Send to Kim" })).toBeDisabled();
});
test("retry keeps the recipient and success links to the delivered chat without a second send", async () => {
  const p = props();
  const view = await render(
    <ShareDesignView {...p} selected={kim} sendError="Offline" />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Retry sharing" }));
  expect(p.onSend).toHaveBeenCalledTimes(1);
  await view.rerender(<ShareDesignView {...p} selected={kim} sent />);
  expect(screen.queryByRole("radio", { name: "Select Kim" })).toBeNull();
  expect(screen.getByRole("header", { name: "Shared with Kim" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Open chat" }));
  expect(p.onOpenChat).toHaveBeenCalledTimes(1);
  expect(p.onSend).toHaveBeenCalledTimes(1);
});
test("demo sharing carries the actual selected design into the local conversation", async () => {
  await render(
    <ShareDesignPreview
      width={393}
      design={{ id: "rose", title: "Rose Chrome", metadata: "Almond" }}
      onBack={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole("radio", { name: "Select Kim" }));
  await fireEvent.press(screen.getByRole("button", { name: "Send to Kim" }));
  expect(
    screen.getByText(/No message was sent to a real account/),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Open chat" }));
  expect(screen.getByText("Rose Chrome")).toBeTruthy();
});
test("inbox shows last-message/time rows while New message retains contact browsing", async () => {
  const p = {
    contacts: [
      {
        ...kim,
        lastMessage: "You: Shared a design",
        lastMessageAt: new Date().toISOString(),
        unread: true,
      },
    ],
    onOpen: jest.fn(),
    onRefresh: jest.fn(),
    onMore: jest.fn(),
    onFind: jest.fn(),
  };
  await render(<MessagesView {...p} />);
  expect(screen.getByText("You: Shared a design")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Messages" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "New message" }));
  expect(screen.getByRole("header", { name: "New message" })).toBeTruthy();
  expect(screen.queryByText("You: Shared a design")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back to inbox" }));
  expect(screen.getByText("You: Shared a design")).toBeTruthy();
});
test("message summaries and timestamps describe actual data, including empty chats and attachment-only messages", () => {
  const message = {
    sender_id: "me",
    content: " Hello\nthere ",
    created_at: "2026-09-29T12:00:00Z",
  } as Message;
  expect(messagePreview(message, "me")).toBe("You: Hello there");
  expect(messagePreview({ ...message, design_id: "design" }, "other")).toBe(
    "Shared a design",
  );
  expect(
    messagePreview({ ...message, image_path: "private/image.webp" }, "me"),
  ).toBe("You: Sent a photo");
  expect(messagePreview(undefined, "me")).toBe("Start a conversation");
  const now = new Date(2026, 8, 29, 14, 0);
  expect(inboxTime(new Date(2026, 8, 28, 14, 0).toISOString(), now)).toBe(
    "Yesterday",
  );
  expect(inboxTime(undefined, now)).toBe("");
  expect(inboxTime("bad", now)).toBe("");
  expect(inboxTime(new Date(2025, 8, 28).toISOString(), now)).toContain("2025");
});

test("a demo share survives leaving design details and reopening its conversation from the inbox", async () => {
  await render(<HomeDesignPreview />);
  await fireEvent.press(
    screen.getAllByRole("button", { name: "View Cathedral" })[0],
  );
  await fireEvent.press(screen.getByRole("button", { name: "Share design" }));
  await fireEvent.press(screen.getByRole("button", { name: "Share to Chat" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Select Kim" }));
  await fireEvent.press(screen.getByRole("button", { name: "Send to Kim" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Back from sharing" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Messages" }));
  expect(screen.getByRole("button", { name: "Message Kim" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Message Kim" }));
  expect(screen.getByText("Cathedral")).toBeTruthy();
});
