import { useState } from "react";
import * as Crypto from "expo-crypto";
import { Linking, Platform, Text } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import {
  Button,
  Card,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
} from "../components/ui";
import { api } from "../lib/api";
import { useAccountQuery, queryClient } from "../lib/auth";
import {
  buyPackage,
  restoreStorePurchases,
  storePackages,
} from "../lib/purchases";
type Catalog = {
  store: string;
  product_id: string;
  kind: "credits" | "subscription";
  plan_id: string | null;
  credits: number;
};
type BillingState = {
  credits: number;
  tier: string | null;
  catalog: Catalog[];
  sources: { store: string; plan_id: string; expires_at?: string }[];
  canSubscribe: boolean;
  needsReview: boolean;
  verifiedAt: string | null;
  configured: boolean;
  pendingPurchases: { id: string }[];
};
function Billing() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const query = useAccountQuery(["billing"], () =>
    api<BillingState>("/mobile/billing"),
  );
  const packages = useAccountQuery(
    ["store-packages"],
    () => storePackages(),
    !!query.data?.configured,
  );
  const platform = Platform.OS === "ios" ? "APP_STORE" : "PLAY_STORE";
  const items =
    packages.data
      ?.map((p) => ({
        package: p,
        product: query.data?.catalog.find(
          (c) => c.store === platform && c.product_id === p.product.identifier,
        ),
      }))
      .filter((item) => item.product) || [];
  const verify = async () => {
    await api("/mobile/billing", {});
    await queryClient.invalidateQueries();
    setNotice(
      "Store status verified. Your balance above comes from the server. Purchases awaiting a store event will appear after verification finishes.",
    );
  };
  const purchase = async (item: PurchasesPackage, product: Catalog) => {
    const purchaseId = Crypto.randomUUID();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const status = await api<BillingState>("/mobile/billing");
      if (status.needsReview || status.pendingPurchases.length)
        throw new Error("A previous purchase needs verification first.");
      if (product.kind === "subscription" && !status.canSubscribe)
        throw new Error(
          "You already have an active or pending subscription. Manage it with its original provider.",
        );
      await api("/mobile/billing", {
        action: "purchase",
        id: purchaseId,
        store: platform,
        productId: product.product_id,
      });
      await buyPackage(item);
      setNotice(
        "Purchase received. Waiting for server verification. Do not purchase again.",
      );
      await verify();
    } catch (e) {
      const failure = e as Error & { userCancelled?: boolean; code?: string };
      if (failure.userCancelled) {
        await api("/mobile/billing", {
          action: "cancel",
          id: purchaseId,
        }).catch(() => undefined);
        setNotice("Purchase cancelled.");
      } else
        setError(
          failure.message ||
            "Purchase is pending or could not be verified. Use Check purchases before buying again.",
        );
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    setBusy(true);
    setError("");
    try {
      await restoreStorePurchases();
      await verify();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const manage = async (store: string) => {
    try {
      if (store === "STRIPE") {
        const { url } = await api<{ url: string }>(
          "/create-billing-portal-session",
          {},
        );
        if (new URL(url).hostname !== "billing.stripe.com")
          throw new Error("Invalid billing management address.");
        await Linking.openURL(url);
      } else
        await Linking.openURL(
          store === "APP_STORE"
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions",
        );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data && (
          <>
            <Card>
              <Text style={styles.title}>{query.data.credits} credits</Text>
              <Text style={styles.text}>
                {query.data.tier?.replace("_", " ") || "Free account"}
              </Text>
              {(query.data.needsReview ||
                !!query.data.pendingPurchases.length) && (
                <Notice>
                  Store verification is pending. Please check purchases before
                  trying again.
                </Notice>
              )}
            </Card>
            {query.data.sources.map((source) => (
              <Card key={`${source.store}:${source.plan_id}`}>
                <Text style={styles.subtitle}>
                  {source.plan_id?.replace("_", " ") || "Subscription"}
                </Text>
                <Notice>
                  Managed through{" "}
                  {source.store === "STRIPE"
                    ? "the web"
                    : source.store === "APP_STORE"
                      ? "Apple"
                      : "Google Play"}
                  .
                </Notice>
                {source.expires_at && (
                  <Notice>
                    Current access through{" "}
                    {new Date(source.expires_at).toLocaleDateString()}
                  </Notice>
                )}
                <Button
                  title="Manage original subscription"
                  secondary
                  onPress={() => void manage(source.store)}
                />
              </Card>
            ))}
            {!query.data.configured ? (
              <Notice>
                Native purchases are not enabled for this beta build yet. Your
                existing verified benefits remain available.
              </Notice>
            ) : (
              <QueryState
                loading={packages.isPending}
                error={packages.error}
                empty={!items.length}
                retry={() => void packages.refetch()}
              >
                {items
                  .filter(
                    (i) =>
                      i.product!.kind !== "subscription" ||
                      query.data!.canSubscribe,
                  )
                  .map((item) => (
                    <Card key={item.package.identifier}>
                      <Text style={styles.subtitle}>
                        {item.product!.kind === "credits"
                          ? `${item.product!.credits} credits`
                          : item.product!.plan_id?.replace("_", " ")}
                      </Text>
                      <Notice>
                        {item.product!.kind === "subscription"
                          ? `${item.product!.credits} credits per paid monthly period. Subscription benefits follow your verified account.`
                          : "Credits for LaQue Lab. Restoring a purchase never grants consumed credits again."}
                      </Notice>
                      <Button
                        title={`${item.package.product.priceString} · ${item.product!.kind === "subscription" ? "Subscribe" : "Buy credits"}`}
                        disabled={
                          busy ||
                          query.data!.needsReview ||
                          !!query.data!.pendingPurchases.length
                        }
                        onPress={() =>
                          void purchase(item.package, item.product!)
                        }
                      />
                    </Card>
                  ))}
              </QueryState>
            )}
          </>
        )}
      </QueryState>
      <Button
        title="Restore purchases"
        busy={busy}
        disabled={!query.data?.configured}
        onPress={() => void restore()}
      />
      <Button
        title="Check purchases"
        secondary
        disabled={busy || !query.data?.configured}
        onPress={() => {
          setBusy(true);
          setError("");
          void verify()
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      />
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function BillingScreen() {
  return (
    <Screen title="Credits & subscriptions" back>
      <RequireAuth>
        <Billing />
      </RequireAuth>
    </Screen>
  );
}
