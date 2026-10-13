import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Modal, Text } from "react-native";
import { UpdatesHubView } from "../features/rewards/updates-hub";
import { RewardRoundView } from "../features/rewards/round-view";
import { Screen, Button, styles } from "../features/secondary/primitives";
import { LabSheet } from "../features/lab-ui/primitives";
import type {
  Campaign,
  Entry,
  HomeEntry,
  RewardDetail,
} from "../features/rewards/types";
import { CompetitionGalleryView } from "../features/rewards/home-gallery";
const photo = require("../../assets/figma/home-main/f24ce.jpg");
const photo2 = require("../../assets/figma/home-main/6cdce.jpg");
const photo3 = require("../../assets/figma/home-main/f24ce.jpg");
// Synthetic samples only. No API, generation, prize or vote is executed.
const sample = (id: string, countries: string[], title: string): Campaign => ({
  id,
  title,
  country_codes: countries,
  theme: "Modern minimal",
  description: "Celebrate independent designers and their Lab creations.",
  prize_type: "cash",
  prize_label: "$2,000 prize pool",
  opens_at: new Date(Date.now() - 86400000).toISOString(),
  entries_close_at: new Date(Date.now() + 5 * 86400000).toISOString(),
  votes_close_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  award_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  winner_count: 3,
  status: "published",
  version: 1,
  rules:
    "Sample rules for design review only.\n\nEntrants must be 18+, have a completed public profile and an active verified Lab subscription. Submit up to three existing confirmed Lab designs. No additional generation allowance is granted and there is no separate submission fee.\n\nInvitations are optional. Voting requires a verified LaQue account, but no subscription. One vote per account per entry, no self-votes.\n\nThe highest valid vote counts win, with earlier submissions breaking ties. One winning design per entrant. LaQue reviews suspected manipulation before publishing results.\n\nSample allocation: first $1,000; second $600; third $400. Residence and prize eligibility must be verified before fulfilment. Apple is not a sponsor or involved.",
});
const rounds = [
  sample("worldwide", [], "The independent designer edit"),
  sample("india", ["IN"], "India · Modern Minimal"),
  sample("turkey", ["TR"], "Türkiye · Modern Minimal"),
];
const initial: Entry[] = [
  {
    id: "sample-entry-1",
    design_id: "rosewood",
    user_id: "anelia",
    display_name: "Anelia Cafe",
    username: "anelia.cafe",
    snapshot: {
      title: "Rosewood Bride",
      image_url: photo,
      shape: "Almond",
      length: "Medium",
      category: "Minimal",
    },
    votes: 128,
    liked: false,
    rank: null,
    final_votes: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "sample-entry-2",
    design_id: "cathedral",
    user_id: "sarah",
    display_name: "Sarah M.",
    username: "sarah.nails",
    snapshot: {
      title: "Cathedral",
      image_url: photo2,
      shape: "Stiletto",
      length: "Long",
      category: "Glam",
    },
    votes: 96,
    liked: false,
    rank: null,
    final_votes: null,
    created_at: new Date(Date.now() - 40000000).toISOString(),
  },
];
const PreviewRewardsContext = createContext<{
  country: string;
  setCountry: Dispatch<SetStateAction<string>>;
  entries: HomeEntry[];
  setEntries: Dispatch<SetStateAction<HomeEntry[]>>;
  round: Campaign | null;
  setRound: Dispatch<SetStateAction<Campaign | null>>;
} | null>(null);
export function PreviewRewardsProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = useState("AE"),
    [round, setRound] = useState<Campaign | null>(null);
  const [entries, setEntries] = useState<HomeEntry[]>(() =>
    rounds.flatMap((c) =>
      initial.map((e) => ({ ...e, id: c.id + "-" + e.id, campaign: c })),
    ),
  );
  return (
    <PreviewRewardsContext.Provider
      value={{ country, setCountry, round, setRound, entries, setEntries }}
    >
      {children}
    </PreviewRewardsContext.Provider>
  );
}
const usePreviewRewards = () => {
  const state = useContext(PreviewRewardsContext);
  if (!state) throw new Error("Preview Rewards provider missing");
  return state;
};
export function CompetitionGalleryPreview({
  compact,
  onAll,
  onDesign,
  onCompetition,
}: {
  compact: boolean;
  onAll: () => void;
  onDesign: (id: string) => void;
  onCompetition: () => void;
}) {
  const { entries, setEntries, country, setRound } = usePreviewRewards();
  return (
    <CompetitionGalleryView
      preview
      compact={compact}
      userId="preview-self"
      enabled
      items={entries
        .filter((e) => {
          const c = rounds.find((r) => r.id === e.campaign.id)!;
          return !c.country_codes.length || c.country_codes.includes(country);
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))}
      onRetry={() => undefined}
      onAll={onAll}
      onDesign={(id) => onDesign(id.startsWith("sample-own") ? "rosewood" : id)}
      onCompetition={(id) => {
        setRound(rounds.find((r) => r.id === id) || null);
        onCompetition();
      }}
      onVote={(e) =>
        setEntries((v) =>
          v.map((item) =>
            item.id === e.id
              ? {
                  ...item,
                  liked: !item.liked,
                  votes: item.votes + (item.liked ? -1 : 1),
                }
              : item,
          ),
        )
      }
    />
  );
}
export function RewardsPreview({
  onProfile,
  onDesign,
  onNotifications,
  onBilling,
  onLab,
  initialTab = "News",
}: {
  onProfile: (id: string) => void;
  onDesign: (id: string) => void;
  onNotifications: () => void;
  onBilling: () => void;
  onLab: () => void;
  initialTab?: "News" | "Rewards";
}) {
  const [sampleNewsDate] = useState(() =>
    new Date(Date.now() - 3600000).toISOString(),
  );
  const { country, setCountry, round, setRound, entries, setEntries } =
    usePreviewRewards();
  const [countrySheet, setCountrySheet] = useState(false),
    [message, setMessage] = useState("");
  const roundEntries = entries.filter((e) => e.campaign.id === round?.id);
  const myEntries = roundEntries
    .filter((e) => e.user_id === "preview-self")
    .map((e) => ({ id: e.id, designId: e.design_id, disqualified: false }));
  const candidates = [
    {
      id: "sample-own-1",
      title: "My minimal rose",
      image_url: photo,
      shape: "Almond",
      length: "Medium",
    },
    {
      id: "sample-own-2",
      title: "My chrome accent",
      image_url: photo2,
      shape: "Stiletto",
      length: "Long",
    },
    {
      id: "sample-own-3",
      title: "My soft nude",
      image_url: photo3,
      shape: "Oval",
      length: "Short",
    },
  ].filter((d) => !myEntries.some((e) => e.designId === d.id));
  const allowed = rounds.filter(
    (r) => !r.country_codes.length || r.country_codes.includes(country),
  );
  const detail: RewardDetail | undefined = round
    ? {
        campaign: round,
        items: roundEntries,
        ownItems: roundEntries.filter((e) => e.user_id === "preview-self"),
        myEntries,
        candidates,
        country,
        enabled: true,
        verified: true,
        profileComplete: true,
        subscription: { active: true, needsReview: false },
      }
    : undefined;
  return (
    <>
      <UpdatesHubView
        initialTab={initialTab}
        preview
        news={[
          {
            id: "sample-news",
            title: "A new space for independent designers",
            body: "Discover Rewards inside Updates. Official announcements and competition rounds are managed by LaQue admins. Your personal posts belong in Community.",
            published_at: sampleNewsDate,
          },
        ]}
        rewards={{ items: allowed, winners: [], country, enabled: true }}
        onRetry={() => undefined}
        onCampaign={(id) => {
          setRound(rounds.find((c) => c.id === id) || null);
          setMessage("");
        }}
        onProfile={onProfile}
        onCountry={() => setCountrySheet(true)}
        onNotifications={onNotifications}
      />
      {round && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setRound(null)}
        >
          <Screen title="Rewards" onBack={() => setRound(null)}>
            <RewardRoundView
              preview
              data={detail}
              error={message || undefined}
              onRetry={() => setMessage("")}
              onSubmit={async (ids) => {
                const fresh = ids.filter(
                  (id) => !myEntries.some((e) => e.designId === id),
                );
                if (myEntries.length + fresh.length > 3) {
                  setMessage("Three designs maximum.");
                  return false;
                }
                const added: HomeEntry[] = fresh.map((id) => {
                  const d = candidates.find((c) => c.id === id)!;
                  return {
                    id: round.id + "-entry-" + id,
                    campaign: round,
                    design_id: id,
                    user_id: "preview-self",
                    display_name: "You",
                    username: "your.handle",
                    snapshot: {
                      title: d.title,
                      image_url: d.image_url,
                      shape: d.shape,
                      length: d.length,
                      category: "Minimal",
                    },
                    votes: 0,
                    liked: false,
                    rank: null,
                    final_votes: null,
                    created_at: new Date().toISOString(),
                  };
                });
                setEntries((v) => [...added, ...v]);
                return true;
              }}
              onVote={(e) =>
                setEntries((v) =>
                  v.map((item) =>
                    item.id === e.id
                      ? {
                          ...item,
                          liked: !item.liked,
                          votes: item.votes + (item.liked ? -1 : 1),
                        }
                      : item,
                  ),
                )
              }
              onShare={() =>
                setMessage(
                  "Preview only: the connected app opens the native share sheet with an entry link.",
                )
              }
              onDesign={(id) => {
                setRound(null);
                onDesign(id.startsWith("sample-own") ? "rosewood" : id);
              }}
              onProfile={(id) => {
                setRound(null);
                onProfile(id);
              }}
              onProfileEdit={() =>
                setMessage("Your sample public profile is complete.")
              }
              onBilling={() => {
                setRound(null);
                onBilling();
              }}
              onLab={() => {
                setRound(null);
                onLab();
              }}
            />
          </Screen>
        </Modal>
      )}
      <LabSheet
        visible={countrySheet}
        title="Preview profile country"
        onClose={() => setCountrySheet(false)}
      >
        <Text style={styles.muted}>
          Sample country targeting. Admin Studio can view all countries.
        </Text>
        {[
          ["AE", "United Arab Emirates"],
          ["IN", "India"],
          ["TR", "Türkiye"],
        ].map(([code, label]) => (
          <Button
            key={code}
            title={`${country === code ? "✓ " : ""}${label}`}
            secondary
            onPress={() => {
              setCountry(code);
              setCountrySheet(false);
            }}
          />
        ))}
      </LabSheet>
    </>
  );
}
