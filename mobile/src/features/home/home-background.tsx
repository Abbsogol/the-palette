import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { homeAssets } from "./assets";

/** Same opaque backdrop under the feed and its sticky controls: cards cannot bleed through. */
export function HomeBackground({ width }: { width: number }) {
  const scale = width / 393;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { overflow: "hidden", backgroundColor: "#3c000e" },
      ]}
    >
      <Image
        source={homeAssets.background}
        accessible={false}
        contentFit="cover"
        style={{
          position: "absolute",
          left: -20 * scale,
          top: -158 * scale,
          width: 657 * scale,
          height: 1415 * scale,
        }}
      />
      <LinearGradient
        colors={["#3c000e", "rgba(60,0,14,0)"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1226 * scale,
        }}
      />
    </View>
  );
}
