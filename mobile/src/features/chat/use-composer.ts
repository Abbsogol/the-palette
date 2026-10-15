import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { accountScope } from "../../lib/account-scope";
import { api } from "../../lib/api";
import { readPending, writePending } from "../../lib/pending";
import { chooseAndUpload } from "../../lib/upload";
export type Outgoing = {
  id: string;
  conversationId: string;
  content: string;
  imagePath?: string | null;
  designId?: string | null;
};
// Preserve the ID across lost responses so a retry cannot create a second message.
export function useChatComposer(
  id: string,
  onSent: () => void,
  initialDraft?: string,
) {
  const [draft, setDraft] = useState(initialDraft?.slice(0, 2000) || ""),
    [pending, setPending] = useState<Outgoing | null>(null);
  const [attachment, setAttachment] = useState<{
    path: string;
    previewUrl: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const owner = useRef(accountScope.capture()).current;
  const latch = useRef(false),
    pendingRef = useRef<Outgoing | null>(null),
    mounted = useRef(true),
    readyRef = useRef(false);
  const restore = useCallback(async () => {
    const ticket = owner;
    readyRef.current = false;
    try {
      accountScope.assert(ticket);
      const value = await readPending<Outgoing>(`message:${id}`, ticket);
      accountScope.assert(ticket);
      if (!mounted.current) return;
      if (
        value &&
        (value.conversationId !== id ||
          !value.id ||
          typeof value.content !== "string")
      )
        throw new Error("The saved message could not be restored.");
      pendingRef.current = value;
      setPending(value);
      if (value) setDraft(value.content);
      readyRef.current = true;
      setReady(true);
      setError("");
    } catch (e) {
      if (mounted.current && accountScope.isCurrent(ticket))
        setError(`${(e as Error).message} Pull to refresh to retry recovery.`);
    }
  }, [id, owner]);
  useEffect(() => {
    mounted.current = true;
    void restore();
    return () => {
      mounted.current = false;
    };
  }, [restore]);
  const run = async (
    operation: (
      ticket: ReturnType<typeof accountScope.capture>,
    ) => Promise<void>,
  ) => {
    if (latch.current || !readyRef.current || !accountScope.isCurrent(owner))
      return;
    latch.current = true;
    setBusy(true);
    setError("");
    const ticket = owner;
    try {
      await operation(ticket);
    } catch (e) {
      if (mounted.current && accountScope.isCurrent(ticket))
        setError((e as Error).message);
    } finally {
      latch.current = false;
      if (mounted.current && accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  const send = () =>
    run(async (ticket) => {
      const outgoing = pendingRef.current || {
        id: Crypto.randomUUID(),
        conversationId: id,
        content: draft.trim() || (attachment ? "Shared an image" : ""),
        imagePath: attachment?.path || null,
      };
      if (!outgoing.content && !outgoing.designId)
        throw new Error("Write a message or choose a photo.");
      pendingRef.current = outgoing;
      setPending(outgoing);
      await writePending(`message:${id}`, outgoing, ticket);
      accountScope.assert(ticket);
      if (!mounted.current) return;
      await api("/mobile/message", outgoing);
      accountScope.assert(ticket);
      await writePending(`message:${id}`, null, ticket);
      accountScope.assert(ticket);
      if (!mounted.current) return;
      pendingRef.current = null;
      setPending(null);
      setDraft("");
      setAttachment(null);
      onSent();
    });
  const photo = () =>
    run(async (ticket) => {
      if (pendingRef.current) return;
      const result = await chooseAndUpload("message", id);
      accountScope.assert(ticket);
      if (mounted.current && result) setAttachment(result);
    });
  const discard = () =>
    run(async (ticket) => {
      await writePending(`message:${id}`, null, ticket);
      accountScope.assert(ticket);
      if (!mounted.current) return;
      pendingRef.current = null;
      setPending(null);
      setDraft("");
      setAttachment(null);
    });
  return {
    draft,
    setDraft,
    pending,
    attachment,
    removeAttachment: () => setAttachment(null),
    busy,
    ready,
    error,
    send,
    photo,
    discard,
    restore,
  };
}
