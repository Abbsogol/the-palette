import { useEffect, useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  Field,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
  money,
} from "../../components/ui";
import { useAccountQuery, queryClient } from "../../lib/auth";
import { api, checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { accountScope } from "../../lib/account-scope";
import { readPending, writePending } from "../../lib/pending";
import type { Booking, Profile, Service, Slot } from "../../lib/types";
import { Calendar } from "../../components/calendar";
type Request = {
  id: string;
  creatorId: string;
  serviceId: string;
  date: string;
  start: string;
  end: string;
  timeZone: string;
  price: number;
  deposit: number;
  location: string;
  designId?: string;
  notes: string;
};
function BookingForm() {
  const { id, designId, rescheduledFrom } = useLocalSearchParams<{
    id: string;
    designId?: string;
    rescheduledFrom?: string;
  }>();
  const [step, setStep] = useState(0),
    [service, setService] = useState<Service | null>(null),
    [date, setDate] = useState(""),
    [dateQuery, setDateQuery] = useState(""),
    [slot, setSlot] = useState<Slot | null>(null),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Request | null>(null);
  const query = useAccountQuery(["book-context", id], async () => {
    const creator = await checked<(Profile & { booking_area?: string }) | null>(
      supabase.from("profiles").select("*").eq("id", id).single(),
    );
    const services = await checked<Service[]>(
      supabase
        .from("services")
        .select("*")
        .eq("creator_id", id)
        .eq("is_active", true)
        .order("created_at"),
    );
    const zone = await checked<{ time_zone: string } | null>(
      supabase
        .from("creator_booking_settings")
        .select("time_zone")
        .eq("creator_id", id)
        .single(),
    );
    return { creator, services, zone: zone.time_zone };
  });
  const slots = useAccountQuery(
    ["available-slots", id, service?.id, dateQuery],
    () =>
      checked<Slot[]>(
        supabase.rpc("booking_available_slots", {
          p_creator_id: id,
          p_service_id: service!.id,
          p_date: dateQuery,
        }),
      ),
    !!service && !!dateQuery,
  );
  useEffect(() => {
    void readPending<Request>(`booking:${id}`)
      .then(setPending)
      .catch(() => undefined);
  }, [id]);
  const submit = async (retry = false) => {
    setBusy(true);
    setError("");
    const ticket = accountScope.capture();
    try {
      if (!retry && (!query.data || !service || !slot))
        throw new Error("Choose a service and time first.");
      const request =
        retry && pending
          ? pending
          : {
              id: Crypto.randomUUID(),
              creatorId: id,
              serviceId: service!.id,
              date: dateQuery,
              start: slot!.start_time,
              end: slot!.end_time,
              timeZone: query.data!.zone,
              price: Number(service!.price),
              deposit: Number(service!.deposit_amount),
              location:
                query.data!.creator.booking_area ||
                query.data!.creator.location ||
                "",
              designId,
              notes,
            };
      await writePending(`booking:${id}`, request, ticket);
      setPending(request);
      const { booking } = await api<{ booking: Booking }>(
        "/mobile/request-booking",
        request,
      );
      await writePending(`booking:${id}`, null, ticket);
      await queryClient.invalidateQueries();
      router.replace({ pathname: "/booking/[id]", params: { id: booking.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {rescheduledFrom && (
        <Notice>
          Your previous appointment was cancelled. Its refund and any deposit
          for this new appointment are separate transactions.
        </Notice>
      )}
      {pending && (
        <Card>
          <Notice>
            A previous request may have reached the server. Check it before
            making another request.
          </Notice>
          <Button
            title="Recover request"
            busy={busy}
            onPress={() => void submit(true)}
          />
          <Button
            title="Clear request after checking appointments"
            secondary
            disabled={busy}
            onPress={() => {
              void writePending(
                `booking:${id}`,
                null,
                accountScope.capture(),
              ).then(() => setPending(null));
            }}
          />
        </Card>
      )}
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data && (
          <>
            <Text style={styles.subtitle}>
              {query.data.creator.display_name}
            </Text>
            <Notice>
              Times shown in {query.data.zone}. Your device may use a different
              time zone.
            </Notice>
            <Text style={styles.muted}>
              {
                [
                  "Choose a service",
                  "Choose a date",
                  "Choose a time",
                  "Review request",
                ][step]
              }{" "}
              · {step + 1} of 4
            </Text>
            {step === 0 &&
              query.data.services.map((s) => (
                <Card key={s.id}>
                  <Text style={styles.subtitle}>{s.name}</Text>
                  <Notice>
                    {s.duration_minutes} min · {money(s.price)} · Deposit{" "}
                    {money(s.deposit_amount)}
                  </Notice>
                  <Button
                    title="Choose service"
                    onPress={() => {
                      setService(s);
                      setSlot(null);
                      setStep(1);
                    }}
                  />
                </Card>
              ))}
            {step === 0 && !query.data.services.length && (
              <Notice>This creator has no bookable services yet.</Notice>
            )}
            {step === 1 && (
              <>
                <Calendar
                  timeZone={query.data.zone}
                  value={date}
                  onChange={setDate}
                />
                <Button
                  title="Find available times"
                  onPress={() => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                      setError("Use YYYY-MM-DD.");
                      return;
                    }
                    setError("");
                    setDateQuery(date);
                    setSlot(null);
                    setStep(2);
                  }}
                />
              </>
            )}
            {step === 2 && (
              <QueryState
                loading={slots.isPending}
                error={slots.error}
                empty={!slots.data?.some((s) => s.available)}
                retry={() => void slots.refetch()}
              >
                {slots.data
                  ?.filter((s) => s.available)
                  .map((s) => (
                    <Button
                      key={s.starts_at}
                      title={`${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`}
                      secondary
                      onPress={() => {
                        setSlot(s);
                        setStep(3);
                      }}
                    />
                  ))}
              </QueryState>
            )}
            {step === 3 && service && slot && (
              <Card>
                <Text style={styles.subtitle}>{service.name}</Text>
                <Notice>
                  {dateQuery} · {slot.start_time.slice(0, 5)}–
                  {slot.end_time.slice(0, 5)} · {query.data.zone}
                </Notice>
                <Notice>
                  Location:{" "}
                  {query.data.creator.booking_area ||
                    query.data.creator.location ||
                    "Not provided — contact this creator before booking."}
                </Notice>
                <Notice>Total {money(service.price)}</Notice>
                <Notice>Deposit {money(service.deposit_amount)}</Notice>
                <Notice>
                  Remaining balance{" "}
                  {money(
                    Number(service.price) - Number(service.deposit_amount),
                  )}
                </Notice>
                <Notice>
                  This is a booking request. The creator must accept it.
                  Pre-appointment cancellation receives a full deposit refund.
                  To reschedule, cancel and request a new appointment.
                </Notice>
                <Field
                  label="Note to creator"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={1000}
                />
                <Button
                  title="Request appointment"
                  busy={busy}
                  disabled={
                    !!pending ||
                    !(
                      query.data.creator.booking_area ||
                      query.data.creator.location
                    )
                  }
                  onPress={() => void submit()}
                />
              </Card>
            )}
            {step > 0 && (
              <Button
                title="Previous step"
                secondary
                disabled={busy}
                onPress={() => setStep(step - 1)}
              />
            )}
          </>
        )}
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function BookScreen() {
  return (
    <Screen title="Book with a creator" back>
      <RequireAuth>
        <BookingForm />
      </RequireAuth>
    </Screen>
  );
}
