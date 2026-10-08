import { useCallback, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { AppState, Linking, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { RequireAuth } from "../components/ui";
import { CreditsView } from "../features/credits/credits-view";
import {
  creditPackages,
  type CreditBillingState,
  type CreditOperation,
} from "../features/credits/model";
import { environment } from "../lib/config";
import { api } from "../lib/api";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { accountScope, type AccountTicket } from "../lib/account-scope";
import {
  buyPackage,
  restoreStorePurchases,
  storePackages,
} from "../lib/purchases";

function Billing() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [workingOn, setWorkingOn] = useState<CreditOperation | null>(null);
  const operation = useRef(false);
  const query = useAccountQuery(["billing"], () =>
    api<CreditBillingState>("/mobile/billing"),
  );
  const native = Platform.OS === "ios" || Platform.OS === "android";
  const enabled = !!query.data?.configured && native;
  const packages = useAccountQuery(
    ["store-packages"],
    () => storePackages(),
    enabled,
  );
  const store = Platform.OS === "ios" ? "APP_STORE" : "PLAY_STORE";
  const items = creditPackages(
    query.data?.catalog || [],
    packages.data || [],
    store,
  );
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      // Returning from a store sheet/background re-reads the server. Never repeat a charge.
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active" && !operation.current) void refetch();
      });
      void refetch();
      return () => subscription.remove();
    }, [refetch]),
  );
  const refresh = async (ticket: AccountTicket) => {
    const result = await query.refetch();
    accountScope.assert(ticket);
    if (result.error || !result.data)
      throw (
        result.error ||
        new Error("Your balance could not be checked. Try again.")
      );
    setUnconfirmed(
      !!result.data.pendingPurchases.length || result.data.needsReview,
    );
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    accountScope.assert(ticket);
    return result.data;
  };
  const verify = async (ticket: AccountTicket, restoring = false) => {
    await api("/mobile/billing", {});
    accountScope.assert(ticket);
    const status = await refresh(ticket);
    setNotice(
      status.needsReview || status.pendingPurchases.length
        ? "Your purchase is still being verified. Please check again shortly; you don’t need to buy again."
        : restoring
          ? `Purchase history checked. Your available balance is ${status.credits} design tokens. Previously used designs are not restored.`
          : "Your subscription and design-token balance are up to date.",
    );
  };
  const run = async (
    kind: CreditOperation,
    action: (ticket: AccountTicket) => Promise<void>,
  ) => {
    if (operation.current) return;
    const ticket = accountScope.capture();
    operation.current = true;
    setBusy(true);
    setWorkingOn(kind);
    setError("");
    setNotice("");
    try {
      await action(ticket);
    } catch (e) {
      if (accountScope.isCurrent(ticket))
        setError(
          (e as Error).message ||
            "We couldn’t verify your purchase. Check purchases before trying again.",
        );
    } finally {
      operation.current = false;
      if (accountScope.isCurrent(ticket)) {
        setBusy(false);
        setWorkingOn(null);
      }
    }
  };
  const purchase = (id: string) =>
    run("purchase", async (ticket) => {
      const item = items.find((item) => item.id === id);
      if (!enabled || !item)
        throw new Error(
          "This store product is unavailable. Reload the store and try again.",
        );
      const status = await api<CreditBillingState>("/mobile/billing");
      accountScope.assert(ticket);
      if (status.needsReview || status.pendingPurchases.length) {
        setUnconfirmed(true);
        throw new Error("A previous purchase needs verification first.");
      }
      if (
        !status.catalog.some(
          (product) =>
            product.store === store &&
            product.product_id === id &&
            product.kind === item.kind &&
            product.credits === item.credits,
        )
      )
        throw new Error(
          "This store product has changed. Reload the store before purchasing.",
        );
      if (item.kind === "subscription" ? status.subscription?.active || status.canSubscribe === false : !status.subscription?.active || status.subscription.monthlyRemaining > 0)
        throw new Error("Your membership or allowance changed. Reload before purchasing.");
      const purchaseId = Crypto.randomUUID();
      // Keep the UI blocked after any uncertain reserve/payment response until a server read reconciles it.
      setUnconfirmed(true);
      try {
        await api("/mobile/billing", {
          action: "purchase",
          id: purchaseId,
          store,
          productId: id,
        });
        accountScope.assert(ticket);
        await buyPackage(item.package);
        accountScope.assert(ticket);
        setNotice("Confirming your subscription and design tokens…");
        await verify(ticket);
      } catch (e) {
        accountScope.assert(ticket);
        const failure = e as Error & { userCancelled?: boolean; code?: string };
        if (failure.userCancelled) {
          await api("/mobile/billing", { action: "cancel", id: purchaseId });
          accountScope.assert(ticket);
          await refresh(ticket);
          setNotice(
            "Purchase cancelled. You can try again whenever you’re ready.",
          );
          return;
        }
        if (failure.code === "20") {
          setNotice(
            "Your store payment is pending approval. Access and tokens will appear after payment and server verification. Don’t buy again while it’s pending.",
          );
          return;
        }
        await refresh(ticket).catch(() => undefined);
        throw e;
      }
    });
  return (
    <CreditsView
      subscription={query.data?.subscription}
      canSubscribe={query.data?.canSubscribe}
      onManage={() => void Linking.openURL((query.data?.subscription?.store || store) === "APP_STORE" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions")}
      onPolicy={(page) => void Linking.openURL(`${environment.apiUrl}/${page}`)}
      balance={query.error ? null : (query.data?.credits ?? null)}
      store={store}
      history={query.error ? null : query.data?.history}
      historyLoading={query.isFetching}
      packs={items}
      loading={query.isPending || (enabled && packages.isPending)}
      busy={busy}
      workingOn={workingOn}
      pending={
        unconfirmed ||
        !!query.data?.needsReview ||
        !!query.data?.pendingPurchases.length
      }
      unavailable={!!query.data && !enabled}
      error={error || query.error?.message || packages.error?.message}
      notice={notice}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/lab")
      }
      onBuy={(id) => void purchase(id)}
      onRetry={() =>
        void run("reload", async (ticket) => {
          await refresh(ticket);
          if (enabled) {
            const result = await packages.refetch();
            accountScope.assert(ticket);
            if (result.error) throw result.error;
          }
        })
      }
      onCheck={() => void run("check", (ticket) => verify(ticket))}
      onHistoryRetry={() =>
        void run("reload", async (ticket) => {
          await refresh(ticket);
        })
      }
      onRestore={() =>
        void run("restore", async (ticket) => {
          await restoreStorePurchases();
          accountScope.assert(ticket);
          await verify(ticket, true);
        })
      }
    />
  );
}
export default function BillingScreen() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Billing key={(session?.user.id || "") + ":" + epoch} />
    </RequireAuth>
  );
}
