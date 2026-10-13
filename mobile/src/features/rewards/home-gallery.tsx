import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useState } from "react";
import { router } from "expo-router";
import { api } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { queryClient, useAccountQuery, useAuth } from "../../lib/auth";
import { useSubmission } from "../secondary/use-submission";
import { homeFonts as f } from "../home/tokens";
import type { HomeEntry, HomeEntryFeed } from "./types";

export const canVoteFromHome = (
  entry: HomeEntry,
  userId: string | undefined,
  enabled: boolean,
  now = Date.now(),
) =>
  enabled &&
  !!userId &&
  entry.user_id !== userId &&
  entry.campaign.status === "published" &&
  now >= Date.parse(entry.campaign.opens_at) &&
  now < Date.parse(entry.campaign.votes_close_at);

export function CompetitionGalleryView({
  items,
  enabled,
  userId,
  compact = false,
  loading,
  error,
  busy,
  onRetry,
  onVote,
  onDesign,
  onCompetition,
  onAll,
  onMore,
  preview = false,
}: {
  items: HomeEntry[];
  enabled: boolean;
  userId?: string;
  compact?: boolean;
  loading?: boolean;
  error?: string;
  busy?: boolean;
  onRetry: () => void;
  onVote: (entry: HomeEntry) => void;
  onDesign: (id: string) => void;
  onCompetition: (id: string) => void;
  onAll: () => void;
  onMore?: () => void;
  preview?: boolean;
}) {
  return (
    <View style={s.section}>
      <View style={s.row}>
        <Text accessibilityRole="header" style={s.heading}>
          Competition designs
        </Text>
        {compact && (
          <Pressable
            accessibilityRole="button"
            onPress={onAll}
            style={s.linkButton}
          >
            <Text style={s.link}>See all ›</Text>
          </Pressable>
        )}
      </View>
      <Text style={s.muted}>
        Discover the entries. Tap a design to see its details, or vote here.
      </Text>
      {!compact && (
        <Pressable accessibilityRole="button" onPress={onAll} style={s.join}>
          <Text style={s.text}>Find a competition · Enter your design ↗</Text>
        </Pressable>
      )}
      {preview && <Text style={s.muted}>Design preview · sample entries</Text>}
      {loading && !items.length && (
        <ActivityIndicator
          color="#ff8dae"
          accessibilityLabel="Loading competition designs"
        />
      )}
      {!!error && (
        <View>
          <Text accessibilityRole="alert" style={s.muted}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={s.linkButton}
          >
            <Text style={s.link}>Retry competition designs</Text>
          </Pressable>
        </View>
      )}
      {!loading && !error && !items.length && (
        <View style={s.empty}>
          <Text style={s.text}>The next challenge is coming</Text>
          <Text style={s.muted}>
            Published entries for your country will appear here automatically.
          </Text>
        </View>
      )}
      {!error && (
        <View style={s.grid}>
          {(compact ? items.slice(0, 6) : items).map((e) => (
            <View key={e.id} style={s.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View competition design ${e.snapshot.title}`}
                onPress={() => onDesign(e.design_id)}
                style={s.image}
              >
                {e.snapshot.image_url ? (
                  <Image
                    source={e.snapshot.image_url}
                    cachePolicy="none"
                    contentFit="cover"
                    style={StyleSheet.absoluteFill}
                    accessible={false}
                  />
                ) : (
                  <Text style={s.muted}>Image unavailable</Text>
                )}
                <Text style={s.badge}>
                  {e.rank ? `Winner #${e.rank}` : "COMPETITION"}
                </Text>
              </Pressable>
              <Text style={s.text} numberOfLines={2}>
                {e.snapshot.title}
              </Text>
              <Text style={s.muted} numberOfLines={1}>
                @{e.username}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View competition ${e.campaign.title}`}
                onPress={() => onCompetition(e.campaign.id)}
                style={s.linkButton}
              >
                <Text style={s.link} numberOfLines={2}>
                  {e.campaign.title} ↗
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${e.liked ? "Remove vote from" : "Vote for"} ${e.snapshot.title}`}
                accessibilityState={{ selected: e.liked }}
                disabled={busy || !canVoteFromHome(e, userId, enabled)}
                onPress={() => onVote(e)}
                style={[s.vote, e.liked && s.voted]}
              >
                <Text style={s.text}>
                  {e.liked ? "♥" : "♡"} {e.final_votes ?? e.votes} ·{" "}
                  {e.user_id === userId
                    ? "Your entry"
                    : e.campaign.status === "results"
                      ? "Final votes"
                      : e.liked
                        ? "Voted"
                        : "Vote"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {!compact && onMore && !error && (
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={onMore}
          style={s.join}
        >
          <Text style={s.text}>
            {loading ? "Loading…" : "Load more competition designs"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function CompetitionGallery({
  active,
  compact,
  onAll,
  onDesign,
}: {
  active: boolean;
  compact: boolean;
  onAll: () => void;
  onDesign: (id: string) => void;
}) {
  const [limit, setLimit] = useState(25),
    { session } = useAuth(),
    submit = useSubmission();
  const query = useAccountQuery(
    ["competition-home", limit],
    async () => {
      const pages = await Promise.all(
        Array.from({ length: Math.ceil(limit / 25) }, (_, i) =>
          api<HomeEntryFeed>(`/mobile/rewards/entries?offset=${i * 25}`),
        ),
      );
      return {
        ...pages[0],
        hasMore: pages[pages.length - 1].hasMore,
        items: pages.flatMap((p) => p.items),
      };
    },
    active && !!session,
  );
  const refresh = () => {
    void query.refetch();
    submit.clearError();
  };
  return (
    <CompetitionGalleryView
      items={query.error ? [] : query.data?.items || []}
      enabled={!!query.data?.enabled}
      userId={session?.user.id}
      compact={compact}
      loading={query.isFetching}
      error={
        submit.error ||
        (query.error
          ? "Competition designs couldn’t load. Please try again."
          : undefined)
      }
      busy={submit.busy}
      onRetry={refresh}
      onDesign={onDesign}
      onAll={onAll}
      onCompetition={(id) =>
        router.push({ pathname: "/rewards/[id]", params: { id } })
      }
      onMore={query.data?.hasMore ? () => setLimit((v) => v + 25) : undefined}
      onVote={(e) => {
        void submit.run(async () => {
          const ticket = accountScope.capture();
          await api(`/mobile/rewards/campaigns/${e.campaign.id}`, {
            action: "vote",
            entryId: e.id,
            liked: !e.liked,
          });
          accountScope.assert(ticket);
          await queryClient.invalidateQueries();
        });
      }}
    />
  );
}
const s = StyleSheet.create({
  section: { paddingHorizontal: 24, gap: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { fontFamily: f.regular, fontSize: 24, color: "white", flex: 1 },
  text: { fontFamily: f.regular, fontSize: 13, lineHeight: 18, color: "white" },
  muted: {
    fontFamily: f.light,
    fontSize: 12,
    lineHeight: 18,
    color: "#e8bfcd",
  },
  link: {
    fontFamily: f.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "#ffafce",
  },
  linkButton: { minHeight: 44, justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card: { width: "47%", gap: 6 },
  image: {
    height: 210,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#6d2439",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 12,
    padding: 6,
    fontFamily: f.regular,
    fontSize: 9,
    letterSpacing: 1,
    color: "white",
    backgroundColor: "rgba(52,0,15,.85)",
  },
  vote: {
    minHeight: 44,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.1)",
    padding: 6,
  },
  voted: { backgroundColor: "#932044" },
  join: {
    borderRadius: 24,
    minHeight: 48,
    borderColor: "#a06478",
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  empty: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
    backgroundColor: "rgba(255,255,255,.06)",
  },
});
