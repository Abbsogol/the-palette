import { act, fireEvent, render, screen } from "@testing-library/react-native";
import NotificationScreen from "../src/app/notifications";
import { router } from "expo-router";
import { accountScope } from "../src/lib/account-scope";
import {
  activityDestination,
  markActivity,
} from "../src/features/notifications/data";
import { unregisterPush } from "../src/lib/notifications";
const mockRefetch = jest.fn(),
  mockDeviceRefetch = jest.fn(),
  mockSet = jest.fn(),
  mockInvalidate = jest.fn();
let mockOwner = "owner",
  mockEpoch = 1;
const mockItem = {
  id: "row",
  user_id: "owner",
  actor_id: "actor",
  type: "new_message",
  read: false,
  design_id: null,
  comment_preview: null,
  created_at: "2026-10-07T00:00:00Z",
  actor: { id: "actor", display_name: "Sarah", avatar_url: null },
};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: () => {},
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/components/ui", () => ({
  RequireAuth: ({ children }: any) => children,
}));
jest.mock("../src/features/notifications/data", () => ({
  loadActivity: jest.fn(),
  markActivity: jest.fn(),
  activityDestination: jest.fn(),
}));
jest.mock("../src/lib/notifications", () => ({
  getPushState: jest.fn(),
  registerPush: jest.fn(),
  unregisterPush: jest.fn(),
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: mockOwner } }, epoch: mockEpoch }),
  queryClient: {
    setQueriesData: (...args: any[]) => mockSet(...args),
    invalidateQueries: (...args: any[]) => mockInvalidate(...args),
  },
  useAccountQuery: (key: any[]) =>
    key[0] === "notifications"
      ? {
          data: { items: [mockItem], hasMore: false },
          isFetching: false,
          refetch: mockRefetch,
        }
      : {
          data: { state: "enabled", registered: true },
          isPending: false,
          refetch: mockDeviceRefetch,
        },
}));
const press = (name: string | RegExp) =>
  fireEvent.press(screen.getByRole("button", { name }));
beforeEach(() => {
  jest.clearAllMocks();
  mockOwner = "owner";
  mockEpoch = 1;
  accountScope.change("owner", true);
  jest.mocked(activityDestination).mockResolvedValue("/messages");
  jest.mocked(markActivity).mockResolvedValue();
  jest.mocked(unregisterPush).mockResolvedValue();
  mockDeviceRefetch.mockResolvedValue({
    data: { state: "off", registered: false },
  });
});
afterEach(() => accountScope.change(null));
test("opening activity waits for access and confirmed marking before navigation", async () => {
  let done!: () => void;
  jest.mocked(markActivity).mockReturnValue(
    new Promise<void>((r) => {
      done = r;
    }),
  );
  await render(<NotificationScreen />);
  await press(/Unread: New message/);
  expect(router.push).not.toHaveBeenCalled();
  expect(markActivity).toHaveBeenCalledWith("owner", ["row"], true);
  await act(async () => done());
  expect(router.push).toHaveBeenCalledWith("/messages");
  expect(mockSet).toHaveBeenCalledWith(
    { queryKey: ["owner", 1, "notifications"] },
    expect.any(Function),
  );
});
test("failed marking leaves activity unread and blocks navigation", async () => {
  jest.mocked(markActivity).mockRejectedValue(new Error("Offline"));
  await render(<NotificationScreen />);
  await press(/Unread: New message/);
  expect(screen.getByText("Offline")).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();
  expect(mockSet).not.toHaveBeenCalled();
});
test("revoked content cannot mark or navigate", async () => {
  jest
    .mocked(activityDestination)
    .mockRejectedValue(new Error("Content unavailable"));
  await render(<NotificationScreen />);
  await press(/Unread: New message/);
  expect(screen.getByText("Content unavailable")).toBeTruthy();
  expect(markActivity).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});
test("duplicate read presses submit one write", async () => {
  let done!: () => void;
  jest.mocked(markActivity).mockReturnValue(
    new Promise<void>((r) => {
      done = r;
    }),
  );
  await render(<NotificationScreen />);
  await press("Mark New message read");
  await press("Mark New message read");
  expect(markActivity).toHaveBeenCalledTimes(1);
  await act(async () => done());
});
test("an account change suppresses a late read completion and navigation", async () => {
  let done!: () => void;
  jest.mocked(markActivity).mockReturnValue(
    new Promise<void>((r) => {
      done = r;
    }),
  );
  const view = await render(<NotificationScreen />);
  await press(/Unread: New message/);
  mockOwner = "other";
  mockEpoch = 2;
  accountScope.change("other");
  await view.rerender(<NotificationScreen />);
  await act(async () => done());
  expect(router.push).not.toHaveBeenCalled();
  expect(mockSet).not.toHaveBeenCalled();
});
test("failed push disabling shows an error and refreshes actual status without success", async () => {
  jest
    .mocked(unregisterPush)
    .mockRejectedValue(new Error("Could not unregister"));
  await render(<NotificationScreen />);
  await fireEvent.press(screen.getByRole("tab", { name: "Preferences" }));
  await press("Disable on this device");
  expect(screen.getByText("Could not unregister")).toBeTruthy();
  expect(mockDeviceRefetch).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByText(
      "Notifications disabled for this account on this device.",
    ),
  ).toBeNull();
});
