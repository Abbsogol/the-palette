import { useState } from "react";
import { Switch, Text, View } from "react-native";
import {
  Button,
  Card,
  Field,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
} from "../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { api, checked } from "../lib/api";
import { supabase } from "../lib/supabase";
type Day = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};
const names = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function Schedule({ initial, zone }: { initial: Day[]; zone: string }) {
  const [days, setDays] = useState(
      names.map(
        (_, i) =>
          initial.find((d) => d.day_of_week === i) || {
            day_of_week: i,
            start_time: "09:00",
            end_time: "18:00",
            is_active: i > 0 && i < 6,
          },
      ),
    ),
    [timeZone, setTimeZone] = useState(zone),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
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
    .filter((z) => z.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 12);
  const change = (i: number, fields: Partial<Day>) =>
    setDays(days.map((d) => (d.day_of_week === i ? { ...d, ...fields } : d)));
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (!timeZone) throw new Error("Choose your local time zone.");
      await api("/update-availability", { timeZone, schedule: days });
      await queryClient.invalidateQueries();
      setNotice(
        "Availability saved. Existing appointments keep their recorded time zone.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Notice>
        Choose the time zone where you provide services. Clients will see all
        appointment times in this zone.
      </Notice>
      <Text style={styles.subtitle}>
        {timeZone || "Time zone not selected"}
      </Text>
      <Field
        label="Find IANA time zone"
        value={search}
        onChangeText={setSearch}
        placeholder="e.g. Asia/Dubai"
        autoCapitalize="none"
      />
      {search.includes("/") && (
        <Button
          title={`Use ${search}`}
          secondary
          onPress={() => {
            try {
              new Intl.DateTimeFormat("en", { timeZone: search }).format();
              setTimeZone(search);
              setError("");
            } catch {
              setError("Enter a valid IANA time zone.");
            }
          }}
        />
      )}
      {zones.map((z) => (
        <Button key={z} title={z} secondary onPress={() => setTimeZone(z)} />
      ))}
      {days.map((d) => (
        <Card key={d.day_of_week}>
          <View style={styles.row}>
            <Text style={styles.subtitle}>{names[d.day_of_week]}</Text>
            <Switch
              accessibilityLabel={`${names[d.day_of_week]} open`}
              value={d.is_active}
              onValueChange={(value) =>
                change(d.day_of_week, { is_active: value })
              }
            />
          </View>
          <Field
            label={`${names[d.day_of_week]} opens (24-hour HH:mm)`}
            value={d.start_time.slice(0, 5)}
            onChangeText={(value) =>
              change(d.day_of_week, { start_time: value })
            }
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Field
            label={`${names[d.day_of_week]} closes (24-hour HH:mm)`}
            value={d.end_time.slice(0, 5)}
            onChangeText={(value) => change(d.day_of_week, { end_time: value })}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </Card>
      ))}
      <Button
        title="Save working hours"
        busy={busy}
        onPress={() => void save()}
      />
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
function Availability() {
  const { session } = useAuth();
  const query = useAccountQuery(
    ["availability", session!.user.id],
    async () => {
      const days = await checked<Day[]>(
        supabase
          .from("availability")
          .select("*")
          .eq("creator_id", session!.user.id),
      );
      const { data, error } = await supabase
        .from("creator_booking_settings")
        .select("time_zone")
        .eq("creator_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return { days, zone: data?.time_zone || "" };
    },
  );
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    >
      {query.data && (
        <Schedule initial={query.data.days} zone={query.data.zone} />
      )}
    </QueryState>
  );
}
export default function AvailabilityScreen() {
  return (
    <Screen title="Working hours" back>
      <RequireAuth>
        <Availability />
      </RequireAuth>
    </Screen>
  );
}
