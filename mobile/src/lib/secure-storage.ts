import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

type Vault = Pick<
  typeof SecureStore,
  "getItemAsync" | "setItemAsync" | "deleteItemAsync"
>;
// A manifest swap commits a whole session. Small chunks accommodate older
// Keychain limits; no token or private cache is ever persisted in plaintext.
export function createSecureStorage(vault: Vault, uuid: () => string) {
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };
  const manifest = async (
    key: string,
  ): Promise<{ id: string; count: number } | null> => {
    const raw = await vault.getItemAsync(`${key}.manifest`);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !/^[a-zA-Z0-9-]+$/.test(value.id) ||
      !Number.isInteger(value.count) ||
      value.count < 1 ||
      value.count > 200
    )
      throw new Error("Invalid secure session");
    return value;
  };
  const removeChunks = async (
    key: string,
    old: { id: string; count: number } | null,
  ) => {
    if (old)
      await Promise.all(
        Array.from({ length: old.count }, (_, i) =>
          vault.deleteItemAsync(`${key}.${old.id}.${i}`),
        ),
      );
  };
  return {
    getItem: (key: string) =>
      serialize(async () => {
        const m = await manifest(key);
        if (!m) return null;
        const chunks = await Promise.all(
          Array.from({ length: m.count }, (_, i) =>
            vault.getItemAsync(`${key}.${m.id}.${i}`),
          ),
        );
        if (chunks.some((chunk) => chunk === null))
          throw new Error("Secure session is incomplete. Sign in again.");
        return chunks.join("");
      }),
    setItem: (key: string, value: string) =>
      serialize(async () => {
        if (value.length > 51200)
          throw new Error("Secure session exceeds storage limit");
        const old = await manifest(key),
          id = uuid();
        const chunks = value.match(/[\s\S]{1,256}/g) || [""];
        try {
          for (let i = 0; i < chunks.length; i++)
            await vault.setItemAsync(`${key}.${id}.${i}`, chunks[i]);
          await vault.setItemAsync(
            `${key}.manifest`,
            JSON.stringify({ id, count: chunks.length }),
          );
        } catch (error) {
          await removeChunks(key, { id, count: chunks.length }).catch(
            () => undefined,
          );
          throw error;
        }
        await removeChunks(key, old);
      }),
    removeItem: (key: string) =>
      serialize(async () => {
        const old = await manifest(key);
        await vault.deleteItemAsync(`${key}.manifest`);
        await removeChunks(key, old);
      }),
  };
}
// SecureStore has no browser implementation. Browser sessions and pending work
// live only in this page's memory; native sessions retain encrypted storage.
export function createPlatformSecureStorage(
  platform: string,
  nativeVault: Vault,
  uuid: () => string,
) {
  const memory = new Map<string, string>();
  const vault: Vault = platform === "web" ? {
    getItemAsync: async (key) => memory.get(key) ?? null,
    setItemAsync: async (key, value) => { memory.set(key, value); },
    deleteItemAsync: async (key) => { memory.delete(key); },
  } : nativeVault;
  return createSecureStorage(vault, uuid);
}
export const secureStorage = createPlatformSecureStorage(
  Platform.OS, SecureStore, Crypto.randomUUID,
);
