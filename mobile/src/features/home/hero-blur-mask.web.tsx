import { StyleSheet, View, type ViewStyle } from "react-native";
import type { HeroBlurMaskProps } from "./hero-blur-mask";

export function HeroBlurMask({ start, end, children }: HeroBlurMaskProps) {
  const mask = `linear-gradient(to bottom, transparent ${start * 100}%, black ${end * 100}%)`;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, {
        maskImage: mask,
        WebkitMaskImage: mask,
      } as ViewStyle]}
    >
      {children}
    </View>
  );
}
