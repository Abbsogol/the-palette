import { typography } from "../../theme/typography";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { homeAssets as a } from "./assets";
import { homeColors as c, homeFonts as f } from "./tokens";
import { HomeGlass, HomeIcon, compactCount } from "./home-primitives";

export type HomeCommunityStats = {
  artists: number;
  posts: number;
  approximate?: boolean;
  // Only provided by the visual fixture, or a real featured post with known totals.
  likes?: number;
  comments?: number;
};
export type HomeCommunityState = {
  stats?: HomeCommunityStats;
  loading?: boolean;
  error?: string;
  retry: () => void;
};

export function HomeCommunity({
  width,
  state,
  onPress,
}: {
  width: number;
  state: HomeCommunityState;
  onPress: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const photoWidth = width - 16;
  const scale = photoWidth / 377;
  const tileWidth = largeText ? width - 48 : (width - 56) / 2;
  const cropWidth = tileWidth + 28.5;
  const cropHeight = (cropWidth * 190) / 169;
  const stats = state.error ? undefined : state.stats;
  const count = (value: number | undefined) =>
    value === undefined
      ? ""
      : `${value.toLocaleString("en")}${stats?.approximate ? "+" : ""}\n`;
  return (
    <View testID="home-community" style={s.card}>
      <View
        testID="home-community-photo"
        style={[s.photo, { width: photoWidth, height: 280 * scale }]}
      >
        <Image
          source={a.community}
          accessible={false}
          contentFit="fill"
          style={{
            position: "absolute",
            left: 0,
            top: -280 * scale * 0.4932,
            width: photoWidth + 1,
            height: 280 * scale * 1.688,
          }}
        />
        {stats?.likes !== undefined && stats.comments !== undefined && (
          <HomeGlass intensity={24} style={[s.reactions, { top: 222 * scale }]}>
            <HomeIcon source={a.heartFilled} size={14} />
            <Text style={s.reactionText}>{compactCount(stats.likes)}</Text>
            <HomeIcon source={a.comment} size={14} />
            <Text style={s.reactionText}>{compactCount(stats.comments)}</Text>
          </HomeGlass>
        )}
        <View
          pointerEvents="none"
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          {[
            {
              x: 310,
              y: 190,
              angle: "0deg",
              heartX: 18,
              heartY: 17,
              heartAngle: "12.31deg",
            },
            {
              x: 286.594,
              y: 220.594,
              angle: "-14.99deg",
              heartX: 14.91,
              heartY: 16.08,
              heartAngle: "27.3deg",
            },
            {
              x: 325.6605,
              y: 227.0705,
              angle: "17.5deg",
              heartX: 19.35,
              heartY: 16.48,
              heartAngle: "-5.19deg",
            },
          ].map((avatar, index) => (
            <View
              key={index}
              style={[
                s.avatar,
                {
                  left: avatar.x * scale,
                  top: avatar.y * scale,
                  transform: [{ rotate: avatar.angle }],
                },
              ]}
            >
              <Image
                source={a.avatars[index]}
                accessible={false}
                contentFit="cover"
                style={s.avatarImage}
              />
              <View
                style={{
                  position: "absolute",
                  left: avatar.heartX,
                  top: avatar.heartY,
                  transform: [{ rotate: avatar.heartAngle }],
                }}
              >
                <HomeIcon source={a.avatarHearts[index]} size={14} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={s.content}>
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={s.heading}>
            Explore our community
          </Text>
          <Text style={s.description}>
            Discover nail artists, share your designs, follow creators, and get
            inspired by the latest trends.
          </Text>
        </View>
        <View style={[s.tiles, largeText && { flexDirection: "column" }]}>
          {["Artists", "Community Posts"].map((label, index) => (
            <View
              key={label}
              testID={`home-community-${index === 0 ? "artists" : "posts"}`}
              style={[
                s.tile,
                largeText && {
                  flex: 0,
                  width: "100%",
                  height: Math.max(124, 68 * fontScale + 16),
                },
              ]}
            >
              <View
                style={{
                  position: "absolute",
                  left: -14,
                  top: index === 0 ? -32 : 0,
                  width: cropWidth,
                  height: cropHeight,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={index === 0 ? a.artists : a.posts}
                  accessible={false}
                  contentFit="fill"
                  style={{
                    position: "absolute",
                    width: cropWidth * (index === 0 ? 1.6301 : 1),
                    height: cropHeight * (index === 0 ? 2.3109 : 1.1121),
                    left: cropWidth * (index === 0 ? -0.5954 : 0.0015),
                    top: -cropHeight * (index === 0 ? 0.8099 : 0.2736),
                  }}
                />
              </View>
              <HomeGlass
                intensity={28}
                style={[
                  s.tileGlass,
                  { width: largeText ? tileWidth - 24 : 134 },
                ]}
              >
                {state.loading && !stats && (
                  <ActivityIndicator
                    color="white"
                    size="small"
                    accessibilityLabel={`Loading ${label.toLowerCase()} total`}
                  />
                )}
                <Text style={s.total}>
                  {count(index === 0 ? stats?.artists : stats?.posts)}
                  {label}
                </Text>
              </HomeGlass>
            </View>
          ))}
        </View>
        {state.error && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry community totals"
            onPress={state.retry}
            style={s.retry}
          >
            <Text style={s.description}>{state.error} Tap to retry.</Text>
          </Pressable>
        )}
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={s.button}>
        <Text style={s.buttonText}>Explore Community</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: c.rose,
    borderRadius: 32,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  photo: { borderRadius: 24, overflow: "hidden" },
  reactions: {
    position: "absolute",
    left: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 100,
  },
  reactionText: {
    fontFamily: f.regular,
    fontSize: 12,
    lineHeight: 14,
    color: "white",
    marginRight: 4,
  },
  avatar: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "white",
  },
  avatarImage: { width: 30, height: 30, borderRadius: 100 },
  content: { marginTop: 20, paddingHorizontal: 16, gap: 16 },
  heading: {
    fontFamily: f.display,
    fontSize: 28,
    lineHeight: 34,
    color: c.roseText,
  },
  description: {
    fontFamily: f.light,
    fontSize: 16,
    lineHeight: 19,
    color: c.roseText,
  },
  tiles: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    height: 124,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tileGlass: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: "center",
  },
  total: {
    fontFamily: f.regular,
    fontSize: 14,
    lineHeight: 17,
    color: "white",
    textAlign: "center",
  },
  retry: { minHeight: 44, justifyContent: "center" },
  button: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: c.burgundy,
    borderRadius: 100,
    minHeight: 51,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    ...typography.button,
    color: "white",
    textAlign: "center",
  },
});
