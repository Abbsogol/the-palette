import { router, useLocalSearchParams } from "expo-router";
import { RequireAuth } from "../../components/ui";
import { Screen } from "../../features/secondary/primitives";
import { CommunityFeed } from "../../features/social/feed";
import { listCommunity } from "../../features/social/data";
import { useAccountQuery } from "../../lib/auth";
function Post() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAccountQuery(["community-post", id], (signal) =>
    listCommunity(signal, 1, id),
  );
  return (
    <Screen title="Community post" onBack={() => router.back()}>
      <CommunityFeed
        posts={q.data || []}
        loading={q.isPending}
        error={q.error?.message}
        onRetry={() => void q.refetch()}
        onProfile={(user) =>
          router.push({ pathname: "/creator/[id]", params: { id: user } })
        }
        onReport={(user) =>
          router.push({
            pathname: "/report",
            params: { targetType: "profile", targetId: user },
          })
        }
      />
    </Screen>
  );
}
export default function CommunityPost() {
  return (
    <RequireAuth>
      <Post />
    </RequireAuth>
  );
}
