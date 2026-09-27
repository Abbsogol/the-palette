import { useState } from "react";
import { router } from "expo-router";
import {
  Button,
  Card,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
} from "../components/ui";
import { DesignCard } from "../components/design-card";
import { useAccountQuery, useAuth } from "../lib/auth";
import { checked } from "../lib/api";
import { resolvePrivateImage } from "../lib/designs";
import { supabase } from "../lib/supabase";
import type { Design } from "../lib/types";
function Portfolio() {
  const { session } = useAuth();
  const [limit, setLimit] = useState(20);
  const query = useAccountQuery(["portfolio", limit], async () => {
    const designs = await checked<Design[]>(
      supabase
        .from("designs")
        .select("*")
        .eq("created_by", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return Promise.all(
      designs.map(async (d) => ({
        ...d,
        image_url: await resolvePrivateImage(d.image_url),
      })),
    );
  });
  return (
    <>
      <Button
        title="Publish a new design"
        onPress={() => router.push("/portfolio-edit")}
      />
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={!query.data?.length}
        retry={() => void query.refetch()}
      >
        {query.data?.map((d) => (
          <Card key={d.id}>
            <DesignCard design={d} />
            <Notice>{d.is_published ? "Published" : "Private draft"}</Notice>
            <Button
              title="Edit design"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/portfolio-edit",
                  params: { id: d.id },
                })
              }
            />
          </Card>
        ))}
        {query.data?.length === limit && (
          <Button
            title="Load more"
            secondary
            onPress={() => setLimit(limit + 20)}
          />
        )}
      </QueryState>
    </>
  );
}
export default function PortfolioScreen() {
  return (
    <Screen title="My portfolio" back>
      <RequireAuth>
        <Portfolio />
      </RequireAuth>
    </Screen>
  );
}
