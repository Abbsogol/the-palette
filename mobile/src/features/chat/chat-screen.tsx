import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { checked } from "../../lib/api";
import { useAccountQuery, queryClient } from "../../lib/auth";
import { accountScope } from "../../lib/account-scope";
import { supabase } from "../../lib/supabase";
import { resolvePrivateImage } from "../../lib/designs";
import { loadIdentity } from "../profiles/data";
import type { Booking, Conversation, Design, Message } from "../../lib/types";
import { ChatView } from "./chat-view";
import {
  otherParticipant,
  upcomingAppointment,
  type ChatAction,
  type ChatMessage,
} from "./model";
import { useChatComposer } from "./use-composer";
function invalidate() {
  void queryClient.invalidateQueries({
    predicate: (q) =>
      q.queryKey.some((k) =>
        [
          "conversation",
          "chat-appointments",
          "inbox",
          "chat-preferences",
          "profile-relationships",
        ].includes(String(k)),
      ),
  });
}
export function ChatScreen({
  id,
  userId,
  initialDraft,
}: {
  id: string;
  userId: string;
  initialDraft?: string;
}) {
  const [limit, setLimit] = useState(50),
    [connection, setConnection] = useState("Connecting…"),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [now, setNow] = useState(() => Date.now());
  const latch = useRef(false),
    mounted = useRef(true);
  const composer = useChatComposer(id, invalidate, initialDraft);
  const query = useAccountQuery(["conversation", id, limit], async (signal) => {
    const ticket = accountScope.capture();
    const conversation = await checked<Conversation>(
      supabase
        .from("conversations")
        .select("id,client_id,creator_id,last_message_at,muted_by")
        .eq("id", id)
        .abortSignal(signal)
        .single(),
    );
    const otherId = otherParticipant(conversation, userId);
    const contact = await loadIdentity(otherId, signal);
    const rows = await checked<Message[]>(
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(limit)
        .abortSignal(signal),
    );
    const messages: ChatMessage[] = await Promise.all(
      rows.reverse().map(async (m) => {
        const value: ChatMessage = {
          id: m.id,
          own: m.sender_id === userId,
          text: m.content,
          createdAt: m.created_at,
          read: m.is_read,
        };
        if (m.image_path) {
          const { data, error } = await supabase.storage
            .from("mobile-uploads")
            .createSignedUrl(m.image_path, 900);
          if (error || !data?.signedUrl)
            value.mediaError = "Photo unavailable. Refresh to check access.";
          else {
            value.image = { uri: data.signedUrl };
            if (value.text === "Shared an image") value.text = "";
          }
        }
        if (m.design_id) {
          try {
            const d = await checked<Design>(
              supabase
                .from("designs")
                .select("id,title,image_url,shape,length,technique")
                .eq("id", m.design_id)
                .abortSignal(signal)
                .single(),
            );
            const url = await resolvePrivateImage(d.image_url);
            value.design = {
              id: d.id,
              title: d.title,
              metadata: [d.shape, d.length, d.technique]
                .filter(Boolean)
                .join(" · "),
              image: url ? { uri: url } : null,
            };
          } catch {
            value.mediaError =
              "Shared design unavailable. It may be private or removed.";
          }
        }
        return value;
      }),
    );
    accountScope.assert(ticket);
    await checked(
      supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", id)
        .neq("sender_id", userId)
        .eq("is_read", false)
        .abortSignal(signal)
        .select("id"),
    );
    return { conversation, contact, messages };
  });
  const otherId = query.data?.contact.id;
  const bookings = useAccountQuery(
    ["chat-appointments", id, otherId],
    (signal) =>
      checked<Booking[]>(
        supabase
          .from("bookings")
          .select("*,services(*)")
          .eq("client_id", query.data!.conversation.client_id)
          .eq("creator_id", query.data!.conversation.creator_id)
          .in("status", ["pending", "confirmed"])
          .gt("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(20)
          .abortSignal(signal),
      ),
    !!query.data,
  );
  const preferences = useAccountQuery(
    ["chat-preferences", id, otherId],
    async (signal) => {
      const favorite = await checked<{ creator_id: string }[]>(
        supabase
          .from("favourite_creators")
          .select("creator_id")
          .eq("user_id", userId)
          .eq("creator_id", otherId!)
          .abortSignal(signal),
      );
      return { favorite: favorite.length > 0 };
    },
    !!otherId,
  );
  useFocusEffect(
    useCallback(() => {
      invalidate();
    }, []),
  );
  useEffect(() => {
    mounted.current = true;
    const ticket = accountScope.capture();
    const channel = supabase
      .channel(`mobile-chat-${id}-${ticket.epoch}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        () => {
          if (accountScope.isCurrent(ticket)) invalidate();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          if (accountScope.isCurrent(ticket)) invalidate();
        },
      )
      .subscribe((status) => {
        if (mounted.current && accountScope.isCurrent(ticket))
          setConnection(
            status === "SUBSCRIBED"
              ? "Connected"
              : "Reconnecting · pull to refresh",
          );
      });
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [id]);
  const run = async (operation: () => Promise<void>) => {
    if (latch.current || composer.busy || !otherId) return;
    latch.current = true;
    setBusy(true);
    setError("");
    const ticket = accountScope.capture();
    try {
      await operation();
      accountScope.assert(ticket);
      if (mounted.current) invalidate();
    } catch (e) {
      if (mounted.current && accountScope.isCurrent(ticket))
        setError((e as Error).message);
    } finally {
      latch.current = false;
      if (mounted.current && accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  const action = (kind: ChatAction, target?: string) => {
    if (kind === "discard") {
      void composer.discard();
      return;
    }
    if (!query.data || query.error) return;
    if (kind === "photo") {
      void composer.photo();
      return;
    }
    if (kind === "profile" || kind === "portfolio") {
      router.push({
        pathname: "/creator/[id]",
        params: {
          id: otherId!,
          ...(kind === "portfolio" ? { tab: "Services" } : {}),
        },
      });
      return;
    }
    if (kind === "book") {
      router.push({ pathname: "/book/[id]", params: { id: otherId! } });
      return;
    }
    if (kind === "appointment" && target) {
      router.push({ pathname: "/booking/[id]", params: { id: target } });
      return;
    }
    if (kind === "design" && target) {
      router.push({ pathname: "/design/[id]", params: { id: target } });
      return;
    }
    if (kind === "share-design") {
      router.push("/saved");
      return;
    }
    if (kind === "report" || kind === "report-message") {
      router.push({
        pathname: "/report",
        params: {
          targetType: kind === "report" ? "profile" : "message",
          targetId: kind === "report" ? otherId! : target!,
        },
      });
      return;
    }
    void run(async () => {
      const ticket = accountScope.capture();
      if (kind === "favorite") {
        const { data, error } = await preferences.refetch();
        accountScope.assert(ticket);
        if (error || !data)
          throw error || new Error("Could not check favorite status.");
        if (data.favorite)
          await checked(
            supabase
              .from("favourite_creators")
              .delete()
              .eq("user_id", userId)
              .eq("creator_id", otherId!)
              .select("creator_id"),
          );
        else
          await checked(
            supabase
              .from("favourite_creators")
              .upsert(
                { user_id: userId, creator_id: otherId },
                { onConflict: "user_id,creator_id", ignoreDuplicates: true },
              )
              .select("creator_id"),
          );
      }
      if (kind === "mute") {
        const current = await checked<{ muted_by: string[] }>(
          supabase
            .from("conversations")
            .select("muted_by")
            .eq("id", id)
            .single(),
        );
        accountScope.assert(ticket);
        const muted = current.muted_by.includes(userId),
          next = muted
            ? current.muted_by.filter((u) => u !== userId)
            : [...current.muted_by, userId];
        // Compare-and-swap preserves the other participant's concurrent preference.
        const changed = await checked<{ id: string }[]>(
          supabase
            .from("conversations")
            .update({ muted_by: next })
            .eq("id", id)
            .eq("muted_by", `{${current.muted_by.join(",")}}`)
            .select("id"),
        );
        if (!changed.length)
          throw new Error("Notification settings changed. Please try again.");
      }
      if (kind === "block")
        await checked(
          supabase
            .from("blocks")
            .upsert(
              { blocker_id: userId, blocked_id: otherId },
              { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
            )
            .select("id"),
        );
      if (kind === "delete")
        await checked(
          supabase
            .from("hidden_conversations")
            .upsert(
              { user_id: userId, conversation_id: id },
              { onConflict: "user_id,conversation_id", ignoreDuplicates: true },
            )
            .select("conversation_id"),
        );
      accountScope.assert(ticket);
      if (mounted.current && (kind === "block" || kind === "delete"))
        router.back();
    });
  };
  return (
    <ChatView
      contact={query.error ? undefined : query.data?.contact}
      messages={query.error ? [] : query.data?.messages || []}
      appointment={
        otherId && bookings.data
          ? upcomingAppointment(bookings.data, userId, otherId, now)
          : undefined
      }
      connection={connection}
      loading={query.isPending}
      error={query.error?.message}
      actionError={
        composer.error ||
        error ||
        (bookings.error
          ? "Appointment updates unavailable. Pull to refresh."
          : preferences.error
            ? "Favorite status unavailable. Pull to refresh."
            : undefined)
      }
      refreshing={query.isRefetching}
      busy={busy || composer.busy}
      ready={composer.ready && !!query.data && !query.error && !busy}
      pending={!!composer.pending}
      muted={query.data?.conversation.muted_by?.includes(userId)}
      favorite={preferences.data?.favorite}
      draft={composer.draft}
      onDraft={composer.setDraft}
      attachment={
        composer.attachment ? { uri: composer.attachment.previewUrl } : null
      }
      onRemoveAttachment={composer.removeAttachment}
      onSend={() => {
        if (!query.error && query.data) void composer.send();
      }}
      onAction={action}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/messages")
      }
      onMore={() => setLimit((n) => n + 50)}
      hasMore={query.data?.messages.length === limit}
      onRefresh={() => {
        invalidate();
        if (!composer.ready) void composer.restore();
      }}
    />
  );
}
