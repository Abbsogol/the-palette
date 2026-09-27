import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { api } from "./api";
import { secureStorage } from "./secure-storage";
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
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error("This build is not connected to an Expo project yet.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("activity", {
      name: "Messages and appointments",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain && requestPermission)
    permission = await Notifications.requestPermissionsAsync();
  accountScope.assert(ticket);
  if (!permission.granted) {
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
  if (ticket.id)
    await secureStorage.removeItem(`laque.push-enabled.${ticket.id}`);
  const installation = await secureStorage.getItem(installationKey);
  accountScope.assert(ticket);
  if (installation && ticket.id)
    await api("/mobile/push", { installationId: installation }, "DELETE");
}
