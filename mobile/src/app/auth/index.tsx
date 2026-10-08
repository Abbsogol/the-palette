import {
  type Eligibility,
  eligibilityMessage,
} from "../../features/welcome/eligibility";
import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { supabase } from "../../lib/supabase";
import { safeReturnPath } from "../../lib/links";
import { authCallback, oauth } from "../../features/auth-actions";
import { secureStorage } from "../../lib/secure-storage";
import { useAuth } from "../../lib/auth";
import { useFirstLaunch } from "../../features/welcome/first-launch";
import { initialAuthMode } from "../../features/auth-callback/model";
import { AuthView, type AuthMode } from "../../features/welcome/welcome-view";

export default function AuthScreen() {
  const { returnTo, mode: requestedMode } = useLocalSearchParams();
  const { session, ready } = useAuth();
  const launch = useFirstLaunch();
  const [intent, setIntent] = useState<{
    source: unknown;
    path: string;
  } | null>(null);
  const destination =
    intent && intent.source === returnTo
      ? intent.path
      : safeReturnPath(returnTo);
  const setDestination = (path: string) => {
    setIntent({ source: returnTo, path });
    // Keep the selected destination when authentication remounts the navigator.
    router.setParams({ returnTo: path });
  };
  const [mode, setMode] = useState<AuthMode>(() =>
      initialAuthMode(requestedMode),
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (ready && session && initialAuthMode(requestedMode) === "welcome")
      router.replace(destination as Href);
  }, [ready, session, destination, requestedMode]);
  const changeMode = (next: AuthMode) => {
    if (pending.current) return;
    setMode(next);
    setError("");
    setMessage("");
    setVerificationEmail("");
    setPassword("");
  };
  const run = async (
    provider?: "google" | "apple",
    resend = false,
    eligibility?: Eligibility,
  ) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !resend &&
        (provider || mode === "Create account") &&
        (!eligibility?.ageConfirmed || !eligibility.privacyAccepted)
      )
        throw new Error(eligibilityMessage);
      const address = email.trim();
      if (!provider && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
        throw new Error("Enter a valid email address.");
      if (
        !provider &&
        !resend &&
        mode !== "Reset password" &&
        mode !== "Verify email"
      ) {
        if (!password) throw new Error("Enter your password.");
        if (mode === "Create account" && password.length < 8)
          throw new Error("Use a password with at least 8 characters.");
      }
      await launch.complete();
      await secureStorage.setItem("laque.auth-intent", destination);
      if (!mounted.current) return;
      if (provider) {
        const success = await oauth(provider);
        if (mounted.current && success) router.replace(destination as Href);
        else if (mounted.current)
          setMessage("Sign-in cancelled. You can try again or use email.");
        return;
      }
      if (resend) {
        // Resend only to the exact address submitted for this verification flow.
        if (!verificationEmail || verificationEmail !== address)
          throw new Error(
            "Create your account first to request a verification email.",
          );
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: verificationEmail,
          options: { emailRedirectTo: authCallback },
        });
        if (error) throw error;
        if (mounted.current)
          setMessage("Verification email sent. Check your inbox.");
        return;
      }
      if (mode === "Verify email") {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: address,
          options: { emailRedirectTo: authCallback },
        });
        if (error)
          throw new Error(
            "We couldn’t send a verification link. Check your connection and try again.",
          );
        if (mounted.current)
          setMessage(
            "If this account needs verification, check your inbox for the newest link. Open it on this device.",
          );
        return;
      }
      if (mode === "Reset password") {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${authCallback}?flow=recovery`,
        });
        if (error) throw error;
        if (mounted.current)
          setMessage(
            "Check your email for a recovery link. Open it on this device.",
          );
        return;
      }
      const credentials = { email: address, password };
      const response =
        mode === "Create account"
          ? await supabase.auth.signUp({
              ...credentials,
              options: {
                emailRedirectTo: authCallback,
                data: {
                  age_confirmed: true,
                  privacy_accepted: true,
                  privacy_policy_version: "2026-09-29",
                },
              },
            })
          : await supabase.auth.signInWithPassword(credentials);
      if (response.error) throw response.error;
      if (!mounted.current) return;
      if (response.data.session) router.replace(destination as Href);
      else {
        setVerificationEmail(address);
        setMessage(
          "Check your email to verify your account. Open the link on this device, then finish your profile.",
        );
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Sign-in failed. Please try again.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <AuthView
      mode={mode}
      onMode={changeMode}
      email={email}
      password={password}
      onEmail={(value) => {
        setEmail(value);
        setVerificationEmail("");
      }}
      onPassword={setPassword}
      busy={busy}
      error={error}
      message={message}
      canResend={
        !!verificationEmail &&
        verificationEmail === email.trim() &&
        mode === "Create account"
      }
      onSubmit={(eligibility) => void run(undefined, false, eligibility)}
      onProvider={(provider, eligibility) =>
        void run(provider, false, eligibility)
      }
      onResend={() => void run(undefined, true)}
      onBack={() => changeMode("welcome")}
      onCreator={() => {
        setDestination("/creator-onboarding");
        changeMode("Create account");
      }}
    />
  );
}
