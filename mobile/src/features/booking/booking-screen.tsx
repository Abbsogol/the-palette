import { useCallback } from "react";
import { router } from "expo-router";
import { useAccountQuery, queryClient } from "../../lib/auth";
import { BookingFormView } from "./booking-form";
import { BookingButton, BookingNotice, BookingShell } from "./primitives";
import {
  loadBookingContext,
  loadBookingMonth,
  loadBookingReferences,
  loadBookingSlots,
} from "./data";
import { useBookingRequest } from "./use-request";
export function BookingScreen({
  id,
  userId,
  designId,
  rescheduledFrom,
}: {
  id: string;
  userId: string;
  designId?: string;
  rescheduledFrom?: string;
}) {
  const query = useAccountQuery(["book-context", id], () =>
    loadBookingContext(id),
  );
  const request = useBookingRequest(query.data, (booking) => {
    void queryClient.invalidateQueries();
    router.replace({ pathname: "/booking/[id]", params: { id: booking.id } });
  });
  const loadSlots = useCallback(
    (service: string, date: string) => loadBookingSlots(id, service, date),
    [id],
  );
  const loadMonth = useCallback(
    (service: string, month: string) =>
      loadBookingMonth(id, service, month, query.data!.timeZone),
    [id, query.data],
  );
  const loadReferences = useCallback(
    () => loadBookingReferences(userId),
    [userId],
  );
  if (!query.data || query.error || id === userId)
    return (
      <BookingShell name="" onBack={() => router.back()}>
        <BookingNotice
          text={
            id === userId
              ? "You cannot book your own services."
              : query.error?.message || "Loading services…"
          }
          error={!!query.error}
        />
        {query.error && (
          <BookingButton title="Retry" onPress={() => void query.refetch()} />
        )}
      </BookingShell>
    );
  return (
    <BookingFormView
      context={query.data}
      onBack={() => router.back()}
      loadSlots={loadSlots}
      loadMonth={loadMonth}
      loadReferences={loadReferences}
      initialDesignId={designId}
      onSubmit={(draft) => void request.submit(draft)}
      busy={request.busy}
      error={request.error}
      calendarConflict={request.calendarConflict}
      onCalendarConnect={() => router.push("/calendar-connect")}
      recovery={request.pending}
      recovering={request.restoring}
      onRecover={() => void request.recover()}
      rescheduled={!!rescheduledFrom}
    />
  );
}
