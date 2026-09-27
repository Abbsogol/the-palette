import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Crypto from "expo-crypto";
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
} from "../../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../../lib/auth";
import { api, checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { accountScope } from "../../lib/account-scope";
import { readPending, writePending } from "../../lib/pending";
import { chooseAndUpload } from "../../lib/upload";
import type { Message, Conversation } from "../../lib/types";
type Outgoing = {
  id: string;
  conversationId: string;
  content: string;
  imagePath?: string | null;
  designId?: string | null;
};
function MessageBody({ message }: { message: Message }) {
  const query = useAccountQuery(
    ["message-image", message.id],
    async () => {
      const { data, error } = await supabase.storage
        .from("mobile-uploads")
        .createSignedUrl(message.image_path!, 900);
      if (error) throw error;
      return data.signedUrl;
    },
    !!message.image_path,
  );
  return (
    <>
      <Text style={styles.text}>{message.content}</Text>
      {message.design_id && (
        <Button
          title="View shared design"
          secondary
          onPress={() =>
            router.push({
              pathname: "/design/[id]",
              params: { id: message.design_id! },
            })
          }
        />
      )}{" "}
      {message.image_path &&
        (query.error ? (
          <Notice error>
            Image unavailable. Your access may have changed.
          </Notice>
        ) : (
          query.data && (
            <Image
              source={query.data}
              style={{ width: "100%", height: 220, borderRadius: 16 }}
              contentFit="contain"
              cachePolicy="none"
              accessibilityLabel="Shared image"
            />
          )
        ))}
    </>
  );
}
function ConversationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [content, setContent] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [limit, setLimit] = useState(50),
    [pending, setPending] = useState<Outgoing | null>(null),
    [image, setImage] = useState<{ path: string; previewUrl: string } | null>(
      null,
    ),
    [live, setLive] = useState("Connecting");
  const query = useAccountQuery(["conversation", id, limit], async () => {
    const conversation = await checked<Conversation | null>(
      supabase.from("conversations").select("*").eq("id", id).single(),
    );
    const messages = await checked<Message[]>(
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(limit),
    );
    await checked(
      supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", id)
        .neq("sender_id", session!.user.id)
        .eq("is_read", false)
        .select("id"),
    );
    return { conversation, messages: messages.reverse() };
  });
  useEffect(() => {
    const ticket = accountScope.capture();
    void readPending<Outgoing>(`message:${id}`, ticket)
      .then((value) => {
        if (value && accountScope.isCurrent(ticket)) {
          setPending(value);
          setContent(value.content);
        }
      })
      .catch(() => undefined);
    const channel = supabase
      .channel(`mobile-message-${id}-${ticket.epoch}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        () => {
          if (accountScope.isCurrent(ticket))
            void queryClient.invalidateQueries({
              predicate: (q) =>
                q.queryKey.includes("conversation") ||
                q.queryKey.includes("inbox"),
            });
        },
      )
      .subscribe((status) => {
        if (accountScope.isCurrent(ticket))
          setLive(
            status === "SUBSCRIBED"
              ? "Live"
              : "Connection interrupted. Refresh to check for messages.",
          );
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);
  const send = async () => {
    setBusy(true);
    setError("");
    const ticket = accountScope.capture();
    try {
      const outgoing = pending || {
        id: Crypto.randomUUID(),
        conversationId: id,
        content: content.trim() || (image ? "Shared an image" : ""),
        imagePath: image?.path || null,
      };
      if (!outgoing.content)
        throw new Error("Write a message or choose an image.");
      await writePending(`message:${id}`, outgoing, ticket);
      setPending(outgoing);
      await api("/mobile/message", outgoing);
      await writePending(`message:${id}`, null, ticket);
      setPending(null);
      setContent("");
      setImage(null);
      await queryClient.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const other =
    query.data?.conversation.client_id === session!.user.id
      ? query.data.conversation.creator_id
      : query.data?.conversation.client_id;
  return (
    <>
      <Text style={styles.muted}>{live}</Text>
      <View style={styles.row}>
        <Button
          title="Refresh"
          secondary
          onPress={() => void query.refetch()}
        />
        <Button
          title="Hide conversation"
          secondary
          onPress={() => {
            void checked(
              supabase
                .from("hidden_conversations")
                .insert({ user_id: session!.user.id, conversation_id: id })
                .select("conversation_id"),
            )
              .then(() => {
                void queryClient.invalidateQueries();
                router.back();
              })
              .catch((e) => setError(e.message));
          }}
        />
        {other && (
          <Button
            title="Safety controls"
            secondary
            onPress={() =>
              router.push({ pathname: "/creator/[id]", params: { id: other } })
            }
          />
        )}
      </View>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data?.messages.length === limit && (
          <Button
            title="Load older messages"
            secondary
            onPress={() => setLimit(limit + 50)}
          />
        )}{" "}
        {query.data?.messages.map((message) => (
          <Card
            key={message.id}
            style={{
              alignSelf:
                message.sender_id === session!.user.id
                  ? "flex-end"
                  : "flex-start",
              maxWidth: "94%",
            }}
          >
            <Text style={styles.muted}>
              {message.sender_id === session!.user.id ? "You" : "Member"} ·{" "}
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <MessageBody message={message} />
            {message.sender_id !== session!.user.id && (
              <Button
                title="Report message"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/report",
                    params: { targetType: "message", targetId: message.id },
                  })
                }
              />
            )}
          </Card>
        ))}
      </QueryState>
      {image && (
        <Image
          source={image.previewUrl}
          cachePolicy="none"
          style={{ height: 140, borderRadius: 16 }}
          contentFit="contain"
        />
      )}
      <Field
        label="Message"
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={4000}
        editable={!pending && !busy}
      />
      <Button
        title={pending ? "Retry sending" : "Send message"}
        busy={busy}
        disabled={!query.data}
        onPress={() => void send()}
      />
      {!pending && (
        <Button
          title="Share image"
          secondary
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void chooseAndUpload("message", id)
              .then((result) => {
                if (result) setImage(result);
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        />
      )}
      {pending && (
        <Button
          title="Discard pending message"
          secondary
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Discard this pending message?",
              "It may already have arrived if the connection was interrupted. Refresh the conversation first.",
              [
                { text: "Keep", style: "cancel" },
                {
                  text: "Discard",
                  onPress: () => {
                    void writePending(
                      `message:${id}`,
                      null,
                      accountScope.capture(),
                    ).then(() => {
                      setPending(null);
                      setContent("");
                      setImage(null);
                    });
                  },
                },
              ],
            )
          }
        />
      )}{" "}
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function ConversationScreen() {
  return (
    <Screen title="Conversation" back>
      <RequireAuth>
        <ConversationView />
      </RequireAuth>
    </Screen>
  );
}
