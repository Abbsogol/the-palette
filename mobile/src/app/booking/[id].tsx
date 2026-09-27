import { useEffect, useState } from "react";
import { Alert, AppState, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
  money,
} from "../../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../../lib/auth";
import { api, checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { appScheme } from "../../lib/config";
import { accountScope } from "../../lib/account-scope";
import type { Booking } from "../../lib/types";
import { useCurrentTime } from "../../lib/clock";
const outcomes: Record<string, string> = {
  fulfilled: "Deposit received",
  refunded: "Full deposit refund completed",
  refund_pending: "Full deposit refund pending",
  refund_failed: "Refund needs attention. Contact support.",
  payment_review: "Payment is being reviewed. Do not pay again.",
  pending: "Payment has not yet been confirmed",
  partial_refund: "Deposit partially refunded",
  partially_refunded: "Deposit partially refunded",
  failed: "Payment failed",
  expired: "Checkout expired",
};
function Appointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useAccountQuery(["booking", id], () =>
    checked<Booking | null>(
      supabase.from("bookings").select("*,services(*)").eq("id", id).single(),
    ),
  );
  const b = query.data;
  const deposit = useAccountQuery(
    ["deposit", id],
    () => api<{ status: string }>(`/mobile/deposit-status?booking=${id}`),
    !!b,
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void queryClient.invalidateQueries();
    });
    return () => sub.remove();
  }, []);
  const action = async (
    kind: "confirm" | "decline" | "cancel",
    reschedule = false,
  ) => {
    setBusy(true);
    setError("");
    try {
      await api("/mobile/booking-action", { bookingId: id, action: kind });
      await queryClient.invalidateQueries();
      if (reschedule && b)
        router.push({
          pathname: "/book/[id]",
          params: {
            id: b.creator_id,
            rescheduledFrom: id,
            ...(b.reference_design_id
              ? { designId: b.reference_design_id }
              : {}),
          },
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const cancel = (reschedule = false) =>
    Alert.alert(
      reschedule
        ? "Cancel and request a new time?"
        : "Cancel this appointment?",
      "Any paid deposit will be fully refunded. Refunds can take time; a new booking may need a separate deposit.",
      [
        { text: "Keep appointment", style: "cancel" },
        {
          text: reschedule ? "Cancel & rebook" : "Cancel appointment",
          style: "destructive",
          onPress: () => void action("cancel", reschedule),
        },
      ],
    );
  const pay = async () => {
    setBusy(true);
    setError("");
    const ticket = accountScope.capture();
    try {
      const { url } = await api<{ url: string }>("/create-deposit-payment", {
        bookingId: id,
        returnContext: appScheme,
      });
      if (new URL(url).hostname !== "checkout.stripe.com")
        throw new Error("Invalid checkout address.");
      await WebBrowser.openBrowserAsync(url);
      accountScope.assert(ticket);
      await deposit.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const now = useCurrentTime();
  const future = !!b?.starts_at && new Date(b.starts_at).getTime() > now;
  return (
    <>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {b && (
          <>
            <Card>
              <Text style={styles.title}>
                {b.services?.name || "Appointment"}
              </Text>
              <Text style={styles.subtitle}>{b.status}</Text>
              <Notice>
                {b.booking_date} · {b.start_time.slice(0, 5)}–
                {b.end_time.slice(0, 5)} ·{" "}
                {b.time_zone || "Time zone not recorded"}
              </Notice>
              <Notice>
                Location:{" "}
                {b.location_snapshot ||
                  "Ask your creator to confirm the service location."}
              </Notice>
              {b.price_snapshot != null ? (
                <>
                  <Notice>Total {money(b.price_snapshot)}</Notice>
                  <Notice>Deposit {money(b.deposit_snapshot || 0)}</Notice>
                  <Notice>
                    Balance after deposit{" "}
                    {money(b.price_snapshot - (b.deposit_snapshot || 0))}
                  </Notice>
                </>
              ) : (
                <Notice>
                  This older appointment needs its original price confirmed.
                </Notice>
              )}
              {b.notes && <Notice>{b.notes}</Notice>}
            </Card>
            {deposit.data && (
              <Notice>
                {outcomes[deposit.data.status] || "Payment update pending"}
              </Notice>
            )}
            {deposit.error && <Notice error>{deposit.error.message}</Notice>}
            {b.client_id === session!.user.id &&
              future &&
              ["pending", "confirmed"].includes(b.status) &&
              !b.deposit_paid &&
              Number(b.deposit_snapshot ?? b.services?.deposit_amount) > 0 && (
                <Button
                  title="Pay appointment deposit"
                  busy={busy}
                  onPress={() => void pay()}
                />
              )}
            <Button
              title="Refresh appointment & payment"
              secondary
              onPress={() => void queryClient.invalidateQueries()}
            />
            {b.creator_id === session!.user.id &&
              b.status === "pending" &&
              future && (
                <>
                  <Button
                    title="Accept request"
                    busy={busy}
                    onPress={() => void action("confirm")}
                  />
                  <Button
                    title="Decline request"
                    secondary
                    disabled={busy}
                    onPress={() => void action("decline")}
                  />
                </>
              )}
            {future && ["pending", "confirmed"].includes(b.status) && (
              <>
                <Button
                  title="Cancel appointment"
                  secondary
                  disabled={busy}
                  onPress={() => cancel()}
                />
                {b.client_id === session!.user.id && (
                  <Button
                    title="Reschedule: cancel and rebook"
                    secondary
                    disabled={busy}
                    onPress={() => cancel(true)}
                  />
                )}
              </>
            )}
            {b.reference_design_id && (
              <Button
                title="View reference design"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/design/[id]",
                    params: { id: b.reference_design_id! },
                  })
                }
              />
            )}
          </>
        )}
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function BookingDetails() {
  return (
    <Screen title="Appointment" back>
      <RequireAuth>
        <Appointment />
      </RequireAuth>
    </Screen>
  );
}
