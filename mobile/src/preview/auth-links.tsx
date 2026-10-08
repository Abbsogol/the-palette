import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  CallbackView,
  type CallbackState,
} from "../features/auth-callback/callback-view";
import { passwordValidation } from "../features/auth-callback/model";
import { AuthView } from "../features/welcome/welcome-view";
import { typography } from "../theme/typography";
export function AuthLinksPreview({ onClose }: { onClose: () => void }) {
  const [requesting, setRequesting] = useState(false),
    [email, setEmail] = useState(""),
    [notice, setNotice] = useState("");
  const [state, setState] = useState<CallbackState>("verified");
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState("");
  const choose = (value: CallbackState) => {
    setRequesting(false);
    setEmail("");
    setNotice("");
    setState(value);
    setPassword("");
    setConfirmation("");
    setError("");
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#280b19" }}>
        <ScrollView
          horizontal
          contentContainerStyle={{ padding: 12, gap: 8 }}
          style={{ flexGrow: 0 }}
        >
          {(
            [
              ["verified", "Verified"],
              ["recovery", "New password"],
              ["expired", "Expired"],
              ["retry", "Retry"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Preview ${label}`}
              onPress={() => choose(value)}
              style={{
                minHeight: 44,
                padding: 12,
                borderRadius: 22,
                backgroundColor: state === value ? "#9f2852" : "#502637",
              }}
            >
              <Text style={{ ...typography.caption, color: "white" }}>
                {label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={{ padding: 12, minHeight: 44 }}
          >
            <Text style={{ ...typography.caption, color: "white" }}>
              Close preview
            </Text>
          </Pressable>
        </ScrollView>
        {requesting ? (
          <AuthView
            mode="Reset password"
            email={email}
            password=""
            onEmail={setEmail}
            onPassword={() => undefined}
            onMode={() => choose("expired")}
            onSubmit={() =>
              setNotice(
                "Design preview · no email was sent. Open a real recovery link in the connected app.",
              )
            }
            onProvider={() => undefined}
            onCreator={onClose}
            onBack={() => choose("expired")}
            onResend={() => undefined}
            message={
              notice ||
              "Design preview · no email is sent and no account is changed."
            }
          />
        ) : (
          <CallbackView
            preview
            state={state}
            recovery
            password={password}
            confirmation={confirmation}
            onPassword={setPassword}
            onConfirmation={setConfirmation}
            error={error}
            onSave={() => {
              const validation = passwordValidation(password, confirmation);
              setError(validation);
              if (!validation) choose("password-saved");
            }}
            onContinue={onClose}
            onRetry={() => choose("verified")}
            onNewLink={() => {
              setPassword("");
              setConfirmation("");
              setRequesting(true);
            }}
            onSignIn={onClose}
          />
        )}
      </View>
    </Modal>
  );
}
