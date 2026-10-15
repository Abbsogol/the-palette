import { useEffect, useState } from "react";
import { Platform, Switch, Text, View } from "react-native";
import { accountScope } from "../../lib/account-scope";
import { LabSheet } from "../lab-ui/primitives";
import { CalendarInvite } from "../calendar/calendar-view";
import { Button, Card, Field, Notice, styles } from "./primitives";
import { type DraftStatus } from "./profile-exit";
import { useSubmission } from "./use-submission";
import {
  dayNames,
  hoursPayload,
  validRange,
  validZone,
  weekDays,
} from "./hours-model";
import { TimeControl, TimeSelector } from "./time-selector";
export type Day = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};
export function Schedule({
  initial,
  zone,
  onSave,
  onCalendar,
  onStatusChange,
}: {
  initial: Day[];
  zone: string;
  onSave: (zone: string, days: Day[]) => Promise<void>;
  onCalendar?: () => void;
  onStatusChange?: (status: DraftStatus) => void;
}) {
  const [days, setDays] = useState(() => weekDays(initial)),
    [timeZone, setTimeZone] = useState(zone);
  const snapshot = JSON.stringify({ days, timeZone });
  const [baseline, setBaseline] = useState(snapshot),
    [notice, setNotice] = useState(""),
    [showErrors, setShowErrors] = useState(false);
  const [choosingZone, setChoosingZone] = useState(false),
    [search, setSearch] = useState(""),
    [zoneError, setZoneError] = useState("");
  const [choosingTime, setChoosingTime] = useState<{
    day: number;
    field: "start_time" | "end_time";
  } | null>(null);
  const submit = useSubmission(),
    dirty = snapshot !== baseline;
  useEffect(() => {
    onStatusChange?.({ dirty, busy: submit.busy });
  }, [dirty, submit.busy, onStatusChange]);
  useEffect(
    () => () => onStatusChange?.({ dirty: false, busy: false }),
    [onStatusChange],
  );
  const suggested =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [
          "Asia/Dubai",
          "Europe/London",
          "America/New_York",
          "America/Los_Angeles",
          "Asia/Tokyo",
        ];
  const zones = [...new Set(["UTC", timeZone, ...suggested])]
    .filter(Boolean)
    .filter((z) =>
      z
        .toLowerCase()
        .replaceAll("_", " ")
        .includes(search.trim().toLowerCase().replaceAll("_", " ")),
    )
    .slice(0, 12);
  const change = (i: number, fields: Partial<Day>) => {
    setNotice("");
    setDays((current) =>
      current.map((d) => (d.day_of_week === i ? { ...d, ...fields } : d)),
    );
  };
  const chooseZone = (z: string) => {
    const value = z.trim();
    if (!validZone(value)) {
      setZoneError("Enter a valid IANA time zone, such as Asia/Dubai.");
      return;
    }
    setTimeZone(value);
    setNotice("");
    setZoneError("");
    setChoosingZone(false);
  };
  const save = () =>
    void submit.run(async () => {
      setNotice("");
      setShowErrors(true);
      if (!validZone(timeZone))
        throw new Error("Select a valid service time zone before saving.");
      const invalid = days.find((d) => d.is_active && !validRange(d));
      if (invalid) throw new Error("Review the highlighted working hours.");
      const ticket = accountScope.capture();
      try {
        await onSave(timeZone, hoursPayload(days));
      } catch (e) {
        if (e instanceof Error && "status" in e && e.status === 409)
          throw new Error(
            "Your schedule could not be updated because of a conflict. Review your appointments and try again.",
          );
        throw e;
      }
      accountScope.assert(ticket);
      setBaseline(snapshot);
      setShowErrors(false);
      setNotice(
        "Working hours saved. Existing appointments keep their agreed times and recorded time zone.",
      );
    });
  const active = days.filter((d) => d.is_active).length;
  return (
    <>
      <Card>
        <Text style={styles.tag}>YOUR WEEKLY BOOKING HOURS</Text>
        <Text style={styles.subtitle}>A schedule that fits you</Text>
        <Text style={styles.muted}>
          Choose when new appointments can start and finish. Hours use your
          service location’s time zone, even when your client is elsewhere.
        </Text>
        <Text style={styles.label}>
          {active} open {active === 1 ? "day" : "days"} · {7 - active} closed
        </Text>
      </Card>
      {onCalendar && <CalendarInvite onPress={onCalendar} />}
      <Card>
        <Text style={styles.tag}>SERVICE TIME ZONE</Text>
        <Text style={styles.subtitle}>
          {timeZone || "Time zone not selected"}
        </Text>
        <Text style={styles.muted}>
          Select an IANA city/region, such as Asia/Dubai. Daylight-saving
          changes follow that zone automatically. Changing it applies to new
          bookings; existing appointments keep their recorded zone.
        </Text>
        <Button
          title="Change time zone"
          secondary
          disabled={submit.busy}
          onPress={() => {
            setSearch("");
            setZoneError("");
            setChoosingZone(true);
          }}
        />
        {showErrors && !validZone(timeZone) && (
          <Notice error>Choose your local time zone.</Notice>
        )}
      </Card>
      <LabSheet
        title="Your local time zone"
        visible={choosingZone}
        onClose={() => setChoosingZone(false)}
      >
        <Field
          label="Find IANA time zone"
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setZoneError("");
          }}
          placeholder="e.g. Asia/Dubai"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.small}>
          Use the zone where appointments take place.
        </Text>
        {zoneError && <Notice error>{zoneError}</Notice>}
        {search.trim() && (
          <Button
            title={"Use " + search.trim()}
            secondary
            onPress={() => chooseZone(search)}
          />
        )}
        {!zones.length && (
          <Text style={styles.muted}>
            No matching zones. Enter a full IANA zone above.
          </Text>
        )}
        {zones.map((z) => (
          <Button key={z} title={z} secondary onPress={() => chooseZone(z)} />
        ))}
      </LabSheet>
      <Text style={styles.small}>
        24-hour times · one opening period per day. Closing must be after
        opening on the same day. 24:00 means midnight at the end of the day.
      </Text>
      {days.map((d) => (
        <Card key={d.day_of_week}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={styles.subtitle}>
                {dayNames[d.day_of_week]}
              </Text>
              <Text style={styles.small}>
                {d.is_active ? "Open for appointments" : "Closed"}
              </Text>
            </View>
            <Switch
              {...(Platform.OS === "web"
                ? { activeThumbColor: "#fff1f5" }
                : {})}
              trackColor={{ true: "#bc315b", false: "#71505c" }}
              thumbColor="#fff1f5"
              accessibilityLabel={dayNames[d.day_of_week] + " open"}
              accessibilityState={{ disabled: submit.busy }}
              value={d.is_active}
              disabled={submit.busy}
              onValueChange={(value) =>
                change(d.day_of_week, { is_active: value })
              }
            />
          </View>
          {d.is_active ? (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {(["start_time", "end_time"] as const).map((field) => (
                  <TimeControl
                    key={field}
                    label={
                      dayNames[d.day_of_week] +
                      " " +
                      (field === "start_time" ? "opens" : "closes")
                    }
                    value={d[field]}
                    disabled={submit.busy}
                    onPress={() =>
                      setChoosingTime({ day: d.day_of_week, field })
                    }
                  />
                ))}
              </View>
              {!validRange(d) && (
                <Notice error>
                  Check {dayNames[d.day_of_week]} opening and closing times.
                  Closing must be later on the same day.
                </Notice>
              )}
            </>
          ) : (
            <Text style={styles.muted}>
              Day off · no new appointments. Your times are remembered if you
              reopen this day.
            </Text>
          )}
        </Card>
      ))}
      {choosingTime && (
        <TimeSelector
          key={choosingTime.day + ":" + choosingTime.field}
          title={
            dayNames[choosingTime.day] +
            " " +
            (choosingTime.field === "start_time" ? "opening" : "closing") +
            " time"
          }
          value={days[choosingTime.day][choosingTime.field]}
          closing={choosingTime.field === "end_time"}
          onCancel={() => setChoosingTime(null)}
          onConfirm={(value) => {
            change(choosingTime.day, { [choosingTime.field]: value });
            setChoosingTime(null);
          }}
        />
      )}
      {!active && (
        <Notice>
          All days are closed. Clients cannot request new appointments until you
          open a day.
        </Notice>
      )}
      <Notice>
        Existing appointments stay unchanged when you close a day or shorten
        your hours. Manage those appointments separately. Connected Calendar
        busy events can also reduce available slots.
      </Notice>
      {dirty && (
        <Text accessibilityLiveRegion="polite" style={styles.small}>
          Unsaved changes
        </Text>
      )}
      {!!submit.error && <Notice error>{submit.error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      <Button title="Save working hours" busy={submit.busy} onPress={save} />
    </>
  );
}
