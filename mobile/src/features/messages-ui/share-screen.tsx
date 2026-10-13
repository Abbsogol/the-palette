import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { api, checked } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { queryClient, useAccountQuery, useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { readPending, writePending } from "../../lib/pending";
import {
  discoverRecipients,
  inboxContact,
  loadInbox,
  loadShareDesign,
} from "./data";
import type { ShareRecipient } from "./model";
import { ShareDesignView } from "./share-view";
export function ShareDesignScreen({ designId }: { designId: string }) {
  const { session, epoch } = useAuth();
  if (!session) return null;
  return (
    <AccountShareDesignScreen
      key={`${session.user.id}:${epoch}:${designId}`}
      designId={designId}
      userId={session.user.id}
    />
  );
}
function AccountShareDesignScreen({
  designId,
  userId,
}: {
  designId: string;
  userId: string;
}) {
  const [source, setSource] = useState<"recent" | "discover">("recent"),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState("");
  const [limit, setLimit] = useState(30),
    [selected, setSelected] = useState<ShareRecipient>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState<string>(),
    [notice, setNotice] = useState("");
  const sending = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const design = useAccountQuery(
    ["share-design", designId],
    (signal) => loadShareDesign(designId, signal),
    !!designId,
  );
  const inbox = useAccountQuery(["inbox", limit], (signal) =>
    loadInbox(userId, limit, signal),
  );
  const discover = useAccountQuery(
    ["share-recipients", debounced, limit],
    (signal) => discoverRecipients(debounced, limit, userId, signal),
    source === "discover",
  );
  const contacts = (inbox.data ?? []).map((c) => inboxContact(c, userId));
  const recipients =
    source === "recent"
      ? contacts
      : (discover.data ?? []).map((p) => ({
          ...p,
          conversationId: contacts.find((c) => c.userId === p.userId)
            ?.conversationId,
        }));
  const active = source === "recent" ? inbox : discover;
  const send = async () => {
    if (
      sending.current ||
      sent ||
      !selected ||
      selected.available === false ||
      !design.data ||
      design.error ||
      active.error
    )
      return;
    sending.current = true;
    setBusy(true);
    setError("");
    const ticket = accountScope.capture();
    const recipient = selected;
    try {
      // Recheck publication/access before creating a conversation or sending a stale selection.
      await loadShareDesign(designId, new AbortController().signal);
      accountScope.assert(ticket);
      let conversationId = recipient.conversationId;
      if (!conversationId) {
        const result = await api<{ conversationId: string }>(
          "/mobile/conversation",
          { creatorId: recipient.userId },
        );
        accountScope.assert(ticket);
        if (
          typeof result?.conversationId !== "string" ||
          !result.conversationId.trim()
        )
          throw new Error("The chat could not be confirmed. Please retry.");
        conversationId = result.conversationId;
      }
      const key = `share:${conversationId}:${designId}`;
      const id =
        (await readPending<string>(key, ticket)) || Crypto.randomUUID();
      accountScope.assert(ticket);
      await writePending(key, id, ticket);
      accountScope.assert(ticket);
      const response = await api<{
        message?: {
          id?: string;
          conversation_id?: string;
          design_id?: string;
          sender_id?: string;
          content?: string;
        };
      }>("/mobile/message", {
        id,
        conversationId,
        content: "Shared a design",
        designId,
      });
      accountScope.assert(ticket);
      const message = response?.message;
      if (
        !message ||
        message.id !== id ||
        message.conversation_id !== conversationId ||
        message.design_id !== designId ||
        message.sender_id !== userId ||
        message.content !== "Shared a design"
      )
        throw new Error(
          "Delivery could not be confirmed. Retry to check and send safely.",
        );
      // Once acknowledged, storage/refresh failures must not misreport delivery as failed.
      setSent(conversationId);
      await writePending(key, null, ticket).catch(() => {
        if (accountScope.isCurrent(ticket))
          setNotice(
            "Shared successfully. The local retry record could not be cleared.",
          );
      });
      accountScope.assert(ticket);
      await checked(
        supabase
          .from("hidden_conversations")
          .delete()
          .eq("user_id", userId)
          .eq("conversation_id", conversationId),
      ).catch(() => {
        if (accountScope.isCurrent(ticket))
          setNotice(
            "Shared successfully. Open the chat here if it is still hidden in your inbox.",
          );
      });
      accountScope.assert(ticket);
      void queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === userId && q.queryKey.includes("inbox"),
      });
    } catch (e) {
      if (accountScope.isCurrent(ticket))
        setError(
          (e as Error).message ||
            "The design could not be shared. Please try again.",
        );
    } finally {
      sending.current = false;
      if (accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  return (
    <ShareDesignView
      design={design.error ? undefined : design.data}
      designLoading={!!designId && design.isPending}
      designError={
        !designId
          ? "Choose a design before sharing."
          : design.error
            ? "This design is unavailable. Return to the design or retry."
            : undefined
      }
      recipients={recipients}
      selected={selected}
      source={source}
      search={search}
      loading={
        active.isPending || (source === "discover" && debounced !== search)
      }
      error={active.error?.message}
      sendError={error}
      busy={busy}
      sent={!!sent}
      notice={notice}
      hasMore={active.data?.length === limit}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/messages")
      }
      onSearch={(value) => {
        setSearch(value);
        setLimit(30);
      }}
      onSource={(value) => {
        setSource(value);
        setSearch("");
        setDebounced("");
        setLimit(30);
      }}
      onSelect={(value) => {
        setSelected(value);
        setError("");
      }}
      onSend={() => void send()}
      onRetry={() => {
        void design.refetch();
        void active.refetch();
      }}
      onMore={() => setLimit((value) => value + 30)}
      onOpenChat={() => {
        if (sent)
          router.replace({
            pathname: "/conversation/[id]",
            params: { id: sent },
          });
      }}
    />
  );
}
