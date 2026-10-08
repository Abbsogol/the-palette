import type { PurchasesPackage } from "react-native-purchases";

export type CreditCatalogItem = {
  store: string;
  product_id: string;
  kind: string;
  credits: number;
};
export type CreditBillingState = {
  credits: number;
  purchasedTokens?: number;
  canSubscribe?: boolean;
  subscription?: { active: boolean; monthlyRemaining: number; purchasedTokens: number; renewsAt: string | null; store: string | null };
  catalog: CreditCatalogItem[];
  needsReview: boolean;
  configured: boolean;
  pendingPurchases: { id: string }[];
  // Optional while older beta backends are being upgraded. Missing is not empty.
  history?: CreditHistory | null;
};
export type CreditReceipt = {
  store: string;
  environment: string;
  productId: string;
  credits: number;
  purchasedAt: string | null;
  status: "credited" | "refunded" | "verifying";
};
export type CreditHistory = { items: CreditReceipt[]; hasMore: boolean };
export type CreditOperation = "purchase" | "check" | "restore" | "reload";
export function creditStoreName(store?: string) {
  return store === "APP_STORE"
    ? "Apple App Store"
    : store === "PLAY_STORE"
      ? "Google Play"
      : "Your app store";
}
export type CreditPack = { id: string; credits: number; price: string | null; kind?: string };

// Match only the configured monthly subscription and consumable design tokens.
export function creditPackages(catalog: CreditCatalogItem[], packages: PurchasesPackage[], store: string) {
 return packages.flatMap(item => {
  const product=catalog.find(p=>p.store===store && p.product_id===item.product.identifier);
  if(!product)return [];
  const monthly=product.kind==="subscription" && product.product_id===(store==="PLAY_STORE"?"laque_lab_monthly_5:monthly":"laque_lab_monthly_5") && product.credits===15 && item.product.subscriptionPeriod==="P1M" && item.product.productCategory==="SUBSCRIPTION" && item.product.productType==="AUTO_RENEWABLE_SUBSCRIPTION";
  const tokens=product.kind==="credits" && [30,100].includes(product.credits) && ["laque_lab_tokens_30","laque_lab_tokens_100"].includes(product.product_id) && !item.product.subscriptionPeriod && item.product.productCategory==="NON_SUBSCRIPTION" && item.product.productType==="CONSUMABLE";
  return monthly||tokens ? [{package:item,product,id:product.product_id,kind:product.kind,credits:product.credits,price:item.product.priceString}] : [];
 }).sort((a,b)=>a.credits-b.credits);
}
