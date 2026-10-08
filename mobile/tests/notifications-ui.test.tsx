import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  NotificationsView,
  type NotificationViewProps,
} from "../src/features/notifications/notifications-view";
import { NotificationsPreview } from "../src/preview/notifications";
import {
  activityDetails,
  activityDay,
  activityTime,
  type Activity,
} from "../src/features/notifications/model";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const owner = "00000000-0000-4000-8000-000000000001",
  actor = "00000000-0000-4000-8000-000000000002",
  now = new Date(2026, 9, 7, 12).getTime();
const item = (type = "new_message", read = false): Activity => ({
  id: "00000000-0000-4000-8000-000000000003",
  user_id: owner,
  actor_id: actor,
  type,
  read,
  design_id: "00000000-0000-4000-8000-000000000004",
  created_at: new Date(now - 120000).toISOString(),
  comment_preview: null,
  actor: { id: actor, display_name: "Sarah", avatar_url: null },
});
const props = (): NotificationViewProps => ({
  items: [item()],
  device: { state: "off", registered: false },
  now,
  onBack: jest.fn(),
  onRefresh: jest.fn(),
  onOlder: jest.fn(),
  onOpen: jest.fn(),
  onRead: jest.fn(),
  onEnable: jest.fn(),
  onDisable: jest.fn(),
  onCheck: jest.fn(),
  onSettings: jest.fn(),
});
test.each([
  ["new_message", "New message", "Open inbox"],
  ["booking_request", "Booking request", "View bookings"],
  ["booking_confirmed", "Appointment confirmed", "View bookings"],
  ["like", "Design liked", "View design"],
  ["comment", "New comment", "View design"],
  ["follow", "New follower", "View profile"],
])(
  "%s has a recognizable label and accessible destination",
  async (type, title, label) => {
    const p = props();
    p.items = [item(type)];
    await render(<NotificationsView {...p} />);
    expect(screen.getByText(title)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(`Unread: ${title}.*${label}`),
      }),
    );
    expect(p.onOpen).toHaveBeenCalledWith(p.items[0]);
  },
);
test("read/unread filters, explicit marking and loaded-page marking are separate", async () => {
  const p = props();
  p.items.push({ ...item("like", true), id: "read-row" });
  await render(<NotificationsView {...p} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Unread activity" }),
  );
  expect(screen.queryByText("Design liked")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Mark shown as read" }),
  );
  expect(p.onRead).toHaveBeenCalledWith([p.items[0].id], true);
  await fireEvent.press(screen.getByRole("button", { name: "All activity" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Mark Design liked unread" }),
  );
  expect(p.onRead).toHaveBeenCalledWith(["read-row"], false);
});
test.each([
  "enabled",
  "quiet",
  "off",
  "denied",
  "unavailable",
  "unknown",
  "checking",
] as const)(
  "%s preference states show the right action without changing activity",
  async (state) => {
    const p = props();
    p.device = { state, registered: state === "enabled" || state === "quiet" };
    await render(<NotificationsView {...p} />);
    expect(screen.queryByText("Alerts on this device")).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Preferences" }));
    expect(screen.getByText("Your activity stays here")).toBeTruthy();
    if (state === "off")
      expect(
        screen.getByRole("button", { name: "Enable notifications" }),
      ).toBeTruthy();
    if (state === "denied")
      expect(
        screen.getByRole("button", { name: "Open device settings" }),
      ).toBeTruthy();
    if (state === "unknown")
      expect(screen.getByText("Status unavailable")).toBeTruthy();
    if (state === "enabled" || state === "quiet")
      expect(
        screen.getByRole("button", { name: "Disable on this device" }),
      ).toBeTruthy();
    if (state === "checking" || state === "unavailable")
      expect(
        screen.queryByRole("button", { name: "Enable notifications" }),
      ).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  },
);
test("loading/error/empty/unread-empty states never claim all historic activity was read", async () => {
  const p = props();
  const view = await render(<NotificationsView {...p} items={[]} loading />);
  expect(screen.getByText("Loading activity…")).toBeTruthy();
  await view.rerender(<NotificationsView {...p} items={[]} error />);
  expect(screen.getByRole("button", { name: "Retry activity" })).toBeTruthy();
  expect(screen.queryByText("No activity yet")).toBeNull();
  await view.rerender(<NotificationsView {...p} items={[]} />);
  expect(screen.getByText("No activity yet")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Unread activity" }),
  );
  expect(screen.getByText("No unread activity here")).toBeTruthy();
});
test("busy operations block row actions, bulk marking and preference writes", async () => {
  const p = props();
  await render(<NotificationsView {...p} busy />);
  await fireEvent.press(
    screen.getByRole("button", { name: /Unread: New message/ }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Mark New message read" }),
  );
  expect(p.onOpen).not.toHaveBeenCalled();
  expect(p.onRead).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("tab", { name: "Preferences" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Enable notifications" }),
  );
  expect(p.onEnable).not.toHaveBeenCalled();
});
test("preview has sample activity, lets you change read status and demonstrates device states", async () => {
  await render(<NotificationsPreview onBack={jest.fn()} />);
  expect(screen.getByText(/No notifications are sent/)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Mark New message read" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Unread activity" }),
  );
  expect(screen.queryByText("New message")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Preferences" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Enable notifications" }),
  );
  expect(screen.getByText("Device alerts are on")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Open device settings" }),
  );
  expect(screen.getByText("Blocked in device settings")).toBeTruthy();
});
test("missing/revoked identities and unknown types remain safe without inventing targets or appointment times", () => {
  expect(
    activityDetails({ ...item("like"), design_id: "https://evil.test" }).path,
  ).toBeNull();
  expect(activityDetails({ ...item("unknown") }).path).toBeNull();
  expect(activityDetails({ ...item("follow"), actor: null }).body).toBe(
    "Someone followed you.",
  );
  expect(activityDetails(item("appointment_reminder")).body).not.toMatch(
    /tomorrow|\d/,
  );
  expect(activityTime("invalid", now)).toBe("Time unavailable");
  expect(activityDay(new Date(now - 86400000).toISOString(), now)).toBe(
    "Yesterday",
  );
});
