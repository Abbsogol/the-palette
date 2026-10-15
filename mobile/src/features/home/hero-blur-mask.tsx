import type { PropsWithChildren } from "react";
import { StyleSheet } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

export type HeroBlurMaskProps = PropsWithChildren<{ start: number; end: number }>;

export function HeroBlurMask({ start, end, children }: HeroBlurMaskProps) {
  return (
    <MaskedView
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      maskElement={
        <LinearGradient
          colors={["transparent", "transparent", "black", "black"]}
          locations={[0, start, end, 1]}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      {children}
    </MaskedView>
  );
}
