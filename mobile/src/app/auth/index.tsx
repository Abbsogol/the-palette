import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
  Button,
  Card,
  Chips,
  Field,
  Notice,
  Screen,
  styles,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { safeReturnPath } from "../../lib/links";
import { authCallback, oauth } from "../../features/auth-actions";
import { secureStorage } from "../../lib/secure-storage";

export default function AuthScreen() {
  const { returnTo } = useLocalSearchParams();
  const [mode, setMode] = useState("Sign in"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const destination = safeReturnPath(returnTo);
  const run = async (provider?: "google" | "apple") => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await secureStorage.setItem("laque.auth-intent", destination);
      if (provider) {
        if (await oauth(provider)) router.replace(destination as Href);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error("Enter a valid email address.");
      if (mode === "Reset password") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${authCallback}?flow=recovery` },
        );
        if (error) throw error;
        setMessage(
          "Check your email for a recovery link. Open it on this device.",
        );
        return;
      }
      if (password.length < 8)
        throw new Error("Use a password with at least 8 characters.");
      const credentials = { email: email.trim(), password };
      const response =
        mode === "Create account"
          ? await supabase.auth.signUp({
              ...credentials,
              options: { emailRedirectTo: authCallback },
            })
          : await supabase.auth.signInWithPassword(credentials);
      if (response.error) throw response.error;
      if (response.data.session) router.replace(destination as Href);
      else
        setMessage(
          "Check your email to verify your account. Open the link on this device, then finish your profile.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Welcome to LaQue" back>
      <Text style={styles.text}>Find your next set. Make it yours.</Text>
      <Chips
        values={["Sign in", "Create account", "Reset password"]}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setError("");
          setMessage("");
        }}
      />
      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        {mode !== "Reset password" && (
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={
              mode === "Create account" ? "new-password" : "current-password"
            }
          />
        )}
        <Button title={mode} busy={busy} onPress={() => void run()} />
        {error && <Notice error>{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        {message && mode === "Create account" && (
          <Button
            title="Resend verification email"
            secondary
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void supabase.auth
                .resend({
                  type: "signup",
                  email: email.trim(),
                  options: { emailRedirectTo: authCallback },
                })
                .then(({ error }) => {
                  if (error) setError(error.message);
                  else setMessage("Verification email sent.");
                })
                .finally(() => setBusy(false));
            }}
          />
        )}
      </Card>
      <View style={{ gap: 12 }}>
        <Button
          title="Continue with Google"
          secondary
          disabled={busy}
          onPress={() => void run("google")}
        />
        <Button
          title="Continue with Apple"
          secondary
          disabled={busy}
          onPress={() => void run("apple")}
        />
      </View>
    </Screen>
  );
}
