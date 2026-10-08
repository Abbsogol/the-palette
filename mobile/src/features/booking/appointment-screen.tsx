import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { checked, api } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { useAccountQuery, queryClient } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { appScheme } from "../../lib/config";
import type { Booking } from "../../lib/types";
import { AppointmentView, type AppointmentAction } from "./appointment-view";
import { BookingButton, BookingNotice, BookingShell } from "./primitives";
import { BookingFormView } from "./booking-form";
import {
  canManage,
  canPayDeposit,
  changeMessage,
  type BookingDraft,
} from "./model";
import { loadBookingMonth, loadBookingSlots } from "./data";
import { exportAppointment } from "./calendar-export";
async function conversationFor(b: Booking) {
  const ticket = accountScope.capture();
  const find = () =>
    supabase
      .from("conversations")
      .select("id")
      .eq("client_id", b.client_id)
      .eq("creator_id", b.creator_id)
      .maybeSingle();
  const existing = await find();
  accountScope.assert(ticket);
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id as string;
  const created = await supabase
    .from("conversations")
    .insert({ client_id: b.client_id, creator_id: b.creator_id })
    .select("id")
    .single();
  accountScope.assert(ticket);
  if (created.error?.code === "23505") {
    const concurrent = await checked<{ id: string }>(find());
    return concurrent.id;
  }
  if (created.error || !created.data)
    throw new Error("Unable to open chat. Please retry.");
  return created.data.id as string;
}
export function AppointmentScreen({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [owner] = useState(() => accountScope.capture());
  const latch = useRef(false),
    mounted = useRef(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [proposing, setProposing] = useState(false);
  const query = useAccountQuery(["booking", id], async () => {
    const booking = await checked<Booking>(
      supabase.from("bookings").select("*,services(*)").eq("id", id).single(),
    );
    if (![booking.client_id, booking.creator_id].includes(userId))
      throw new Error("You do not have access to this appointment.");
    const profiles = await checked<{ id: string; display_name: string }[]>(
      supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", [booking.client_id, booking.creator_id]),
    );
    return {
      booking,
      artist:
        profiles.find((p) => p.id === booking.creator_id)?.display_name ||
        "Artist",
      client:
        profiles.find((p) => p.id === booking.client_id)?.display_name ||
        "Client",
    };
  });
  const b = query.data?.booking;
  const deposit = useAccountQuery(
    ["deposit", id],
    () => api<{ status: string }>(`/mobile/deposit-status?booking=${id}`),
    !!b,
  );
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey.some((k) =>
          [
            "booking",
            "deposit",
            "chat-appointments",
            "appointments",
            "appointment-deposits",
            "profile-account",
          ].includes(String(k)),
        ),
    });
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    mounted.current = true;
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    const channel = supabase
      .channel(`appointment:${owner.epoch}:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `id=eq.${id}`,
        },
        refresh,
      )
      .subscribe();
    return () => {
      mounted.current = false;
      app.remove();
      void supabase.removeChannel(channel);
    };
  }, [id, owner, refresh]);
  const run = async (operation: () => Promise<void>) => {
    if (latch.current || !accountScope.isCurrent(owner)) return;
    latch.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      if (mounted.current && accountScope.isCurrent(owner))
        setError((e as Error).message);
    } finally {
      latch.current = false;
      if (mounted.current && accountScope.isCurrent(owner)) setBusy(false);
    }
  };
  const chat = async (draft?: string) => {
    if (!b) return;
    const conversationId = await conversationFor(b);
    accountScope.assert(owner);
    if (mounted.current)
      router.push({
        pathname: "/conversation/[id]",
        params: { id: conversationId, ...(draft ? { draft } : {}) },
      });
  };
  const action = (kind: AppointmentAction) =>
    void run(async () => {
      if (!b) return;
      if (kind === "refresh") {
        await Promise.all([query.refetch(), deposit.refetch()]);
        return;
      }
      if (kind === "chat") return chat();
      if (kind === "connect-calendar") return router.push("/calendar-connect");
      if (kind === "calendar") return exportAppointment(b);
      if (kind === "design" && b.reference_design_id) {
        router.push({
          pathname: "/design/[id]",
          params: { id: b.reference_design_id },
        });
        return;
      }
      if (kind === "propose") {
        if (b.creator_id !== userId || !canManage(b, userId, Date.now()))
          throw new Error("This appointment cannot be changed.");
        if (!b.services || !b.time_zone)
          throw new Error(
            "The original service or time zone is unavailable. Discuss the change in chat.",
          );
        setProposing(true);
        return;
      }
      if (kind === "pay") {
        // Re-read both booking and payment immediately before checkout.
        const [latest, payment] = await Promise.all([
          query.refetch(),
          deposit.refetch(),
        ]);
        accountScope.assert(owner);
        if (
          latest.error ||
          payment.error ||
          !latest.data ||
          !canPayDeposit(
            latest.data.booking,
            userId,
            payment.data?.status,
            Date.now(),
          )
        )
          throw new Error(
            "This deposit cannot be paid right now. Refresh its status.",
          );
        const { url } = await api<{ url: string }>("/create-deposit-payment", {
          bookingId: id,
          returnContext: appScheme,
        });
        const parsed = new URL(url);
        if (
          parsed.protocol !== "https:" ||
          parsed.hostname !== "checkout.stripe.com" ||
          parsed.username ||
          parsed.password
        )
          throw new Error("Invalid checkout address.");
        accountScope.assert(owner);
        await WebBrowser.openBrowserAsync(url);
        accountScope.assert(owner);
        await Promise.all([query.refetch(), deposit.refetch()]);
        return;
      }
      if (!["confirm", "decline", "cancel", "reschedule"].includes(kind))
        return;
      if (!canManage(b, userId, Date.now()))
        throw new Error("This appointment can no longer be changed.");
      if ((kind === "confirm" || kind === "decline") && b.creator_id !== userId)
        throw new Error("Only the artist can decide this request.");
      if (kind === "reschedule" && b.client_id !== userId)
        throw new Error("The client must approve and rebook the new time.");
      await api("/mobile/booking-action", {
        bookingId: id,
        action: kind === "reschedule" ? "cancel" : kind,
      });
      accountScope.assert(owner);
      refresh();
      await query.refetch();
      accountScope.assert(owner);
      if (kind === "reschedule" && mounted.current)
        router.push({
          pathname: "/book/[id]",
          params: {
            id: b.creator_id,
            rescheduledFrom: b.id,
            ...(b.reference_design_id
              ? { designId: b.reference_design_id }
              : {}),
          },
        });
    });
  const loadSlots = useCallback(
    (service: string, date: string) =>
      loadBookingSlots(b!.creator_id, service, date),
    [b],
  );
  const loadMonth = useCallback(
    (service: string, month: string) =>
      loadBookingMonth(b!.creator_id, service, month, b!.time_zone!),
    [b],
  );
  const propose = (draft: BookingDraft) =>
    void run(async () => {
      if (!b || !canManage(b, userId, Date.now()))
        throw new Error("This appointment can no longer be changed.");
      await chat(changeMessage(b, draft.date, draft.slot));
      accountScope.assert(owner);
      if (mounted.current) setProposing(false);
    });
  if (!b || query.error)
    return (
      <BookingShell name="" onBack={() => router.back()}>
        <BookingNotice
          text={query.error?.message || "Loading appointment…"}
          error={!!query.error}
        />
        {query.error && (
          <BookingButton title="Retry" onPress={() => void query.refetch()} />
        )}
      </BookingShell>
    );
  if (proposing && b.services && b.time_zone)
    return (
      <BookingFormView
        proposing
        initialStep={1}
        initialServiceId={b.service_id}
        context={{
          creator: { id: b.creator_id, name: query.data!.artist },
          services: [b.services],
          location: b.location_snapshot || "Confirm location in chat",
          timeZone: b.time_zone,
        }}
        loadSlots={loadSlots}
        loadMonth={loadMonth}
        busy={busy}
        error={error}
        onBack={() => setProposing(false)}
        onSubmit={propose}
      />
    );
  return (
    <AppointmentView
      booking={b}
      artist={query.data!.artist}
      client={query.data!.client}
      userId={userId}
      paymentStatus={deposit.data?.status}
      paymentError={deposit.error?.message}
      busy={busy}
      error={error}
      onBack={() => router.back()}
      onAction={action}
    />
  );
}
