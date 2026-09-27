import { useState } from "react";
import { Alert, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Field,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
} from "../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { checked } from "../lib/api";
import { supabase } from "../lib/supabase";
function Collections() {
  const { designId } = useLocalSearchParams<{ designId?: string }>();
  const { session } = useAuth();
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const items = useAccountQuery(["collections"], () =>
    checked<{ id: string; name: string }[]>(
      supabase
        .from("collections")
        .select("id,name")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false }),
    ),
  );
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await queryClient.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Field
        label="New collection"
        value={name}
        onChangeText={setName}
        maxLength={80}
      />
      <Button
        title="Create collection"
        busy={busy}
        onPress={() =>
          void perform(async () => {
            if (!name.trim()) throw new Error("Enter a collection name.");
            await checked(
              supabase
                .from("collections")
                .insert({ user_id: session!.user.id, name: name.trim() })
                .select("id"),
            );
            setName("");
          })
        }
      />
      {designId && <Notice>Choose a collection for this design.</Notice>}
      <QueryState
        loading={items.isPending}
        error={items.error}
        empty={!items.data?.length}
        retry={() => void items.refetch()}
      >
        {items.data?.map((item) => (
          <Card key={item.id}>
            <Text style={styles.subtitle}>{item.name}</Text>
            <Button
              title={designId ? "Add design" : "Open collection"}
              secondary
              disabled={busy}
              onPress={() => {
                if (!designId)
                  router.push({
                    pathname: "/collection/[id]",
                    params: { id: item.id },
                  });
                else
                  void perform(async () => {
                    await checked(
                      supabase
                        .from("collection_designs")
                        .upsert(
                          { collection_id: item.id, design_id: designId },
                          {
                            onConflict: "collection_id,design_id",
                            ignoreDuplicates: true,
                          },
                        )
                        .select("id"),
                    );
                    setNotice(`Added to ${item.name}.`);
                  });
              }}
            />
            <Button
              title="Delete collection"
              secondary
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  "Delete collection?",
                  "Saved designs will remain in your Saved list.",
                  [
                    { text: "Keep", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        void perform(() =>
                          checked(
                            supabase
                              .from("collections")
                              .delete()
                              .eq("id", item.id)
                              .eq("user_id", session!.user.id)
                              .select("id"),
                          ),
                        ),
                    },
                  ],
                )
              }
            />
          </Card>
        ))}
      </QueryState>
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function CollectionsScreen() {
  return (
    <Screen title="Collections" back>
      <RequireAuth>
        <Collections />
      </RequireAuth>
    </Screen>
  );
}
