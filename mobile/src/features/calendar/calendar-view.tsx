import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  LabShell,
  LabButton,
  LabMessage,
  LabSheet,
} from "../lab-ui/primitives";
import { typography } from "../../theme/typography";
import { calendarExplanation, type CalendarStatus } from "./model";
export function CalendarView(p: {
  width?: number;
  state?: CalendarStatus;
  loading?: boolean;
  busy?: boolean;
  error?: string;
  notice?: string;
  preview?: boolean;
  onBack: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSave: (ids: string[]) => void;
  onSync: () => void;
  onRetry: () => void;
}) {
  const inset = useSafeAreaInsets(),
    state = p.state;
  const [selected, setSelected] = useState(
      () => state?.sources.map((s) => s.id) || [],
    ),
    [disconnect, setDisconnect] = useState(false);
  const connected = state?.status === "connected";
  const error = p.error || state?.calendarError;
  return (
    <LabShell width={p.width}>
      <View style={[s.header, { paddingTop: inset.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from Google Calendar"
          onPress={p.onBack}
          style={s.back}
        >
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={s.title}>
          Google Calendar
        </Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { paddingBottom: Math.max(inset.bottom, 24) + 28 },
        ]}
      >
        <View style={s.hero}>
          <Text style={s.symbol}>▦</Text>
          <Text accessibilityRole="header" style={s.heading}>
            Make time for your next set
          </Text>
          <Text style={s.body}>{calendarExplanation}</Text>
        </View>
        {!!p.preview && (
          <LabMessage>
            Design preview · connection and busy times are examples. Your Google
            account is not accessed.
          </LabMessage>
        )}
        {!!p.notice && <LabMessage>{p.notice}</LabMessage>}
        {!!error && (
          <>
            <LabMessage error>{error}</LabMessage>
            <LabButton
              title="Retry calendar status"
              secondary
              onPress={p.onRetry}
              disabled={p.busy}
            />
          </>
        )}
        {p.loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading calendar connection"
            color="#ff517f"
          />
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.eyebrow}>
                {connected
                  ? "CONNECTED"
                  : state?.status === "reconnect_required"
                    ? "RECONNECT NEEDED"
                    : "OPTIONAL CONNECTION"}
              </Text>
              <Text style={s.cardTitle}>
                {connected
                  ? state.accountLabel
                  : "Keep your schedules together"}
              </Text>
              <Text style={s.body}>
                {connected
                  ? "Confirmed bookings appear in your LaQue appointments calendar. Cancellations update it automatically."
                  : "Google sign-in and calendar access are separate. Choose the Google account you use for your schedule."}
              </Text>
              {!connected && (
                <LabButton
                  title={
                    state?.status === "reconnect_required"
                      ? "Reconnect Google Calendar"
                      : "Connect Google Calendar"
                  }
                  onPress={p.onConnect}
                  busy={p.busy}
                  disabled={state?.configured === false}
                />
              )}
              {state?.configured === false && (
                <LabMessage>
                  Google Calendar setup is still being completed. You can keep
                  using LaQue and connect here when it is ready.
                </LabMessage>
              )}
            </View>
            {connected && (
              <>
                <View style={s.card}>
                  <Text style={s.cardTitle}>Calendars to check</Text>
                  <Text style={s.body}>
                    Choose up to 10 calendars that contain your commitments.
                    Only busy times affect availability.
                  </Text>
                  {(state.calendars.length
                    ? state.calendars
                    : state.sources
                  ).map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Check ${c.name}`}
                      accessibilityState={{
                        checked: selected.includes(c.id),
                        disabled: p.busy,
                      }}
                      disabled={p.busy}
                      onPress={() =>
                        setSelected((current) =>
                          current.includes(c.id)
                            ? current.filter((id) => id !== c.id)
                            : current.length < 10
                              ? [...current, c.id]
                              : current,
                        )
                      }
                      style={s.calendar}
                    >
                      <Text style={s.check}>
                        {selected.includes(c.id) ? "✓" : "○"}
                      </Text>
                      <Text style={[s.body, { flex: 1 }]}>
                        {c.name}
                        {c.primary ? " · Primary" : ""}
                      </Text>
                    </Pressable>
                  ))}
                  <LabButton
                    title="Save calendars"
                    onPress={() => p.onSave(selected)}
                    disabled={
                      !selected.length ||
                      p.busy ||
                      JSON.stringify([...selected].sort()) ===
                        JSON.stringify(state.sources.map((c) => c.id).sort())
                    }
                  />
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>
                    {state.pending
                      ? "Calendar updates pending"
                      : "Appointment sync is on"}
                  </Text>
                  <Text style={s.body}>
                    {state.pending
                      ? `${state.pending} appointment update${state.pending === 1 ? "" : "s"} waiting to sync. Your LaQue booking status is still saved.`
                      : "New confirmations and cancellations will update Google Calendar. Refresh to check for pending updates."}
                  </Text>
                  {state.syncFailed && (
                    <LabMessage error>
                      Google could not be updated. Retry sync or reconnect your
                      calendar.
                    </LabMessage>
                  )}
                  <LabButton
                    title="Reconnect Google Calendar"
                    secondary
                    onPress={p.onConnect}
                    disabled={p.busy}
                  />
                  <LabButton
                    title="Sync now"
                    secondary
                    onPress={p.onSync}
                    busy={p.busy}
                  />
                </View>
              </>
            )}
            <View style={s.card}>
              <Text style={s.cardTitle}>Your plans stay private</Text>
              <Text style={s.body}>
                LaQue checks when you are busy, not personal event names,
                descriptions or guests. Your other appointments are never shown
                to the client or nail tech.
              </Text>
              <Text style={s.body}>
                Only confirmed LaQue appointments are added to a separate
                calendar. Change or cancel them in LaQue; moving the calendar
                copy does not reschedule your booking.
              </Text>
              <Text style={s.body}>
                Calendar checks help prevent overlaps. Changes made in Google
                after a check can still create a conflict.
              </Text>
            </View>
            {state?.status !== "disconnected" && !!state && (
              <LabButton
                title="Disconnect Google Calendar"
                secondary
                disabled={p.busy}
                onPress={() => setDisconnect(true)}
              />
            )}
            {!connected && (
              <LabButton
                title="Maybe later"
                secondary
                onPress={p.onBack}
                disabled={p.busy}
              />
            )}
          </>
        )}
      </ScrollView>
      <LabSheet
        visible={disconnect}
        title="Disconnect calendar?"
        onClose={() => setDisconnect(false)}
      >
        <LabMessage>
          LaQue will stop checking your schedule and syncing bookings. Existing
          Google Calendar entries stay there and will no longer update. You can
          remove them in Google Calendar.
        </LabMessage>
        <LabButton
          title="Keep connected"
          onPress={() => setDisconnect(false)}
        />
        <LabButton
          title="Disconnect"
          secondary
          onPress={() => {
            setDisconnect(false);
            p.onDisconnect();
          }}
        />
      </LabSheet>
    </LabShell>
  );
}
export function CalendarInvite({
  onPress,
  connected = false,
}: {
  onPress: () => void;
  connected?: boolean;
}) {
  return (
    <View style={s.invite}>
      <Text style={s.cardTitle}>
        {connected
          ? "Google Calendar connected"
          : "Avoid overlapping schedules"}
      </Text>
      <Text style={s.body}>
        {connected
          ? "Your selected calendars are checked for busy times. LaQue appointments sync after confirmation."
          : calendarExplanation}
      </Text>
      <LabButton
        title={connected ? "Manage Google Calendar" : "Connect Google Calendar"}
        secondary
        onPress={onPress}
      />
    </View>
  );
}
const s = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffffff30",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "white", fontSize: 32 },
  title: { ...typography.heading, color: "white", flex: 1, fontSize: 27 },
  content: { paddingHorizontal: 24, gap: 18 },
  hero: { paddingVertical: 8, gap: 12 },
  symbol: { fontSize: 42, color: "#ff7199" },
  heading: {
    ...typography.heading,
    color: "white",
    fontSize: 28,
    lineHeight: 34,
  },
  body: { ...typography.body, color: "#f1dfe5", fontSize: 14, lineHeight: 21 },
  card: {
    padding: 18,
    gap: 13,
    borderWidth: 1,
    borderColor: "#ffffff26",
    borderRadius: 22,
    backgroundColor: "#ffffff0d",
  },
  cardTitle: {
    ...typography.body,
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  eyebrow: {
    ...typography.body,
    color: "#ff92b0",
    fontSize: 11,
    letterSpacing: 1.6,
  },
  calendar: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 48,
  },
  check: { color: "#ff729c", fontSize: 22 },
  invite: {
    padding: 18,
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ffffff26",
    backgroundColor: "#ffffff0d",
  },
});
