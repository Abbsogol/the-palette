import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isAdmin: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ ...mock, serviceClient: { from: mock.from } }));
import { GET, PATCH } from "@/app/api/mobile/admin-reports/route";
beforeEach(() => vi.resetAllMocks());
it("signed-in non-administrators cannot read or resolve reports", async () => {
  mock.getSessionUser.mockResolvedValue({ id: "member" });
  mock.isAdmin.mockResolvedValue(false);
  for (const [method, handler] of [
    ["GET", GET],
    ["PATCH", PATCH],
  ])
    expect(
      (
        await handler(
          new Request("https://example.invalid/api/mobile/admin-reports", {
            method,
            ...(method === "PATCH" ? { body: "{}" } : {}),
          }),
        )
      ).status,
    ).toBe(403);
  expect(mock.from).not.toHaveBeenCalled();
});
it("administrator requests still validate report identity and status", async () => {
  mock.getSessionUser.mockResolvedValue({ id: "admin" });
  mock.isAdmin.mockResolvedValue(true);
  expect(
    (
      await PATCH(
        new Request("https://example.invalid/api/mobile/admin-reports", {
          method: "PATCH",
          body: JSON.stringify({ id: "invalid", status: "resolved" }),
        }),
      )
    ).status,
  ).toBe(400);
  expect(mock.from).not.toHaveBeenCalled();
});
