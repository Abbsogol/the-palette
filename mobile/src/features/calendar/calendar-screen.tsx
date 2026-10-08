import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { useAccountQuery, queryClient } from "../../lib/auth";
import { appScheme } from "../../lib/config";
import { readPending, writePending } from "../../lib/pending";
import type { CalendarStatus } from "./model";
import { CalendarView } from "./calendar-view";
WebBrowser.maybeCompleteAuthSession();
export function CalendarScreen() {
  const params = useLocalSearchParams<{ attempt?: string }>();
  const query = useAccountQuery(["google-calendar"], () =>
    api<CalendarStatus>("/mobile/calendar?calendars=1"),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const latch = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const run = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      if (latch.current) return;
      latch.current = true;
      setBusy(true);
      setError("");
      setNotice("");
      const ticket = accountScope.capture();
      try {
        if (action === "connect") {
          const returnUrl =
            Platform.OS === "web"
              ? Linking.createURL("calendar-connect")
              : `${appScheme}://calendar-connect`;
          const start = await api<{ url: string; attemptId: string }>(
            "/mobile/calendar",
            { action, returnUrl },
          );
          accountScope.assert(ticket);
          await writePending(
            "google-calendar-connect",
            start.attemptId,
            ticket,
          );
          accountScope.assert(ticket);
          const result = await WebBrowser.openAuthSessionAsync(
            start.url,
            returnUrl,
          );
          accountScope.assert(ticket);
          if (result.type !== "success") {
            if (mounted.current)
              setNotice(
                "Calendar connection was cancelled. You can connect whenever you are ready.",
              );
            return;
          }
          const url = new URL(result.url);
          if (
            `${url.protocol}//${url.host}${url.pathname}` !== returnUrl ||
            url.searchParams.get("attempt") !== start.attemptId
          )
            throw new Error(
              "The calendar return link did not match this connection. Please try again.",
            );
          if (url.searchParams.get("calendar") !== "authorized")
            throw new Error(
              "Google Calendar was not connected. Allow calendar access and try again.",
            );
          await api("/mobile/calendar", {
            action: "finish",
            attemptId: start.attemptId,
          });
          accountScope.assert(ticket);
          await writePending("google-calendar-connect", null, ticket);
        } else if (action === "finish") {
          const pending = await readPending<string>(
            "google-calendar-connect",
            ticket,
          );
          accountScope.assert(ticket);
          if (pending !== payload.attemptId)
            throw new Error(
              "Start a calendar connection from this account before continuing.",
            );
          await api("/mobile/calendar", { action, ...payload });
          accountScope.assert(ticket);
          await writePending("google-calendar-connect", null, ticket);
        } else await api("/mobile/calendar", { action, ...payload });
        accountScope.assert(ticket);
        await queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === ticket.id,
        });
        accountScope.assert(ticket);
        if (mounted.current)
          setNotice(
            action === "disconnect"
              ? "Google Calendar disconnected. Existing calendar copies will no longer update."
              : action === "sync"
                ? "Calendar sync checked. Any pending updates are shown below."
                : action === "sources"
                  ? "Calendars saved. Busy-time checks use your selection."
                  : "Google Calendar connected. Your primary calendar is selected; add any other calendars you use below.",
          );
      } catch (e) {
        if (mounted.current && accountScope.isCurrent(ticket))
          setError((e as Error).message);
      } finally {
        latch.current = false;
        if (mounted.current && accountScope.isCurrent(ticket)) setBusy(false);
      }
    },
    [],
  );
  const returned = useRef("");
  useEffect(() => {
    if (params.attempt && params.attempt !== returned.current) {
      returned.current = params.attempt;
      void run("finish", { attemptId: params.attempt });
    }
  }, [params.attempt, run]);
  return (
    <CalendarView
      key={`${query.data?.status}:${query.data?.sources.map((s) => s.id).join(",")}`}
      state={query.data}
      loading={query.isPending}
      busy={busy}
      error={error || query.error?.message}
      notice={notice}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/profile-settings")
      }
      onConnect={() => void run("connect")}
      onDisconnect={() => void run("disconnect")}
      onSave={(ids) => void run("sources", { ids })}
      onSync={() => void run("sync")}
      onRetry={() => void query.refetch()}
    />
  );
}
