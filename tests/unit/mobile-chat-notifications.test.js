import { describe, expect, it, vi } from "vitest";
import {
  canDeliverMobileMessage,
  processMobileJobs,
} from "../../lib/mobile-jobs";
vi.mock("@/lib/mobile-billing", () => ({ reconcileMobileBilling: vi.fn() }));
vi.mock("@/lib/deposit-refund", () => ({
  reconcileLateDepositRefund: vi.fn(),
}));
function database({
  muted = [],
  blocked = false,
  error = null,
  missing = false,
  job = null,
} = {}) {
  const from = vi.fn((table) => {
    const result = {
      data:
        table === "conversations"
          ? missing
            ? null
            : { client_id: "client", creator_id: "artist", muted_by: muted }
          : table === "blocks"
            ? blocked
              ? [{ id: "block" }]
              : []
            : [],
      error: table === "conversations" ? error : null,
    };
    const chain = {
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    for (const name of [
      "select",
      "eq",
      "or",
      "limit",
      "order",
      "lte",
      "update",
      "maybeSingle",
    ])
      chain[name] = vi.fn(() => chain);
    return chain;
  });
  return {
    from,
    rpc: vi.fn(async (name) => ({
      data:
        name === "claim_mobile_notifications"
          ? job
            ? [job]
            : []
          : name === "finish_mobile_notification"
            ? true
            : [],
      error: null,
    })),
  };
}
const message = {
  kind: "message",
  target_id: "chat",
  user_id: "client",
  id: "job",
  status: "pending",
  claim_token: "claim",
  token: "push-token",
};
describe("chat mute notification delivery", () => {
  it("respects the recipient mute without suppressing the other participant", async () => {
    expect(
      await canDeliverMobileMessage(database({ muted: ["client"] }), message),
    ).toBe(false);
    expect(
      await canDeliverMobileMessage(database({ muted: ["artist"] }), message),
    ).toBe(true);
  });
  it("excludes blocked, missing and non-participant recipients", async () => {
    expect(
      await canDeliverMobileMessage(database({ blocked: true }), message),
    ).toBe(false);
    expect(
      await canDeliverMobileMessage(database({ missing: true }), message),
    ).toBe(false);
    expect(
      await canDeliverMobileMessage(database(), {
        ...message,
        user_id: "stranger",
      }),
    ).toBe(false);
  });
  it("leaves appointment notifications independent of conversation mute", async () => {
    const db = database({ muted: ["client"] });
    expect(
      await canDeliverMobileMessage(db, { ...message, kind: "booking" }),
    ).toBe(true);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("skips an already-queued muted message without calling Expo", async () => {
    const db = database({ muted: ["client"], job: message }),
      send = vi.fn();
    const result = await processMobileJobs(db, {}, send);
    expect(send).not.toHaveBeenCalled();
    expect(result.failed).toBe(0);
    expect(db.rpc).toHaveBeenCalledWith(
      "finish_mobile_notification",
      expect.objectContaining({ p_id: "job", p_status: "skipped" }),
    );
  });
  it("preference lookup failure stays retryable and cannot send", async () => {
    const db = database({
        error: new Error("Database unavailable"),
        job: message,
      }),
      send = vi.fn();
    const result = await processMobileJobs(db, {}, send);
    expect(send).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(db.rpc).toHaveBeenCalledWith(
      "finish_mobile_notification",
      expect.objectContaining({
        p_status: "pending",
        p_error: "Database unavailable",
      }),
    );
  });
  it("delivers unmuted message to Expo and records its ticket", async () => {
    const db = database({ job: message }),
      send = vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { status: "ok", id: "expo-ticket" } }),
      }));
    await processMobileJobs(db, {}, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith(
      "finish_mobile_notification",
      expect.objectContaining({ p_status: "receipt", p_ticket: "expo-ticket" }),
    );
  });
  it("still polls an existing receipt after muting; no second push is sent", async () => {
    const db = database({
      muted: ["client"],
      job: { ...message, status: "receipt", ticket_id: "ticket" },
    });
    const send = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { ticket: { status: "ok" } } }),
    }));
    await processMobileJobs(db, {}, send);
    expect(send).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/getReceipts",
      expect.anything(),
    );
    expect(db.rpc).toHaveBeenCalledWith(
      "finish_mobile_notification",
      expect.objectContaining({ p_status: "delivered" }),
    );
  });
});
