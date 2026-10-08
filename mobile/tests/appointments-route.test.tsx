import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Appointments from "../src/app/appointments";
import { router } from "expo-router";
import {
  loadAppointments,
  loadAppointmentDeposits,
} from "../src/features/appointments/data";
const mockRefetch = jest.fn(),
  mockPaymentsRefetch = jest.fn(),
  mockQueries = jest.fn();
let mockId = "owner",
  mockEpoch = 1,
  mockRole = "creator",
  mockError: Error | null = null,
  mockProfileError: Error | null = null,
  mockPaymentError = false,
  mockPending = false;
const mockItem = {
  id: "exact-booking",
  client_id: "owner",
  creator_id: "artist",
  service_id: "service",
  booking_date: "2026-10-10",
  start_time: "10:00:00",
  end_time: "11:00:00",
  starts_at: "2026-10-10T06:00:00Z",
  ends_at: "2026-10-10T07:00:00Z",
  time_zone: "Asia/Dubai",
  status: "pending",
  deposit_paid: false,
  person: { id: "artist", name: "Anelia", username: "anelia", avatar: null },
};
const mockData = { items: [mockItem], hasMore: true };
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: (fn: () => void) => {
    require("react").useEffect(fn, [fn]);
  },
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/components/ui", () => ({
  RequireAuth: ({ children }: any) => children,
}));
jest.mock("../src/features/appointments/data", () => ({
  loadAppointments: jest.fn(),
  loadAppointmentDeposits: jest.fn(),
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: mockId } }, epoch: mockEpoch }),
  useProfile: () => ({
    data: { account_type: mockRole },
    error: mockProfileError,
  }),
  useAccountQuery: (key: any[], fn: any, enabled = true) => {
    mockQueries(key, enabled);
    require("react").useEffect(() => {
      if (enabled) fn(new AbortController().signal);
    }, [JSON.stringify(key), enabled]);
    return key[0] === "appointments"
      ? {
          data: mockData,
          error: mockError,
          isPending: mockPending,
          isFetching: false,
          refetch: mockRefetch,
        }
      : {
          data: {
            "exact-booking": mockPaymentError
              ? { unavailable: true }
              : { status: "pending" },
          },
          error: null,
          isPending: false,
          isFetching: false,
          refetch: mockPaymentsRefetch,
        };
  },
}));
const press = (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
beforeEach(() => {
  mockId = "owner";
  mockEpoch = 1;
  mockRole = "creator";
  mockError = null;
  mockProfileError = null;
  mockPaymentError = false;
  mockPending = false;
});
test("owned role/filter adapter reads reset pagination and open the existing exact booking route", async () => {
  await render(<Appointments />);
  expect(loadAppointments).toHaveBeenLastCalledWith(
    "owner",
    "customer",
    "Requests",
    20,
    expect.any(Number),
    expect.any(AbortSignal),
  );
  expect(loadAppointmentDeposits).toHaveBeenLastCalledWith(
    ["exact-booking"],
    expect.any(AbortSignal),
  );
  await press("View request");
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/booking/[id]",
    params: { id: "exact-booking" },
  });
  await press("Load more appointments");
  expect(loadAppointments).toHaveBeenLastCalledWith(
    "owner",
    "customer",
    "Requests",
    40,
    expect.any(Number),
    expect.any(AbortSignal),
  );
  await press("Client bookings");
  expect(loadAppointments).toHaveBeenLastCalledWith(
    "owner",
    "creator",
    "Requests",
    20,
    expect.any(Number),
    expect.any(AbortSignal),
  );
  await press("Past");
  expect(loadAppointments).toHaveBeenLastCalledWith(
    "owner",
    "creator",
    "Past",
    20,
    expect.any(Number),
    expect.any(AbortSignal),
  );
});
test("a refreshed profile read failure removes creator controls and reverts to customer-only reads", async () => {
  const view = await render(<Appointments />);
  await press("Client bookings");
  mockProfileError = new Error("Offline");
  await view.rerender(<Appointments />);
  expect(screen.queryByRole("button", { name: "Client bookings" })).toBeNull();
  expect(loadAppointments).toHaveBeenLastCalledWith(
    "owner",
    "customer",
    "Requests",
    20,
    expect.any(Number),
    expect.any(AbortSignal),
  );
});
test("signing into another account resets the selected role, history filter and pagination", async () => {
  const view = await render(<Appointments />);
  await press("Client bookings");
  await press("Past");
  await press("Load more appointments");
  mockId = "other";
  mockEpoch = 2;
  await view.rerender(<Appointments />);
  expect(loadAppointments).toHaveBeenLastCalledWith(
    "other",
    "customer",
    "Requests",
    20,
    expect.any(Number),
    expect.any(AbortSignal),
  );
});
test("list failure hides cached cards and disables dependent financial reads; a user retry refreshes both reads", async () => {
  mockError = new Error("Revoked");
  await render(<Appointments />);
  expect(screen.queryByText("Anelia")).toBeNull();
  expect(mockQueries).toHaveBeenCalledWith(
    expect.arrayContaining(["appointment-deposits"]),
    false,
  );
  expect(loadAppointmentDeposits).not.toHaveBeenCalled();
  await press("Refresh appointments");
  expect(mockRefetch).toHaveBeenCalled();
  expect(mockPaymentsRefetch).toHaveBeenCalled();
});
test("individual payment retry does not refetch or mutate bookings", async () => {
  mockPaymentError = true;
  await render(<Appointments />);
  const reads = mockRefetch.mock.calls.length;
  await press("Retry payment statuses");
  expect(mockPaymentsRefetch).toHaveBeenCalled();
  expect(mockRefetch.mock.calls.length).toBe(reads);
  expect(router.push).not.toHaveBeenCalled();
});
