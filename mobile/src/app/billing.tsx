import { useCallback, useRef, useState } from "react";
import * as WebBrowser from "expo-web-browser";
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
import { labBillingRoute } from "../lib/lab-billing-route";
import { presentNativeLabPayment, type NativeLabPayment } from "../lib/native-lab-payment";
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
  // No release enrollments/adapters are connected yet. Fail closed to store
  // billing; profile country and client flags cannot activate regional Stripe.
  const route = labBillingRoute(Platform.OS, __DEV__ && ["beta", "development"].includes(environment.appEnv || ""), { sandboxPilot: !!query.data?.stripeLab?.enabled, enabledPrograms: [] }, null);
  const sandbox = route === 'stripe_sandbox' || (__DEV__ && native && !!query.data?.stripeLab && query.data.subscription?.store === 'STRIPE_LAB');
  const stripeOwned = query.data?.subscription?.store === "STRIPE_LAB";
  const verifyStripe = sandbox || stripeOwned || !!query.data?.stripeLab?.pending.length;
  const storeEnabled = !sandbox && !!query.data?.configured && native;
  const enabled = sandbox ? !!query.data?.stripeLab?.enabled : storeEnabled;
  const packages = useAccountQuery(
    ["store-packages"],
    () => storePackages(),
    storeEnabled,
  );
  const store = Platform.OS === "ios" ? "APP_STORE" : "PLAY_STORE";
  const storeItems = creditPackages(
    query.data?.catalog || [],
    packages.data || [],
    store,
  );
  const items = sandbox ? query.data?.stripeLab?.packages || [] : storeItems;
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
      !!result.data.pendingPurchases.length || !!result.data.stripeLab?.pending.length || result.data.needsReview,
    );
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    accountScope.assert(ticket);
    return result.data;
  };
  const verify = async (ticket: AccountTicket, restoring = false) => {
    await api(verifyStripe ? "/mobile/billing/stripe" : "/mobile/billing", verifyStripe ? { action: "check" } : {});
    accountScope.assert(ticket);
    const status = await refresh(ticket);
    setNotice(
      status.needsReview || status.pendingPurchases.length || status.stripeLab?.pending.length
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
      if (sandbox) {
        const status = await api<CreditBillingState>("/mobile/billing");
        accountScope.assert(ticket);
        if (!status.stripeLab?.enabled || status.needsReview) throw new Error("Sandbox purchasing is unavailable. Check purchases first.");
        const pending = status.stripeLab.pending;
        if (pending.some(item => item.package !== id)) throw new Error("A previous checkout needs verification first.");
        setUnconfirmed(true);
        const purchaseId = pending[0]?.id || Crypto.randomUUID();
        if (status.stripeLab.native && (!pending[0] || pending[0].surface === 'native')) {
          if (!native) throw new Error('Open the connected iPhone or Android app for in-app sandbox payments.');
          const payment = await api<NativeLabPayment>('/mobile/billing/stripe/native', { action: 'payment', id: purchaseId, package: id });
          accountScope.assert(ticket);
          const outcome = await presentNativeLabPayment(payment, ticket);
          accountScope.assert(ticket);
          await verify(ticket);
          if (outcome.cancelled) setNotice('Payment sheet closed. You can resume the same payment or check its status. No new payment is created on retry.');
          return;
        }
        const response = await api<{ url: string | null; pending: boolean }>("/mobile/billing/stripe", { action: "checkout", id: purchaseId, package: id });
        accountScope.assert(ticket);
        if (response.url) {
          const url = new URL(response.url);
          if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Unexpected checkout address.");
          await WebBrowser.openBrowserAsync(response.url);
          accountScope.assert(ticket);
        }
        await verify(ticket);
        return;
      }
      const item = storeItems.find((item) => item.id === id);
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
      onResumeCheckout={sandbox && query.data?.stripeLab?.pending[0] ? () => void purchase(query.data!.stripeLab!.pending[0].package) : undefined}
      purchaseAvailable={sandbox ? query.data?.stripeLab?.enabled : undefined}
      sandbox={sandbox}
      cancelViaStripe={stripeOwned}
      cancelScheduled={query.data?.stripeLab?.subscription?.cancel_at_period_end}
      subscription={query.data?.subscription}
      canSubscribe={query.data?.canSubscribe}
      onManage={() => (sandbox || stripeOwned) ? void run("check", async ticket => {
        await api("/mobile/billing/stripe", { action: "cancelSubscription" });
        accountScope.assert(ticket); await refresh(ticket);
        setNotice("Renewal cancelled. Your verified allowance remains available until the paid period ends.");
      }) : void Linking.openURL((query.data?.subscription?.store || store) === "APP_STORE" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions")}
      onPolicy={(page) => void Linking.openURL(`${environment.apiUrl}/${page}`)}
      balance={query.error ? null : (query.data?.credits ?? null)}
      store={sandbox ? "STRIPE_LAB" : store}
      history={query.error ? null : query.data?.history}
      historyLoading={query.isFetching}
      packs={items}
      loading={query.isPending || (storeEnabled && packages.isPending)}
      busy={busy}
      workingOn={workingOn}
      pending={
        unconfirmed ||
        !!query.data?.needsReview ||
        !!query.data?.pendingPurchases.length || !!query.data?.stripeLab?.pending.length
      }
      unavailable={!!query.data && !enabled && !sandbox}
      error={error || query.error?.message || packages.error?.message}
      notice={notice}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/lab")
      }
      onBuy={(id) => void purchase(id)}
      onRetry={() =>
        void run("reload", async (ticket) => {
          await refresh(ticket);
          if (storeEnabled) {
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
      onRestore={sandbox ? undefined : () =>
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
