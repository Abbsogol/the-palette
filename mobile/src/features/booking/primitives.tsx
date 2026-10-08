import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appFonts } from "../../theme/typography";
export const bookingAssets = {
  background: require("../../../assets/figma/booking/02531.png"),
  line: require("../../../assets/figma/booking/1efd6.svg"),
  attach: require("../../../assets/figma/booking/04805.svg"),
  sparkle: require("../../../assets/figma/booking/a7474.svg"),
  check: require("../../../assets/figma/booking/934da.svg"),
  calendar: require("../../../assets/figma/booking/855a8.svg"),
};
export function BookingShell({
  name,
  title = "Book appointment",
  step,
  width: supplied,
  onBack,
  children,
  footer,
  centered = false,
  busy = false,
}: {
  name: string;
  title?: string;
  step?: number;
  width?: number;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  centered?: boolean;
  busy?: boolean;
}) {
  const window = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const width =
    supplied ??
    (Platform.OS === "web" ? Math.min(393, window.width) : window.width);
  return (
    <View style={s.outer}>
      <View style={{ flex: 1, width }}>
        <Image
          source={bookingAssets.background}
          accessible={false}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(26,5,13,.6)" },
          ]}
        />
        <LinearGradient
          colors={["rgba(32,5,11,0)", "rgba(32,5,11,.8)"]}
          style={[s.header, { paddingTop: insets.top + 8 }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            disabled={busy}
            onPress={onBack}
            style={s.touch}
          >
            <Text style={s.back}>‹</Text>
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityRole="header" style={s.headerTitle}>
              {title}
            </Text>
            <Text style={s.muted}>{name}</Text>
          </View>
          {step !== undefined && (
            <View
              accessibilityLabel={`Step ${step + 1} of 4`}
              style={s.progress}
            >
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    width: i === step ? 16 : 6,
                    height: 6,
                    borderRadius: 6,
                    backgroundColor:
                      i <= step ? "#ff517f" : "rgba(255,255,255,.2)",
                  }}
                />
              ))}
            </View>
          )}
        </LinearGradient>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            key={step}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              s.content,
              centered && {
                flexGrow: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 24,
              },
            ]}
          >
            {children}
          </ScrollView>
          {footer && (
            <View
              style={[
                s.footer,
                { paddingBottom: Math.max(insets.bottom, 24) + 12 },
              ]}
            >
              {footer}
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}
export function BookingButton({
  title,
  onPress,
  disabled,
  busy,
  secondary,
  plain,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  plain?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <LinearGradient
        colors={
          secondary || plain
            ? ["transparent", "transparent"]
            : ["#a01a36", "#ff517f"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          s.button,
          secondary && { borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text
            style={[
              s.buttonText,
              secondary && { color: "rgba(255,255,255,.7)" },
            ]}
          >
            {title}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}
export function BookingNotice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[s.notice, error && { color: "#ffc7d4" }]}
    >
      {text}
    </Text>
  );
}
export function SummaryRow({
  label,
  value,
  pink = false,
  last = false,
}: {
  label: string;
  value: string;
  pink?: boolean;
  last?: boolean;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Text
          style={[s.text, { color: "rgba(255,255,255,.55)", flexShrink: 0 }]}
        >
          {label}
        </Text>
        <Text style={[s.value, pink && s.pink]}>{value}</Text>
      </View>
      {!last && (
        <View style={{ overflow: "hidden", height: 1 }}>
          <Image
            source={bookingAssets.line}
            style={{ width: 329, height: 1 }}
            contentFit="fill"
          />
        </View>
      )}
    </View>
  );
}
export const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#260d14", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 16,
    paddingBottom: 8,
    gap: 8,
    minHeight: 60,
  },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  back: { color: "white", fontSize: 32, fontFamily: appFonts.light },
  headerTitle: { fontFamily: appFonts.display, fontSize: 18, color: "white" },
  progress: { flexDirection: "row", gap: 4, alignItems: "center" },
  content: { padding: 16, paddingTop: 24, gap: 16, paddingBottom: 24 },
  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 12 },
  title: {
    color: "white",
    fontFamily: appFonts.display,
    fontSize: 20,
    lineHeight: 26,
  },
  headline: {
    color: "white",
    fontFamily: appFonts.display,
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
  },
  text: {
    color: "white",
    fontFamily: appFonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: "rgba(255,255,255,.55)",
    fontFamily: appFonts.light,
    fontSize: 13,
    lineHeight: 18,
  },
  value: {
    color: "white",
    fontFamily: appFonts.regular,
    fontWeight: "500",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "right",
    flex: 1,
  },
  pink: { color: "#ff517f" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  card: {
    backgroundColor: "rgba(255,255,255,.06)",
    borderColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  button: {
    minHeight: 52,
    borderRadius: 1000,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontFamily: appFonts.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "500",
  },
  notice: {
    color: "rgba(255,255,255,.65)",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: appFonts.light,
  },
  link: { minHeight: 44, flexDirection: "row", gap: 6, alignItems: "center" },
  field: {
    backgroundColor: "rgba(255,255,255,.06)",
    borderColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: "white",
    fontSize: 14,
    fontFamily: appFonts.light,
    minHeight: 100,
    textAlignVertical: "top",
  },
  center: { alignItems: "center", gap: 16 },
  circle: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    width: 56,
    height: 56,
  },
  label: {
    fontFamily: appFonts.regular,
    fontSize: 11,
    color: "rgba(255,255,255,.5)",
  },
  slot: {
    width: "30.2%",
    minHeight: 44,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { borderColor: "#ff517f", backgroundColor: "rgba(255,81,127,.12)" },
});
