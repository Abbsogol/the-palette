import type { PropsWithChildren, ReactNode } from "react";
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
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import {
  router,
  usePathname,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useAuth } from "../lib/auth";

import { protectedReturnPath } from "../lib/links";
export const palette = {
  background: "#281920",
  surface: "#45252e",
  text: "#fff7f8",
  muted: "#e4cbd1",
  burgundy: "#660007",
  rose: "#ff517f",
  border: "#86525e",
  danger: "#ffd0d8",
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 20, paddingBottom: 40 },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  subtitle: { color: palette.text, fontSize: 20, fontWeight: "600" },
  text: { color: palette.text, fontSize: 16, lineHeight: 24 },
  muted: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  card: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  field: {
    color: palette.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    backgroundColor: "#321c25",
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  chip: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: "center",
  },
});
export function Screen({
  children,
  title,
  scroll = true,
  back = false,
}: PropsWithChildren<{ title?: string; scroll?: boolean; back?: boolean }>) {
  const content = (
    <>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ minHeight: 44, justifyContent: "center" }}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        >
          <Text style={styles.text}>‹ Back</Text>
        </Pressable>
      )}
      {title && (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      )}
      {children}
    </>
  );
  return (
    <View style={styles.screen}>
      <Image
        source={require("../../assets/figma/discovery-background.png")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessible={false}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(25,8,17,0.34)" },
        ]}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              {content}
            </ScrollView>
          ) : (
            <View style={[styles.content, { flex: 1 }]}>{content}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
export function Button({
  title,
  onPress,
  disabled,
  busy,
  secondary = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={{ opacity: disabled || busy ? 0.55 : 1 }}
    >
      <LinearGradient
        colors={
          secondary
            ? [palette.surface, palette.surface]
            : [palette.burgundy, "#c92253"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.button,
          secondary && { borderWidth: 1, borderColor: palette.border },
        ]}
      >
        {busy ? (
          <ActivityIndicator
            color="white"
            accessibilityLabel={`${title}, in progress`}
          />
        ) : (
          <Text style={styles.buttonText}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#bd9aa4"
        style={styles.field}
        {...props}
      />
    </View>
  );
}
export function Chips({
  values,
  value,
  onChange,
  label,
}: {
  values: readonly string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {label && <Text style={styles.muted}>{label}</Text>}
      <View style={styles.row}>
        {values.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ checked: item === value }}
            accessibilityLabel={item}
            onPress={() => onChange(item)}
            style={[
              styles.chip,
              {
                backgroundColor: item === value ? palette.burgundy : "#3d2530",
              },
            ]}
          >
            <Text style={styles.text}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Notice({
  children,
  error = false,
}: PropsWithChildren<{ error?: boolean }>) {
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.text, error && { color: palette.danger }]}
    >
      {children}
    </Text>
  );
}
export function Loading() {
  return (
    <ActivityIndicator
      accessibilityLabel="Loading"
      color={palette.rose}
      size="large"
    />
  );
}
export function QueryState({
  loading,
  error,
  empty,
  retry,
  children,
}: {
  loading: boolean;
  error: Error | null;
  empty?: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading) return <Loading />;
  if (error)
    return (
      <Card>
        <Notice error>{error.message}</Notice>
        <Button title="Try again" onPress={retry} />
      </Card>
    );
  if (empty) return <Notice>Nothing here yet.</Notice>;
  return <>{children}</>;
}
export function RequireAuth({ children }: PropsWithChildren) {
  const { session, ready } = useAuth();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  if (!ready) return <Loading />;
  if (!session)
    return (
      <Card>
        <Text style={styles.subtitle}>Make it yours</Text>
        <Notice>
          Sign in to save, message and book with your favourite creators.
        </Notice>
        <Button
          title="Sign in"
          onPress={() =>
            router.push({
              pathname: "/auth",
              params: { returnTo: protectedReturnPath(pathname, params) },
            } as Href)
          }
        />
      </Card>
    );
  return <>{children}</>;
}
export const money = (value: number, currency = "AED") =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(
    Number(value),
  );
