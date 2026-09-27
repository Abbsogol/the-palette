import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { router, usePathname, type Href } from "expo-router";
import { useAuth, useProfile } from "../lib/auth";
import { accountScope } from "../lib/account-scope";
import { notificationPath } from "../lib/links";
import { registerPush } from "../lib/notifications";
import { secureStorage } from "../lib/secure-storage";
export function AccountNavigation() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const profile = useProfile();
  const pathname = usePathname();
  useEffect(() => {
    if (
      session &&
      profile.data &&
      !profile.data.onboarding_complete &&
      !pathname.startsWith("/auth") &&
      pathname !== "/onboarding"
    )
      router.replace("/onboarding");
  }, [session, profile.data, pathname]);
  useEffect(() => {
    if (!userId) return;
    const ticket = accountScope.capture();
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response || !accountScope.isCurrent(ticket)) return;
      const path = notificationPath(
        response.notification.request.content.data || {},
      );
      void Notifications.clearLastNotificationResponseAsync();
      if (path) router.push(path as Href);
    };
    void Notifications.getLastNotificationResponseAsync().then(handle);
    const listener =
      Notifications.addNotificationResponseReceivedListener(handle);
    const refresh = async () => {
      if (
        (await secureStorage.getItem(`laque.push-enabled.${userId}`)) ===
          "true" &&
        accountScope.isCurrent(ticket)
      )
        await registerPush(false).catch(() => undefined);
    };
    void refresh();
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      listener.remove();
      foreground.remove();
    };
  }, [userId]);
  return null;
}
