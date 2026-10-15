import { secureStorage } from "./secure-storage";

// A tombstone only suppresses a permanently closed UUID. A new account, even
// using the same email address, has a different UUID and remains unaffected.
export function createClosedAccounts(storage: Pick<typeof secureStorage, "getItem" | "setItem">) {
  const closed = new Set<string>();
  const listeners = new Set<(id: string) => void>();
  return {
    async has(id: string) {
      if (closed.has(id)) return true;
      if (await storage.getItem(`laque.closed.${id}`) === "1") closed.add(id);
      return closed.has(id);
    },
    async add(id: string) {
      closed.add(id);
      for (const listener of listeners) listener(id);
      await storage.setItem(`laque.closed.${id}`, "1");
    },
    subscribe(listener: (id: string) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
export const closedAccounts = createClosedAccounts(secureStorage);
