import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { api } from "./api";
import { secureStorage } from "./secure-storage";
import type { PushState } from "../features/notifications/model";
import { accountScope } from "./account-scope";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
const installationKey = "laque.installation";
export async function registerPush(requestPermission = true) {
  const ticket = accountScope.capture();
  if (!ticket.id) throw new Error("Sign in before enabling notifications.");
  if (!Device.isDevice)
    throw new Error("Push notifications require a physical device.");
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error("This build is not connected to an Expo project yet.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("activity", {
      name: "Messages and appointments",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  accountScope.assert(ticket);
  let permission = await Notifications.getPermissionsAsync();
  accountScope.assert(ticket);
  if (!allowsPush(permission) && permission.canAskAgain && requestPermission)
    permission = await Notifications.requestPermissionsAsync();
  accountScope.assert(ticket);
  if (!allowsPush(permission)) {
    await unregisterPush();
    throw new Error(
      "Notifications are off. You can enable them in your device settings.",
    );
  }
  accountScope.assert(ticket);
  let installation = await secureStorage.getItem(installationKey);
  if (!installation) {
    installation = Crypto.randomUUID();
    await secureStorage.setItem(installationKey, installation);
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  accountScope.assert(ticket);
  await api("/mobile/push", {
    installationId: installation,
    token,
    platform: Platform.OS,
  });
  accountScope.assert(ticket);
  await secureStorage.setItem(`laque.push-enabled.${ticket.id}`, "true");
}
export async function unregisterPush() {
  const ticket = accountScope.capture();
  const installation = await secureStorage.getItem(installationKey);
  accountScope.assert(ticket);
  if (installation && ticket.id)
    await api("/mobile/push", { installationId: installation }, "DELETE");
  accountScope.assert(ticket);
  // A failed DELETE must not appear as disabled or suppress a later retry.
  if (ticket.id)
    await secureStorage.removeItem(`laque.push-enabled.${ticket.id}`);
}
function allowsPush(permission: Notifications.NotificationPermissionsStatus) {
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}
export async function getPushState(): Promise<PushState> {
  const ticket = accountScope.capture();
  if (!ticket.id) throw new Error("Sign in to view device preferences.");
  if (!Device.isDevice || !["ios", "android"].includes(Platform.OS))
    return {
      state: "unavailable",
      reason:
        "Push alerts are available in the LaQue app on a physical iPhone or Android device. You can still view activity here.",
    };
  if (!(
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  ))
    return {
      state: "unavailable",
      reason:
        "Push alerts aren’t available in this build yet. Your activity remains available.",
    };
  const permission = await Notifications.getPermissionsAsync();
  accountScope.assert(ticket);
  const installation = await secureStorage.getItem(installationKey);
  accountScope.assert(ticket);
  let registered = false;
  if (installation) {
    try {
      const result = await api<{ enabled: boolean }>(
        `/mobile/push?installationId=${encodeURIComponent(installation)}`,
      );
      accountScope.assert(ticket);
      if (typeof result.enabled !== "boolean")
        throw new Error("Device status could not be confirmed.");
      registered = result.enabled;
    } catch (error) {
      accountScope.assert(ticket);
      // Device permissions remain known even when the server cannot be reached.
      if (!allowsPush(permission))
        return {
          state: permission.canAskAgain ? "off" : "denied",
          reason:
            "Device alerts are off. Server registration could not be checked; retry when connected.",
        };
      throw error;
    }
  }
  if (!allowsPush(permission))
    return { state: permission.canAskAgain ? "off" : "denied", registered };
  return {
    state: registered
      ? permission.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL
        ? "quiet"
        : "enabled"
      : "off",
    registered,
  };
}
