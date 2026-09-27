import { useEffect, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Button, Field, Loading, Notice, Screen } from "../../components/ui";
import { appScheme } from "../../lib/config";
import { safeReturnPath } from "../../lib/links";
import { secureStorage } from "../../lib/secure-storage";
import { exchangeAuthUrl } from "../../features/auth-actions";
import { supabase } from "../../lib/supabase";

export default function Callback() {
  const params = useLocalSearchParams<{
    code?: string;
    flow?: string;
    error?: string;
    error_description?: string;
  }>();
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const {
    code,
    flow,
    error: linkError,
    error_description: description,
  } = params;
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({
      code,
      flow,
      error: linkError,
      error_description: description,
    }))
      if (typeof value === "string") query.set(key, value);
    void exchangeAuthUrl(`${appScheme}://auth/callback?${query}`)
      .then(async (recovery) => {
        if (!active) return;
        if (recovery) {
          setReady(true);
          return;
        }
        const next = safeReturnPath(
          await secureStorage.getItem("laque.auth-intent"),
        );

        if (active) router.replace(next as Href);
      })
      .catch((e) => {
        if (active) setError(e.message || "This link has expired.");
      });
    return () => {
      active = false;
    };
  }, [code, flow, linkError, description]);
  const reset = async () => {
    setBusy(true);
    setError("");
    try {
      if (password.length < 8) throw new Error("Use at least 8 characters.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title={ready ? "Set a new password" : "Confirming your account"}>
      {!ready && !error && <Loading />}
      {ready && (
        <>
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <Button
            title="Save password"
            busy={busy}
            onPress={() => void reset()}
          />
        </>
      )}
      {error && (
        <>
          <Notice error>{error}</Notice>
          <Button
            title="Request a new link"
            onPress={() => router.replace("/auth")}
          />
        </>
      )}
    </Screen>
  );
}
