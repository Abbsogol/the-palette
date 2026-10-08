import { useRef, useState } from "react";
import { Alert, Share } from "react-native";
import { router, type Href } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAccountQuery, useAuth, queryClient } from "../../lib/auth";
import { accountScope } from "../../lib/account-scope";
import { checked, api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { setSaved } from "../../lib/designs";
import { HomeNavigation } from "../../components/home-tab-bar";
import { ProfileView, ProfileShell, type ProfileAction } from "./profile-view";
import {
  loadIdentity,
  loadStats,
  loadAccount,
  loadContent,
  loadRelationships,
} from "./data";

export function ProfileScreen({
  id,
  owner = false,
  initialTab,
}: {
  id: string;
  owner?: boolean;
  initialTab?: "Services";
}) {
  const { session, epoch } = useAuth();
  const [tab, setTab] = useState(
    owner ? "My Designs" : initialTab || "Designs",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const latch = useRef(false);
  const permittedOwner = owner && session?.user.id === id;
  const identity = useAccountQuery(
    ["profile-identity", id, permittedOwner],
    (s) => loadIdentity(id, s, permittedOwner),
    !owner || permittedOwner,
  );
  const stats = useAccountQuery(
    [
      "profile-stats",
      id,
      permittedOwner,
      identity.data?.private,
      identity.data?.role,
    ],
    (s) =>
      loadStats(
        id,
        permittedOwner,
        !!identity.data?.private,
        s,
        identity.data?.role === "user",
      ),
    !!identity.data,
  );
  const account = useAccountQuery(
    ["profile-account", id],
    (s) => loadAccount(id, s),
    permittedOwner,
  );
  const ownerState = useAccountQuery(
    ["profile-onboarding", id],
    (s) =>
      checked<{ onboarding_complete: boolean }>(
        supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", id)
          .abortSignal(s)
          .single(),
      ),
    permittedOwner,
  );
  const content = useInfiniteQuery({
    queryKey: [
      session?.user.id || "public",
      epoch,
      "profile-content",
      id,
      permittedOwner,
      tab,
      identity.data?.private,
    ],
    initialPageParam: 0,
    enabled: !!identity.data,
    queryFn: async ({ pageParam, signal }) => {
      const ticket = accountScope.capture();
      const value = await loadContent(
        identity.data!,
        permittedOwner,
        tab,
        pageParam,
        signal,
      );
      accountScope.assert(ticket);
      return value;
    },
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length : undefined,
  });
  const pages = content.data?.pages || [],
    designs = pages.flatMap((p) => p.designs),
    designIds = designs.map((d) => d.id);
  const relationships = useAccountQuery(
    ["profile-relationships", id, designIds.join(",")],
    (s) => loadRelationships(session!.user.id, id, designIds, s),
    !!session && !!identity.data,
  );
  const requireLogin = () => {
    if (session) return true;
    router.push({ pathname: "/auth", params: { returnTo: `/creator/${id}` } });
    return false;
  };
  const run = async (work: () => Promise<void>) => {
    if (!requireLogin() || latch.current) return;
    const ticket = accountScope.capture();
    latch.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      accountScope.assert(ticket);
      await queryClient.invalidateQueries();
    } catch (e) {
      if (accountScope.isCurrent(ticket)) setError((e as Error).message);
    } finally {
      latch.current = false;
      if (accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  const relationship = async () => {
    const result = await relationships.refetch();
    if (result.error || !result.data)
      throw (
        result.error ||
        new Error("Could not check your saved state. Try again.")
      );
    return result.data;
  };
  const action = (kind: ProfileAction, itemId?: string) => {
    if (kind === "back") {
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    if (kind === "share") {
      void Share.share({
        message: `${identity.data?.name || "LaQue"} on LaQue\nhttps://www.laque.app/creator/${id}`,
      }).catch((e) => setError(e.message));
      return;
    }
    if (kind === "public") {
      router.push({
        pathname: "/creator/[id]",
        params: { id, from: "profile" },
      });
      return;
    }
    if (kind === "design") {
      if (!requireLogin()) return;
      router.push({ pathname: "/design/[id]", params: { id: itemId! } });
      return;
    }
    if (!requireLogin()) return;
    const paths: Partial<Record<ProfileAction, Href>> = {
      settings: "/profile-settings" as Href,
      edit: "/profile-edit",
      upcoming: "/appointments",
      saved: "/saved",
      collections: "/collections",
      credits: "/billing",
      favorites: "/profile-favorites" as Href,
      onboarding: "/onboarding",
      portfolio: "/portfolio",
      "upload-design": "/portfolio-edit",
    };
    if (paths[kind]) {
      router.push(paths[kind]!);
      return;
    }
    if (kind === "appointment") {
      router.push({ pathname: "/booking/[id]", params: { id: itemId! } });
      return;
    }
    if (kind === "collection") {
      router.push({ pathname: "/collection/[id]", params: { id: itemId! } });
      return;
    }
    if (kind === "book") {
      router.push({ pathname: "/book/[id]", params: { id } });
      return;
    }
    if (kind === "report") {
      router.push({
        pathname: "/report",
        params: { targetType: "profile", targetId: id },
      });
      return;
    }
    if (kind === "block") {
      Alert.alert(
        "Block this profile?",
        "Neither of you will be able to send new messages to the other.",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: () =>
              void run(async () => {
                await checked(
                  supabase
                    .from("blocks")
                    .upsert(
                      { blocker_id: session!.user.id, blocked_id: id },
                      {
                        onConflict: "blocker_id,blocked_id",
                        ignoreDuplicates: true,
                      },
                    )
                    .select("id"),
                );
                router.back();
              }),
          },
        ],
      );
      return;
    }
    void run(async () => {
      if (kind === "message") {
        const { conversationId } = await api<{ conversationId: string }>(
          "/mobile/conversation",
          { creatorId: id },
        );
        router.push({
          pathname: "/conversation/[id]",
          params: { id: conversationId },
        });
        return;
      }
      const ticket = accountScope.capture();
      const state = await relationship();
      accountScope.assert(ticket);
      if (kind === "save-design" && itemId) {
        await setSaved(session!.user.id, itemId, !state.saved.includes(itemId));
        return;
      }
      if (kind === "favorite") {
        if (state.favorite)
          await checked(
            supabase
              .from("favourite_creators")
              .delete()
              .eq("user_id", session!.user.id)
              .eq("creator_id", id)
              .select("creator_id"),
          );
        else
          await checked(
            supabase
              .from("favourite_creators")
              .upsert(
                { user_id: session!.user.id, creator_id: id },
                { onConflict: "user_id,creator_id", ignoreDuplicates: true },
              )
              .select("creator_id"),
          );
      }
      if (kind === "follow") {
        if (state.following)
          await checked(
            supabase
              .from("follows")
              .delete()
              .eq("follower_id", session!.user.id)
              .eq("following_id", id)
              .select("following_id"),
          );
        else
          await checked(
            supabase
              .from("follows")
              .upsert(
                { follower_id: session!.user.id, following_id: id },
                {
                  onConflict: "follower_id,following_id",
                  ignoreDuplicates: true,
                },
              )
              .select("following_id"),
          );
      }
    });
  };
  const retry = () => {
    void identity.refetch();
    void stats.refetch();
    if (permittedOwner) void account.refetch();
  };
  return (
    <ProfileShell>
      <ProfileView
        owner={permittedOwner}
        profile={identity.data}
        stats={stats.data}
        account={permittedOwner ? account.data : undefined}
        loading={identity.isPending}
        error={identity.error?.message}
        onRetry={retry}
        tab={tab}
        onTab={setTab}
        onAction={action}
        self={session?.user.id === id}
        favorite={relationships.data?.favorite}
        following={relationships.data?.following}
        busy={busy}
        actionError={error || relationships.error?.message}
        statsError={
          stats.error?.message ||
          (permittedOwner ? account.error?.message : undefined)
        }
        onRetryStats={() => {
          void stats.refetch();
          if (permittedOwner) void account.refetch();
        }}
        contentLoading={content.isPending}
        contentError={content.error?.message}
        onRetryContent={() => void content.refetch()}
        designs={designs.map((d) => ({
          ...d,
          saved: relationships.data?.saved.includes(d.id),
        }))}
        collections={pages.flatMap((p) => p.collections)}
        services={pages.flatMap((p) => p.services)}
        reviews={pages.flatMap((p) => p.reviews)}
        hasMore={content.hasNextPage && !content.isFetchingNextPage}
        onMore={() => void content.fetchNextPage()}
        onRefresh={() => {
          retry();
          void content.refetch();
        }}
        needsOnboarding={
          permittedOwner && ownerState.data?.onboarding_complete === false
        }
      />
      {!owner && (
        <HomeNavigation
          selected={session?.user.id === id ? "profile" : "search"}
          onSelect={(name) => {
            if (name !== "index" && !requireLogin()) return;
            router.replace((name === "index" ? "/" : `/${name}`) as Href);
          }}
        />
      )}
    </ProfileShell>
  );
}
