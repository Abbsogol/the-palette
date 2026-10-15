import { StyleSheet, View, type ViewStyle } from "react-native";
import type { ProgressiveBlurProps } from "./progressive-blur";

export function ProgressiveBlur({ reversed = false }: ProgressiveBlurProps) {
  const webMask = {
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    maskImage: `linear-gradient(to bottom, ${reversed ? "black, transparent" : "transparent, black"})`,
    WebkitMaskImage: `linear-gradient(to bottom, ${reversed ? "black, transparent" : "transparent, black"})`,
  } as ViewStyle;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, webMask]} />
  );
}
