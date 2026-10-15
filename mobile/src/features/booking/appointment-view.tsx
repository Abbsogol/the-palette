import { CalendarInvite } from "../calendar/calendar-view";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { money } from "../../lib/money";
import type { Booking } from "../../lib/types";
import { useCurrentTime } from "../../lib/clock";
import { LabSheet } from "../lab-ui/primitives";
import {
  bookingPolicy,
  canManage,
  canPayDeposit,
  dateLabel,
  durationLabel,
  paymentLabels,
  timeLabel,
} from "./model";
import {
  BookingButton,
  BookingNotice,
  BookingShell,
  SummaryRow,
  bookingAssets,
  s,
} from "./primitives";
export type AppointmentAction =
  | "confirm"
  | "decline"
  | "cancel"
  | "reschedule"
  | "propose"
  | "pay"
  | "refresh"
  | "chat"
  | "calendar"
  | "connect-calendar"
  | "design";
export function AppointmentView({
  booking: b,
  artist,
  client,
  userId,
  paymentStatus,
  paymentError,
  busy,
  error,
  width,
  onBack,
  onAction,
  initialManage = false,
  previewControls,
  simulated = false,
}: {
  booking: Booking;
  artist: string;
  client: string;
  userId: string;
  paymentStatus?: string;
  paymentError?: string;
  busy?: boolean;
  error?: string;
  width?: number;
  onBack: () => void;
  onAction: (action: AppointmentAction) => void;
  initialManage?: boolean;
  previewControls?: React.ReactNode;
  simulated?: boolean;
}) {
  const [view, setView] = useState<"status" | "details" | "payment">(
      initialManage ? "details" : "status",
    ),
    [manage, setManage] = useState(initialManage),
    [confirmation, setConfirmation] = useState<
      "cancel" | "reschedule" | "decline" | null
    >(null);
  const creator = b.creator_id === userId,
    now = useCurrentTime(),
    manageable = canManage(b, userId, now),
    payable = canPayDeposit(
      b,
      userId,
      paymentError ? undefined : paymentStatus,
      now,
    );
  const sent = b.status === "pending" && !creator && view === "status",
    confirmed = b.status === "confirmed";
  const paid = !paymentError && paymentStatus === "fulfilled";
  const total = b.price_snapshot,
    deposit = b.deposit_snapshot ?? b.services?.deposit_amount ?? 0;
  const title =
    view === "payment"
      ? "Appointment deposit"
      : creator
        ? "Appointment"
        : "Book appointment";
  const rows = (
    <View style={s.card}>
      <SummaryRow
        label={creator ? "Client" : "Artist"}
        value={creator ? client : artist}
      />
      <SummaryRow label="Service" value={b.services?.name || "Appointment"} />
      <SummaryRow label="Date" value={dateLabel(b.booking_date, true)} />
      <SummaryRow
        label="Time"
        value={`${timeLabel(b.start_time)} – ${timeLabel(b.end_time)}`}
      />
      <SummaryRow label="Time zone" value={b.time_zone || "Not recorded"} />
      {b.services && (
        <SummaryRow
          label="Duration"
          value={durationLabel(
            b.starts_at && b.ends_at
              ? (Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000
              : b.services.duration_minutes,
          )}
        />
      )}
      <SummaryRow
        label="Price"
        value={total == null ? "Confirm original price" : money(total)}
        pink
      />
      <SummaryRow label="Deposit" value={money(deposit)} />
      <SummaryRow
        label="Balance after deposit"
        value={
          total == null
            ? "Confirm original price"
            : money(Math.max(0, total - deposit))
        }
      />
      <SummaryRow
        label="Location"
        value={b.location_snapshot || "Confirm with artist"}
      />
      <SummaryRow
        label="Ref"
        value={`#${b.id.slice(0, 8).toUpperCase()}`}
        last
      />
    </View>
  );
  const action = (a: AppointmentAction) => {
    if (!busy) onAction(a);
  };
  return (
    <>
      <BookingShell
        width={width}
        name={creator ? client : artist}
        title={title}
        centered={sent}
        onBack={() => (view === "payment" ? setView("status") : onBack())}
        busy={busy}
        footer={
          <>
            {view === "payment" ? (
              <>
                <BookingButton
                  title={
                    paid
                      ? "Deposit received"
                      : `${simulated ? "Simulate" : "Pay"} ${money(deposit)} deposit`
                  }
                  disabled={!payable}
                  busy={busy}
                  onPress={() => action("pay")}
                />
                <BookingButton
                  title="Check payment status"
                  secondary
                  disabled={busy}
                  onPress={() => action("refresh")}
                />
                <BookingNotice
                  text={
                    simulated
                      ? "Preview payment only. No card is collected and no money is charged."
                      : "Secure checkout opens in your browser. We verify payment on the server before showing it as received."
                  }
                />
              </>
            ) : (
              <>
                {creator && b.status === "pending" && manageable ? (
                  <>
                    <BookingButton
                      title="Accept request"
                      busy={busy}
                      onPress={() => action("confirm")}
                    />
                    <BookingButton
                      title="Decline request"
                      secondary
                      disabled={busy}
                      onPress={() => setConfirmation("decline")}
                    />
                  </>
                ) : (
                  <BookingButton
                    title={
                      sent
                        ? "Back to chat"
                        : confirmed
                          ? "Manage appointment"
                          : "Back to chat"
                    }
                    disabled={busy}
                    onPress={() =>
                      sent || !confirmed ? action("chat") : setManage(true)
                    }
                  />
                )}
                {(sent || confirmed || (creator && b.status === "pending")) && (
                  <BookingButton
                    title={sent ? "View request" : "Back to chat"}
                    secondary
                    disabled={busy}
                    onPress={() => (sent ? setView("details") : action("chat"))}
                  />
                )}
                {payable && (
                  <BookingButton
                    title="Pay appointment deposit"
                    disabled={busy}
                    secondary
                    onPress={() => setView("payment")}
                  />
                )}
                {!sent && b.status === "pending" && !creator && manageable && (
                  <BookingButton
                    title="Manage request"
                    secondary
                    disabled={busy}
                    onPress={() => setManage(true)}
                  />
                )}
                {previewControls}
              </>
            )}
          </>
        }
      >
        {simulated && <BookingNotice text="Demo booking · sample data only" />}
        {!!error && <BookingNotice error text={error} />}
        {view === "payment" ? (
          <>
            <Text accessibilityRole="header" style={s.title}>
              {paid ? "Your deposit is received" : "Your appointment, secured"}
            </Text>
            <Text style={s.muted}>
              {paid
                ? "No further deposit is due for this appointment."
                : "Pay the deposit for your confirmed appointment."}
            </Text>
            <View
              style={[s.card, { alignItems: "center", paddingVertical: 24 }]}
            >
              <Text style={s.label}>
                {paid ? "PAID" : payable ? "DUE NOW" : "DEPOSIT"}
              </Text>
              <Text style={[s.headline, { fontSize: 38, lineHeight: 46 }]}>
                {money(deposit)}
              </Text>
              <Text style={s.muted}>Appointment deposit</Text>
            </View>
            <View style={s.card}>
              <SummaryRow
                label="Service total"
                value={total == null ? "Confirm original price" : money(total)}
              />
              <SummaryRow label="Deposit today" value={money(deposit)} pink />
              <SummaryRow
                label="Pay at appointment"
                value={
                  total == null
                    ? "Confirm original price"
                    : money(Math.max(0, total - deposit))
                }
                last
              />
            </View>
            <Text style={s.text}>
              {b.services?.name} · {dateLabel(b.booking_date)} ·{" "}
              {timeLabel(b.start_time)}
            </Text>
            <BookingNotice
              text={`Time zone: ${b.time_zone}. ${bookingPolicy}`}
            />
            <BookingNotice
              text={
                paymentStatus
                  ? paymentLabels[paymentStatus] || "Payment update pending"
                  : "Verifying payment status…"
              }
            />
            {!!paymentError && <BookingNotice text={paymentError} error />}
            {!payable && !paid && (
              <BookingNotice text="Checkout is unavailable while payment is unverified, under review, refunded, or this booking is no longer payable." />
            )}
          </>
        ) : sent ? (
          <>
            <View style={s.center}>
              <View
                style={[
                  s.circle,
                  {
                    width: 72,
                    height: 72,
                    backgroundColor: "rgba(255,255,255,.04)",
                  },
                ]}
              >
                <Image
                  source={bookingAssets.sparkle}
                  style={{ width: 44, height: 44 }}
                />
              </View>
              <Text accessibilityRole="header" style={[s.headline, s.pink]}>
                Request sent!
              </Text>
            </View>
            <View style={{ gap: 8, paddingVertical: 8 }}>
              <Text style={[s.text, { textAlign: "center", fontSize: 15 }]}>
                Your appointment request has been sent to {artist}.
              </Text>
              <Text style={[s.muted, { textAlign: "center" }]}>
                We’ll notify you when {artist} confirms or declines.
              </Text>
            </View>
            <View style={[s.card, { paddingVertical: 8, borderWidth: 0 }]}>
              <Text style={[s.muted, { textAlign: "center" }]}>
                {b.services?.name} · {dateLabel(b.booking_date)} ·{" "}
                {timeLabel(b.start_time)}
              </Text>
            </View>
            <BookingNotice text={`Awaiting artist approval · ${b.time_zone}`} />
            {Number(deposit) > 0 &&
              !b.deposit_paid &&
              paymentStatus === "pending" && (
                <BookingNotice text="Your deposit is due after the artist approves. No payment has been taken by this request." />
              )}
            <BookingButton
              title="Refresh booking status"
              plain
              disabled={busy}
              onPress={() => action("refresh")}
            />
          </>
        ) : (
          <>
            <View style={s.center}>
              {confirmed && (
                <LinearGradient
                  colors={["#a01a36", "#ff517f"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.circle}
                >
                  <Image
                    source={bookingAssets.check}
                    style={{ width: 24, height: 24 }}
                  />
                </LinearGradient>
              )}
              <Text accessibilityRole="header" style={s.headline}>
                {confirmed
                  ? "Appointment confirmed"
                  : b.status === "pending"
                    ? creator
                      ? "New booking request"
                      : "Awaiting confirmation"
                    : b.status === "cancelled"
                      ? "Appointment cancelled"
                      : "Request declined"}
              </Text>
              <Text
                style={[
                  s.text,
                  { textAlign: "center", color: "rgba(255,255,255,.7)" },
                ]}
              >
                {confirmed
                  ? creator
                    ? "You accepted this booking"
                    : `${artist} accepted your booking`
                  : b.status === "pending"
                    ? creator
                      ? `${client} would like to book with you.`
                      : `${artist} will confirm or decline.`
                    : "This appointment will not go ahead."}
              </Text>
            </View>
            {rows}
            {!!b.notes && (
              <View style={s.card}>
                <Text style={s.label}>NOTE TO ARTIST</Text>
                <Text style={s.text}>{b.notes}</Text>
              </View>
            )}
            {Number(deposit) > 0 && (
              <BookingNotice
                text={
                  paymentStatus
                    ? paymentLabels[paymentStatus] || "Payment update pending"
                    : "Verifying payment status…"
                }
              />
            )}
            {!!paymentError && <BookingNotice text={paymentError} error />}
            {confirmed && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add to calendar"
                onPress={() => action("calendar")}
                style={[s.link, { justifyContent: "center" }]}
              >
                <Image
                  source={bookingAssets.calendar}
                  style={{ width: 16, height: 16 }}
                />
                <Text style={[s.text, s.pink]}>Add to calendar</Text>
              </Pressable>
            )}
            {["pending", "confirmed"].includes(b.status) && (
              <CalendarInvite onPress={() => action("connect-calendar")} />
            )}
            {b.reference_design_id && (
              <BookingButton
                title="View reference design"
                secondary
                onPress={() => action("design")}
              />
            )}
            <BookingButton
              title="Refresh appointment & payment"
              plain
              disabled={busy}
              onPress={() => action("refresh")}
            />
            <BookingNotice text={bookingPolicy} />
          </>
        )}
      </BookingShell>
      <LabSheet
        visible={manage}
        title="Manage appointment"
        onClose={() => {
          if (!busy) setManage(false);
        }}
      >
        <Text style={s.title}>{b.services?.name}</Text>
        <Text style={s.text}>
          {dateLabel(b.booking_date)} · {timeLabel(b.start_time)} ·{" "}
          {b.time_zone}
        </Text>
        <BookingNotice text={bookingPolicy} />
        {!!error && <BookingNotice text={error} error />}
        {manageable ? (
          <>
            <BookingButton
              title="Change date or time"
              disabled={busy}
              onPress={() => {
                setManage(false);
                if (creator) action("propose");
                else setConfirmation("reschedule");
              }}
            />
            <BookingButton
              title="Cancel appointment"
              disabled={busy}
              secondary
              onPress={() => {
                setManage(false);
                setConfirmation("cancel");
              }}
            />
          </>
        ) : (
          <BookingNotice text="This appointment can no longer be changed or cancelled here." />
        )}
        <BookingButton
          title="Close"
          secondary
          disabled={busy}
          onPress={() => setManage(false)}
        />
      </LabSheet>
      <LabSheet
        visible={!!confirmation}
        title={
          confirmation === "reschedule"
            ? "Cancel and request a new time?"
            : confirmation === "decline"
              ? "Decline this request?"
              : "Cancel this appointment?"
        }
        onClose={() => {
          if (!busy) setConfirmation(null);
        }}
      >
        <BookingNotice
          text={
            confirmation === "decline"
              ? "The client will be notified. Any deposit that settles later is automatically refundable."
              : "The original appointment will be cancelled. Any paid deposit is queued for a full refund. A new booking needs artist approval and may require a separate deposit."
          }
        />
        {error && <BookingNotice error text={error} />}
        <BookingButton
          title={
            confirmation === "reschedule"
              ? "Cancel & choose new time"
              : confirmation === "decline"
                ? "Decline request"
                : "Confirm cancellation"
          }
          busy={busy}
          onPress={() => {
            const kind = confirmation;
            setConfirmation(null);
            if (kind) action(kind);
          }}
        />
        <BookingButton
          title="Keep appointment"
          secondary
          disabled={busy}
          onPress={() => setConfirmation(null)}
        />
      </LabSheet>
    </>
  );
}
