import { render, screen, fireEvent } from "@testing-library/react-native";
import { CalendarView } from "../src/features/calendar/calendar-view";
import type { CalendarStatus } from "../src/features/calendar/model";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const state: CalendarStatus = {
  configured: true,
  status: "connected",
  accountLabel: "client@example.invalid",
  sources: [{ id: "personal", name: "Personal" }],
  calendars: [
    { id: "personal", name: "Personal" },
    { id: "work", name: "Work" },
  ],
  pending: 0,
};
const props = () => ({
  onBack: jest.fn(),
  onConnect: jest.fn(),
  onDisconnect: jest.fn(),
  onSave: jest.fn(),
  onSync: jest.fn(),
  onRetry: jest.fn(),
});
test("connection is optional and explains overlap checks and private event protection", async () => {
  const p = props();
  await render(
    <CalendarView {...p} state={{ ...state, status: "disconnected" }} />,
  );
  expect(screen.getByText(/help avoid overlapping schedules/)).toBeTruthy();
  expect(screen.getByText(/not personal event names/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Maybe later" }));
  expect(p.onBack).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole("button", { name: "Connect Google Calendar" }),
  );
  expect(p.onConnect).toHaveBeenCalledTimes(1);
});
test("unconfigured service does not promise a live connection", async () => {
  await render(
    <CalendarView
      {...props()}
      state={{ ...state, status: "disconnected", configured: false }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Connect Google Calendar" }),
  ).toBeDisabled();
  expect(screen.getByText(/setup is still being completed/)).toBeTruthy();
});
test("selected calendars can be changed, but at least one is required", async () => {
  const p = props();
  await render(<CalendarView {...p} state={state} />);
  expect(screen.getByRole("button", { name: "Save calendars" })).toBeDisabled();
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Check Personal" }),
  );
  expect(screen.getByRole("button", { name: "Save calendars" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("checkbox", { name: "Check Work" }));
  await fireEvent.press(screen.getByRole("button", { name: "Save calendars" }));
  expect(p.onSave).toHaveBeenCalledWith(["work"]);
});
test("failed sync keeps the booking and exposes safe retry and reconnection", async () => {
  const p = props();
  await render(
    <CalendarView
      {...p}
      state={{
        ...state,
        pending: 2,
        syncFailed: true,
        calendarError: "Calendar list unavailable",
      }}
    />,
  );
  expect(
    screen.getByText(/2 appointment updates waiting to sync/),
  ).toBeTruthy();
  expect(screen.getByText("Calendar list unavailable")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Sync now" }));
  expect(p.onSync).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole("button", { name: "Reconnect Google Calendar" }),
  );
  expect(p.onConnect).toHaveBeenCalledTimes(1);
});
test("disconnect needs explicit confirmation that existing calendar copies stop updating", async () => {
  const p = props();
  await render(<CalendarView {...p} state={state} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Disconnect Google Calendar" }),
  );
  expect(p.onDisconnect).not.toHaveBeenCalled();
  expect(screen.getByText(/Google Calendar entries stay there/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Disconnect" }));
  expect(p.onDisconnect).toHaveBeenCalledTimes(1);
});
