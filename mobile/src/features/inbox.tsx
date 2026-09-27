import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Button, Card, Notice, QueryState, styles } from "../components/ui";
import { useAccountQuery, useAuth } from "../lib/auth";
import { api, checked } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Conversation, Profile } from "../lib/types";
import * as Crypto from "expo-crypto";
import { readPending, writePending } from "../lib/pending";
import { accountScope } from "../lib/account-scope";
export function Inbox({ designId }: { designId?: string }) {
  const { session } = useAuth();
  const [limit, setLimit] = useState(30),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useAccountQuery(["inbox", limit], async () => {
    const hidden = await checked<{ conversation_id: string }[]>(
      supabase
        .from("hidden_conversations")
        .select("conversation_id")
        .eq("user_id", session!.user.id),
    );
    let request = supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .order("id")
      .limit(limit);
    if (hidden.length)
      request = request.not(
        "id",
        "in",
        `(${hidden.map((h) => h.conversation_id).join(",")})`,
      );
    const conversations = await checked<Conversation[]>(request);
    const ids = conversations.map((c) =>
      c.client_id === session!.user.id ? c.creator_id : c.client_id,
    );
    const profiles = ids.length
      ? await checked<Profile[]>(
          supabase.from("profiles").select("*").in("id", ids),
        )
      : [];
    const unread = conversations.length
      ? await checked<{ conversation_id: string }[]>(
          supabase
            .from("messages")
            .select("conversation_id")
            .in(
              "conversation_id",
              conversations.map((c) => c.id),
            )
            .neq("sender_id", session!.user.id)
            .eq("is_read", false),
        )
      : [];
    return conversations.map((c) => ({
      ...c,
      other: profiles.find(
        (p) =>
          p.id ===
          (c.client_id === session!.user.id ? c.creator_id : c.client_id),
      ),
      unread: unread.some((m) => m.conversation_id === c.id),
    }));
  });
  const open = async (c: Conversation) => {
    setBusy(true);
    setError("");
    try {
      if (designId) {
        const ticket = accountScope.capture();
        const key = `share:${c.id}:${designId}`;
        const id =
          (await readPending<string>(key, ticket)) || Crypto.randomUUID();
        await writePending(key, id, ticket);
        await api("/mobile/message", {
          id,
          conversationId: c.id,
          content: "Shared a design",
          designId,
        });
        await writePending(key, null, ticket);
      }
      router.push({ pathname: "/conversation/[id]", params: { id: c.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {designId && (
        <Notice>Choose the conversation to share this design with.</Notice>
      )}
      <Button
        title="Find a creator to message"
        secondary
        onPress={() => router.push("/search")}
      />
      <Button
        title="Refresh inbox"
        secondary
        onPress={() => void query.refetch()}
      />
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={!query.data?.length}
        retry={() => void query.refetch()}
      >
        {query.data?.map((c) => (
          <Card key={c.id}>
            <Text style={styles.subtitle}>
              {c.other?.display_name || "LaQue member"}
            </Text>
            {c.unread && (
              <Text accessibilityLabel="Unread messages" style={styles.muted}>
                New messages
              </Text>
            )}
            <Button
              title={designId ? "Share design" : "Open conversation"}
              secondary
              disabled={busy}
              onPress={() => void open(c)}
            />
          </Card>
        ))}
        {query.data?.length === limit && (
          <Button
            title="Load older conversations"
            secondary
            onPress={() => setLimit(limit + 30)}
          />
        )}
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
