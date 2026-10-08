import {
  useEffect,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LabShell, LabButton, LabMessage } from "../lab-ui/primitives";
import { typography } from "../../theme/typography";
import { homeFonts } from "../home/tokens";
export { LabButton as Button, LabMessage as Notice };
export function Screen({
  title,
  subtitle,
  children,
  back = true,
  onBack,
  action,
  resetScrollKey,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  action?: ReactNode;
  resetScrollKey?: string;
}>) {
  const inset = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (resetScrollKey !== undefined)
      scroll.current?.scrollTo({ y: 0, animated: false });
  }, [resetScrollKey]);
  return (
    <LabShell dark>
      <View style={[styles.header, { paddingTop: inset.top + 12 }]}>
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={styles.back}
          >
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
        )}
        <Text accessibilityRole="header" style={styles.heading}>
          {title}
        </Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.body,
            { paddingBottom: Math.max(inset.bottom, 24) + 100 },
          ]}
        >
          {subtitle && <Text style={styles.intro}>{subtitle}</Text>}
          {children}
          {action}
        </ScrollView>
      </KeyboardAvoidingView>
    </LabShell>
  );
}
export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function Section({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={styles.subtitle}>
        {title}
      </Text>
      {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
      {children}
    </View>
  );
}
export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 8, flexShrink: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#c7a7b1"
        selectionColor="#ff517f"
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 108, textAlignVertical: "top" },
          props.style,
        ]}
      />
      {hint && <Text style={styles.small}>{hint}</Text>}
    </View>
  );
}
export function Chips({
  label,
  values,
  value,
  onChange,
  disabled = false,
}: {
  label?: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.wrap}>
        {values.map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityState={{ selected: v === value, disabled }}
            disabled={disabled}
            onPress={() => onChange(v)}
            style={[styles.chip, v === value && styles.selected]}
          >
            <Text style={styles.text}>{v}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Row({
  title,
  detail,
  onPress,
  danger,
  badge,
  disabled = false,
}: {
  title: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.link, disabled && { opacity: 0.5 }]}
    >
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[styles.text, danger && { color: "#ffc1ce" }]}>
          {title}
        </Text>
        {detail && <Text style={styles.small}>{detail}</Text>}
      </View>
      {badge && <Text style={styles.tag}>{badge}</Text>}
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <View style={styles.emblem}>
        <Text style={styles.arrow}>✦</Text>
      </View>
      <Text style={styles.subtitle}>{title}</Text>
      <Text style={styles.muted}>{detail}</Text>
    </Card>
  );
}
export const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(39,4,16,.55)",
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ffffff30",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff0a",
  },
  arrow: { color: "#fff1f5", fontSize: 28, lineHeight: 32 },
  heading: { ...typography.heading, color: "white", flex: 1 },
  body: { padding: 24, gap: 24 },
  intro: {
    fontFamily: homeFonts.regular,
    color: "#ead3db",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ffffff24",
    backgroundColor: "rgba(53,10,27,.67)",
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  subtitle: { ...typography.section, color: "white" },
  text: {
    fontFamily: homeFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: "#fff8fa",
  },
  muted: {
    fontFamily: homeFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: "#e2bfcc",
  },
  small: {
    fontFamily: homeFonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#e2bfcc",
  },
  label: {
    fontFamily: homeFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "#fff8fa",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ffffff40",
    backgroundColor: "#24041155",
    borderRadius: 16,
    minHeight: 52,
    padding: 14,
    color: "white",
    fontFamily: homeFonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ffffff40",
    justifyContent: "center",
  },
  selected: { backgroundColor: "#a92149", borderColor: "#ff7097" },
  link: {
    minHeight: 64,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 8,
  },
  tag: {
    fontFamily: homeFonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: "#ffd2df",
    backgroundColor: "#ffffff10",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: "hidden",
  },
  emblem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff12",
    alignItems: "center",
    justifyContent: "center",
  },
});
