import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  ScrollView,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { homeColors } from "./tokens";

export type HomeScrollHandle = { scrollToFeed: () => void };

/** One scroll offset raises the sheet first, then scrolls its contents.
 * Counter-translation keeps the contents at the sheet's top during the lift.
 * Both transforms clamp at the expanded position, so reversing is continuous.
 * A native sticky header then holds every discovery control above the scrolling feed.
 */
export function HomeScrollSheet({
  ref,
  hero,
  active = true,
  initialHeroHeight,
  header,
  background,
  children,
  onRefresh,
  refreshing=false,
}: {
  ref?: Ref<HomeScrollHandle>;
  hero: ReactNode;
  active?: boolean;
  initialHeroHeight: number;
  header: ReactNode;
  background: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [heroHeight, setHeroHeight] = useState(initialHeroHeight);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(357);
  const [reducedMotion, setReducedMotion] = useState(false);
  const ordinaryScroll = useRef<ScrollView>(null);
  const pinnedScroll = useRef<HomeScrollHandle>(null);
  // Keep the hero and the panel reachable on short screens and at large text sizes.
  const ordinaryScrolling =
    reducedMotion ||
    window.fontScale > 1.3 ||
    heroHeight > (viewportHeight || window.height) - 96 ||
    headerHeight > (viewportHeight || window.height) - insets.top - 180;

  useImperativeHandle(
    ref,
    () => ({
      scrollToFeed() {
        if (ordinaryScrolling)
          ordinaryScroll.current?.scrollTo({ y: heroHeight, animated: false });
        else pinnedScroll.current?.scrollToFeed();
      },
    }),
    [ordinaryScrolling, heroHeight],
  );

  useEffect(() => {
    let active = true;
    const updatePreference = (enabled: boolean) => {
      if (active) setReducedMotion(enabled);
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(updatePreference)
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      updatePreference,
    );
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return (
    <View
      testID="home-viewport"
      style={styles.screen}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
    >
      {ordinaryScrolling ? (
        <ScrollView
          ref={ordinaryScroll}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff477e" /> : undefined}
          testID="home-scroll"
          style={styles.scroll}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {active && <StatusBar style="light" />}
          <View
            testID="home-hero"
            onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}
          >
            {hero}
          </View>
          <View testID="home-sheet" style={styles.surface}>
            {background}
            <View
              onLayout={(event) =>
                setHeaderHeight(event.nativeEvent.layout.height)
              }
            >
              {header}
            </View>
            {children}
          </View>
        </ScrollView>
      ) : (
        <PinnedHomeSheet
          ref={pinnedScroll}
          active={active}
          hero={hero}
          heroHeight={heroHeight}
          viewportHeight={viewportHeight || window.height}
          topInset={insets.top}
          onHeroHeight={setHeroHeight}
          header={header}
          background={background}
          headerHeight={headerHeight}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onHeaderHeight={setHeaderHeight}
        >
          {children}
        </PinnedHomeSheet>
      )}
    </View>
  );
}

function PinnedHomeSheet({
  ref,
  active,
  hero,
  heroHeight,
  viewportHeight,
  topInset,
  onHeroHeight,
  header,
  background,
  headerHeight,
  onHeaderHeight,
  children,
  onRefresh,
  refreshing=false,
}: {
  ref?: Ref<HomeScrollHandle>;
  active: boolean;
  hero: ReactNode;
  heroHeight: number;
  viewportHeight: number;
  topInset: number;
  onHeroHeight: (height: number) => void;
  header: ReactNode;
  background: ReactNode;
  headerHeight: number;
  onHeaderHeight: (height: number) => void;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [offset] = useState(() => new Animated.Value(0));
  const [heroCovered, setHeroCovered] = useState(false);
  const travel = Math.max(1, heroHeight - topInset);
  const scroll = useRef<ScrollView>(null);
  useImperativeHandle(
    ref,
    () => ({
      scrollToFeed() {
        scroll.current?.scrollTo({ y: travel, animated: false });
      },
    }),
    [travel],
  );

  const lift = useMemo(
    () =>
      offset.interpolate({
        inputRange: [0, travel],
        outputRange: [travel, 0],
        extrapolate: "clamp",
      }),
    [offset, travel],
  );
  const contentLift = useMemo(() => Animated.multiply(lift, -1), [lift]);
  const statusCover = useMemo(
    () =>
      offset.interpolate({
        inputRange: [Math.max(0, travel - 32), travel],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    [offset, travel],
  );
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], {
        useNativeDriver: Platform.OS !== "web",
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const nextCovered = event.nativeEvent.contentOffset.y >= travel;
          setHeroCovered(nextCovered);
        },
      }),
    [offset, travel],
  );

  return (
    <>
      {active && <StatusBar style="light" />}
      <View
        testID="home-hero"
        onLayout={(event) => onHeroHeight(event.nativeEvent.layout.height)}
        aria-hidden={heroCovered}
        accessibilityElementsHidden={heroCovered}
        importantForAccessibility={heroCovered ? "no-hide-descendants" : "auto"}
      >
        {hero}
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.statusCover,
          { height: topInset + 32, opacity: statusCover },
        ]}
      />
      <Animated.View
        testID="home-sheet"
        style={[
          styles.sheet,
          { top: topInset, transform: [{ translateY: lift }] },
        ]}
      >
        {background}
        <Animated.ScrollView
          ref={scroll}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff477e" /> : undefined}
          testID="home-scroll"
          stickyHeaderIndices={[0]}
          style={styles.scroll}
          contentContainerStyle={{ paddingTop: travel }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
        >
          <View
            onLayout={(event) =>
              onHeaderHeight(event.nativeEvent.layout.height)
            }
          >
            {/* RN transfers the sticky child's styles to its own wrapper. Keep
                the lift on an inner view so the native sticky transform cannot replace it. */}
            <Animated.View
              testID="home-sticky-header"
              style={{ transform: [{ translateY: contentLift }] }}
            >
              {header}
            </Animated.View>
          </View>
          <Animated.View
            testID="home-sheet-content"
            style={{
              minHeight: Math.max(0, viewportHeight - topInset - headerHeight),
              transform: [{ translateY: contentLift }],
            }}
          >
            {children}
          </Animated.View>
        </Animated.ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: homeColors.burgundy, overflow: "hidden" },
  surface: {
    backgroundColor: homeColors.burgundy,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  sheet: {
    ...StyleSheet.absoluteFill,
    backgroundColor: homeColors.burgundy,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  scroll: { flex: 1 },
  statusCover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: homeColors.burgundy,
  },
});
