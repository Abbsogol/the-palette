import { DesignGrid } from "../components/design-card";
import { QueryState, RequireAuth, Screen } from "../components/ui";
import { useAccountQuery, useAuth } from "../lib/auth";
import { checked } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Design } from "../lib/types";
function Saved() {
  const { session } = useAuth();
  const query = useAccountQuery(["saved"], async () => {
    const rows = await checked<{ design_id: string }[]>(
      supabase
        .from("saved_designs")
        .select("design_id")
        .eq("user_id", session!.user.id)
        .order("saved_at", { ascending: false })
        .limit(100),
    );
    return rows.length
      ? checked<Design[]>(
          supabase
            .from("designs")
            .select("*")
            .in(
              "id",
              rows.map((r) => r.design_id),
            ),
        )
      : [];
  });
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      empty={!query.data?.length}
      retry={() => void query.refetch()}
    >
      <DesignGrid designs={query.data || []} />
    </QueryState>
  );
}
export default function SavedScreen() {
  return (
    <Screen title="Saved designs" back>
      <RequireAuth>
        <Saved />
      </RequireAuth>
    </Screen>
  );
}
