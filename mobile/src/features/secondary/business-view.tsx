import { ActivityIndicator, Text, View } from "react-native";
import { Button, Card, Row, Section, Notice, styles } from "./primitives";
import type { CreatorSetup, SetupDestination } from "../creator-setup/model";
export type BusinessDestination =
  SetupDestination | "calendar-connect" | "appointments";
const fallback = [
  {
    id: "profile-edit" as const,
    title: "Profile & service location",
    detail: "Add your name, unique @ID, city and service location.",
  },
  {
    id: "services" as const,
    title: "Services & deposits",
    detail: "Set fixed prices, duration and deposits.",
  },
  {
    id: "availability" as const,
    title: "Hours & time zone",
    detail: "Save open days and choose your local time zone.",
  },
  {
    id: "portfolio" as const,
    title: "Publish your portfolio",
    detail: "Publish a design so clients can discover your work.",
  },
];
export function BusinessView({
  creator,
  onStart,
  onOpen,
  busy,
  error,
  setup,
  checking,
  checkError,
  onRefresh,
}: {
  creator: boolean;
  onStart?: () => void;
  onOpen: (route: BusinessDestination) => void;
  busy?: boolean;
  error?: string;
  setup?: CreatorSetup;
  checking?: boolean;
  checkError?: string;
  onRefresh?: () => void;
}) {
  const verified = creator && !!setup && !checking && !checkError;
  const ready = verified && setup.ready;
  return (
    <>
      <Card>
        <Text style={styles.tag}>
          {ready ? "READY TO TAKE BOOKINGS" : "YOUR CREATOR SPACE"}
        </Text>
        <Text style={styles.heading}>
          {ready
            ? "Ready for your\nnext client."
            : creator
              ? "Get ready to\ntake bookings."
              : "Turn your art\ninto appointments."}
        </Text>
        <Text style={styles.muted}>
          {ready
            ? "Your studio essentials are complete. Clients can request available appointments, and you review each request."
            : "Set up your profile, services, schedule and portfolio. Your progress updates when you return from each step."}
        </Text>
        {!creator && (
          <Button
            title="Set up my creator account"
            onPress={() => onStart?.()}
            busy={busy}
          />
        )}
        {!!error && <Notice error>{error}</Notice>}
        {creator && (
          <>
            {checking && (
              <View
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                <ActivityIndicator color="#ff8dae" />
                <Text style={styles.small}>Checking your studio…</Text>
              </View>
            )}
            {!!checkError && <Notice error>{checkError}</Notice>}
            {verified && (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.tag}>
                  {setup.completed} OF 4 COMPLETE
                </Text>
                <View
                  accessibilityLabel={`${setup.completed} of 4 setup steps complete`}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#ffffff20",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      width: `${setup.completed * 25}%`,
                      backgroundColor: "#ff517f",
                    }}
                  />
                </View>
                {(ready || setup.next) && (
                  <Button
                    title={
                      ready ? "View appointment requests" : "Continue setup"
                    }
                    onPress={() =>
                      onOpen(ready ? "appointments" : setup.next!.id)
                    }
                  />
                )}
              </>
            )}
            {!!onRefresh && (
              <Button
                title={checkError ? "Retry setup check" : "Refresh setup"}
                secondary
                busy={checking}
                onPress={onRefresh}
              />
            )}
          </>
        )}
      </Card>
      <Section
        title="Your setup checklist"
        subtitle={
          creator
            ? "Complete each step, then come back to check your progress."
            : "Activate your creator account to unlock your business tools."
        }
      >
        {(setup?.steps || fallback).map((step, index) => (
          <Card key={step.id}>
            <Row
              disabled={busy || (!creator && step.id !== "profile-edit")}
              title={`${String(index + 1).padStart(2, "0")}  ${step.title}`}
              detail={step.detail}
              badge={
                verified
                  ? "done" in step && step.done
                    ? "Done"
                    : "To do"
                  : creator
                    ? "Check"
                    : step.id === "profile-edit"
                      ? "To do"
                      : "Locked"
              }
              onPress={() => onOpen(step.id)}
            />
          </Card>
        ))}
      </Section>
      {ready && (
        <Notice>
          Setup complete. Booking times still depend on your availability,
          existing appointments and connected calendar.
        </Notice>
      )}
      <Section title="Day to day">
        <Card>
          <Row
            title="Appointments"
            detail="Requests, upcoming visits and booking history"
            onPress={() => onOpen("appointments")}
          />
          <Row
            title="Google Calendar"
            detail="Optional: connect to help prevent overlapping appointments."
            onPress={() => onOpen("calendar-connect")}
          />
        </Card>
      </Section>
    </>
  );
}
