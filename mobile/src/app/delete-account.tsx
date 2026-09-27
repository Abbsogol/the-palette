import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { Button, Field, Notice, RequireAuth, Screen } from "../components/ui";
import { api } from "../lib/api";
import { signOut } from "../lib/auth";
export default function DeleteAccount() {
  const [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/delete-account", {});
      await signOut();
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Delete account" back>
      <RequireAuth>
        <Notice>
          Your profile, private images and saved content will be permanently
          removed. Cancel upcoming appointments and wait for pending refunds or
          purchases to finish first. Active subscriptions must be cancelled with
          their original provider.
        </Notice>
        <Field
          label="Type DELETE to continue"
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
        />
        <Button
          title="Permanently delete account"
          busy={busy}
          disabled={confirm !== "DELETE"}
          onPress={() =>
            Alert.alert(
              "Permanently delete your account?",
              "This cannot be undone.",
              [
                { text: "Keep account", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => void remove(),
                },
              ],
            )
          }
        />
        {error && <Notice error>{error}</Notice>}
      </RequireAuth>
    </Screen>
  );
}
