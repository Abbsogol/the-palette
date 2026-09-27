import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type PurchasesPackage,
} from "react-native-purchases";
import { accountScope } from "./account-scope";
let queue: Promise<unknown> = Promise.resolve();
function run<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}
async function bindAccount(id: string) {
  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY;
  if (!apiKey)
    throw new Error("Store billing is not configured for this build.");
  if (!(await Purchases.isConfigured())) {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey, appUserID: id });
  } else if ((await Purchases.getAppUserID()) !== id) await Purchases.logIn(id);
  if ((await Purchases.getAppUserID()) !== id)
    throw new Error("Store account could not be verified.");
}
export function storePackages() {
  const ticket = accountScope.capture();
  return run(async () => {
    accountScope.assert(ticket);
    if (!ticket.id) throw new Error("Sign in before loading purchases.");
    await bindAccount(ticket.id);
    accountScope.assert(ticket);
    const offers = await Purchases.getOfferings();
    accountScope.assert(ticket);
    return offers.current?.availablePackages || [];
  });
}
export function buyPackage(item: PurchasesPackage) {
  const ticket = accountScope.capture();
  return run(async () => {
    accountScope.assert(ticket);
    if (!ticket.id) throw new Error("Sign in to purchase.");
    await bindAccount(ticket.id);
    accountScope.assert(ticket);
    const result = await Purchases.purchasePackage(item);
    accountScope.assert(ticket);
    return result;
  });
}
export function restoreStorePurchases() {
  const ticket = accountScope.capture();
  return run(async () => {
    accountScope.assert(ticket);
    if (!ticket.id) throw new Error("Sign in to restore.");
    await bindAccount(ticket.id);
    accountScope.assert(ticket);
    await Purchases.restorePurchases();
    accountScope.assert(ticket);
  });
}
export function clearStoreIdentity() {
  return run(async () => {
    if ((await Purchases.isConfigured()) && !(await Purchases.isAnonymous()))
      await Purchases.logOut();
  });
}
