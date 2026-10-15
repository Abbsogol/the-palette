import { useEffect, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { homeAssets } from "../features/home/assets";
import { HomeGlass, HomeIcon } from "../features/home/home-primitives";
import { homeFonts } from "../features/home/tokens";
import { ProgressiveBlur } from "../features/home/progressive-blur";

export const homeTabs = [
  { name: "index", title: "Home", icon: homeAssets.home },
  { name: "search", title: "Search", icon: homeAssets.search },
  { name: "lab", title: "Lab", icon: homeAssets.lab },
  { name: "messages", title: "Messages", icon: homeAssets.messages },
  { name: "saved", title: "Saved", icon: homeAssets.saved },
  { name: "profile", title: "Profile", icon: homeAssets.profile },
] as const;

export function HomeNavigation({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const compact = width < 370 || fontScale > 1.3;
  if (keyboardOpen) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[s.overlay, { paddingBottom: Math.max(insets.bottom, 34) }]}
    >
      <ProgressiveBlur />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(32,5,11,0)", "rgba(32,5,11,.8)"]}
        style={StyleSheet.absoluteFill}
      />
      <HomeGlass style={s.bar} intensity={18} tint="dark">
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(92,34,48,.2)", "rgba(209,94,122,.2)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {homeTabs.map((tab) => {
          const active = selected === tab.name;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(tab.name)}
              style={[
                s.item,
                active &&
                  !compact && { width: tab.name === "messages" ? 120 : 114 },
                !active && !compact && { width: 28 },
                compact && { flex: 1 },
              ]}
              hitSlop={{ left: 6, right: 6 }}
            >
              {active && (
                <LinearGradient
                  colors={["#660007", "#ff517f"]}
                  locations={[0.47832, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, s.pill]}
                />
              )}
              <View
                style={{
                  width: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <HomeIcon
                  source={tab.icon}
                  size={
                    tab.name === "messages" || tab.name === "saved" ? 20 : 16
                  }
                />
              </View>
              {active && !compact && <Text style={s.label}>{tab.title}</Text>}
            </Pressable>
          );
        })}
      </HomeGlass>
    </View>
  );
}

export function HomeTabBar({
  state,
  navigation,
  onBeforeSelect,
}: BottomTabBarProps & {
  onBeforeSelect?: (name: string) => boolean;
}) {
  const selected = state.routes[state.index].name;
  return (
    <HomeNavigation
      selected={selected}
      onSelect={(name) => {
        if (onBeforeSelect && !onBeforeSelect(name)) return;
        const route = state.routes.find((route) => route.name === name);
        if (!route) return;
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (!event.defaultPrevented && name !== selected)
          navigation.navigate(route.name, route.params);
      }}
    />
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  bar: {
    minHeight: 60,
    borderRadius: 1000,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  item: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 1000,
  },
  pill: { borderRadius: 1000 },
  label: {
    fontFamily: homeFonts.regular,
    fontSize: 14,
    lineHeight: 18,
    color: "white",
  },
});
