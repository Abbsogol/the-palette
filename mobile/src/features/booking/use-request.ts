import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { api, ApiError } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { readPending, writePending } from "../../lib/pending";
import type { Booking } from "../../lib/types";
import {
  requestFromDraft,
  type BookingContext,
  type BookingDraft,
  type BookingRequest,
} from "./model";
export function useBookingRequest(
  context: BookingContext | undefined,
  onSuccess: (booking: Booking) => void,
) {
  const [owner] = useState(() => accountScope.capture());
  const mounted = useRef(true),
    latch = useRef(false),
    saved = useRef<BookingRequest | null>(null),
    ready = useRef(false);
  const [pending, setPending] = useState(false),
    [restoring, setRestoring] = useState(true),
    [recoveryFailed, setRecoveryFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [calendarConflict, setCalendarConflict] = useState("");
  const id = context?.creator.id;
  const restore = useCallback(async () => {
    if (!id || !accountScope.isCurrent(owner)) return;
    try {
      const request = await readPending<BookingRequest>(`booking:${id}`, owner);
      accountScope.assert(owner);
      if (!mounted.current) return;
      if (request && (request.creatorId !== id || !request.id))
        throw new Error(
          "The saved request cannot be recovered. Open your appointments before booking again.",
        );
      saved.current = request;
      setPending(!!request);
      ready.current = true;
      setRecoveryFailed(false);
      setRestoring(false);
    } catch (e) {
      if (mounted.current && accountScope.isCurrent(owner)) {
        setRestoring(false);
        setRecoveryFailed(true);
        setError((e as Error).message);
      }
    }
  }, [id, owner]);
  useEffect(() => {
    mounted.current = true;
    // Restore synchronizes with asynchronous account-owned secure storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore();
    return () => {
      mounted.current = false;
    };
  }, [restore]);
  const submit = async (draft?: BookingDraft) => {
    if (
      !context ||
      !ready.current ||
      latch.current ||
      !accountScope.isCurrent(owner)
    )
      return;
    latch.current = true;
    setBusy(true);
    setError("");
    try {
      const request =
        saved.current ||
        (draft ? requestFromDraft(Crypto.randomUUID(), context, draft) : null);
      if (!request) throw new Error("Choose a service, date and time first.");
      saved.current = request;
      setPending(true);
      await writePending(`booking:${id}`, request, owner);
      accountScope.assert(owner);
      const { booking } = await api<{ booking: Booking }>(
        "/mobile/request-booking",
        request,
      );
      accountScope.assert(owner);
      await writePending(`booking:${id}`, null, owner);
      accountScope.assert(owner);
      saved.current = null;
      if (mounted.current) {
        setPending(false);
        onSuccess(booking);
      }
    } catch (e) {
      if (accountScope.isCurrent(owner) && mounted.current) {
        if (
          e instanceof ApiError &&
          ["CLIENT_CALENDAR_CONFLICT", "CLIENT_CALENDAR_UNCHECKED"].includes(
            e.code || "",
          )
        )
          setCalendarConflict(
            saved.current
              ? `${saved.current.date}:${saved.current.start.slice(0, 5)}`
              : "",
          );
        if (e instanceof ApiError && [400, 409].includes(e.status)) {
          try {
            await writePending(`booking:${id}`, null, owner);
            accountScope.assert(owner);
            saved.current = null;
            if (mounted.current) setPending(false);
          } catch (storageError) {
            if (mounted.current && accountScope.isCurrent(owner))
              setError((storageError as Error).message);
            return;
          }
        }
        if (mounted.current && accountScope.isCurrent(owner))
          setError((e as Error).message);
      }
    } finally {
      latch.current = false;
      if (mounted.current && accountScope.isCurrent(owner)) setBusy(false);
    }
  };
  return {
    submit,
    calendarConflict,
    pending: pending || recoveryFailed,
    restoring,
    busy,
    error,
    recover: () => {
      if (ready.current) return submit();
      setRestoring(true);
      setError("");
      return restore();
    },
  };
}
