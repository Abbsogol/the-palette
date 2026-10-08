import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AvailabilityScreen from "../src/app/availability";
import { usePreventRemove } from "expo-router/react-navigation";
import { router } from "expo-router";
import { accountScope } from "../src/lib/account-scope";
const mockDispatch = jest.fn(),
  mockInvalidate = jest.fn().mockResolvedValue(undefined),
  mockApi = jest.fn().mockResolvedValue({ ok: true }),
  mockRefetch = jest.fn();
let mockRole = "creator",
  mockQueryError: Error | null = null,
  mockProfileError: Error | null = null,
  mockId = "owner",
  mockEpoch = 1;
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/components/ui", () => ({
  RequireAuth: ({ children }: any) => children,
  QueryState: ({ children }: any) => children,
}));
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../src/lib/api", () => ({
  api: (...args: any[]) => mockApi(...args),
  checked: jest.fn(),
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: mockId } }, epoch: mockEpoch }),
  useProfile: () => ({
    data: { id: mockId, account_type: mockRole },
    isPending: false,
    error: mockProfileError,
    refetch: mockRefetch,
  }),
  useAccountQuery: () => ({
    data: { days: [], zone: "Asia/Dubai" },
    isPending: false,
    error: mockQueryError,
    refetch: mockRefetch,
  }),
  queryClient: { invalidateQueries: () => mockInvalidate() },
}));
const press = (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
const edit = async () => {
  await press("Monday opens, 09:00");
  await press("Hour 10");
  await press("Use time");
};
beforeEach(() => {
  mockRole = "creator";
  mockQueryError = null;
  mockProfileError = null;
  mockId = "owner";
  mockEpoch = 1;
});
afterEach(() => accountScope.change(null));
test("creator saves all seven days through the authenticated API and refreshes dependent views", async () => {
  await render(<AvailabilityScreen />);
  await edit();
  await press("Save working hours");
  expect(mockApi).toHaveBeenCalledWith("/update-availability", {
    timeZone: "Asia/Dubai",
    schedule: expect.arrayContaining([
      expect.objectContaining({
        day_of_week: 1,
        start_time: "10:00",
        is_active: true,
      }),
    ]),
  });
  expect(mockApi.mock.calls[0][1].schedule).toHaveLength(7);
  expect(mockInvalidate).toHaveBeenCalled();
});
test("back and Calendar navigation protect an unsaved schedule", async () => {
  await render(<AvailabilityScreen />);
  await edit();
  await press("Connect Google Calendar");
  expect(router.push).not.toHaveBeenCalled();
  await press("Keep editing");
  const guard = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
  expect(guard[0]).toBe(true);
  await act(() => guard[1]({ data: { action: { type: "GO_BACK" } } }));
  await press("Discard changes");
  expect(mockDispatch).toHaveBeenCalledWith({ type: "GO_BACK" });
});
test("background schedule/profile read failures retain the edited draft", async () => {
  const view = await render(<AvailabilityScreen />);
  await edit();
  mockQueryError = new Error("Offline");
  mockProfileError = new Error("Offline");
  await view.rerender(<AvailabilityScreen />);
  expect(
    screen.getByRole("button", { name: "Monday opens, 10:00" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Retry working hours" }),
  ).toBeTruthy();
  await press("Save working hours");
  expect(mockApi).toHaveBeenCalled();
});
test("server failure retains the draft without a success notice", async () => {
  mockApi.mockRejectedValueOnce(new Error("Server unavailable"));
  await render(<AvailabilityScreen />);
  await edit();
  await press("Save working hours");
  expect(screen.getByText("Server unavailable")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Monday opens, 10:00" }),
  ).toBeTruthy();
  expect(screen.queryByText(/Working hours saved/)).toBeNull();
  expect(mockInvalidate).not.toHaveBeenCalled();
});
test("customers see creator onboarding instead of working-hour mutations", async () => {
  mockRole = "user";
  await render(<AvailabilityScreen />);
  expect(screen.getByRole("button", { name: "Become a creator" })).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Save working hours" }),
  ).toBeNull();
  expect(mockApi).not.toHaveBeenCalled();
});
test("account changes remount the draft instead of carrying another account hours", async () => {
  const view = await render(<AvailabilityScreen />);
  await edit();
  mockId = "second";
  mockEpoch = 2;
  await view.rerender(<AvailabilityScreen />);
  expect(
    screen.getByRole("button", { name: "Monday opens, 09:00" }),
  ).toBeTruthy();
  expect(screen.queryByText("Unsaved changes")).toBeNull();
});
