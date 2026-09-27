import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Field,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
} from "../../components/ui";
import { DesignCard } from "../../components/design-card";
import { useAccountQuery, queryClient } from "../../lib/auth";
import { checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import type { Design } from "../../lib/types";
function Collection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState(""),
    [error, setError] = useState("");
  const query = useAccountQuery(["collection", id], async () => {
    const collection = await checked<{ name: string } | null>(
      supabase.from("collections").select("name").eq("id", id).single(),
    );
    const rows = await checked<{ design_id: string }[]>(
      supabase
        .from("collection_designs")
        .select("design_id")
        .eq("collection_id", id)
        .order("added_at")
        .limit(100),
    );
    const designs = rows.length
      ? await checked<Design[]>(
          supabase
            .from("designs")
            .select("*")
            .in(
              "id",
              rows.map((r) => r.design_id),
            ),
        )
      : [];
    return { collection, designs };
  });
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await queryClient.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        <Notice>{query.data?.collection.name}</Notice>
        <Field
          label="Rename collection"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <Button
          title="Rename"
          onPress={() =>
            void run(async () => {
              if (!name.trim()) throw new Error("Enter a name.");
              await checked(
                supabase
                  .from("collections")
                  .update({ name: name.trim() })
                  .eq("id", id)
                  .select("id"),
              );
              setName("");
            })
          }
        />
        {query.data?.designs.map((d) => (
          <Card key={d.id}>
            <DesignCard design={d} />
            <Button
              title="Remove from collection"
              secondary
              onPress={() =>
                void run(() =>
                  checked(
                    supabase
                      .from("collection_designs")
                      .delete()
                      .eq("collection_id", id)
                      .eq("design_id", d.id)
                      .select("id"),
                  ),
                )
              }
            />
          </Card>
        ))}
        {!query.data?.designs.length && (
          <Notice>No visible designs in this collection.</Notice>
        )}
        <Button
          title="Discover designs"
          onPress={() => router.push("/search")}
        />
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function CollectionScreen() {
  return (
    <Screen title="Your collection" back>
      <RequireAuth>
        <Collection />
      </RequireAuth>
    </Screen>
  );
}
