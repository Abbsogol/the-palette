import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { RequireAuth } from "../components/ui";
import { Screen, Notice } from "../features/secondary/primitives";
import { AppointmentList } from "../features/secondary/history-view";
import {
  loadAppointments,
  loadAppointmentDeposits,
} from "../features/appointments/data";
import type {
  AppointmentRole,
  AppointmentFilter,
} from "../features/appointments/model";
import { useAccountQuery, useAuth, useProfile } from "../lib/auth";
function Appointments() {
  const { session } = useAuth(),
    profile = useProfile();
  const [selectedRole, setRole] = useState<AppointmentRole>("customer"),
    [filter, setFilter] = useState<AppointmentFilter>("Requests"),
    [limit, setLimit] = useState(20),
    [now, setNow] = useState(() => Date.now());
  const canCreate =
      !!profile.data &&
      !profile.error &&
      ["creator", "salon", "nail_artist"].includes(profile.data.account_type),
    role = canCreate ? selectedRole : "customer";
  const query = useAccountQuery(
    ["appointments", role, filter, limit],
    (signal) =>
      loadAppointments(
        session!.user.id,
        role,
        filter,
        limit,
        Date.now(),
        signal,
      ),
  );
  const ids = query.data?.items.map((b) => b.id) || [];
  const deposits = useAccountQuery(
    ["appointment-deposits", role, filter, ids],
    (signal) => loadAppointmentDeposits(ids, signal),
    !!ids.length && !query.error,
  );
  const { refetch } = query,
    { refetch: refetchPayments } = deposits;
  const refresh = useCallback(() => {
    setNow(Date.now());
    void refetch();
    void refetchPayments();
  }, [refetch, refetchPayments]);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      refresh();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => {
        setFocused(false);
        subscription.remove();
      };
    }, [refresh]),
  );
  // Reclassify at known start/end boundaries, without polling financial endpoints off screen.
  useEffect(() => {
    if (!focused) return;
    const future = (query.data?.items || [])
      .flatMap((b) => [
        Date.parse(b.starts_at || ""),
        Date.parse(b.ends_at || ""),
      ])
      .filter((t) => Number.isFinite(t) && t > Date.now());
    if (!future.length) return;
    const delay = Math.min(Math.min(...future) - Date.now() + 50, 2147483647);
    const timer = setTimeout(refresh, Math.max(50, delay));
    return () => clearTimeout(timer);
  }, [focused, query.data, refresh]);
  return (
    <Screen
      title="Appointments"
      onBack={() => router.back()}
      resetScrollKey={role + ":" + filter}
    >
      {!!profile.error && (
        <Notice error>
          Couldn’t check your creator account. Your customer bookings are still
          available.
        </Notice>
      )}
      <AppointmentList
        items={query.error ? [] : query.data?.items || []}
        role={role}
        canCreate={canCreate}
        onRole={(v) => {
          setRole(v);
          setLimit(20);
        }}
        filter={filter}
        onFilter={(v) => {
          setFilter(v);
          setLimit(20);
        }}
        now={now}
        loading={query.isPending}
        error={query.error}
        refreshing={query.isFetching}
        onRetry={refresh}
        hasMore={query.data?.hasMore}
        onMore={() => setLimit((v) => v + 20)}
        onOpen={(id) =>
          router.push({ pathname: "/booking/[id]", params: { id } })
        }
        payments={deposits.data}
        paymentsLoading={deposits.isFetching || deposits.isPending}
        paymentError={deposits.error}
        onRetryPayments={() => void refetchPayments()}
      />
    </Screen>
  );
}
export default function AppointmentScreen() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Appointments key={(session?.user.id || "") + ":" + epoch} />
    </RequireAuth>
  );
}
