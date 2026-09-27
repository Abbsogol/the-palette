import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Chips,
  QueryState,
  RequireAuth,
  Screen,
  styles,
} from "../components/ui";
import { useAccountQuery, useAuth } from "../lib/auth";
import { checked } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Booking } from "../lib/types";
function Appointments() {
  const { session } = useAuth();
  const [role, setRole] = useState("Customer"),
    [limit, setLimit] = useState(40);
  const query = useAccountQuery(["appointments", role, limit], () =>
    checked<Booking[]>(
      supabase
        .from("bookings")
        .select("*,services(*)")
        .eq(role === "Customer" ? "client_id" : "creator_id", session!.user.id)
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(limit),
    ),
  );
  return (
    <>
      <Chips values={["Customer", "Creator"]} value={role} onChange={setRole} />
      <Button
        title="Refresh appointments"
        secondary
        onPress={() => void query.refetch()}
      />
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={!query.data?.length}
        retry={() => void query.refetch()}
      >
        {query.data?.map((b) => (
          <Card key={b.id}>
            <Text style={styles.subtitle}>
              {b.services?.name || "Appointment"}
            </Text>
            <Text style={styles.text}>
              {b.booking_date} · {b.start_time.slice(0, 5)} ·{" "}
              {b.time_zone || "Time zone needs review"}
            </Text>
            <Text style={styles.muted}>{b.status}</Text>
            <Button
              title="Appointment details"
              secondary
              onPress={() =>
                router.push({ pathname: "/booking/[id]", params: { id: b.id } })
              }
            />
          </Card>
        ))}
        {query.data?.length === limit && (
          <Button
            title="Load older appointments"
            secondary
            onPress={() => setLimit(limit + 40)}
          />
        )}
      </QueryState>
    </>
  );
}
export default function AppointmentScreen() {
  return (
    <Screen title="Appointments" back>
      <RequireAuth>
        <Appointments />
      </RequireAuth>
    </Screen>
  );
}
