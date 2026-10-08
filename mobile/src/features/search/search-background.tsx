import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { searchAssets } from "./assets";
export function SearchBackground({
  width,
  variant = "search",
}: {
  width: number;
  variant?: "search" | "messages";
}) {
  const scale = width / 393;
  const crop =
    variant === "messages"
      ? { left: -174, top: -640, width: 908, height: 1955 }
      : { left: -21, top: -7, width: 629, height: 1353 };
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
    >
      <Image
        source={searchAssets.background}
        accessible={false}
        contentFit="cover"
        style={{
          position: "absolute",
          left: crop.left * scale,
          top: crop.top * scale,
          width: crop.width * scale,
          height: crop.height * scale,
        }}
      />
    </View>
  );
}
