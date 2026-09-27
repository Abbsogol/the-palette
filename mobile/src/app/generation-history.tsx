import { useState } from "react";
import { Text } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Button,
  Card,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
} from "../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { api, checked } from "../lib/api";
import { resolvePrivateImage, setSaved } from "../lib/designs";
import { supabase } from "../lib/supabase";
import type { Generation } from "../lib/types";
function History() {
  const { session } = useAuth();
  const [limit, setLimit] = useState(12),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useAccountQuery(["generations", limit], async () => {
    const rows = await checked<Generation[]>(
      supabase
        .from("nail_lab_generations")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        url: await resolvePrivateImage(r.image_url),
      })),
    );
  });
  const save = async (id: string, asDraft: boolean) => {
    setBusy(true);
    try {
      const { designId } = await api<{ designId: string }>(
        "/publish-nail-lab-generation",
        { generationId: id, asDraft },
      );
      if (asDraft) await setSaved(session!.user.id, designId, true);
      await queryClient.invalidateQueries();
      router.push({ pathname: "/design/[id]", params: { id: designId } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={!query.data?.length}
        retry={() => void query.refetch()}
      >
        {query.data?.map((g) => (
          <Card key={g.id}>
            <Image
              source={g.url}
              style={{ width: "100%", aspectRatio: 1.5, borderRadius: 16 }}
              contentFit="contain"
              cachePolicy="none"
            />
            <Text style={styles.text}>
              {g.vibe?.join(" + ")} · {g.shape} · {g.length}
            </Text>
            <Button
              title="Save privately"
              disabled={busy}
              onPress={() => void save(g.id, true)}
            />
            <Button
              title="Publish"
              secondary
              disabled={busy}
              onPress={() => void save(g.id, false)}
            />
          </Card>
        ))}
        {query.data?.length === limit && (
          <Button
            title="Load older designs"
            secondary
            onPress={() => setLimit(limit + 12)}
          />
        )}
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function GenerationHistory() {
  return (
    <Screen title="Generation history" back>
      <RequireAuth>
        <History />
      </RequireAuth>
    </Screen>
  );
}
