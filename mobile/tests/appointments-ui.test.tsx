import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  AppointmentList,
  HistoryCards,
} from "../src/features/secondary/history-view";
import { AppointmentPreviewList } from "../src/preview/appointments";
import type { AppointmentItem } from "../src/features/appointments/model";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const now = Date.parse("2026-10-09T12:00:00Z");
const item: AppointmentItem = {
  id: "one",
  client_id: "client",
  creator_id: "artist",
  service_id: "service",
  booking_date: "2026-10-10",
  start_time: "10:00:00",
  end_time: "11:00:00",
  starts_at: "2026-10-10T06:00:00Z",
  ends_at: "2026-10-10T07:00:00Z",
  time_zone: "Asia/Dubai",
  status: "pending",
  deposit_paid: true,
  reference_design_id: null,
  notes: null,
  deposit_snapshot: 25,
  price_snapshot: 125,
  person: { id: "artist", name: "Anelia", username: "anelia", avatar: "photo" },
};
const props = () => ({
  items: [item],
  role: "creator" as const,
  canCreate: true,
  onRole: jest.fn(),
  filter: "Requests" as const,
  onFilter: jest.fn(),
  onOpen: jest.fn(),
  now,
  onRetry: jest.fn(),
  onMore: jest.fn(),
  onRetryPayments: jest.fn(),
  payments: { one: { status: "refund_pending" } },
});
test("request card shows participant, date, snapshot zone and actual refund state; opens only existing detail", async () => {
  const p = props();
  await render(<AppointmentList {...p} />);
  expect(screen.getByText("REQUEST TO REVIEW")).toBeTruthy();
  expect(screen.getByText("Your client · @anelia")).toBeTruthy();
  expect(screen.getByText("Asia/Dubai · creator’s time zone")).toBeTruthy();
  expect(screen.getByText("Full deposit refund pending")).toBeTruthy();
  expect(screen.getByLabelText("Anelia profile photo")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Review request" }));
  expect(p.onOpen).toHaveBeenCalledWith("one");
  expect(screen.queryByRole("button", { name: "Accept request" })).toBeNull();
});
test("role/filter controls and sentinel load-more dispatch independently", async () => {
  const p = props();
  await render(<AppointmentList {...p} hasMore />);
  await fireEvent.press(screen.getByRole("button", { name: "My bookings" }));
  expect(p.onRole).toHaveBeenCalledWith("customer");
  await fireEvent.press(screen.getByRole("button", { name: "Past" }));
  expect(p.onFilter).toHaveBeenCalledWith("Past");
  await fireEvent.press(
    screen.getByRole("button", { name: "Load more appointments" }),
  );
  expect(p.onMore).toHaveBeenCalled();
});
test("failed list access hides cached identities while refresh remains usable", async () => {
  const p = props();
  await render(<AppointmentList {...p} error={new Error("Revoked")} />);
  expect(screen.queryByText("Anelia")).toBeNull();
  expect(screen.queryByRole("button", { name: "Review request" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Refresh appointments" }),
  );
  expect(p.onRetry).toHaveBeenCalled();
});
test("partial payment failure permits retry without suggesting a successful refund", async () => {
  const p = props();
  await render(
    <AppointmentList {...p} payments={{ one: { unavailable: true } }} />,
  );
  expect(
    screen.getByText("Payment status unavailable · open details"),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry payment statuses" }),
  );
  expect(p.onRetryPayments).toHaveBeenCalled();
  expect(screen.queryByText("Deposit received")).toBeNull();
});
test("legacy unknown times and unavailable profile remain accessible with explicit review notice", async () => {
  await render(
    <HistoryCards
      bookings={[
        {
          ...item,
          status: "confirmed",
          starts_at: null,
          ends_at: null,
          person: undefined,
          identityUnavailable: true,
        },
      ]}
      now={now}
      onOpen={jest.fn()}
    />,
  );
  expect(screen.getByText("Account name unavailable")).toBeTruthy();
  expect(screen.getByText(/Recorded time needs review/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "View appointment" })).toBeTruthy();
});
test("avatar load failure falls back to initials, retaining participant identity", async () => {
  await render(<HistoryCards bookings={[item]} now={now} onOpen={jest.fn()} />);
  await fireEvent(screen.getByLabelText("Anelia profile photo"), "error", {
    nativeEvent: { error: "Image unavailable" },
  });
  expect(screen.queryByLabelText("Anelia profile photo")).toBeNull();
  expect(screen.getByText("A")).toBeTruthy();
  expect(screen.getByText("Anelia")).toBeTruthy();
});
test("expired pending history is not labelled completed; customer empty requests differ from creator", async () => {
  await render(
    <HistoryCards
      bookings={[item]}
      filter="Past"
      now={Date.parse(item.ends_at!) + 1}
      onOpen={jest.fn()}
    />,
  );
  expect(screen.getByText("UNCONFIRMED · TIME PASSED")).toBeTruthy();
  expect(screen.queryByText("PAST APPOINTMENT")).toBeNull();
});
test("preview uses all categories and selects the exact existing detail data and role", async () => {
  const open = jest.fn();
  await render(<AppointmentPreviewList onOpen={open} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Client bookings" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Review request" }));
  expect(open).toHaveBeenLastCalledWith(
    expect.objectContaining({
      role: "creator",
      client: "Keyvan",
      booking: expect.objectContaining({
        id: "sample-request",
        status: "pending",
      }),
      paymentStatus: "pending",
    }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Cancelled" }));
  expect(screen.getByText("Full deposit refund pending")).toBeTruthy();
  expect(screen.getByText("Full deposit refund completed")).toBeTruthy();
  await fireEvent.press(
    screen.getAllByRole("button", { name: "View appointment" })[0],
  );
  expect(open).toHaveBeenLastCalledWith(
    expect.objectContaining({
      booking: expect.objectContaining({
        id: "sample-cancelled",
        status: "cancelled",
      }),
      paymentStatus: "refund_pending",
    }),
  );
});
test("legacy cards do not display current service prices as recorded booking terms", async () => {
  await render(
    <HistoryCards
      bookings={[
        {
          ...item,
          price_snapshot: undefined,
          deposit_snapshot: undefined,
          services: {
            id: "service",
            creator_id: "artist",
            name: "Changed",
            price: 999,
            deposit_amount: 0,
            duration_minutes: 60,
            is_active: true,
            description: null,
          },
        },
      ]}
      now={now}
      payments={{ one: { status: "pending" } }}
      onOpen={jest.fn()}
    />,
  );
  expect(
    screen.getByText("Recorded price/deposit terms need review · open details"),
  ).toBeTruthy();
  expect(screen.queryByText(/999/)).toBeNull();
  expect(screen.queryByText("No deposit required")).toBeNull();
});
