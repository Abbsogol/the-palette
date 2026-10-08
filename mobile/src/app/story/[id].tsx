import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAccountQuery, useAuth } from "../../lib/auth";
import { listHomeStories } from "../../features/home/data";
import { accountScope } from "../../lib/account-scope";
import { StoryViewer } from "../../features/stories/story-ui";
export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { session } = useAuth();
  const [openedAt] = useState(() => Date.now()),
    [accessReady, setAccessReady] = useState(false);
  const query = useAccountQuery(
    ["story", id, openedAt],
    async (signal) => (await listHomeStories(signal, id)).reverse(),
    !!id,
  );
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      let focused = true;
      let active =
        AppState.currentState !== "background" &&
        AppState.currentState !== "inactive";
      let request = 0;
      const check = () => {
        if (!active) return;
        const version = ++request;
        const ticket = accountScope.capture();
        void refetch().then(() => {
          if (
            focused &&
            active &&
            version === request &&
            accountScope.isCurrent(ticket)
          )
            setAccessReady(true);
        });
      };
      check();
      const timer = setInterval(check, 60000);
      const subscription = AppState.addEventListener("change", (state) => {
        active = state === "active";
        request++;
        setAccessReady(false);
        if (active) check();
      });
      return () => {
        focused = false;
        setAccessReady(false);
        clearInterval(timer);
        subscription.remove();
      };
    }, [refetch]),
  );
  return (
    <StoryViewer
      stories={(query.data || []).map((story) => ({
        id: story.id,
        userId: story.user_id,
        name: story.name,
        image: story.image_url,
        avatar: story.avatar_url,
        caption: story.caption,
        mediaType: story.media_type,
        tags: story.tags,
        people: story.people,
        createdAt: story.created_at,
        expiresAt: new Date(
          Date.parse(story.created_at) + 86400000,
        ).toISOString(),
      }))}
      viewerId={session?.user.id}
      loading={query.isPending || !accessReady}
      error={query.error?.message}
      onRetry={() => void refetch()}
      onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      onProfile={(story) =>
        router.push({ pathname: "/creator/[id]", params: { id: story.userId } })
      }
      onReport={
        session
          ? (story) =>
              router.push({
                pathname: "/report",
                params: { targetType: "profile", targetId: story.userId },
              })
          : undefined
      }
    />
  );
}
