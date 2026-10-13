import { render } from "@testing-library/react-native";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AccountNavigation } from "../src/components/account-navigation";

jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "member" } } }),
  useProfile: () => ({ data: { onboarding_complete: true } }),
}));
jest.mock("expo-router", () => ({
  usePathname: () => "/",
  router: { push: jest.fn(), replace: jest.fn() },
}));
jest.mock("expo-notifications", () => ({
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock("../src/lib/notifications", () => ({ registerPush: jest.fn() }));
jest.mock("../src/lib/secure-storage", () => ({
  secureStorage: { getItem: jest.fn(async () => null) },
}));
jest.mock("../src/lib/account-scope", () => ({
  accountScope: { capture: () => ({}), isCurrent: () => true },
}));

const nativePlatform = Platform.OS;
afterEach(() => { Platform.OS = nativePlatform; });

test("connected web sign-in never calls unsupported native notification APIs", async () => {
  Platform.OS = "web";
  await render(<AccountNavigation />);
  expect(Notifications.getLastNotificationResponseAsync).not.toHaveBeenCalled();
  expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
});

test("iOS retains notification response handling and removes its listener", async () => {
  Platform.OS = "ios";
  const view = await render(<AccountNavigation />);
  expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
  const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.results[0].value;
  await view.unmount();
  expect(listener.remove).toHaveBeenCalledTimes(1);
});
