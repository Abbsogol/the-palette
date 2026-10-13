import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { HomeUpdate } from "./data";
import { homeAssets } from "./assets";
import { HomeIcon } from "./home-primitives";
import { LabButton, LabMessage, LabSheet } from "../lab-ui/primitives";
import { typography } from "../../theme/typography";
import { timeAgo } from "../stories/story-ui";

export function UpdateCard({
  post,
  onProfile,
  onReport,
  own = false,
  previewCard = false,
}: {
  own?: boolean;
  previewCard?: boolean;
  post: HomeUpdate;
  onProfile: (id: string) => void;
  onReport?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false),
    [menu, setMenu] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const long = post.body.length > 240 || post.body.split("\n").length > 5;
  return (
    <LinearGradient
      colors={["rgba(255,255,255,.13)", "rgba(255,255,255,.035)"]}
      style={s.card}
    >
      <View style={s.row}>
        <Pressable
          accessibilityRole={previewCard ? "text" : "button"}
          accessibilityLabel={
            previewCard
              ? `Update author ${post.name}`
              : `View ${post.name}'s profile`
          }
          disabled={previewCard}
          onPress={() => onProfile(post.creator_id)}
          style={[s.row, { flex: 1 }]}
        >
          <View style={s.avatar}>
            {post.avatar && !imageFailed ? (
              <Image
                source={post.avatar}
                style={s.avatarPhoto}
                contentFit="cover"
                cachePolicy="none"
                accessibilityLabel={`${post.name} profile photo`}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Text style={s.initial}>{post.name.charAt(0)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>
              {post.name}
            </Text>
            {!!post.username && (
              <Text style={s.handle} numberOfLines={1}>
                @{post.username}
              </Text>
            )}
            <Text style={s.meta}>{timeAgo(post.created_at)}</Text>
          </View>
        </Pressable>
        {onReport && !own && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Options for ${post.name}'s update`}
            onPress={() => setMenu(true)}
            style={s.icon}
          >
            <Text style={s.dots}>···</Text>
          </Pressable>
        )}
      </View>
      <View style={s.labelRow}>
        <View style={s.dot} />
        <Text style={s.label}>{own ? "YOUR UPDATE" : "FROM YOUR CIRCLE"}</Text>
      </View>
      <Text style={s.body}>
        {!expanded && long
          ? `${post.body.split("\n").slice(0, 5).join("\n").slice(0, 240).trimEnd()}…`
          : post.body}
      </Text>
      {long && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Show less" : "Read more"} from ${post.name}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((v) => !v)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={s.link}>{expanded ? "Show less" : "Read more"}</Text>
        </Pressable>
      )}
      {!previewCard && (
        <>
          <View style={s.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open profile for ${post.name}`}
            onPress={() => onProfile(post.creator_id)}
            style={s.cardFooter}
          >
            <Text style={s.link}>View profile</Text>
            <Text style={s.link}>↗</Text>
          </Pressable>
        </>
      )}
      <LabSheet
        visible={menu}
        title="Update options"
        onClose={() => setMenu(false)}
      >
        <Text style={s.muted}>
          Report this account if its updates are inappropriate.
        </Text>
        <LabButton
          title="Report account"
          secondary
          onPress={() => {
            setMenu(false);
            onReport?.(post.creator_id);
          }}
        />
      </LabSheet>
    </LinearGradient>
  );
}
export function UpdatesFeed({
  posts,
  loading,
  refreshing,
  error,
  onRetry,
  onMore,
  hasMore,
  onProfile,
  onDiscover,
  onNotifications,
  onReport,
  onCompose,
  preview = false,
  currentUserId,
}: {
  currentUserId?: string;
  posts: HomeUpdate[];
  loading?: boolean;
  refreshing?: boolean;
  error?: string;
  onRetry: () => void;
  onMore?: () => void;
  hasMore?: boolean;
  onProfile: (id: string) => void;
  onDiscover: () => void;
  onNotifications: () => void;
  onReport?: (id: string) => void;
  preview?: boolean;
  onCompose?: () => void;
}) {
  return (
    <View style={s.feed}>
      <View style={s.spread}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={s.title}>
            Updates
          </Text>
          <Text style={s.muted}>
            Studio news, open slots & little inspirations.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          onPress={onNotifications}
          style={s.notification}
        >
          <HomeIcon source={homeAssets.bell} size={20} />
        </Pressable>
      </View>
      {onCompose && <LabButton title="Create update" onPress={onCompose} />}
      <View style={s.spread}>
        <Text style={s.meta}>
          {preview ? "Sample updates" : "You & the creators you follow"}
        </Text>
        <View style={s.pill}>
          <Text style={s.meta}>Latest first</Text>
        </View>
      </View>
      {loading ? (
        <View style={s.empty}>
          <ActivityIndicator
            accessibilityLabel="Loading updates"
            color="#ff8dae"
          />
          <Text style={s.muted}>Catching up with your circle…</Text>
        </View>
      ) : (
        <>
          {!!error && (
            <>
              <LabMessage error>{error}</LabMessage>
              <LabButton
                title="Retry updates"
                secondary
                busy={refreshing}
                onPress={onRetry}
              />
            </>
          )}
          {!error && !posts.length && (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <HomeIcon source={homeAssets.comment} size={28} />
              </View>
              <Text style={s.emptyTitle}>Your circle starts here</Text>
              <Text style={[s.muted, { textAlign: "center" }]}>
                Follow artists and salons to see their latest news and
                inspiration.
              </Text>
              <LabButton title="Find artists & salons" onPress={onDiscover} />
            </View>
          )}
          {posts.map((post) => (
            <UpdateCard
              key={post.id}
              post={post}
              own={post.creator_id === currentUserId}
              onProfile={onProfile}
              onReport={onReport}
            />
          ))}
          {!error &&
            (hasMore ? (
              <LabButton
                title="Load more updates"
                secondary
                busy={refreshing}
                onPress={() => onMore?.()}
              />
            ) : (
              posts.length > 0 && (
                <View style={s.end}>
                  <View style={s.dot} />
                  <Text style={s.meta}>You’re all caught up</Text>
                </View>
              )
            ))}
          {!error && (
            <LabButton
              title="Refresh updates"
              secondary
              busy={refreshing}
              onPress={onRetry}
            />
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  feed: { paddingHorizontal: 24, gap: 20 },
  spread: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { ...typography.heading, color: "white" },
  muted: { ...typography.caption, color: "#f1ccd7" },
  meta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: "#e4bdca",
  },
  notification: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.22)",
    backgroundColor: "rgba(255,255,255,.08)",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,.08)",
  },
  card: {
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    gap: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#8b2949",
    borderWidth: 1,
    borderColor: "#d5819e",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPhoto: { width: 42, height: 42, borderRadius: 21 },
  handle: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: "#f2c9d9",
  },
  initial: { ...typography.section, color: "white" },
  name: { ...typography.body, color: "white" },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: { ...typography.section, color: "white", fontSize: 26 },
  labelRow: { flexDirection: "row", gap: 7, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#ff7aa1" },
  label: {
    ...typography.caption,
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#ffc4d7",
  },
  body: { ...typography.body, color: "#fff5f8", lineHeight: 25 },
  link: { ...typography.caption, color: "#ffd5e2" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,.12)" },
  cardFooter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  empty: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.15)",
    backgroundColor: "rgba(255,255,255,.05)",
    alignItems: "center",
    gap: 18,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    ...typography.heading,
    color: "white",
    fontSize: 26,
    lineHeight: 32,
    textAlign: "center",
  },
  end: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
