import {
  loadProgress,
  saveProgress,
  clearProgress,
  parseProgress,
} from "../src/features/onboarding/progress";
import { clearPending } from "../src/lib/pending";
import { accountScope } from "../src/lib/account-scope";
const mockValues = new Map<string, string>();
jest.mock("../src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(async (key: string) => mockValues.get(key) || null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockValues.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockValues.delete(key);
    }),
  },
}));
const draft = {
  display_name: "Sarah",
  username: "sarah.nails",
  location: "Dubai",
  bio: "Chrome lover",
  booking_area: "",
  role: "Customer" as const,
};
beforeEach(() => {
  mockValues.clear();
  accountScope.change("account-a", true);
});
test("interrupted setup restores fields and step without restoring eligibility consent", async () => {
  const ticket = accountScope.capture();
  await saveProgress(
    {
      step: 1,
      draft: { ...draft, age_confirmed: true, privacy_accepted: true },
    },
    ticket,
  );
  expect(await loadProgress()).toEqual({ step: 1, draft });
});
test("drafts are isolated by account and a late write cannot cross account changes", async () => {
  const ticket = accountScope.capture();
  await saveProgress({ step: 1, draft }, ticket);
  accountScope.change("account-b");
  expect(await loadProgress()).toBeNull();
  await expect(saveProgress({ step: 1, draft }, ticket)).rejects.toThrow(
    "Your account changed",
  );
  accountScope.change("account-a");
  expect((await loadProgress())?.draft.username).toBe("sarah.nails");
});
test("finishing or signing out clears saved setup", async () => {
  await saveProgress({ step: 1, draft }, accountScope.capture());
  await clearProgress();
  expect(await loadProgress()).toBeNull();
  await saveProgress({ step: 0, draft }, accountScope.capture());
  await clearPending("account-a");
  expect(await loadProgress()).toBeNull();
});
test("invalid or oversized saved drafts are rejected before rendering", () => {
  expect(parseProgress({ step: 9, draft })).toBeNull();
  expect(
    parseProgress({ step: 1, draft: { ...draft, bio: "x".repeat(1001) } }),
  ).toBeNull();
});
test("interests survive interrupted onboarding and invalid tag drafts are rejected", async () => {
  await saveProgress(
    { step: 1, draft: { ...draft, specialties: ["Chrome", "Minimal"] } },
    accountScope.capture(),
  );
  expect((await loadProgress())?.draft.specialties).toEqual([
    "Chrome",
    "Minimal",
  ]);
  expect(
    parseProgress({
      step: 1,
      draft: { ...draft, specialties: Array(21).fill("Chrome") },
    }),
  ).toBeNull();
});
