import { useState } from "react";
import { Switch, Text, View } from "react-native";
import {
  Button,
  Chips,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
} from "../components/ui";
import { useAccountQuery, useAuth, useProfile, queryClient } from "../lib/auth";
import { api, checked } from "../lib/api";
import { supabase } from "../lib/supabase";
function Privacy() {
  const { session } = useAuth();
  const profile = useProfile();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const blocks = useAccountQuery(["blocks"], () =>
    checked<{ id: string; blocked_id: string }[]>(
      supabase
        .from("blocks")
        .select("id,blocked_id")
        .eq("blocker_id", session!.user.id),
    ),
  );
  const update = async (body: unknown) => {
    setBusy(true);
    try {
      await api("/update-privacy-settings", body);
      await queryClient.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const settings = useAccountQuery(["privacy-settings"], () =>
    checked<{ message_permission: string; show_saves: boolean } | null>(
      supabase
        .from("profiles")
        .select("message_permission,show_saves")
        .eq("id", session!.user.id)
        .single(),
    ),
  );
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.text}>Private profile</Text>
        <Switch
          accessibilityLabel="Private profile"
          value={profile.data?.is_private || false}
          disabled={busy || !profile.data}
          onValueChange={(value) => void update({ is_private: value })}
        />
      </View>
      <Chips
        label="Who can send me messages?"
        values={["everyone", "followers", "none"]}
        value={settings.data?.message_permission || "everyone"}
        onChange={(value) => {
          if (!busy) void update({ message_permission: value });
        }}
      />
      <View style={styles.row}>
        <Text style={styles.text}>Show saved designs on profile</Text>
        <Switch
          accessibilityLabel="Show saves"
          value={settings.data?.show_saves || false}
          disabled={busy || !settings.data}
          onValueChange={(value) => void update({ show_saves: value })}
        />
      </View>
      <Text style={styles.subtitle}>Blocked accounts</Text>
      <QueryState
        loading={blocks.isPending}
        error={blocks.error}
        empty={!blocks.data?.length}
        retry={() => void blocks.refetch()}
      >
        {blocks.data?.map((b) => (
          <Button
            key={b.id}
            title={`Unblock account ${b.blocked_id.slice(0, 8)}`}
            secondary
            onPress={() => {
              void checked(
                supabase
                  .from("blocks")
                  .delete()
                  .eq("id", b.id)
                  .eq("blocker_id", session!.user.id)
                  .select("id"),
              )
                .then(() => queryClient.invalidateQueries())
                .catch((e) => setError(e.message));
            }}
          />
        ))}
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function PrivacyScreen() {
  return (
    <Screen title="Privacy & safety" back>
      <RequireAuth>
        <Privacy />
      </RequireAuth>
    </Screen>
  );
}
