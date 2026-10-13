import { StyleSheet, View, type ImageStyle } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { HeroBlurMask } from "./hero-blur-mask";

// Home main / 345:3624: progressive background blur, Figma radius 0–20
// (CSS Gaussian blur 0–10px). Crossfade aligned copies with increasing blur
// to avoid the solid system tint that BlurView adds on iOS and web.
const blurSteps = [2.5, 5, 7.5, 10];

export function HeroPhoto({
  source, label, imageStyle, blurTop, blurHeight,
}: {
  source: ImageSource | number;
  label: string;
  imageStyle: ImageStyle;
  blurTop: number;
  blurHeight: number;
}) {
  return (
    <>
      <Image
        source={source}
        accessibilityLabel={label}
        accessible
        contentFit="cover"
        contentPosition="top center"
        style={imageStyle}
      />
      <View
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[s.blur, { top: blurTop, height: blurHeight }]}
      >
        {blurSteps.map((radius, index) => (
          <HeroBlurMask key={radius} start={index / 4} end={(index + 1) / 4}>
            <Image
              source={source}
              accessible={false}
              contentFit="cover"
              contentPosition="top center"
              blurRadius={radius}
              style={[imageStyle, { top: -blurTop }]}
            />
          </HeroBlurMask>
        ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  blur: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
});
