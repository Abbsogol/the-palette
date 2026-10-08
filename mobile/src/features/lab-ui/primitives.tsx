import { typography } from "../../theme/typography";
import {
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { SearchBackground } from "../search/search-background";
import { HomeIcon } from "../home/home-primitives";
import { homeFonts } from "../home/tokens";
import { labAssets } from "./assets";

export function LabShell({
  children,
  width: suppliedWidth,
  dark = false,
}: PropsWithChildren<{ width?: number; dark?: boolean }>) {
  const window = useWindowDimensions();
  const width =
    suppliedWidth ??
    (Platform.OS === "web" ? Math.min(393, window.width) : window.width);
  return (
    <View style={s.outer}>
      <View style={{ flex: 1, width }}>
        <SearchBackground width={width} />
        {dark && (
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(27,4,14,.35)",
              "rgba(34,5,17,.58)",
              "rgba(18,4,11,.38)",
            ]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}
        {children}
      </View>
    </View>
  );
}
export function LabButton({
  title,
  onPress,
  disabled,
  busy,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
    >
      <LinearGradient
        colors={
          secondary || disabled
            ? ["rgba(255,255,255,.02)", "rgba(255,255,255,.02)"]
            : ["#660007", "#660007", "#ff517f"]
        }
        locations={secondary || disabled ? [0, 1] : [0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.button, (secondary || disabled) && s.outline]}
      >
        {busy ? (
          <ActivityIndicator color="white" accessibilityLabel="In progress" />
        ) : (
          <Text style={[s.buttonText, disabled && { opacity: 0.4 }]}>
            {title}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}
export function LabHeader({
  credits,
  onCredits,
  onHistory,
  onBack,
}: {
  credits?: number | null;
  onCredits?: () => void;
  onHistory?: () => void;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        s.header,
        {
          paddingTop: insets.top + (onBack ? 16 : 8),
          paddingBottom: onBack ? 16 : 12,
        },
      ]}
    >
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Nail Lab"
          onPress={onBack}
          hitSlop={6}
          style={{ width: 32, height: 32 }}
        >
          <View style={s.back}>
            <HomeIcon source={labAssets.back} size={16} />
          </View>
        </Pressable>
      )}
      <Text accessibilityRole="header" style={s.logo}>
        Nail Lab
      </Text>
      {onBack ? (
        <View style={{ width: 32 }} />
      ) : (
        <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="History"
            onPress={onHistory}
            style={s.pillTouch}
          >
            <View style={s.pill}>
              <Text style={s.pillText}>History</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${credits ?? "Loading"} design tokens. Subscription and token packs`}
            onPress={onCredits}
            style={s.pillTouch}
          >
            <View style={[s.pill, s.credit]}>
              <Text style={s.creditNumber}>{credits ?? "…"}</Text>
              <Text style={s.creditLabel}>TOKENS</Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}
export function LabPageBody({
  children,
  action,
}: PropsWithChildren<{ action?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboard(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { paddingBottom: action ? 24 : insets.bottom + 140 },
        ]}
      >
        {children}
      </ScrollView>
      {action && (
        <View
          style={[
            s.action,
            { marginBottom: keyboard ? 0 : Math.max(insets.bottom, 34) + 68 },
          ]}
        >
          {action}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
export function LabMessage({
  children,
  error = false,
}: PropsWithChildren<{ error?: boolean }>) {
  return (
    <View style={s.banner}>
      <HomeIcon source={labAssets.info} size={16} />
      <Text
        accessibilityRole={error ? "alert" : undefined}
        accessibilityLiveRegion="polite"
        style={s.message}
      >
        {children}
      </Text>
    </View>
  );
}
export function LabSheet({
  visible,
  onClose,
  title,
  children,
}: PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title: string;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.scrim}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          accessibilityViewIsModal
          style={[
            s.sheet,
            { paddingBottom: Math.max(insets.bottom, 24), maxHeight: "90%" },
          ]}
        >
          <View style={s.spread}>
            <Text
              accessibilityRole="header"
              style={[s.sectionTitle, { flex: 1 }]}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              style={s.backTouch}
            >
              <Text style={s.sectionTitle}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#260d14", alignItems: "center" },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  logo: {
    ...typography.heading,
    flexShrink: 0,
    color: "white",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  backTouch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    width: 32,
    height: 32,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  pillTouch: { minHeight: 44, justifyContent: "center" },
  pill: {
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { color: "white", fontFamily: homeFonts.regular, fontSize: 12 },
  credit: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.11)",
    borderColor: "transparent",
  },
  creditNumber: {
    color: "#d98cab",
    fontFamily: homeFonts.regular,
    fontSize: 12,
    fontWeight: "700",
  },
  creditLabel: {
    color: "rgba(255,255,255,.6)",
    fontFamily: homeFonts.regular,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  content: { paddingHorizontal: 24, gap: 20 },
  action: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 12 },
  button: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  outline: { borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  buttonText: {
    ...typography.button,
    color: "white",
    textAlign: "center",
  },
  title: {
    color: "white",
    fontFamily: homeFonts.display,
    fontSize: 42,
    lineHeight: 48,
  },
  subtitle: {
    color: "rgba(255,255,255,.6)",
    fontFamily: homeFonts.light,
    fontSize: 16,
    lineHeight: 20,
  },
  sectionTitle: {
    ...typography.section,
    color: "white",
  },
  text: {
    color: "white",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: homeFonts.regular,
  },
  muted: {
    color: "rgba(255,255,255,.6)",
    fontSize: 14,
    fontFamily: homeFonts.regular,
  },
  small: {
    color: "rgba(255,255,255,.5)",
    fontSize: 12,
    fontFamily: homeFonts.regular,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,81,127,.1)",
    borderWidth: 1,
    borderColor: "rgba(255,81,127,.2)",
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: homeFonts.regular,
    color: "white",
  },
  card: {
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    borderRadius: 24,
    padding: 20,
    gap: 20,
  },
  field: {
    backgroundColor: "rgba(255,255,255,.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    borderRadius: 12,
    padding: 14,
    color: "white",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: homeFonts.regular,
    minHeight: 48,
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#45252e",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
});
