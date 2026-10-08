import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { BlurView, type BlurTint } from "expo-blur";
// Hermes versions can ignore Intl's compact notation. Keep labels identical across platforms.
export function compactCount(count: number) {
  if (count >= 1_000_000) return `${Number((count / 1_000_000).toFixed(1))}m`;
  if (count >= 1_000) return `${Number((count / 1_000).toFixed(1))}k`;
  return String(count);
}

export function HomeIcon({
  source,
  size = 20,
}: {
  source: number;
  size?: number;
}) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
    />
  );
}

export function HomeGlass({
  children,
  style,
  intensity = 20,
  tint = "light",
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: BlurTint;
}) {
  return (
    <View style={[s.glass, style]}>
      <BlurView
        pointerEvents="none"
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          s.glassEdge,
          { borderRadius: StyleSheet.flatten(style)?.borderRadius },
        ]}
      />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  glass: { overflow: "hidden" },
  glassEdge: {
    borderRadius: 1000,
    borderWidth: 0.7,
    borderColor: "rgba(255,255,255,.28)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
});
