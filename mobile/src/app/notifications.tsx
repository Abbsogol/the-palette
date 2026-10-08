import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import { router, useFocusEffect, type Href } from "expo-router";
import { RequireAuth } from "../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { accountScope } from "../lib/account-scope";
import {
  registerPush,
  unregisterPush,
  getPushState,
} from "../lib/notifications";
import { NotificationsView } from "../features/notifications/notifications-view";
import {
  loadActivity,
  markActivity,
  activityDestination,
} from "../features/notifications/data";
import type { Activity } from "../features/notifications/model";
function Notifications() {
  const { session, epoch } = useAuth();
  const owner = session!.user.id;
  const [limit, setLimit] = useState(40),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const query = useAccountQuery(["notifications", limit], (signal) =>
    loadActivity(owner, limit, signal),
  );
  const device = useAccountQuery(["push-preferences"], () => getPushState());
  const { refetch } = query,
    { refetch: refreshDevice } = device;
  const refresh = useCallback(() => {
    void refetch();
    void refreshDevice();
  }, [refetch, refreshDevice]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => {
        subscription.remove();
      };
    }, [refresh]),
  );
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const ticket = accountScope.capture();
    try {
      await action();
    } catch (e) {
      if (mounted.current && accountScope.isCurrent(ticket))
        setError(
          e instanceof Error
            ? e.message
            : "This action couldn’t be completed. Try again.",
        );
    } finally {
      pending.current = false;
      if (mounted.current && accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  const updateRead = async (ids: string[], read: boolean) => {
    const ticket = accountScope.capture();
    await markActivity(owner, ids, read);
    accountScope.assert(ticket);
    queryClient.setQueriesData<{ items: Activity[]; hasMore: boolean }>(
      { queryKey: [owner, epoch, "notifications"] },
      (old) =>
        old
          ? {
              ...old,
              items: old.items.map((n) =>
                ids.includes(n.id) ? { ...n, read } : n,
              ),
            }
          : old,
    );
    void queryClient.invalidateQueries({
      queryKey: [owner, epoch, "notifications"],
    });
  };
  const setPush = async (enabled: boolean) => {
    const ticket = accountScope.capture();
    try {
      if (enabled) await registerPush();
      else await unregisterPush();
      accountScope.assert(ticket);
      if (mounted.current)
        setNotice(
          enabled
            ? "Device registration saved. Your current alert setting is shown in Preferences."
            : "Notifications disabled for this account on this device.",
        );
    } finally {
      // Partial failures must also recheck the server/device state.
      if (mounted.current && accountScope.isCurrent(ticket))
        await refreshDevice();
    }
    accountScope.assert(ticket);
  };
  return (
    <NotificationsView
      items={query.data?.items || []}
      device={
        device.isPending
          ? { state: "checking" }
          : device.error
            ? { state: "unknown" }
            : device.data || { state: "unknown" }
      }
      loading={query.isFetching}
      error={!!query.error}
      hasMore={query.data?.hasMore}
      busy={busy}
      notice={notice}
      actionError={error}
      onBack={() => router.back()}
      onRefresh={() => void refetch()}
      onOlder={() => setLimit((v) => v + 40)}
      onRead={(ids, read) => void run(() => updateRead(ids, read))}
      onOpen={(n) =>
        void run(async () => {
          const ticket = accountScope.capture();
          const path = await activityDestination(owner, n);
          accountScope.assert(ticket);
          if (!n.read) await updateRead([n.id], true);
          accountScope.assert(ticket);
          if (mounted.current) router.push(path as Href);
        })
      }
      onEnable={() => void run(() => setPush(true))}
      onDisable={() => void run(() => setPush(false))}
      onCheck={() => void refreshDevice()}
      onSettings={() =>
        void run(async () => {
          await Linking.openSettings();
        })
      }
    />
  );
}
export default function NotificationScreen() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Notifications key={`${session?.user.id}:${epoch}`} />
    </RequireAuth>
  );
}
