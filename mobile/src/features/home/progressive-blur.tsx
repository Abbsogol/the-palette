import type { RefObject } from "react";
import { StyleSheet, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

export type ProgressiveBlurProps = {
  target?: RefObject<View | null>;
  reversed?: boolean;
};

export function ProgressiveBlur({
  target,
  reversed = false,
}: ProgressiveBlurProps) {
  return (
    <MaskedView
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      maskElement={
        <LinearGradient
          colors={
            reversed ? ["black", "transparent"] : ["transparent", "black"]
          }
          style={{ flex: 1 }}
        />
      }
    >
      <BlurView
        blurTarget={target}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={20}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
    </MaskedView>
  );
}
