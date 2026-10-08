import { createClosedAccounts } from "../src/lib/closed-accounts";
function setup() {
  const values = new Map<string, string>();
  const storage = { getItem: jest.fn(async (key: string) => values.get(key) || null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }) };
  return { storage, registry: createClosedAccounts(storage) };
}
test("closing one account suppresses it immediately without affecting another account", async () => {
  const { registry } = setup(); const listener = jest.fn(); registry.subscribe(listener);
  const result = registry.add("old");
  expect(listener).toHaveBeenCalledWith("old");
  expect(await registry.has("old")).toBe(true);
  expect(await registry.has("new")).toBe(false);
  await result;
});
test("a persisted closure prevents a stale session from returning after restart", async () => {
  const { registry, storage } = setup(); await registry.add("old");
  expect(await createClosedAccounts(storage).has("old")).toBe(true);
});
test("storage failure does not reopen a confirmed closed account", async () => {
  const { registry, storage } = setup(); storage.setItem.mockRejectedValueOnce(new Error("Vault unavailable"));
  await expect(registry.add("old")).rejects.toThrow("Vault unavailable");
  expect(await registry.has("old")).toBe(true);
});
