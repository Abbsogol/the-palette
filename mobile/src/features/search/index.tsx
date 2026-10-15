import { PinterestInspiration, usePinterestFeed, selectedInspiration } from "../pinterest/inspiration";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useAccountQuery, useAuth, queryClient } from "../../lib/auth";
import { accountScope } from "../../lib/account-scope";
import { supabase } from "../../lib/supabase";
import { checked } from "../../lib/api";
import { setSaved } from "../../lib/designs";
import { countSearchDesigns, searchArtists, searchDesigns } from "./data";
import {
  emptyFilters,
  type SearchFilters,
  type SearchMode,
  type SearchSort,
} from "./filters";
import { SearchView } from "./search-view";

export default function SearchScreen({
  initialQuery = "",
  initialMode = "Designs",
}: {
  initialQuery?: string;
  initialMode?: string;
}) {
  const { session, epoch } = useAuth();
  const [active, setActive] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );
  const [source, setSource] = useState<"LaQue" | "Pinterest">("LaQue");
  const [input, setInput] = useState(initialQuery),
    [query, setQuery] = useState(initialQuery.trim());
  const [mode, setMode] = useState<SearchMode>(
      initialMode === "Artists" ? "Artists" : "Designs",
    ),
    [sort, setSort] = useState<SearchSort>("Newest");
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters),
    [draft, setDraft] = useState<SearchFilters | null>(null);
  const [saving, setSaving] = useState<string[]>([]),
    [saveError, setSaveError] = useState<{ epoch: number; message: string } | null>(null);
  const pinterest = usePinterestFeed(active && mode === "Designs" && source === "Pinterest", !!session);
  const pending = useRef(new Set<string>());
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);
  const request = { query, filters, sort };
  const designs = useInfiniteQuery({
    queryKey: [session?.user.id || "public", epoch, "search-designs", request],
    initialPageParam: 0,
    enabled: mode === "Designs" && source === "LaQue",
    queryFn: async ({ pageParam, signal }) => {
      const ticket = accountScope.capture();
      const result = await searchDesigns(request, pageParam, signal);
      accountScope.assert(ticket);
      return result;
    },
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, p) => sum + p.records.length, 0) < last.total
        ? pages.length
        : undefined,
  });
  const artists = useInfiniteQuery({
    queryKey: [session?.user.id || "public", epoch, "search-artists", query],
    initialPageParam: 0,
    enabled: mode === "Artists",
    queryFn: async ({ pageParam, signal }) => {
      const ticket = accountScope.capture();
      const result = await searchArtists(query, pageParam, signal);
      accountScope.assert(ticket);
      return result;
    },
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, p) => sum + p.records.length, 0) < last.total
        ? pages.length
        : undefined,
  });
  const count = useAccountQuery(
    ["search-count", query, draft],
    (signal) => countSearchDesigns({ query, filters: draft!, sort }, signal),
    draft !== null && source === "LaQue",
  );
  const designRows = designs.data?.pages.flatMap((page) => page.records) || [],
    artistRows = artists.data?.pages.flatMap((page) => page.records) || [];
  const ids = [...new Set(designRows.map((d) => d.id))].sort(),
    artistIds = [...new Set(artistRows.map((a) => a.id))].sort();
  const saved = useAccountQuery(
    ["search-saved", ids.join(","), artistIds.join(",")],
    async (signal) => {
      const [designs, artists] = await Promise.all([
        ids.length
          ? checked<{ design_id: string }[]>(
              supabase
                .from("saved_designs")
                .select("design_id")
                .eq("user_id", session!.user.id)
                .in("design_id", ids)
                .abortSignal(signal),
            )
          : Promise.resolve([]),
        artistIds.length
          ? checked<{ creator_id: string }[]>(
              supabase
                .from("favourite_creators")
                .select("creator_id")
                .eq("user_id", session!.user.id)
                .in("creator_id", artistIds)
                .abortSignal(signal),
            )
          : Promise.resolve([]),
      ]);
      return {
        designs: designs.map((d) => d.design_id),
        artists: artists.map((a) => a.creator_id),
      };
    },
    !!session && !!(ids.length + artistIds.length),
  );
  const save = async (id: string, kind: "designs" | "artists") => {
    const route = kind === "designs" ? `/design/${id}` : `/creator/${id}`;
    if (!session) {
      router.push({ pathname: "/auth", params: { returnTo: route } });
      return;
    }
    const ticket = accountScope.capture(),
      key = `${ticket.epoch}:${kind}:${id}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    setSaving([...pending.current]);
    setSaveError(null);
    try {
      const fresh =
        !saved.data || saved.error ? await saved.refetch() : undefined;
      if (fresh?.error)
        throw new Error("Saved items could not be checked. Please try again.");
      const state = fresh ? fresh.data : saved.data;
      if (!state)
        throw new Error("Saved items could not be checked. Please try again.");
      accountScope.assert(ticket);
      const wasSaved = state[kind].includes(id);
      if (kind === "designs") await setSaved(session.user.id, id, !wasSaved);
      else if (wasSaved)
        await checked(
          supabase
            .from("favourite_creators")
            .delete()
            .eq("user_id", session.user.id)
            .eq("creator_id", id)
            .select("creator_id"),
        );
      else
        await checked(
          supabase
            .from("favourite_creators")
            .upsert(
              { user_id: session.user.id, creator_id: id },
              { onConflict: "user_id,creator_id", ignoreDuplicates: true },
            )
            .select("creator_id"),
        );
      accountScope.assert(ticket);
      await queryClient.invalidateQueries();
    } catch (e) {
      if (accountScope.isCurrent(ticket))
        setSaveError({ epoch: ticket.epoch, message: (e as Error).message });
    } finally {
      pending.current.delete(key);
      if (accountScope.isCurrent(ticket)) setSaving([...pending.current]);
    }
  };
  const busy = (id: string, kind: string) =>
    saving.includes(`${epoch}:${kind}:${id}`);
  const current = mode === "Designs" ? designs : artists;
  return (
    <SearchView
      active={active}
      input={input}
      source={source}
      onSource={setSource}
      pinterest={<PinterestInspiration feed={pinterest} query={query} filters={filters} active={active && mode === "Designs" && source === "Pinterest"} authenticated={!!session} onSignIn={() => router.push("/auth")} />}
      onInput={setInput}
      onSubmit={() => setQuery(input.trim())}
      mode={mode}
      onMode={setMode}
      sort={sort}
      onSort={setSort}
      filters={filters}
      onApply={setFilters}
      onDraft={setDraft}
      draftTotal={source === "Pinterest" ? selectedInspiration(pinterest.page?.records || [], pinterest.topic, query, draft || filters).length : count.data}
      counting={source === "LaQue" && count.isFetching}
      countError={source === "LaQue" && count.error ? "Result count unavailable." : undefined}
      onRetryCount={() => {
        void count.refetch();
      }}
      total={current.data?.pages[0]?.total}
      loading={current.isPending}
      error={
        current.error && !current.isFetchNextPageError
          ? "Search couldn’t load. Check your connection and try again."
          : undefined
      }
      saveError={saveError?.epoch === epoch ? saveError.message : undefined}
      onRetry={() => {
        void current.refetch();
      }}
      designs={designRows.map((d) => ({
        id: d.id,
        title: d.title,
        image: d.image_url,
        attributes: [
          d.shape,
          d.length,
          d.technique,
          d.category,
          ...(d.design_colours?.map((c) => c.colour_name) || []),
          d.occasion,
        ].filter((v): v is string => !!v),
        saved: saved.data?.designs.includes(d.id),
        saving: busy(d.id, "designs"),
      }))}
      artists={artistRows.map((a) => ({
        id: a.id,
        name: a.display_name || a.username || "LaQue member",
        username:a.username,
        image: a.avatar_url,
        location: a.location,
        kind: a.account_type === "salon" ? "SALON" : ["creator","nail_artist"].includes(a.account_type) ? "NAIL ARTIST" : "MEMBER",
        saved: saved.data?.artists.includes(a.id),
        saving: busy(a.id, "artists"),
      }))}
      onDesign={(id) =>
        router.push({ pathname: "/design/[id]", params: { id, from: "search" } })
      }
      onArtist={(id) =>
        router.push({ pathname: "/creator/[id]", params: { id } })
      }
      onSave={(id) => {
        void save(id, "designs");
      }}
      onSaveArtist={(id) => {
        void save(id, "artists");
      }}
      hasMore={current.hasNextPage}
      loadingMore={current.isFetchingNextPage}
      moreError={
        current.isFetchNextPageError
          ? "More results could not load."
          : undefined
      }
      onMore={() => {
        void current.fetchNextPage();
      }}
    />
  );
}
