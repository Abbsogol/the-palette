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
import { router } from "expo-router";
import { useAccountQuery } from "../../lib/auth";
import { api } from "../../lib/api";
import { typography } from "../../theme/typography";
import { HomeIcon } from "../home/home-primitives";
import { homeAssets } from "../home/assets";
import { LabButton, LabMessage } from "../lab-ui/primitives";
import type { Campaign, News, RewardFeed } from "./types";
import { rewardDate, rewardPhase, regionName } from "./types";

export function UpdatesHubView({
  news,
  rewards,
  loading,
  error,
  onRetry,
  onCampaign,
  onProfile,
  onCountry,
  onNotifications,
  onMore,
  preview = false,
  initialTab = "News",
}: {
  news: News[];
  rewards: RewardFeed;
  loading?: boolean;
  error?: string;
  onRetry: () => void;
  onCampaign: (id: string) => void;
  onProfile: (id: string) => void;
  onCountry: () => void;
  onNotifications: () => void;
  onMore?: () => void;
  preview?: boolean;
  initialTab?: "News" | "Rewards";
}) {
  const [tab, setTab] = useState<"News" | "Rewards">(initialTab);
  return (
    <View style={s.feed}>
      <View style={s.row}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text accessibilityRole="header" style={s.title}>
            Updates
          </Text>
          <Text style={s.muted}>LaQue news & designer rewards.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          onPress={onNotifications}
          style={s.circle}
        >
          <HomeIcon source={homeAssets.bell} size={20} />
        </Pressable>
      </View>
      <View style={s.tabs}>
        {(["News", "Rewards"] as const).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[s.tab, tab === t && s.selected]}
            onPress={() => setTab(t)}
          >
            <Text style={s.text}>{t}</Text>
          </Pressable>
        ))}
      </View>
      {preview && <Text style={s.muted}>Design preview · sample content</Text>}
      {loading && (
        <ActivityIndicator
          color="#ff8dae"
          accessibilityLabel="Loading Updates"
        />
      )}
      {error && (
        <>
          <LabMessage error>{error}</LabMessage>
          <LabButton secondary title="Retry Updates" onPress={onRetry} />
        </>
      )}
      {tab === "News" ? (
        <>
          {news.map((n) => (
            <LinearGradient
              key={n.id}
              colors={["rgba(255,255,255,.14)", "rgba(255,255,255,.04)"]}
              style={s.card}
            >
              <Text style={s.eyebrow}>LAQUE · OFFICIAL UPDATE</Text>
              <Text accessibilityRole="header" style={s.heading}>
                {n.title}
              </Text>
              {n.published_at && (
                <Text style={s.muted}>{rewardDate(n.published_at)}</Text>
              )}
              <Text style={s.text}>{n.body}</Text>
            </LinearGradient>
          ))}
          {!loading && !error && !news.length && (
            <View style={s.card}>
              <Text style={s.heading}>You’re up to date</Text>
              <Text style={s.muted}>
                Official news from LaQue will appear here. Share your own posts
                in Community.
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={s.row}>
            <Text style={[s.muted, { flex: 1 }]}>
              For {rewards.country || "your profile country"}
            </Text>
            <Pressable
              style={s.country}
              accessibilityRole="button"
              onPress={onCountry}
            >
              <Text style={s.link}>Profile country ›</Text>
            </Pressable>
          </View>
          <Text style={s.muted}>
            Show your Lab creations. Discover designers, support their entries
            and celebrate the winners.
          </Text>
          {rewards.winners.length > 0 && (
            <>
              <Text accessibilityRole="header" style={s.heading}>
                Latest winners
              </Text>
              <Text style={s.muted}>Celebrating our winners for 30 days.</Text>
              {rewards.winners.map((w) => (
                <View style={s.card} key={w.entry_id}>
                  <Text style={s.eyebrow}>
                    WINNER #{w.rank} · {w.campaign_title}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View winner ${w.display_name}'s profile`}
                    onPress={() => onProfile(w.user_id)}
                    style={s.row}
                  >
                    {w.snapshot.image_url && (
                      <Image
                        source={w.snapshot.image_url}
                        cachePolicy="none"
                        style={s.thumb}
                        contentFit="cover"
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.heading}>{w.display_name}</Text>
                      <Text style={s.muted}>
                        @{w.username} · {w.votes} votes
                      </Text>
                      <Text style={s.link}>View profile ↗</Text>
                    </View>
                  </Pressable>
                  <LabButton
                    title="View winning round"
                    secondary
                    onPress={() => onCampaign(w.campaign_id)}
                  />
                </View>
              ))}
            </>
          )}
          {rewards.items.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onOpen={() => onCampaign(c.id)}
            />
          ))}
          {!loading && !error && !rewards.items.length && (
            <View style={s.card}>
              <Text style={s.eyebrow}>REWARDS</Text>
              <Text style={s.heading}>The next challenge is coming</Text>
              <Text style={s.muted}>
                Published competitions for your profile country will appear
                here. Keep creating in Lab.
              </Text>
              <Text style={s.muted}>
                No extra generation credits are issued for competitions.
              </Text>
            </View>
          )}
        </>
      )}
      {onMore && <LabButton title="Load more" secondary onPress={onMore} />}
      <LabButton title="Refresh Updates" secondary onPress={onRetry} />
    </View>
  );
}
export function CampaignCard({
  campaign: c,
  onOpen,
}: {
  campaign: Campaign;
  onOpen: () => void;
}) {
  return (
    <LinearGradient colors={["#872944", "#491221"]} style={s.card}>
      <View style={s.row}>
        <Text style={s.eyebrow}>{rewardPhase(c).toUpperCase()}</Text>
        <Text style={[s.muted, { marginLeft: "auto" }]}>
          {regionName(c.country_codes)}
        </Text>
      </View>
      <Text accessibilityRole="header" style={s.heading}>
        {c.title}
      </Text>
      <Text style={s.prize}>{c.prize_label}</Text>
      <Text style={s.text}>{c.description}</Text>
      <Text style={s.muted}>{c.theme} · up to 3 designs per entrant</Text>
      <Text style={s.muted}>
        Entries close {rewardDate(c.entries_close_at)}
      </Text>
      <LabButton
        title={c.status === "results" ? "See winners" : "View competition"}
        onPress={onOpen}
      />
    </LinearGradient>
  );
}
export function UpdatesHub({
  announcements = [],
  initialTab = "News",
}: {
  announcements?: { id: string; title: string; body: string }[];
  initialTab?: "News" | "Rewards";
}) {
  const [limit, setLimit] = useState(24);
  const news = useAccountQuery(["official-updates", limit], async () => {
    const pages = await Promise.all(
      Array.from({ length: Math.ceil(limit / 25) }, (_, i) =>
        api<{ items: News[] }>("/mobile/rewards/updates?offset=" + i * 25),
      ),
    );
    return pages.flatMap((p) => p.items);
  });
  const rewards = useAccountQuery(["rewards-feed", limit], async () => {
    const pages = await Promise.all(
      Array.from({ length: Math.ceil(limit / 25) }, (_, i) =>
        api<RewardFeed>("/mobile/rewards/campaigns?offset=" + i * 25),
      ),
    );
    return { ...pages[0], items: pages.flatMap((p) => p.items) };
  });
  return (
    <UpdatesHubView
      initialTab={initialTab}
      news={[
        ...announcements.map((n) => ({ ...n, id: "announcement-" + n.id })),
        ...(!news.error ? news.data || [] : []),
      ]}
      rewards={
        (!rewards.error ? rewards.data : undefined) || {
          items: [],
          winners: [],
          country: null,
          enabled: false,
        }
      }
      loading={news.isPending || rewards.isPending}
      error={
        news.error || rewards.error
          ? "Updates could not load. Please try again."
          : undefined
      }
      onRetry={() => {
        void news.refetch();
        void rewards.refetch();
      }}
      onCampaign={(id) =>
        router.push({ pathname: "/rewards/[id]", params: { id } })
      }
      onProfile={(id) =>
        router.push({ pathname: "/creator/[id]", params: { id } })
      }
      onCountry={() => router.push("/profile-country")}
      onNotifications={() => router.push("/notifications")}
      onMore={
        news.data?.length === Math.ceil(limit / 25) * 25 ||
        rewards.data?.items.length === Math.ceil(limit / 25) * 25
          ? () => setLimit((v) => v + 25)
          : undefined
      }
    />
  );
}
export const rewardStyles = StyleSheet.create({
  feed: { paddingHorizontal: 24, gap: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  title: { ...typography.heading, color: "white" },
  heading: {
    ...typography.section,
    color: "white",
    fontSize: 23,
    lineHeight: 29,
  },
  text: { ...typography.body, color: "#fff4f7", lineHeight: 24 },
  muted: { ...typography.caption, color: "#e8bfcd", lineHeight: 20 },
  eyebrow: {
    ...typography.caption,
    color: "#ffc4d8",
    fontSize: 10,
    letterSpacing: 1.4,
  },
  link: { ...typography.caption, color: "#ffafce" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,.07)",
    padding: 4,
    borderRadius: 30,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
  },
  selected: { backgroundColor: "#86243f" },
  card: {
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.19)",
    gap: 14,
  },
  prize: {
    ...typography.heading,
    color: "#ffcada",
    fontSize: 32,
    lineHeight: 38,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#a36a79",
    alignItems: "center",
    justifyContent: "center",
  },
  country: { minHeight: 44, justifyContent: "center" },
  thumb: { width: 72, height: 86, borderRadius: 18 },
});
const s = rewardStyles;
