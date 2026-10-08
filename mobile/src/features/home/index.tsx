import { publishedHome,featuredDesigns } from "./published-content";
import { PinterestInspiration, usePinterestFeed } from "../pinterest/inspiration";
import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  HomeMainView,
  type HomeSection,
  type HomeTab,
  type HomeCategory,
  type HomeSort,
} from "./home-main-view";
import { CommunityFeed } from "../social/feed";
import { listCommunity } from "../social/data";
import { UpdatesFeed } from "./updates-view";
import {
  homeCommunityCounts,
  listHomeDesigns,
  listHomeStories,
  listHomeUpdates,
} from "./data";
import {
  queryClient,
  useAccountQuery,
  useAuth,
  useProfile,
} from "../../lib/auth";
import { accountScope } from "../../lib/account-scope";
import { checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { setSaved } from "../../lib/designs";

export default function HomeScreen() {
  const { session } = useAuth();
  const [active, setActive] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      void queryClient.invalidateQueries();
      return () => setActive(false);
    }, []),
  );
  const profile = useProfile();
  const [tab, setTab] = useState<HomeTab>("Explore");
  const pinterest = usePinterestFeed(active && tab === "Explore", !!session);
  const [category, setCategory] = useState<HomeCategory>("All");
  const [sort, setSort] = useState<HomeSort>("For you");
  const [limit, setLimit] = useState(24);
  const [saving, setSaving] = useState<string[]>([]);
  const pending = useRef(new Set<string>());
  const [saveError, setSaveError] = useState("");
  const options = {
    tab,
    category,
    sort,
    limit,
    userId: session?.user.id,
    preferences: profile.data,
  };
  const published = useAccountQuery(["home", "published"], publishedHome);
  const featured = useAccountQuery(["home","featured",published.data?.revision], signal=>featuredDesigns(published.data?.featuredDesignIds||[],signal),!!published.data);
  const trending = useAccountQuery(
    ["home", "trending", category],
    (signal) =>
      listHomeDesigns("trending", signal, {
        ...options,
        tab: "Explore",
        limit: 24,
      }),
    tab === "Explore",
  );
  const library = useAccountQuery(
    [
      "home",
      "library",
      tab,
      category,
      sort,
      limit,
      profile.data?.nail_shape,
      profile.data?.occasions,
      profile.data?.nail_techniques,
    ],
    (signal) => listHomeDesigns("library", signal, options),
    tab !== "Updates" &&
      tab !== "Community" &&
      (tab !== "Following" || !!session),
  );
  const week = useAccountQuery(
    ["home", "week", category],
    (signal) =>
      listHomeDesigns("week", signal, {
        ...options,
        tab: "Explore",
        limit: 24,
      }),
    tab === "Explore",
  );
  const community = useAccountQuery(
    ["home", "community-counts"],
    homeCommunityCounts,
    tab === "Explore",
  );
  const stories = useAccountQuery(["home", "stories"], (signal) =>
    listHomeStories(signal),
  );
  const posts = useAccountQuery(
    ["community-posts", limit],
    (signal) => listCommunity(signal, limit),
    tab === "Community" && !!session,
  );
  const updates = useAccountQuery(
    ["home", "updates", limit],
    (signal) => listHomeUpdates(session!.user.id, limit, signal),
    tab === "Updates" && !!session,
  );
  const ids = [
    ...new Set(
      [
        ...(featured.data || []),
        ...(trending.data || []),
        ...(week.data || []),
        ...(library.data || []),
      ].map((design) => design.id),
    ),
  ].sort();
  const saved = useAccountQuery(
    ["home-saved", ids.join(",")],
    (signal) =>
      checked<{ design_id: string }[]>(
        supabase
          .from("saved_designs")
          .select("design_id")
          .eq("user_id", session!.user.id)
          .in("design_id", ids)
          .abortSignal(signal),
      ),
    !!session && !!ids.length,
  );
  const savedIds = new Set(saved.data?.map((row) => row.design_id));
  const allow = (returnTo = "/") => {
    if (session) return true;
    router.push({ pathname: "/auth", params: { returnTo } });
    return false;
  };
  const openDesign = (id: string) => {
    if (allow(`/design/${id}`))
      router.push({ pathname: "/design/[id]", params: { id, from: "index" } });
  };
  const save = async (id: string) => {
    if (!session) {
      router.push({ pathname: "/auth", params: { returnTo: `/design/${id}` } });
      return;
    }
    if (pending.current.has(id)) return;
    const ticket = accountScope.capture();
    pending.current.add(id);
    setSaving([...pending.current]);
    setSaveError("");
    try {
      // Do not infer "unsaved" from a pending/failed saved-state request.
      const fresh =
        !saved.data || saved.error ? await saved.refetch() : undefined;
      if (fresh?.error)
        throw new Error(
          "Your saved designs could not be checked. Please try again.",
        );
      const state = fresh ? fresh.data : saved.data;
      if (!state)
        throw new Error(
          "Your saved designs could not be checked. Please try again.",
        );
      accountScope.assert(ticket);
      await setSaved(
        session.user.id,
        id,
        !state.some((row) => row.design_id === id),
      );
      accountScope.assert(ticket);
      await queryClient.invalidateQueries();
    } catch (error) {
      if (accountScope.isCurrent(ticket))
        setSaveError((error as Error).message);
    } finally {
      pending.current.delete(id);
      if (accountScope.isCurrent(ticket)) setSaving([...pending.current]);
    }
  };
  const section = (title: string, query: typeof trending): HomeSection => ({
    title,
    loading: query.isLoading,
    error: query.error
      ? "Designs couldn’t load. Check your connection and try again."
      : undefined,
    designs: (query.data || []).map((design) => ({
      id: design.id,
      title: design.title,
      image: design.image_url,
      saves: design.saves_count,
      shape: design.shape,
      category: design.category,
      saved: savedIds.has(design.id),
      saving: saving.includes(design.id),
    })),
    retry: () => {
      void query.refetch();
    },
  });
  const feedSection = section(
    tab === "Explore" ? "Explore Library" : tab,
    library,
  );
  feedSection.emptyMessage =
    tab === "Following"
      ? "Follow artists to see their latest designs here."
      : "No designs match this filter yet.";
  if (library.data?.length === limit) {
    feedSection.loadMore = () => {
      if (allow()) setLimit((value) => value + 24);
    };
    feedSection.loadingMore = library.isFetching;
  }
  if (tab === "Following" && !session) {
    feedSection.loading = false;
    feedSection.emptyMessage = "Sign in to see the artists you follow.";
    feedSection.action = {
      title: "Sign in",
      onPress: () =>
        router.push({ pathname: "/auth", params: { returnTo: "/" } }),
    };
  }
  const storyCreators = (stories.data || []).filter(
    (story, index, all) =>
      all.findIndex((candidate) => candidate.user_id === story.user_id) ===
      index,
  );
  return (
    <HomeMainView
      heroes={published.data?.heroes}
      featured={section("Featured by LaQue",featured)}
      announcements={published.data?.announcements}
      onRefresh={()=>void queryClient.invalidateQueries()}
      refreshing={published.isFetching && !published.isLoading}
      active={active}
      tab={tab}
      category={category}
      sort={sort}
      onTab={(value) => {
        if (!allow()) return;
        setTab(value);
        setLimit(24);
      }}
      onCategory={(value) => {
        if (!allow()) return;
        setCategory(value);
        setLimit(24);
      }}
      onSort={(value) => {
        if (!allow()) return;
        setSort(value);
        setLimit(24);
      }}
      trending={section("TRENDING", trending)}
      week={{
        ...section("New This Week", week),
        emptyMessage: "No new designs match this filter this week.",
      }}
      community={{
        stats: community.data,
        loading: community.isLoading,
        error: community.error
          ? "Community totals are unavailable."
          : undefined,
        retry: () => {
          void community.refetch();
        },
      }}
      library={feedSection}
      pinterest={<PinterestInspiration feed={pinterest} active={active && tab === "Explore"} authenticated={!!session} onSignIn={() => allow()} />}
      communityFeed={
        <CommunityFeed
          posts={posts.data || []}
          loading={posts.isPending}
          error={posts.error?.message}
          onRetry={() => void posts.refetch()}
          onCompose={() => router.push("/community/new")}
          onProfile={(id) =>
            router.push({ pathname: "/creator/[id]", params: { id } })
          }
          onReport={(id) =>
            router.push({
              pathname: "/report",
              params: { targetType: "profile", targetId: id },
            })
          }
          onMore={
            posts.data?.length === limit
              ? () => setLimit((v) => v + 24)
              : undefined
          }
        />
      }

      stories={storyCreators.map((story) => ({
        id: story.user_id,
        name: story.name,
        image: story.media_type === "video" ? null : story.image_url,
        isOwn: story.user_id === session?.user.id,
      }))}
      storiesLoading={stories.isLoading}
      storiesError={stories.error ? "Stories could not load." : undefined}
      onRetryStories={() => {
        void stories.refetch();
      }}
      onStory={(id) => {
        if (allow(`/story/${id}`))
          router.push({ pathname: "/story/[id]", params: { id } });
      }}
      onAddStory={() =>
        router.push(
          session
            ? "/story/new"
            : { pathname: "/auth", params: { returnTo: "/story/new" } },
        )
      }
      searchLocked={!session}
      onSearch={(query) => {
        if (allow("/search"))
          router.push({ pathname: "/search", params: { query } });
      }}
      onNotifications={() => {
        if (allow("/notifications")) router.push("/notifications");
      }}
      onFavorites={() => {
        if (allow("/saved")) router.push("/saved");
      }}
      onDesign={openDesign}
      onSave={(id) => {
        void save(id);
      }}
      saveError={saveError}
      updates={
        <UpdatesFeed
          currentUserId={session?.user.id}
          onCompose={() => {
            if (allow("/updates/new")) router.push("/updates/new");
          }}
          posts={updates.data || []}
          loading={updates.isLoading}
          refreshing={updates.isFetching && !updates.isLoading}
          error={
            updates.error
              ? "Updates couldn’t load. Check your connection and try again."
              : undefined
          }
          onRetry={() => {
            void updates.refetch();
          }}
          hasMore={updates.data?.length === limit}
          onMore={() => setLimit((value) => value + 24)}
          onProfile={(id) =>
            router.push({ pathname: "/creator/[id]", params: { id } })
          }
          onDiscover={() =>
            router.push({ pathname: "/search", params: { mode: "Artists" } })
          }
          onNotifications={() => {
            if (allow("/notifications")) router.push("/notifications");
          }}
          onReport={(id) =>
            router.push({
              pathname: "/report",
              params: { targetType: "profile", targetId: id },
            })
          }
        />
      }
    />
  );
}
