import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { accountScope } from "../src/lib/account-scope";
import { secureStorage } from "../src/lib/secure-storage";
import { api } from "../src/lib/api";
import {
  getPushState,
  registerPush,
  unregisterPush,
} from "../src/lib/notifications";
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "project" } } } },
}));
jest.mock("../src/lib/api", () => ({ api: jest.fn() }));
jest.mock("../src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
const permission = (granted = true, canAskAgain = true, iosStatus = 2) => ({
  granted,
  canAskAgain,
  ios: { status: iosStatus },
});
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("owner", true);
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  jest
    .mocked(secureStorage.getItem)
    .mockResolvedValue("00000000-0000-4000-8000-000000000001");
  jest.mocked(api).mockResolvedValue({ enabled: true });
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue(permission() as never);
  jest
    .mocked(Notifications.getExpoPushTokenAsync)
    .mockResolvedValue({ data: "ExpoPushToken[fixture]" } as never);
});
afterEach(() => accountScope.change(null));
test("failed server disable keeps the local preference until a confirmed retry", async () => {
  jest.mocked(api).mockRejectedValueOnce(new Error("Offline"));
  await expect(unregisterPush()).rejects.toThrow("Offline");
  expect(secureStorage.removeItem).not.toHaveBeenCalled();
  await unregisterPush();
  expect(secureStorage.removeItem).toHaveBeenCalledWith(
    "laque.push-enabled.owner",
  );
  expect(jest.mocked(api).mock.invocationCallOrder[1]).toBeLessThan(
    jest.mocked(secureStorage.removeItem).mock.invocationCallOrder[0],
  );
});
test("device status comes from an owner-scoped backend read, not an old local enabled flag", async () => {
  expect(await getPushState()).toEqual({ state: "enabled", registered: true });
  expect(api).toHaveBeenCalledWith(
    "/mobile/push?installationId=00000000-0000-4000-8000-000000000001",
  );
  jest.mocked(api).mockResolvedValue({ enabled: false });
  expect(await getPushState()).toEqual({ state: "off", registered: false });
});
test("denied and provisional iOS authorization are distinct", async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue(permission(false, false, 1) as never);
  expect(await getPushState()).toEqual({ state: "denied", registered: true });
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue(permission(false, true, 3) as never);
  expect(await getPushState()).toEqual({ state: "quiet", registered: true });
  await registerPush();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(secureStorage.setItem).toHaveBeenCalledWith(
    "laque.push-enabled.owner",
    "true",
  );
});
test("a stalled or invalid registration read cannot report enabled", async () => {
  jest.mocked(api).mockRejectedValue(new Error("Offline"));
  await expect(getPushState()).rejects.toThrow("Offline");
  jest.mocked(api).mockResolvedValue({});
  await expect(getPushState()).rejects.toThrow(/could not be confirmed/);
});
test("switching accounts during the permission read prevents a late request prompt or registration", async () => {
  let resolve!: (v: unknown) => void;
  jest.mocked(Notifications.getPermissionsAsync).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }) as never,
  );
  const failed = expect(registerPush()).rejects.toThrow(/account changed/);
  accountScope.change("other");
  resolve(permission(false));
  await failed;
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalled();
});
test("a late DELETE does not clear another account's stored preference", async () => {
  let resolve!: (v: unknown) => void;
  jest.mocked(api).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const failed = expect(unregisterPush()).rejects.toThrow(/account changed/);
  await Promise.resolve();
  accountScope.change("other");
  resolve({ ok: true });
  await failed;
  expect(secureStorage.removeItem).not.toHaveBeenCalled();
});
test("no installation is off and web rendering is explicitly unavailable", async () => {
  jest.mocked(secureStorage.getItem).mockResolvedValue(null);
  expect(await getPushState()).toEqual({ state: "off", registered: false });
  expect(api).not.toHaveBeenCalled();
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  expect((await getPushState()).state).toBe("unavailable");
});
test("known denied permissions remain visible when the server is offline", async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue(permission(false, false, 1) as never);
  jest.mocked(api).mockRejectedValue(new Error("Offline"));
  expect(await getPushState()).toEqual({
    state: "denied",
    reason: expect.stringContaining("could not be checked"),
  });
});
