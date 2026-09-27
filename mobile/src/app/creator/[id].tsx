import { useState } from "react";
import { Alert, Text } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Notice,
  QueryState,
  Screen,
  styles,
} from "../../components/ui";
import { DesignGrid } from "../../components/design-card";
import { useAccountQuery, useAuth, queryClient } from "../../lib/auth";
import { api, checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import type { Profile, Design } from "../../lib/types";
export default function Creator() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useAccountQuery(["creator", id], async (signal) => {
    const profile = await checked<Profile | null>(
      supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .abortSignal(signal)
        .single(),
    );
    const designs = await checked<Design[]>(
      supabase
        .from("designs")
        .select("*")
        .eq("created_by", id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(60)
        .abortSignal(signal),
    );
    return { profile, designs };
  });
  const requireSignIn = () => {
    if (session) return true;
    router.push({ pathname: "/auth", params: { returnTo: `/creator/${id}` } });
    return false;
  };
  const run = async (action: () => Promise<unknown>) => {
    if (!requireSignIn()) return;
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
  const p = query.data?.profile;
  return (
    <Screen back>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {p && (
          <>
            <Card>
              {p.avatar_url && (
                <Image
                  source={p.avatar_url}
                  style={{ width: 88, height: 88, borderRadius: 44 }}
                />
              )}
              <Text style={styles.title}>{p.display_name}</Text>
              <Text style={styles.muted}>{p.location}</Text>
              <Notice>{p.bio || "Welcome to my portfolio."}</Notice>
              {p.is_private && (
                <Notice>
                  This is a private profile. Only permitted content is shown.
                </Notice>
              )}
            </Card>
            <DesignGrid designs={query.data?.designs || []} />
            {p.account_type !== "user" && (
              <Button
                title="Book an appointment"
                disabled={busy}
                onPress={() => {
                  if (requireSignIn())
                    router.push({ pathname: "/book/[id]", params: { id } });
                }}
              />
            )}
            {id !== session?.user.id && (
              <>
                <Button
                  title="Message"
                  busy={busy}
                  onPress={() =>
                    void run(async () => {
                      const { conversationId } = await api<{
                        conversationId: string;
                      }>("/mobile/conversation", { creatorId: id });
                      router.push({
                        pathname: "/conversation/[id]",
                        params: { id: conversationId },
                      });
                    })
                  }
                />
                <Button
                  title="Follow creator"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    void run(() =>
                      checked(
                        supabase
                          .from("follows")
                          .upsert(
                            { follower_id: session!.user.id, following_id: id },
                            {
                              onConflict: "follower_id,following_id",
                              ignoreDuplicates: true,
                            },
                          )
                          .select("follower_id"),
                      ),
                    )
                  }
                />
                <Button
                  title="Report profile"
                  secondary
                  onPress={() => {
                    if (requireSignIn())
                      router.push({
                        pathname: "/report",
                        params: { targetType: "profile", targetId: id },
                      });
                  }}
                />
                <Button
                  title="Block profile"
                  secondary
                  disabled={busy}
                  onPress={() => {
                    if (requireSignIn())
                      Alert.alert(
                        "Block this profile?",
                        "Neither of you will be able to send new messages to the other.",
                        [
                          { text: "Keep", style: "cancel" },
                          {
                            text: "Block",
                            style: "destructive",
                            onPress: () =>
                              void run(() =>
                                checked(
                                  supabase
                                    .from("blocks")
                                    .upsert(
                                      {
                                        blocker_id: session!.user.id,
                                        blocked_id: id,
                                      },
                                      {
                                        onConflict: "blocker_id,blocked_id",
                                        ignoreDuplicates: true,
                                      },
                                    )
                                    .select("id"),
                                ),
                              ),
                          },
                        ],
                      );
                  }}
                />
              </>
            )}
          </>
        )}
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
