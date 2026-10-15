import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Button, Card, Notice, styles as ui } from "../secondary/primitives";
import { LabSheet } from "../lab-ui/primitives";
import { rewardStyles as s } from "./updates-hub";
import {
  rewardDate,
  rewardPhase,
  regionName,
  type RewardDetail,
  type Entry,
} from "./types";
export function RewardRoundView({
  data,
  shared,
  loading,
  error,
  busy,
  onRetry,
  onSubmit,
  onVote,
  onShare,
  onDesign,
  onProfile,
  onProfileEdit,
  onBilling,
  onLab,
  onMore,
  hasMore,
  preview = false,
}: {
  data?: RewardDetail;
  shared?: Entry;
  loading?: boolean;
  error?: string;
  busy?: boolean;
  onRetry: () => void;
  onSubmit: (ids: string[]) => Promise<boolean>;
  onVote: (entry: Entry) => void;
  onShare: (entry: Entry) => void;
  onDesign: (id: string) => void;
  onProfile: (id: string) => void;
  onProfileEdit: () => void;
  onBilling: () => void;
  onLab: () => void;
  onMore?: () => void;
  hasMore?: boolean;
  preview?: boolean;
}) {
  const [tab, setTab] = useState<"Entries" | "My entries" | "Rules">("Entries"),
    [picker, setPicker] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [accepted, setAccepted] = useState(false),
    [confirmation, setConfirmation] = useState(false),
    [success, setSuccess] = useState(false),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const c = data?.campaign,
    phase = c ? rewardPhase(c, now) : "";
  const entriesOpen = !!data && data.enabled && phase === "Entries open";
  const votingOpen =
    !!data && data.enabled && ["Entries open", "Voting open"].includes(phase);
  const remaining = Math.max(0, 3 - (data?.myEntries.length || 0));
  const eligible =
    !!data?.verified &&
    !!data.profileComplete &&
    !!data.subscription.active &&
    !data.subscription.needsReview;
  const entries =
    tab === "My entries" ? data?.ownItems || [] : data?.items || [];
  return (
    <>
      {preview && (
        <Notice>Design preview · entries and votes are not saved.</Notice>
      )}
      {loading && !data && (
        <ActivityIndicator
          color="#ff8dae"
          accessibilityLabel="Loading competition"
        />
      )}
      {error && (
        <>
          <Notice error>{error}</Notice>
          <Button
            title="Retry competition"
            secondary
            busy={busy}
            onPress={onRetry}
          />
        </>
      )}
      {c && data && (
        <>
          <Card>
            <View style={s.row}>
              <Text style={s.eyebrow}>{phase.toUpperCase()}</Text>
              <Text style={s.muted}>{regionName(c.country_codes)}</Text>
            </View>
            <Text accessibilityRole="header" style={s.heading}>
              {c.title}
            </Text>
            <Text style={s.prize}>{c.prize_label}</Text>
            <Text style={s.text}>{c.description}</Text>
            <Text style={s.muted}>Theme: {c.theme}</Text>
            <Text style={s.muted}>
              Entries close {rewardDate(c.entries_close_at)}
              {"\n"}Voting closes {rewardDate(c.votes_close_at)}
              {"\n"}Prize award date {rewardDate(c.award_at)}
            </Text>
            <Text style={s.muted}>
              {c.winner_count} winner(s) · 3 entries maximum
            </Text>
          </Card>
          {!data.enabled && (
            <Notice>
              This prize competition is not activated. Entry and voting are
              unavailable.
            </Notice>
          )}
          {c.status === "paused" && (
            <Notice>
              This round is paused. Existing entries remain visible; entry and
              voting will resume only when LaQue reopens it.
            </Notice>
          )}
          {c.status === "results" && (
            <Card>
              <Text style={s.heading}>The winners are here</Text>
              <Text style={s.muted}>
                Final results have been reviewed and published. Winners are
                featured in Updates for 30 days.
              </Text>
              {data.items
                .filter((e) => e.rank)
                .sort((a, b) => a.rank! - b.rank!)
                .map((e) => (
                  <View key={e.id} style={{ gap: 10 }}>
                    <Text style={s.eyebrow}>
                      #{e.rank} · {e.final_votes} VALID VOTES
                    </Text>
                    <Button
                      title={`View ${e.display_name}'s profile`}
                      secondary
                      onPress={() => onProfile(e.user_id)}
                    />
                  </View>
                ))}
            </Card>
          )}
          {entriesOpen && (
            <Card>
              <Text style={s.heading}>Your entry checklist</Text>
              <Text style={s.text}>
                {data.profileComplete ? "✓" : "○"} Completed public profile
              </Text>
              <Text style={s.text}>
                {data.subscription.active && !data.subscription.needsReview
                  ? "✓"
                  : "○"}{" "}
                Active verified Lab subscription
              </Text>
              <Text style={s.text}>
                {data.verified ? "✓" : "○"} Verified LaQue account
              </Text>
              <Text style={s.muted}>
                Choose existing confirmed Lab designs. Entry uses no extra
                credits. Invitations are optional.
              </Text>
              {!data.profileComplete && (
                <Button
                  title="Complete your profile"
                  secondary
                  onPress={onProfileEdit}
                />
              )}
              {(!data.subscription.active || data.subscription.needsReview) && (
                <Button
                  title="View Lab subscription"
                  secondary
                  onPress={onBilling}
                />
              )}
              <Button
                title={
                  remaining
                    ? `Choose designs · ${remaining} entries left`
                    : "All three entries submitted"
                }
                disabled={!eligible || !remaining}
                onPress={() => {
                  setSelected([]);
                  setAccepted(false);
                  setSuccess(false);
                  setPicker(true);
                }}
              />
            </Card>
          )}
          {success && (
            <Notice>
              Your designs are entered. Share an entry with friends and invite
              them to sign in and vote.
            </Notice>
          )}
          {shared && (
            <Card>
              <Text style={s.eyebrow}>SHARED WITH YOU</Text>
              <EntryCard
                entry={shared}
                votingOpen={votingOpen}
                busy={busy}
                own={data.myEntries.some((m) => m.id === shared.id)}
                onDesign={onDesign}
                onProfile={onProfile}
                onVote={onVote}
                onShare={onShare}
              />
            </Card>
          )}
          <View style={s.tabs}>
            {(["Entries", "My entries", "Rules"] as const).map((t) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                style={[s.tab, tab === t && s.selected]}
                key={t}
                onPress={() => setTab(t)}
              >
                <Text style={s.text}>{t}</Text>
              </Pressable>
            ))}
          </View>
          {tab === "Rules" ? (
            <Card>
              <Text accessibilityRole="header" style={s.heading}>
                Official rules
              </Text>
              <Text style={s.text}>{c.rules}</Text>
              <Text style={s.muted}>
                LaQue is the organiser. Apple is not a sponsor or involved in
                this competition.
              </Text>
              <Text style={s.muted}>
                One vote per verified account per design; no self-votes. Highest
                valid vote count wins. Ties use earlier submission, then entry
                ID. One winning design per entrant. Suspected manipulation is
                reviewed before results.
              </Text>
            </Card>
          ) : (
            <>
              {tab === "My entries" && (
                <Text style={s.muted}>
                  {data.myEntries.length}/3 submitted. Deleted, hidden or
                  disqualified submissions do not free another entry slot.
                </Text>
              )}
              {entries.map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  own={data.myEntries.some((m) => m.id === e.id)}
                  votingOpen={votingOpen}
                  busy={busy}
                  onDesign={onDesign}
                  onProfile={onProfile}
                  onVote={onVote}
                  onShare={onShare}
                />
              ))}
              {!entries.length && (
                <Card>
                  <Text style={s.heading}>
                    {tab === "My entries"
                      ? "No visible entries of yours here"
                      : "Be part of this round"}
                  </Text>
                  <Text style={s.muted}>
                    {tab === "My entries"
                      ? "Your submitted designs appear here when they are public and available. Private, deleted or disqualified designs are unavailable."
                      : "Eligible published designs will appear here. Each opens its full design page."}
                  </Text>
                </Card>
              )}
              {hasMore && (
                <Button
                  title="Load more entries"
                  secondary
                  busy={busy}
                  onPress={() => onMore?.()}
                />
              )}
            </>
          )}
          <Button
            title="Refresh competition"
            secondary
            onPress={onRetry}
            busy={busy}
          />
        </>
      )}
      <LabSheet
        visible={picker}
        title="Choose your Lab designs"
        onClose={() => {
          if (!busy) setPicker(false);
        }}
      >
        <Text style={s.muted}>
          Select up to {remaining} designs from your published Lab library. New
          generation uses your normal Lab allowance.
        </Text>
        {data?.candidates.map((d) => (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Select ${d.title}`}
            accessibilityState={{
              checked: selected.includes(d.id),
              disabled:
                !selected.includes(d.id) && selected.length >= remaining,
            }}
            disabled={
              busy || (!selected.includes(d.id) && selected.length >= remaining)
            }
            key={d.id}
            style={[
              s.card,
              selected.includes(d.id) && { borderColor: "#ff517f" },
            ]}
            onPress={() =>
              setSelected((v) =>
                v.includes(d.id) ? v.filter((id) => id !== d.id) : [...v, d.id],
              )
            }
          >
            <View style={s.row}>
              {d.image_url && (
                <Image
                  source={d.image_url}
                  cachePolicy="none"
                  contentFit="cover"
                  style={s.thumb}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{d.title}</Text>
                <Text style={s.muted}>
                  {d.shape} · {d.length}
                </Text>
              </View>
              <Text style={s.text}>{selected.includes(d.id) ? "✓" : "○"}</Text>
            </View>
          </Pressable>
        ))}
        {!data?.candidates.length && (
          <Text style={s.muted}>
            No eligible published Lab designs yet. Publish a confirmed
            generation with its design details first.
          </Text>
        )}
        <Button
          title="Open Lab"
          secondary
          onPress={() => {
            setPicker(false);
            onLab();
          }}
        />
        <Button
          title={`Review ${selected.length} selected ${selected.length === 1 ? "design" : "designs"}`}
          disabled={!selected.length}
          onPress={() => {
            setPicker(false);
            setConfirmation(true);
          }}
        />
      </LabSheet>
      <LabSheet
        visible={confirmation}
        title="Confirm your entries"
        onClose={() => {
          if (!busy) setConfirmation(false);
        }}
      >
        <Text style={s.muted}>
          Your selected designs will be listed for other eligible LaQue members
          to view and vote on. The submitted image and design details will be
          locked. You can still unpublish or delete a design, which removes it
          from the competition gallery.
        </Text>
        {selected.map((id) => (
          <Text key={id} style={s.text}>
            {data?.candidates.find((d) => d.id === id)?.title || "Lab design"}
          </Text>
        ))}
        <Text style={s.muted}>
          No extra generation credits or entry fee. Subscription eligibility and
          prize terms are described in the rules.
        </Text>
        <Button
          title="Read official rules"
          secondary
          onPress={() => {
            setConfirmation(false);
            setTab("Rules");
          }}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          style={ui.row}
          onPress={() => setAccepted((v) => !v)}
        >
          <Text style={s.text}>
            {accepted ? "☑" : "☐"} I accept this round’s official rules.
          </Text>
        </Pressable>
        {error && <Notice error>{error}</Notice>}
        <Button
          title="Submit competition entries"
          busy={busy}
          disabled={!accepted}
          onPress={() => {
            void onSubmit(selected).then((ok) => {
              if (ok) {
                setConfirmation(false);
                setSuccess(true);
              }
            });
          }}
        />
      </LabSheet>
    </>
  );
}
function EntryCard({
  entry: e,
  own,
  votingOpen,
  busy,
  onVote,
  onShare,
  onDesign,
  onProfile,
}: {
  entry: Entry;
  own: boolean;
  votingOpen: boolean;
  busy?: boolean;
  onVote: (e: Entry) => void;
  onShare: (e: Entry) => void;
  onDesign: (id: string) => void;
  onProfile: (id: string) => void;
}) {
  return (
    <Card>
      {e.rank && <Text style={s.eyebrow}>WINNER #{e.rank}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open design ${e.snapshot.title}`}
        onPress={() => onDesign(e.design_id)}
      >
        {e.snapshot.image_url ? (
          <Image
            source={e.snapshot.image_url}
            contentFit="cover"
            cachePolicy="none"
            style={{ width: "100%", height: 280, borderRadius: 22 }}
          />
        ) : (
          <View
            style={{
              height: 120,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={s.muted}>Image unavailable · open design</Text>
          </View>
        )}
      </Pressable>
      <Text accessibilityRole="header" style={s.heading}>
        {e.snapshot.title}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => onProfile(e.user_id)}
        style={s.country}
      >
        <Text style={s.link}>
          {e.display_name} · @{e.username} ↗
        </Text>
      </Pressable>
      <Text style={s.muted}>
        {e.rank ? e.final_votes : e.votes} {e.rank ? "final " : ""}votes{" "}
        {own ? "· Your entry" : ""}
      </Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button
            title={own ? "Your entry" : e.liked ? "♥ Voted" : "♡ Vote"}
            secondary={!e.liked}
            disabled={own || !votingOpen}
            busy={busy}
            onPress={() => onVote(e)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Share entry" secondary onPress={() => onShare(e)} />
        </View>
      </View>
    </Card>
  );
}
