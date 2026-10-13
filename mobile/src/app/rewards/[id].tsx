import { useCallback, useState } from "react";
import { Share } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { RequireAuth } from "../../components/ui";
import { Screen } from "../../features/secondary/primitives";
import { RewardRoundView } from "../../features/rewards/round-view";
import type { Entry, RewardDetail } from "../../features/rewards/types";
import { useSubmission } from "../../features/secondary/use-submission";
import { api } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { queryClient, useAccountQuery, useAuth } from "../../lib/auth";
import { environment } from "../../lib/config";
function Round({ id, entry }: { id: string; entry?: string }) {
  const [limit, setLimit] = useState(25),
    submit = useSubmission();
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey.includes("reward-round"),
      });
    }, []),
  );
  const query = useAccountQuery(["reward-round", id, limit], async () => {
    const pages = await Promise.all(
      Array.from({ length: Math.ceil(limit / 25) }, (_, i) =>
        api<RewardDetail>(`/mobile/rewards/campaigns/${id}?offset=${i * 25}`),
      ),
    );
    return { ...pages[0], items: pages.flatMap((p) => p.items) };
  });
  const shared = useAccountQuery(
    ["reward-shared", id, entry],
    () => api<RewardDetail>(`/mobile/rewards/campaigns/${id}?entry=${entry}`),
    !!entry,
  );
  const refresh = () => {
    void query.refetch();
    if (entry) void shared.refetch();
  };
  const mutate = async (work: () => Promise<void>) =>
    submit.run(async () => {
      const ticket = accountScope.capture();
      await work();
      accountScope.assert(ticket);
      await queryClient.invalidateQueries();
      accountScope.assert(ticket);
    });
  return (
    <Screen
      title="Rewards"
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    >
      <RewardRoundView
        data={query.error ? undefined : query.data}
        shared={shared.error ? undefined : shared.data?.items[0]}
        loading={query.isPending}
        error={
          submit.error ||
          query.error?.message ||
          shared.error?.message ||
          (entry && shared.data && !shared.data.items.length
            ? "The shared entry is no longer available. You can view other eligible entries below."
            : undefined)
        }
        busy={submit.busy}
        onRetry={refresh}
        onSubmit={(ids) =>
          mutate(async () => {
            for (const designId of ids)
              await api(`/mobile/rewards/campaigns/${id}`, {
                action: "submit",
                designId,
                acceptedRules: true,
                rulesVersion: query.data!.campaign.version,
              });
          })
        }
        onVote={(e) =>
          void mutate(() =>
            api(`/mobile/rewards/campaigns/${id}`, {
              action: "vote",
              entryId: e.id,
              liked: !e.liked,
            }),
          )
        }
        onShare={(e: Entry) =>
          void submit.run(async () => {
            const url = `${environment.apiUrl}/rewards/${id}?entry=${e.id}`;
            await Share.share({
              message: `Support ${e.display_name}'s design in LaQue: ${e.snapshot.title}. Sign in to view and vote. ${url}`,
              url,
            });
          })
        }
        onDesign={(designId) =>
          router.push({ pathname: "/design/[id]", params: { id: designId } })
        }
        onProfile={(userId) =>
          router.push({ pathname: "/creator/[id]", params: { id: userId } })
        }
        onProfileEdit={() => router.push("/profile-edit")}
        onBilling={() => router.push("/billing")}
        onLab={() => router.push("/lab")}
        onMore={() => setLimit((v) => v + 25)}
        hasMore={query.data?.items.length === limit}
      />
    </Screen>
  );
}
export default function RewardsRound() {
  const { id, entry } = useLocalSearchParams<{ id: string; entry?: string }>(),
    { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Round key={`${session?.user.id}:${epoch}:${id}`} id={id} entry={entry} />
    </RequireAuth>
  );
}
