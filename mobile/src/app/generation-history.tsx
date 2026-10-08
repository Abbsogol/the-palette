import { useRef, useState } from "react";
import { router, type Href } from "expo-router";
import { RequireAuth } from "../components/ui";
import { HomeNavigation } from "../components/home-tab-bar";
import { HistoryView } from "../features/lab-ui/history-view";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { api, checked } from "../lib/api";
import { accountScope } from "../lib/account-scope";
import { resolvePrivateImage } from "../lib/designs";
import { supabase } from "../lib/supabase";
import type { Generation } from "../lib/types";
function History() {
  const { session } = useAuth();
  const [limit, setLimit] = useState(12),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const query = useAccountQuery(["generations", limit], async () => {
    const ticket = accountScope.capture();
    const response = await supabase
      .from("nail_lab_generations")
      .select("*", { count: "exact" })
      .eq("user_id", session!.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    accountScope.assert(ticket);
    const rows = await checked<Generation[]>(Promise.resolve(response));
    const designs = await Promise.all(
      rows.map(async (g) => ({
        id: g.id,
        title: g.vibe?.join(" + ") || "Your design",
        shape: g.shape,
        length: g.length,
        date: new Date(g.created_at).toLocaleDateString("en", {
          month: "short",
          day: "numeric",
        }),
        image: await resolvePrivateImage(g.image_url),
      })),
    );
    accountScope.assert(ticket);
    return { designs, total: response.count ?? undefined };
  });
  const save = async (id: string) => {
    if (mutation.current) return;
    mutation.current = true;
    const ticket = accountScope.capture();
    setBusy(true);
    setError("");
    try {
      const { designId } = await api<{ designId: string }>(
        "/publish-nail-lab-generation",
        { generationId: id, asDraft: true },
      );
      accountScope.assert(ticket);
      await queryClient.invalidateQueries();
      accountScope.assert(ticket);
      router.push({ pathname: "/design/[id]", params: { id: designId, from: "lab" } });
    } catch (e) {
      if (accountScope.isCurrent(ticket)) setError((e as Error).message);
    } finally {
      mutation.current = false;
      if (accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  const designs = query.data?.designs ?? [];
  return (
    <>
      <HistoryView
        designs={designs}
        total={query.data?.total}
        loading={query.isPending}
        error={query.error?.message}
        actionError={error}
        busy={busy}
        hasMore={
          query.data?.total != null
            ? designs.length < query.data.total
            : designs.length === limit
        }
        loadingMore={query.isFetching}
        onMore={() => setLimit((value) => value + 12)}
        onRetry={() => void query.refetch()}
        onOpen={(id) => void save(id)}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/lab")
        }
      />
      <HomeNavigation
        selected="lab"
        onSelect={(name) =>
          router.replace((name === "index" ? "/" : `/${name}`) as Href)
        }
      />
    </>
  );
}
export default function GenerationHistory() {
  return (
    <RequireAuth>
      <History />
    </RequireAuth>
  );
}
