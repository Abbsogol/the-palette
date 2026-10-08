import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { styles } from "../secondary/primitives";
export type Eligibility = { ageConfirmed: boolean; privacyAccepted: boolean };
export const emptyEligibility: Eligibility = {
  ageConfirmed: false,
  privacyAccepted: false,
};
export const eligibilityMessage =
  "Confirm you are 18 or older and have read the Privacy Policy.";
export function EligibilityConsent({
  value,
  onChange,
  disabled = false,
}: {
  value: Eligibility;
  onChange: (v: Eligibility) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  return (
    <View style={{ gap: 12, paddingVertical: 12 }}>
      <Text style={styles.small}>
        LaQue accounts are for people aged 18 and over.
      </Text>
      {(
        [
          ["ageConfirmed", "I am 18 or older"],
          ["privacyAccepted", "I have read the Privacy Policy"],
        ] as const
      ).map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={{ checked: value[key], disabled }}
          disabled={disabled}
          onPress={() => onChange({ ...value, [key]: !value[key] })}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            minHeight: 44,
          }}
        >
          <View
            style={{
              height: 24,
              width: 24,
              borderRadius: 7,
              borderWidth: 1,
              borderColor: "#ffd3e1",
              backgroundColor: value[key] ? "#a81743" : "#390719",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 17 }}>
              {value[key] ? "✓" : ""}
            </Text>
          </View>
          <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Read Privacy Policy"
        onPress={() =>
          void Linking.openURL("https://www.laque.app/privacy").catch(() =>
            setError("Open www.laque.app/privacy in your browser."),
          )
        }
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text
          style={[
            styles.text,
            { color: "#ffd3e1", textDecorationLine: "underline" },
          ]}
        >
          Read Privacy Policy ↗
        </Text>
      </Pressable>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.small}>
          {error}
        </Text>
      )}
    </View>
  );
}
