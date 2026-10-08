import { CalendarInvite } from "../calendar/calendar-view";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { calendarDay, monthCells, moveMonth } from "../../lib/calendar";
import { useCurrentTime } from "../../lib/clock";
import { money } from "../../lib/money";
import type { Slot } from "../../lib/types";
import { LabSheet } from "../lab-ui/primitives";
import {
  bookingPolicy,
  dateLabel,
  durationLabel,
  timeLabel,
  type BookingContext,
  type BookingDraft,
} from "./model";
import {
  BookingButton,
  BookingNotice,
  BookingShell,
  SummaryRow,
  bookingAssets,
  s,
} from "./primitives";
export type ReferenceDesign = { id: string; title: string; image?: string };
export type BookingFormProps = {
  context: BookingContext;
  width?: number;
  initialServiceId?: string;
  initialDesignId?: string;
  initialStep?: number;
  loadSlots: (serviceId: string, date: string) => Promise<Slot[]>;
  loadMonth: (
    serviceId: string,
    month: string,
  ) => Promise<Record<string, boolean>>;
  loadReferences?: () => Promise<ReferenceDesign[]>;
  onBack: () => void;
  onSubmit: (draft: BookingDraft) => void;
  busy?: boolean;
  error?: string;
  recovery?: boolean;
  recovering?: boolean;
  onRecover?: () => void;
  rescheduled?: boolean;
  proposing?: boolean;
  onCalendarConnect?: () => void;
  calendarConflict?: string;
};
export function BookingFormView(p: BookingFormProps) {
  const now = useCurrentTime(),
    today = calendarDay(now, p.context.timeZone);
  const [step, setStep] = useState(p.initialStep || 0),
    [serviceId, setServiceId] = useState(p.initialServiceId || ""),
    [date, setDate] = useState(""),
    [slot, setSlot] = useState<Slot | null>(null),
    [notes, setNotes] = useState("");
  const [month, setMonth] = useState(today.slice(0, 7)),
    [retry, setRetry] = useState(0),
    [dayResult, setDayResult] = useState<{
      key: string;
      value: Record<string, boolean>;
      error: string;
    }>({ key: "", value: {}, error: "" }),
    [slotResult, setSlotResult] = useState<{
      key: string;
      value: Slot[];
      error: string;
    }>({ key: "", value: [], error: "" });
  const dayKey = `${serviceId}:${month}:${step}:${retry}`;
  const slotKey = `${serviceId}:${date}:${step}:${retry}`;
  const daysBusy = step === 1 && dayResult.key !== dayKey;
  const days = dayResult.key === dayKey ? dayResult.value : {};
  const daysError = dayResult.key === dayKey ? dayResult.error : "";
  const slotsBusy = step >= 2 && slotResult.key !== slotKey;
  const slots = slotResult.key === slotKey ? slotResult.value : [];
  const slotsError = slotResult.key === slotKey ? slotResult.error : "";
  const { loadMonth, loadSlots } = p;
  const [designId, setDesignId] = useState(p.initialDesignId),
    [references, setReferences] = useState<ReferenceDesign[]>([]),
    [refsOpen, setRefsOpen] = useState(false),
    [refsBusy, setRefsBusy] = useState(false),
    [refsError, setRefsError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const service = p.context.services.find((v) => v.id === serviceId);
  useEffect(() => {
    if (!serviceId || step !== 1) return;
    let active = true;
    loadMonth(serviceId, month)
      .then((value) => {
        if (active) setDayResult({ key: dayKey, value, error: "" });
      })
      .catch((e) => {
        if (active) setDayResult({ key: dayKey, value: {}, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [serviceId, month, step, loadMonth, dayKey]);
  useEffect(() => {
    if (!serviceId || !date || step < 2) return;
    let active = true;
    loadSlots(serviceId, date)
      .then((value) => {
        if (active) {
          setSlotResult({ key: slotKey, value, error: "" });
          setSlot((old) =>
            old
              ? value.find(
                  (s) => s.available && s.starts_at === old.starts_at,
                ) || null
              : null,
          );
        }
      })
      .catch((e) => {
        if (active) {
          setSlotResult({ key: slotKey, value: [], error: e.message });
          setSlot(null);
        }
      });
    return () => {
      active = false;
    };
  }, [serviceId, date, step, loadSlots, slotKey]);
  const [calendarAcknowledgement, setCalendarAcknowledgement] = useState("");
  const conflictKey = slot ? `${date}:${slot.start_time.slice(0, 5)}` : "";
  const needsCalendarAcknowledgement =
    !!slot &&
    (slot.client_calendar_conflict ||
      slot.client_calendar_state === "unavailable" ||
      (!!p.calendarConflict && p.calendarConflict === conflictKey));
  const calendarAcknowledged =
    !needsCalendarAcknowledgement || calendarAcknowledgement === conflictKey;
  const validSlot =
    !!slot &&
    slot.available &&
    Date.parse(slot.starts_at) > now &&
    slots.some((v) => v.available && v.starts_at === slot.starts_at);
  const validDate = date >= today && days[date] === true;
  const next = () => {
    if (!service || p.busy || p.recovering || p.recovery) return;
    if (step === 0) setStep(1);
    if (step === 1 && validDate) setStep(2);
    if (step === 2 && validSlot) setStep(3);
    if (step === 3 && validSlot && p.context.location && calendarAcknowledged)
      p.onSubmit({
        service,
        date,
        slot: slot!,
        notes,
        designId,
        ...(needsCalendarAcknowledgement && calendarAcknowledged
          ? { allowCalendarConflict: true }
          : {}),
      });
  };
  const openReferences = async () => {
    setRefsOpen(true);
    setRefsBusy(true);
    setRefsError("");
    try {
      const items = await p.loadReferences?.();
      if (mounted.current) setReferences(items || []);
    } catch (e) {
      if (mounted.current) setRefsError((e as Error).message);
    } finally {
      if (mounted.current) setRefsBusy(false);
    }
  };
  const disabled =
    !service ||
    !!p.recovery ||
    !!p.recovering ||
    (step === 1 && (!validDate || daysBusy)) ||
    (step >= 2 && (!validSlot || slotsBusy || !!slotsError)) ||
    (step === 3 && (!p.context.location || !calendarAcknowledged));
  return (
    <>
      <BookingShell
        width={p.width}
        name={p.context.creator.name}
        title={p.proposing ? "Request a new time" : "Book appointment"}
        step={step}
        busy={p.busy}
        onBack={() =>
          step > (p.proposing ? 1 : 0) ? setStep(step - 1) : p.onBack()
        }
        footer={
          <>
            <BookingButton
              plain={step < 3}
              title={
                step < 3
                  ? "Continue"
                  : p.proposing
                    ? "Review message in chat"
                    : "Send booking request ✦"
              }
              disabled={disabled}
              busy={p.busy}
              onPress={next}
            />
            {step === 3 && (
              <Text style={[s.notice, { textAlign: "center" }]}>
                {p.proposing
                  ? "The current appointment stays unchanged until the client agrees and rebooks."
                  : `This is a request — ${p.context.creator.name} will confirm or decline.`}
              </Text>
            )}
          </>
        }
      >
        {p.onCalendarConnect && step === 0 && (
          <CalendarInvite onPress={p.onCalendarConnect} />
        )}
        {p.rescheduled && (
          <BookingNotice text="Your previous booking was cancelled. Its refund and any new deposit are separate transactions." />
        )}
        {p.recovering && (
          <BookingNotice text="Checking for an unfinished booking request…" />
        )}
        {p.recovery && (
          <View style={s.card}>
            <BookingNotice text="An earlier request may have reached the server. Recover it before making another booking." />
            <BookingButton
              title="Recover booking request"
              disabled={p.recovering}
              busy={p.busy}
              onPress={() => p.onRecover?.()}
            />
          </View>
        )}
        {!!p.error && <BookingNotice text={p.error} error />}
        {step === 0 && (
          <>
            <Text accessibilityRole="header" style={s.title}>
              Choose a service
            </Text>
            {!p.context.services.length && (
              <BookingNotice text="This artist has no services available for booking yet." />
            )}
            <View style={{ gap: 12 }}>
              {p.context.services.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.name}, ${durationLabel(item.duration_minutes)}, ${money(item.price)}`}
                  accessibilityState={{ checked: serviceId === item.id }}
                  onPress={() => {
                    setServiceId(item.id);
                    setDate("");
                    setSlot(null);
                  }}
                  style={[
                    s.card,
                    s.row,
                    { minHeight: 54, paddingVertical: 8 },
                    serviceId === item.id && s.selected,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.text, { fontSize: 16 }]}>{item.name}</Text>
                    <Text style={s.muted}>
                      {durationLabel(item.duration_minutes)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.value,
                      { flex: 0 },
                      serviceId === item.id && s.pink,
                    ]}
                  >
                    {money(item.price)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {step === 1 && (
          <>
            <View style={{ gap: 4 }}>
              <Text accessibilityRole="header" style={s.title}>
                Pick a date
              </Text>
              <Text style={s.muted}>
                Dates with working hours are highlighted
              </Text>
            </View>
            <View style={[s.card, { borderRadius: 16 }]}>
              <View style={s.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  disabled={month <= today.slice(0, 7)}
                  style={s.touch}
                  onPress={() => {
                    setMonth(moveMonth(month, -1));
                    setDate("");
                    setSlot(null);
                  }}
                >
                  <Text style={s.muted}>‹</Text>
                </Pressable>
                <Text style={[s.text, { fontSize: 16 }]}>
                  {new Intl.DateTimeFormat("en", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${month}-01T12:00:00Z`))}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  style={s.touch}
                  onPress={() => {
                    setMonth(moveMonth(month, 1));
                    setDate("");
                    setSlot(null);
                  }}
                >
                  <Text style={s.muted}>›</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <Text
                    key={d}
                    style={[
                      s.muted,
                      {
                        width: "14.285%",
                        textAlign: "center",
                        fontSize: 12,
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {d}
                  </Text>
                ))}
                {monthCells(month).map((d, i) =>
                  d ? (
                    <Pressable
                      key={d}
                      accessibilityRole="button"
                      accessibilityLabel={d}
                      accessibilityState={{
                        selected: date === d,
                        disabled: d < today || !days[d] || daysBusy,
                      }}
                      disabled={d < today || !days[d] || daysBusy}
                      onPress={() => {
                        setDate(d);
                        setSlot(null);
                      }}
                      style={{
                        width: "14.285%",
                        minHeight: 44,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={[
                          {
                            minWidth: 32,
                            minHeight: 32,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: "transparent",
                          },
                          date === d && s.selected,
                        ]}
                      >
                        <Text
                          style={[
                            s.text,
                            { opacity: d < today || !days[d] ? 0.25 : 1 },
                            date === d && { fontWeight: "700" },
                          ]}
                        >
                          {Number(d.slice(-2))}
                        </Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View
                      key={`empty-${i}`}
                      style={{ width: "14.285%", minHeight: 44 }}
                    />
                  ),
                )}
              </View>
            </View>
            {daysBusy && (
              <ActivityIndicator
                accessibilityLabel="Loading available dates"
                color="#ff517f"
              />
            )}
            {!!daysError && (
              <>
                <BookingNotice error text={daysError} />
                <BookingButton
                  title="Retry dates"
                  secondary
                  onPress={() => setRetry((v) => v + 1)}
                />
              </>
            )}
            {!daysBusy && !daysError && !Object.values(days).some(Boolean) && (
              <BookingNotice text="No available dates this month. Try the next month." />
            )}
            {!!date && (
              <Text
                style={[
                  s.value,
                  s.pink,
                  { flex: 0, textAlign: "center", paddingVertical: 8 },
                ]}
              >
                {dateLabel(date, true)}
              </Text>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <View style={{ gap: 4 }}>
              <Text accessibilityRole="header" style={s.title}>
                Pick a time
              </Text>
              <Text style={s.muted}>
                {dateLabel(date)} · {service?.name} (
                {durationLabel(service?.duration_minutes || 0)})
              </Text>
            </View>
            {slotsBusy && (
              <ActivityIndicator
                accessibilityLabel="Loading available times"
                color="#ff517f"
              />
            )}
            {slotsError ? (
              <>
                <BookingNotice text={slotsError} error />
                <BookingButton
                  title="Retry times"
                  secondary
                  onPress={() => setRetry((v) => v + 1)}
                />
              </>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  rowGap: 10,
                }}
              >
                {slots
                  .filter((v) => v.available && Date.parse(v.starts_at) > now)
                  .map((v) => (
                    <Pressable
                      key={v.starts_at}
                      accessibilityRole="radio"
                      accessibilityLabel={`${timeLabel(v.start_time)}${v.client_calendar_conflict ? ", busy in your Google Calendar" : ""}`}
                      accessibilityState={{
                        checked: slot?.starts_at === v.starts_at,
                      }}
                      onPress={() => {
                        setSlot(v);
                        setCalendarAcknowledgement("");
                      }}
                      style={[
                        s.slot,
                        slot?.starts_at === v.starts_at && s.selected,
                      ]}
                    >
                      <Text style={s.text}>
                        {timeLabel(v.start_time)}
                        {v.client_calendar_conflict ? " · Busy for you" : ""}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            )}
            {!slotsBusy &&
              !slotsError &&
              !slots.some(
                (v) => v.available && Date.parse(v.starts_at) > now,
              ) && (
                <BookingNotice text="No times remain on this date. Go back and choose another date." />
              )}
          </>
        )}
        {step === 3 && service && (
          <>
            <View style={{ gap: 4 }}>
              <Text accessibilityRole="header" style={s.title}>
                {p.proposing ? "Review new time" : "Review your booking"}
              </Text>
              <Text style={s.muted}>Review and confirm your request.</Text>
            </View>
            <View style={s.card}>
              <SummaryRow label="Service" value={service.name} />
              <SummaryRow label="Date" value={dateLabel(date)} pink />
              <SummaryRow
                label="Time"
                value={
                  slot
                    ? `${timeLabel(slot.start_time)} – ${timeLabel(slot.end_time)}`
                    : "Time no longer available"
                }
                pink
              />
              <SummaryRow
                label="Duration"
                value={durationLabel(service.duration_minutes)}
              />
              <SummaryRow label="Price" value={money(service.price)} pink />
              <SummaryRow
                label="Deposit after approval"
                value={money(service.deposit_amount)}
              />
              <SummaryRow
                label="Remaining balance"
                value={money(
                  Number(service.price) - Number(service.deposit_amount),
                )}
              />
              <SummaryRow
                label="Location"
                value={p.context.location || "Not provided"}
                last
              />
            </View>
            {!validSlot && !slotsBusy && (
              <BookingNotice
                text="This time is no longer available. Go back and choose a new time."
                error
              />
            )}
            {!p.proposing && (
              <View style={{ gap: 8 }}>
                <Text style={s.label}>NOTE TO ARTIST (OPTIONAL)</Text>
                <TextInput
                  accessibilityLabel="Note to artist"
                  placeholder="Tell the artist about the design you want…"
                  placeholderTextColor="rgba(255,255,255,.35)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={1000}
                  style={s.field}
                />
              </View>
            )}
            {p.loadReferences && !p.proposing && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Attach a reference design"
                onPress={() => void openReferences()}
                style={s.link}
              >
                <Image
                  source={bookingAssets.attach}
                  style={{ width: 16, height: 16 }}
                />
                <Text style={[s.text, s.pink]}>
                  {designId
                    ? "Reference design attached · Change"
                    : "Attach a reference design"}
                </Text>
              </Pressable>
            )}
            <BookingNotice text={bookingPolicy} />
          </>
        )}
        {step >= 2 && needsCalendarAcknowledgement && (
          <View style={s.card}>
            <BookingNotice
              error
              text={
                slot?.client_calendar_conflict
                  ? "You have another Google Calendar event at this time. Choose another slot to avoid an overlap."
                  : "Your calendar reported an overlap or could not be checked. Reconnect or refresh before continuing."
              }
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="I understand and want to book this time anyway"
              accessibilityState={{
                checked: calendarAcknowledgement === conflictKey,
              }}
              onPress={() =>
                setCalendarAcknowledgement(
                  calendarAcknowledgement === conflictKey ? "" : conflictKey,
                )
              }
              style={[s.row, { minHeight: 48 }]}
            >
              <Text style={s.text}>
                {calendarAcknowledgement === conflictKey ? "✓" : "○"}
              </Text>
              <Text style={[s.text, { flex: 1 }]}>
                I understand and want to book this time anyway
              </Text>
            </Pressable>
          </View>
        )}
        {step >= 2 && p.onCalendarConnect && (
          <BookingButton
            title={
              slot?.client_calendar_state === "checked"
                ? "Manage Google Calendar"
                : "Connect Google Calendar"
            }
            secondary
            onPress={p.onCalendarConnect}
          />
        )}
        {step > 0 && (
          <BookingNotice
            text={`All dates and times are in ${p.context.timeZone} (artist’s local time).`}
          />
        )}
      </BookingShell>
      <LabSheet
        visible={refsOpen}
        title="Reference design"
        onClose={() => setRefsOpen(false)}
      >
        {refsBusy && <ActivityIndicator color="#ff517f" />}
        {!!refsError && <BookingNotice text={refsError} error />}
        {!refsBusy && !refsError && !references.length && (
          <BookingNotice text="No saved or published designs yet. Save a design first, then attach it here." />
        )}
        {references.map((d) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Attach ${d.title}`}
            key={d.id}
            onPress={() => {
              setDesignId(d.id);
              setRefsOpen(false);
            }}
            style={[s.card, s.row]}
          >
            {!!d.image && (
              <Image
                source={{ uri: d.image }}
                style={{ width: 48, height: 56, borderRadius: 8 }}
              />
            )}
            <Text style={[s.text, { flex: 1 }]}>{d.title}</Text>
          </Pressable>
        ))}
        {designId && (
          <BookingButton
            title="Remove reference"
            secondary
            onPress={() => {
              setDesignId(undefined);
              setRefsOpen(false);
            }}
          />
        )}
      </LabSheet>
    </>
  );
}
