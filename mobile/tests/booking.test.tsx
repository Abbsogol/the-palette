import { BookingPreview, demoAppointment } from "../src/preview/booking";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  BookingFormView,
  type BookingFormProps,
} from "../src/features/booking/booking-form";
import { AppointmentView } from "../src/features/booking/appointment-view";
import { canManage, canPayDeposit } from "../src/features/booking/model";
import { appointmentICS } from "../src/features/booking/calendar-event";
import type { Booking, Service, Slot } from "../src/lib/types";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/clock", () => ({
  useCurrentTime: () => Date.parse("2026-09-29T06:00:00Z"),
}));
beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-29T06:00:00Z"));
});
afterEach(() => {
  jest.restoreAllMocks();
});
const service: Service = {
  id: "gel",
  creator_id: "artist",
  name: "Gel manicure",
  description: null,
  duration_minutes: 60,
  price: 125,
  deposit_amount: 25,
  is_active: true,
};
const slot: Slot = {
  start_time: "14:00:00",
  end_time: "15:00:00",
  starts_at: "2026-09-30T10:00:00Z",
  ends_at: "2026-09-30T11:00:00Z",
  available: true,
};
const booking: Booking = {
  id: "booking-42",
  client_id: "client",
  creator_id: "artist",
  service_id: "gel",
  services: service,
  booking_date: "2026-09-30",
  start_time: slot.start_time,
  end_time: slot.end_time,
  starts_at: slot.starts_at,
  ends_at: slot.ends_at,
  time_zone: "Asia/Dubai",
  status: "confirmed",
  deposit_paid: false,
  reference_design_id: null,
  notes: null,
  price_snapshot: 125,
  deposit_snapshot: 25,
  location_snapshot: "Dubai studio",
};
const props = (): BookingFormProps => ({
  context: {
    creator: { id: "artist", name: "Kim" },
    services: [service],
    timeZone: "Asia/Dubai",
    location: "Dubai studio",
  },
  loadSlots: jest.fn().mockResolvedValue([
    slot,
    {
      ...slot,
      starts_at: "2026-09-30T12:00:00Z",
      start_time: "16:00:00",
      available: false,
    },
  ]),
  loadMonth: jest.fn().mockResolvedValue({ "2026-09-30": true }),
  onBack: jest.fn(),
  onSubmit: jest.fn(),
});
async function chooseThroughTime(p: BookingFormProps) {
  await render(<BookingFormView {...p} />);
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("radio", { name: /Gel manicure/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "2026-09-30" })).toBeEnabled(),
  );
  expect(screen.getByRole("button", { name: "2026-09-29" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "2026-09-30" }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(screen.getByRole("radio", { name: "2:00 PM" })).toBeTruthy(),
  );
  expect(screen.queryByRole("radio", { name: "4:00 PM" })).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: "2:00 PM" }));
}
test("service → available date → available time → review submits exact selection and reference", async () => {
  const p = props();
  p.loadReferences = jest
    .fn()
    .mockResolvedValue([{ id: "design-7", title: "Chrome" }]);
  await chooseThroughTime(p);
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Send booking request ✦" }),
    ).toBeEnabled(),
  );
  expect(screen.getByText("Deposit after approval")).toBeTruthy();
  expect(screen.getByText("Dubai studio")).toBeTruthy();
  expect(
    screen.getByText(/All dates and times are in Asia\/Dubai/),
  ).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Note to artist"),
    "Please use chrome",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Attach a reference design" }),
  );
  await fireEvent.press(
    await screen.findByRole("button", { name: "Attach Chrome" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Send booking request ✦" }),
  );
  expect(p.onSubmit).toHaveBeenCalledWith({
    service,
    date: "2026-09-30",
    slot,
    notes: "Please use chrome",
    designId: "design-7",
  });
});
test("a slot taken between selection and review cannot be submitted", async () => {
  const p = props();
  jest
    .mocked(p.loadSlots)
    .mockResolvedValueOnce([slot])
    .mockResolvedValueOnce([{ ...slot, available: false }]);
  await chooseThroughTime(p);
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(screen.getByText("Time no longer available")).toBeTruthy(),
  );
  expect(
    screen.getByRole("button", { name: "Send booking request ✦" }),
  ).toBeDisabled();
  expect(p.onSubmit).not.toHaveBeenCalled();
});
test("offline dates retry and unfinished recovery block new booking submission", async () => {
  const p = props();
  jest.mocked(p.loadMonth).mockRejectedValueOnce(new Error("Offline"));
  const v = await render(<BookingFormView {...p} />);
  await fireEvent.press(screen.getByRole("radio", { name: /Gel manicure/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(
    await screen.findByRole("button", { name: "Retry dates" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "2026-09-30" })).toBeEnabled(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "2026-09-30" }));
  const recover = jest.fn();
  await v.rerender(<BookingFormView {...p} recovery onRecover={recover} />);
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Recover booking request" }),
  );
  expect(recover).toHaveBeenCalledTimes(1);
});
test("pending client cannot approve or pay; artist can approve", async () => {
  const action = jest.fn();
  const v = await render(
    <AppointmentView
      booking={{ ...booking, status: "pending" }}
      userId="client"
      artist="Kim"
      client="Sarah"
      paymentStatus="pending"
      onBack={jest.fn()}
      onAction={action}
    />,
  );
  expect(screen.getByRole("header", { name: "Request sent!" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Accept request" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Pay appointment deposit" }),
  ).toBeNull();
  await v.rerender(
    <AppointmentView
      booking={{ ...booking, status: "pending" }}
      userId="artist"
      artist="Kim"
      client="Sarah"
      paymentStatus="pending"
      onBack={jest.fn()}
      onAction={action}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Accept request" }));
  expect(action).toHaveBeenCalledWith("confirm");
});
test("payment appears only after approval and blocks another charge during refund/review", async () => {
  const action = jest.fn();
  const p = {
    booking,
    userId: "client",
    artist: "Kim",
    client: "Sarah",
    onBack: jest.fn(),
    onAction: action,
  };
  const v = await render(<AppointmentView {...p} paymentStatus="pending" />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Pay appointment deposit" }),
  );
  expect(screen.getByText("Pay at appointment")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: /^Pay AED/ }));
  expect(action).toHaveBeenCalledWith("pay");
  await v.rerender(<AppointmentView {...p} paymentStatus="refund_pending" />);
  expect(screen.getByText("Full deposit refund pending")).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Pay AED/ })).toBeDisabled();
  await v.rerender(
    <AppointmentView
      {...p}
      paymentStatus="pending"
      paymentError="Unable to verify"
    />,
  );
  expect(screen.getByRole("button", { name: /^Pay AED/ })).toBeDisabled();
});
test.each(["client", "artist"])(
  "%s can manage and cancellation requires confirmation",
  async (userId) => {
    const action = jest.fn();
    await render(
      <AppointmentView
        booking={booking}
        userId={userId}
        artist="Kim"
        client="Sarah"
        paymentStatus="pending"
        onBack={jest.fn()}
        onAction={action}
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Manage appointment" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    expect(action).not.toHaveBeenCalled();
    expect(
      screen.getByText(/paid deposit is queued for a full refund/),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm cancellation" }),
    );
    expect(action).toHaveBeenCalledWith("cancel");
  },
);
test.each(["client", "artist"])(
  "%s date changes preserve consent and cancel-rebook policy",
  async (userId) => {
    const action = jest.fn();
    await render(
      <AppointmentView
        booking={booking}
        userId={userId}
        artist="Kim"
        client="Sarah"
        paymentStatus="pending"
        onBack={jest.fn()}
        onAction={action}
        initialManage
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Change date or time" }),
    );
    if (userId === "artist") expect(action).toHaveBeenCalledWith("propose");
    else {
      expect(action).not.toHaveBeenCalled();
      await fireEvent.press(
        screen.getByRole("button", { name: "Cancel & choose new time" }),
      );
      expect(action).toHaveBeenCalledWith("reschedule");
    }
  },
);
test("past appointments, strangers, paid deposits, terminal states and unknown payment state disallow financial actions", () => {
  const now = Date.parse("2026-09-29");
  expect(canManage(booking, "stranger", now)).toBe(false);
  expect(canManage(booking, "client", Date.parse("2026-10-01"))).toBe(false);
  for (const status of [
    "refunded",
    "refund_failed",
    "refund_pending",
    "payment_review",
    "partial_refund",
    undefined,
  ])
    expect(canPayDeposit(booking, "client", status, now)).toBe(false);
  expect(
    canPayDeposit(
      { ...booking, status: "cancelled" },
      "client",
      "pending",
      now,
    ),
  ).toBe(false);
  expect(
    canPayDeposit({ ...booking, deposit_paid: true }, "client", "pending", now),
  ).toBe(false);
  expect(canPayDeposit(booking, "artist", "pending", now)).toBe(false);
});
test("calendar uses absolute appointment times and escapes data without leaking private notes", () => {
  const text = appointmentICS({
    ...booking,
    location_snapshot: "Room 1\rEND:VEVENT\n,Unit;2",
    notes: "Private note",
  });
  expect(text).toContain("DTSTART:20260930T100000Z");
  expect(text).toContain("DTEND:20260930T110000Z");
  expect(text).toContain("LOCATION:Room 1\\nEND:VEVENT\\n\\,Unit\\;2");
  expect(text).not.toContain("Private note");
  expect(text.match(/^END:VEVENT$/gm)).toHaveLength(1);
  expect(() => appointmentICS({ ...booking, status: "pending" })).toThrow(
    "Only confirmed",
  );
});

test("a received deposit stops showing an amount due and disables checkout", async () => {
  const p = {
    booking,
    userId: "client",
    artist: "Kim",
    client: "Sarah",
    onBack: jest.fn(),
    onAction: jest.fn(),
  };
  const v = await render(<AppointmentView {...p} paymentStatus="pending" />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Pay appointment deposit" }),
  );
  await v.rerender(
    <AppointmentView
      {...p}
      booking={{ ...booking, deposit_paid: true }}
      paymentStatus="fulfilled"
    />,
  );
  expect(screen.queryByText("DUE NOW")).toBeNull();
  expect(screen.getByText("PAID")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Deposit received" }),
  ).toBeDisabled();
});

test("preview artist change returns a proposed time to chat without changing the confirmed appointment", async () => {
  const original = demoAppointment();
  const chat = jest.fn(),
    close = jest.fn();
  await render(
    <BookingPreview
      width={393}
      artist="Kim"
      initialAppointment={original}
      onClose={close}
      onChat={chat}
    />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Preview as nail tech" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Manage appointment" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Change date or time" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "2026-09-30" })).toBeEnabled(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "2026-09-30" }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(await screen.findByRole("radio", { name: "2:00 PM" }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Review message in chat" }),
    ).toBeEnabled(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Review message in chat" }),
  );
  expect(chat).toHaveBeenCalledWith(
    expect.stringContaining("Your current appointment remains unchanged"),
    original,
  );
  expect(close).toHaveBeenCalledTimes(1);
});

test.each(["busy", "unavailable"])(
  "a refreshed client calendar that is %s requires explicit acknowledgement before booking",
  async (state) => {
    const p = props();
    jest
      .mocked(p.loadSlots)
      .mockResolvedValueOnce([slot])
      .mockResolvedValue([
        {
          ...slot,
          client_calendar_state: state === "busy" ? "checked" : "unavailable",
          client_calendar_conflict: state === "busy",
        },
      ]);
    await chooseThroughTime(p);
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    const submit = screen.getByRole("button", {
      name: "Send booking request ✦",
    });
    await waitFor(() => expect(submit).toBeDisabled());
    await fireEvent.press(screen.getByRole("checkbox"));
    await waitFor(() => expect(submit).toBeEnabled());
    await fireEvent.press(submit);
    expect(p.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ allowCalendarConflict: true }),
    );
  },
);
