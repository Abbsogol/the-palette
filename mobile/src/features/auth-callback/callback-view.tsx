import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LabShell, LabButton, LabMessage } from "../lab-ui/primitives";
import { typography } from "../../theme/typography";
import type { AuthLinkProblem } from "./model";
export type CallbackState =
  | "checking"
  | "verified"
  | "signed-in"
  | "recovery"
  | "password-saved"
  | AuthLinkProblem;
export type CallbackViewProps = {
  state: CallbackState;
  recovery?: boolean;
  preview?: boolean;
  width?: number;
  password: string;
  confirmation: string;
  busy?: boolean;
  canSave?: boolean;
  error?: string;
  onPassword: (v: string) => void;
  onConfirmation: (v: string) => void;
  onSave: () => void;
  onContinue: () => void;
  onRetry: () => void;
  onNewLink: () => void;
  onSignIn: () => void;
};
export function CallbackView(p: CallbackViewProps) {
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const problem = ["expired", "invalid", "retry", "account-changed"].includes(
    p.state,
  );
  const title =
    p.state === "checking"
      ? "Confirming your account"
      : p.state === "verified"
        ? "Email verified"
        : p.state === "signed-in"
          ? "You’re signed in"
          : p.state === "recovery"
            ? "A fresh start"
            : p.state === "password-saved"
              ? "Password updated"
              : p.state === "expired"
                ? "This link has expired"
                : p.state === "invalid"
                  ? "We couldn’t open this link"
                  : p.state === "account-changed"
                    ? "Your account changed"
                    : "Let’s try that again";
  const description =
    p.state === "checking"
      ? "We’re checking your secure link. This may take a moment."
      : p.state === "verified"
        ? "Your email is confirmed. Continue to LaQue and finish setting up your profile if needed."
        : p.state === "signed-in"
          ? "Your secure sign-in is complete. Continue where you left off."
          : p.state === "recovery"
            ? "Choose a new password to keep your account secure."
            : p.state === "password-saved"
              ? "Your new password is ready. Use it the next time you sign in."
              : p.state === "expired"
                ? "Links can expire or be used only once. Request a fresh link and open the newest email on the device where you requested it."
                : p.state === "invalid"
                  ? "This link is incomplete or isn’t valid for LaQue. Open the full link from your email, or request another."
                  : p.state === "account-changed"
                    ? "This link no longer matches your active session. Sign in again or request a new link for the account you want to recover."
                    : "We couldn’t confirm your link. Check your connection and try again. No success has been confirmed yet.";
  return (
    <LabShell width={p.width} dark>
      <View style={[s.header, { paddingTop: insets.top + 20 }]}>
        <Text style={s.headerTitle}>Your account</Text>
        <Text accessible={false} style={s.spark}>
          ✦
        </Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            s.body,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          {p.preview && (
            <LabMessage>
              Design preview · no email is sent and no account or password is
              changed.
            </LabMessage>
          )}
          <View style={s.mark} accessible={false}>
            {p.state === "checking" ? (
              <ActivityIndicator color="#ffb5cf" />
            ) : (
              <Text style={s.markText}>
                {p.state === "recovery" ? "✧" : problem ? "!" : "✓"}
              </Text>
            )}
          </View>
          <Text style={s.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={s.description} accessibilityLiveRegion="polite">
            {description}
          </Text>
          {p.state === "recovery" && (
            <View style={s.card}>
              <Text style={s.label}>New password</Text>
              <TextInput
                accessibilityLabel="New password"
                value={p.password}
                onChangeText={p.onPassword}
                secureTextEntry={!show}
                editable={!p.busy}
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="At least 8 characters"
                placeholderTextColor="#c7a7b1"
                style={s.input}
              />
              <Text style={s.label}>Confirm new password</Text>
              <TextInput
                accessibilityLabel="Confirm new password"
                value={p.confirmation}
                onChangeText={p.onConfirmation}
                secureTextEntry={!show}
                editable={!p.busy}
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Enter it again"
                placeholderTextColor="#c7a7b1"
                style={s.input}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (!p.busy && p.canSave !== false) p.onSave();
                }}
              />
              <View style={s.passwordHelp}>
                <Text style={[s.small, { flex: 1 }]}>
                  Use 8 or more characters. A unique password helps protect your
                  account.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    show ? "Hide new passwords" : "Show new passwords"
                  }
                  accessibilityState={{ disabled: !!p.busy }}
                  disabled={p.busy}
                  onPress={() => setShow(!show)}
                  style={s.show}
                >
                  <Text style={s.showText}>{show ? "Hide" : "Show"}</Text>
                </Pressable>
              </View>
            </View>
          )}
          {!!p.error && <LabMessage error>{p.error}</LabMessage>}
          <View style={s.actions}>
            {p.state === "recovery" ? (
              <LabButton
                title="Save new password"
                busy={p.busy}
                disabled={p.canSave === false}
                onPress={p.onSave}
              />
            ) : ["verified", "signed-in", "password-saved"].includes(
                p.state,
              ) ? (
              <LabButton
                title="Continue to LaQue"
                busy={p.busy}
                onPress={p.onContinue}
              />
            ) : problem ? (
              <>
                {p.state === "retry" && (
                  <LabButton
                    title="Try this link again"
                    busy={p.busy}
                    onPress={p.onRetry}
                  />
                )}
                <LabButton
                  title={
                    p.recovery
                      ? "Request a new recovery link"
                      : "Request a new verification link"
                  }
                  secondary={p.state === "retry"}
                  disabled={p.busy}
                  onPress={p.onNewLink}
                />
              </>
            ) : null}
            {p.state !== "checking" && p.state !== "password-saved" && (
              <LabButton
                title="Back to sign in"
                secondary
                disabled={p.busy}
                onPress={p.onSignIn}
              />
            )}
          </View>
          {p.state === "recovery" && (
            <Text style={s.small}>
              This updates only the LaQue account confirmed by your recovery
              link.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LabShell>
  );
}
const s = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: { ...typography.section, color: "#ffe5ee" },
  spark: { fontSize: 25, color: "#ffc5dc" },
  body: { padding: 24, gap: 20, flexGrow: 1 },
  mark: {
    height: 80,
    width: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "rgba(255,185,212,.3)",
    backgroundColor: "rgba(255,172,202,.1)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  markText: { color: "#ffd8e8", fontSize: 36 },
  title: {
    ...typography.heading,
    fontSize: 38,
    lineHeight: 46,
    color: "white",
  },
  description: { ...typography.body, color: "#f0ceda" },
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    backgroundColor: "rgba(255,255,255,.055)",
    gap: 12,
  },
  label: { ...typography.caption, color: "#ffe5ee" },
  input: {
    ...typography.body,
    color: "white",
    minHeight: 48,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(37,5,20,.22)",
  },
  small: {
    ...typography.caption,
    color: "#e6bdcd",
    fontSize: 13,
    lineHeight: 19,
  },
  passwordHelp: { flexDirection: "row", gap: 10, alignItems: "center" },
  show: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  showText: { ...typography.caption, color: "#ffc7dc" },
  actions: { gap: 12, marginTop: 8 },
});
