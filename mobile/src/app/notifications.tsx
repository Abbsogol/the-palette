import { useState } from "react";
import { Linking, Text } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
} from "../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { checked } from "../lib/api";
import { supabase } from "../lib/supabase";
import { registerPush, unregisterPush } from "../lib/notifications";
function Notifications() {
  const { session } = useAuth();
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [limit, setLimit] = useState(40);
  const query = useAccountQuery(["notifications", limit], () =>
    checked<
      {
        id: string;
        type: string;
        read: boolean;
        design_id: string | null;
        created_at: string;
      }[]
    >(
      supabase
        .from("notifications")
        .select("id,type,read,design_id,created_at")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(limit),
    ),
  );
  const permission = async (enabled: boolean) => {
    setError("");
    try {
      if (enabled) await registerPush();
      else await unregisterPush();
      setNotice(
        enabled
          ? "Notifications enabled."
          : "Notifications disabled on this device.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <Button
        title="Enable notifications"
        onPress={() => void permission(true)}
      />
      <Button
        title="Disable on this device"
        secondary
        onPress={() => void permission(false)}
      />
      <Button
        title="Open device settings"
        secondary
        onPress={() => void Linking.openSettings()}
      />
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice error>{error}</Notice>}
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={!query.data?.length}
        retry={() => void query.refetch()}
      >
        {query.data?.map((n) => (
          <Card key={n.id}>
            <Text style={styles.text}>{n.type.replace(/_/g, " ")}</Text>
            <Text style={styles.muted}>
              {new Date(n.created_at).toLocaleString()}
              {!n.read ? " · Unread" : ""}
            </Text>
            <Button
              title="View update"
              secondary
              onPress={() => {
                void checked(
                  supabase
                    .from("notifications")
                    .update({ read: true })
                    .eq("id", n.id)
                    .select("id"),
                )
                  .then(() => queryClient.invalidateQueries())
                  .catch((e) => setError(e.message));
                if (n.design_id)
                  router.push({
                    pathname: "/design/[id]",
                    params: { id: n.design_id },
                  });
                else
                  router.push(
                    n.type.includes("booking") || n.type.includes("appointment")
                      ? "/appointments"
                      : "/messages",
                  );
              }}
            />
          </Card>
        ))}
        {query.data?.length === limit && (
          <Button
            title="Load older updates"
            secondary
            onPress={() => setLimit(limit + 40)}
          />
        )}
      </QueryState>
    </>
  );
}
export default function NotificationScreen() {
  return (
    <Screen title="Updates" back>
      <RequireAuth>
        <Notifications />
      </RequireAuth>
    </Screen>
  );
}
