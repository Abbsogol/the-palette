import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  userFrom: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getSessionUser: mock.getSessionUser,
  serviceClient: { from: mock.from },
}));
vi.mock("@/lib/mobile-auth", async (importOriginal) => ({
  ...(await importOriginal()),
  mobileUserClient: () => ({ from: mock.userFrom }),
}));
import { GET } from "@/app/api/mobile/deposit-status/route";
const id = "00000000-0000-4000-8000-000000000711";
const request = () =>
  new Request(
    `https://example.invalid/api/mobile/deposit-status?booking=${id}`,
  );
function query(data) {
  const value = {
    then(resolve) {
      resolve({ data, error: null });
    },
  };
  for (const method of ["select", "eq", "order", "in", "maybeSingle"])
    value[method] = () => value;
  return value;
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.getSessionUser.mockResolvedValue({ id: "creator" });
  mock.userFrom.mockReturnValue(
    query({
      id,
      client_id: "client",
      creator_id: "creator",
      deposit_paid: true,
    }),
  );
});
it("the creator sees an outstanding full refund without receiving provider payment identifiers", async () => {
  mock.from.mockReturnValue(
    query([
      {
        payment_intent: "pi_private",
        refund_required: true,
        refund_status: "pending",
        refunded: false,
      },
    ]),
  );
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "refund_pending" });
});
it("a stranger cannot inspect deposit status even if a broken adapter returns a booking", async () => {
  mock.getSessionUser.mockResolvedValue({ id: "stranger" });
  expect((await GET(request())).status).toBe(404);
  expect(mock.from).not.toHaveBeenCalled();
});
it("an externally initiated partial refund cannot be presented as a fully paid deposit", async () => {
  mock.from.mockImplementation((table) =>
    query(
      table === "order_payments"
        ? [{ payment_intent: "pi_private", fulfilled: true }]
        : [{ status: "partially_refunded" }],
    ),
  );
  expect(await (await GET(request())).json()).toEqual({
    status: "partial_refund",
  });
});
