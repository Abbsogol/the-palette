import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { homeAssets as a } from "./assets";
import { HeroPhoto } from "./hero-photo";
import { HomeIcon } from "./home-primitives";
import { homeColors as c, homeFonts as f } from "./tokens";

const defaultSlides = [
  { image: a.hero, label: "Nail and beauty campaign photograph" },
  {
    image: require("../../../assets/home/hero-second.png"),
    label: "Burgundy nail art with silver jewellery",
  },
];

export function HomeHero({
  width,
  height,
  headerTop,
  onNotifications,
  onFavorites,
  heroes,
}: {
  heroes?: import("./published-content").PublishedHero[];
  width: number;
  height: number;
  headerTop: number;
  onNotifications: () => void;
  onFavorites: () => void;
}) {
  const slides = heroes?.length ? heroes.map(h=>({image:{uri:h.imageUrl},label:h.alt,title:h.title,rotate:h.rotate})) : defaultSlides.map((h,i)=>({...h,title:"Nail & beauty\ndesign library",rotate:i===0?180:0}));
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const scale = Math.min(1, width / 393);
  // Home main: panel starts at 491; the 169px overlay starts at 342
  // and continues 20px beneath it, with the title inset by 32px.
  const blurHeight = 169 * scale;
  const blurTop = height - 149 * scale;
  // Continue the photo behind the sheet's rounded top corners.
  const photoHeight = height + 32;

  useEffect(() => {
    // Keep the selected photograph aligned when the viewport changes width.
    scroll.current?.scrollTo({ x: Math.min(pageRef.current,slides.length-1) * width, animated: false });
  }, [width,slides.length]);

  const select = (index: number) => {
    pageRef.current = index;
    setPage(index);
    scroll.current?.scrollTo({ x: index * width, animated: false });
  };

  return (
    <View style={[s.hero, { width, height }]}>
      <View
        style={[s.photoViewport, { height: photoHeight }]}
      >
        <ScrollView
          ref={scroll}
          testID="home-hero-carousel"
          horizontal
          pagingEnabled
          directionalLockEnabled
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
          onScroll={(event) => {
            const index = Math.max(0, Math.min(slides.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / width)));
            if (pageRef.current !== index) {
              pageRef.current = index;
              setPage(index);
            }
          }}
        >
          {slides.map((slide, index) => (
            <View
              key={slide.label}
              testID={`home-hero-slide-${index + 1}`}
              aria-hidden={Math.min(page,slides.length-1) !== index}
              accessibilityElementsHidden={Math.min(page,slides.length-1) !== index}
              importantForAccessibility={Math.min(page,slides.length-1) !== index ? "no-hide-descendants" : "auto"}
              style={{ width, height: photoHeight, overflow: "hidden" }}
            >
              <HeroPhoto
                source={slide.image}
                label={slide.label}
                blurTop={blurTop}
                blurHeight={blurHeight}
                imageStyle={{
                  position: "absolute", top: 0, left: 0, width,
                  height: slide.rotate === 180 ? Math.max((506 * width) / 392, photoHeight) : photoHeight,
                  transform: slide.rotate === 180 ? [{ rotate: "180deg" }] : undefined,
                }}
              />
            </View>
          ))}
        </ScrollView>
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(28,0,9,.5)", "rgba(28,0,9,0)"]}
        style={[s.topShade, { height: headerTop + 100 }]}
      />
      <View pointerEvents="none" style={[s.headlineBackdrop, { top: blurTop, height: blurHeight }]}>
        <LinearGradient
          colors={["rgba(41,0,10,0)", "rgba(41,0,10,.8)"]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View pointerEvents="none" style={[s.brand, { top: headerTop }]}>
        <Text style={s.logo}>LaQue</Text>
      </View>
      <View pointerEvents="none" style={[s.headline, { top: blurTop + 32 * scale }]}>
        <Text
          accessibilityRole="header"
          accessibilityLabel={slides[Math.min(page,slides.length-1)]?.title.replace(/\s+/g," ")}
          style={[s.title, { fontSize: 38 * scale, lineHeight: 45.6 * scale }]}
        >
          {slides[Math.min(page,slides.length-1)]?.title || "Nail & beauty\ndesign library"}
        </Text>
      </View>
      <View style={[s.actions, { top: headerTop - 5 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications"
          onPress={onNotifications} style={s.hitTarget}>
          <View style={s.circle}><HomeIcon source={a.bell} size={16} /></View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open saved designs"
          onPress={onFavorites} style={s.hitTarget}>
          <View style={s.circle}><HomeIcon source={a.star} size={16} /></View>
        </Pressable>
      </View>
      <View style={s.pagination}>
        {slides.map((slide, index) => (
          <Pressable
            key={slide.label}
            accessibilityRole="button"
            accessibilityLabel={`Show hero photo ${index + 1} of ${slides.length}`}
            accessibilityState={{ selected: Math.min(page,slides.length-1) === index }}
            onPress={() => select(index)}
            style={s.pageTarget}
            hitSlop={{ top: 6, bottom: 6 }}
          >
            <View style={[s.dot, Math.min(page,slides.length-1) === index && s.activeDot]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: c.burgundy, overflow: "visible" },
  photoViewport: {
    position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden",
  },
  topShade: { position: "absolute", top: 0, left: 0, right: 0 },
  headlineBackdrop: {
    position: "absolute", left: 0, right: 0,
    overflow: "hidden",
  },
  brand: { position: "absolute", left: 24 },
  logo: { fontFamily: f.display, fontSize: 24, lineHeight: 29, color: "white" },
  headline: { position: "absolute", left: 24, right: 24 },
  title: { fontFamily: f.display, color: "white" },
  actions: { position: "absolute", right: 18, flexDirection: "row" },
  hitTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  circle: {
    width: 32, height: 32, borderRadius: 100,
    borderWidth: 1, borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.1)",
    alignItems: "center", justifyContent: "center",
  },
  pagination: {
    position: "absolute", bottom: 0, alignSelf: "center", flexDirection: "row",
  },
  pageTarget: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.4)" },
  activeDot: { width: 18, backgroundColor: "white" },
});
