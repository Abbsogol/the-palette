import type { ImageProps } from "expo-image";
export type News = {
  id: string;
  title: string;
  body: string;
  published_at?: string;
};
export type Campaign = {
  id: string;
  title: string;
  theme: string;
  description: string;
  prize_type: "cash" | "products" | "gift_cards";
  prize_label: string;
  country_codes: string[];
  opens_at: string;
  entries_close_at: string;
  votes_close_at: string;
  award_at: string;
  winner_count: number;
  status: "published" | "paused" | "results";
  version: number;
  rules?: string;
  results_at?: string | null;
};
export type Entry = {
  id: string;
  design_id: string;
  user_id: string;
  display_name: string;
  username: string;
  snapshot: {
    title: string;
    image_url: ImageProps["source"] | null;
    shape: string;
    length: string;
    category: string | null;
  };
  votes: number;
  liked: boolean;
  rank: number | null;
  final_votes: number | null;
  created_at: string;
};
export type Candidate = {
  id: string;
  title: string;
  image_url: ImageProps["source"] | null;
  shape: string;
  length: string;
};
export type HomeEntry = Entry & {
  campaign: Pick<Campaign, "id" | "title" | "prize_label" | "status" | "opens_at" | "votes_close_at">;
};
export type HomeEntryFeed = {
  items: HomeEntry[];
  country: string | null;
  enabled: boolean;
  hasMore: boolean;
};
export type Winner = {
  campaign_id: string;
  campaign_title: string;
  entry_id: string;
  design_id: string;
  user_id: string;
  display_name: string;
  username: string;
  snapshot: Entry["snapshot"];
  rank: number;
  votes: number;
  results_at: string;
};
export type RewardFeed = {
  items: Campaign[];
  winners: Winner[];
  country: string | null;
  enabled: boolean;
};
export type RewardDetail = {
  campaign: Campaign;
  items: Entry[];
  ownItems: Entry[];
  myEntries: { id: string; designId: string | null; disqualified: boolean }[];
  candidates: Candidate[];
  country: string | null;
  enabled: boolean;
  verified: boolean;
  profileComplete: boolean;
  subscription: { active: boolean; needsReview: boolean };
};
export const regionName = (codes: string[]) =>
  codes.length ? codes.join(" · ") : "Worldwide";
export const rewardPhase = (c: Campaign, now = Date.now()) =>
  c.status === "results"
    ? "Results"
    : c.status === "paused"
      ? "Paused"
      : now < Date.parse(c.opens_at)
        ? "Upcoming"
        : now < Date.parse(c.entries_close_at)
          ? "Entries open"
          : now < Date.parse(c.votes_close_at)
            ? "Voting open"
            : "Under review";
export const rewardDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
