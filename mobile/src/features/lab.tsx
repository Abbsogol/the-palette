import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import { RequireAuth } from "../components/ui";
import { LabView, GeneratedResult } from "./lab-ui/lab-view";
import { defaultLabSettings, type LabSettings } from "./lab-ui/model";
import type { AccountTicket } from "../lib/account-scope";
import { api, ApiError } from "../lib/api";
import { useProfile, useAccountQuery, queryClient } from "../lib/auth";
import { accountScope } from "../lib/account-scope";
import { readPending, writePending } from "../lib/pending";
import { setSaved } from "../lib/designs";

type Request = LabSettings & {
  requestId: string;
  freeRegen?: boolean;
  parentGenerationId?: string;
};
type Result = {
  status?: string;
  generationId?: string;
  imageUrl?: string;
  creditsRemaining?: number;
  error?: string;
  freeRegenUsed?: boolean;
};
function Lab() {
  const profile = useProfile();
  const billing = useAccountQuery(["billing"], () => api<import("./credits/model").CreditBillingState>("/mobile/billing"));
  const { refetch: refreshBilling } = billing;
  useFocusEffect(useCallback(() => {
    void refreshBilling();
    const listener = AppState.addEventListener("change", state => { if(state === "active") void refreshBilling(); });
    return () => listener.remove();
  }, [refreshBilling]));
  const [settings, setSettings] = useState(defaultLabSettings);
  const [pending, setPending] = useState<Request | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const mutation = useRef(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const ticket = accountScope.capture();
    void readPending<Request>("generation", ticket)
      .then((request) => {
        if (!active || !accountScope.isCurrent(ticket)) return;
        accountScope.assert(ticket);
        setPending(request);
        setRecovering(false);
      })
      .catch((e) => {
        if (active && accountScope.isCurrent(ticket)) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [recoveryAttempt]);
  const accept = async (data: Result, ticket: AccountTicket) => {
    accountScope.assert(ticket);
    if (data.generationId && data.imageUrl) {
      await writePending("generation", null, ticket);
      accountScope.assert(ticket);
      setResult(data);
      setPending(null);
      setNotice("Your design is ready.");
      await queryClient.invalidateQueries();
    } else if (data.status === "released") {
      await writePending("generation", null, ticket);
      setPending(null);
      setNotice(
        "This attempt ended. Your current balance is shown above. You can start a new generation.",
      );
      await queryClient.invalidateQueries();
    } else
      setNotice(
        "Your design is processing. You can leave this screen and return to check it.",
      );
  };
  useEffect(() => {
    if (!pending) return;
    const ticket = accountScope.capture();
    let active = true;
    const check = () => {
      if (AppState.currentState !== "active") return;
      void api<Result>(`/generation-status?requestId=${pending.requestId}`)
        .then(async (data) => {
          if (active && accountScope.isCurrent(ticket))
            await accept(data, ticket);
        })
        .catch((e) => {
          if (active && accountScope.isCurrent(ticket))
            setError(
              e.status === 404
                ? "This request has not reached the server. Retry the same request."
                : e.message,
            );
        });
    };
    check();
    const timer = setInterval(check, 5000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
    };
    // This effect follows only the durable request identity; UI settings may change independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.requestId]);
  const generate = async () => {
    if (mutation.current || recovering) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const ticket = accountScope.capture();
    try {
      const request = pending || {
        requestId: Crypto.randomUUID(),
        ...settings,

      };
      await writePending("generation", request, ticket);
      accountScope.assert(ticket);
      setPending(request);
      const data = await api<Result>("/generate-nail-design", request);
      accountScope.assert(ticket);
      await accept(data, ticket);
    } catch (e) {
      if (
        e instanceof ApiError &&
        [400, 402, 403, 410, 422].includes(e.status) &&
        accountScope.isCurrent(ticket)
      ) {
        await writePending("generation", null, ticket);
        setPending(null);
      }
      if (accountScope.isCurrent(ticket)) setError((e as Error).message);
    } finally {
      mutation.current = false;
      if (accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  const publish = async (asDraft: boolean) => {
    if (mutation.current) return;
    mutation.current = true;
    const ticket = accountScope.capture();
    setBusy(true);
    setError("");
    try {
      const { designId } = await api<{ designId: string }>(
        "/publish-nail-lab-generation",
        { generationId: result!.generationId, asDraft: true },
      );
      accountScope.assert(ticket);
      if (asDraft) await setSaved(ticket.id!, designId, true);
      await queryClient.invalidateQueries();
      accountScope.assert(ticket);
      router.push(asDraft ? { pathname: "/design/[id]", params: { id: designId, from: "lab" } } : { pathname: "/portfolio-edit", params: { id: designId } });
    } catch (e) {
      if (accountScope.isCurrent(ticket)) setError((e as Error).message);
    } finally {
      mutation.current = false;
      if (accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  return (
    <LabView
      settings={settings}
      onSettings={setSettings}
      credits={billing.error ? null : (billing.data?.credits ?? null)}
      subscribed={billing.data?.subscription?.active ?? false}
      subscriptionLoading={billing.isPending}
      recovering={recovering}
      pending={!!pending}
      busy={busy}
      error={error || billing.error?.message || profile.error?.message}
      notice={notice}
      onRetry={() => {
        setError("");
        setRecovering(true);
        setRecoveryAttempt((value) => value + 1);
        void profile.refetch();
      }}
      onGenerate={() => void generate()}
      onHistory={() => router.push("/generation-history")}
      onCredits={() => router.push("/billing")}
    >
      {result?.imageUrl && (
        <GeneratedResult
          imageUrl={result.imageUrl}
          busy={busy}
          freeAvailable={false}
          onSave={() => void publish(true)}
          onPublish={() => void publish(false)}
          onVariation={() => void generate()}
        />
      )}
    </LabView>
  );
}
export default function LabScreen() {
  return (
    <RequireAuth>
      <Lab />
    </RequireAuth>
  );
}
