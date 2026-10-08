import { act, renderHook } from "@testing-library/react-native";
import { useBookingRequest } from "../src/features/booking/use-request";
import { accountScope } from "../src/lib/account-scope";
import { api, ApiError } from "../src/lib/api";
import { readPending, writePending } from "../src/lib/pending";
import type {
  BookingContext,
  BookingDraft,
} from "../src/features/booking/model";
jest.mock("../src/lib/api", () => ({
  api: jest.fn(),
  ApiError: class extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));
jest.mock("../src/lib/pending", () => ({
  readPending: jest.fn(),
  writePending: jest.fn(),
}));
const read = jest.mocked(readPending),
  write = jest.mocked(writePending),
  send = jest.mocked(api);
const context: BookingContext = {
  creator: { id: "artist", name: "Kim" },
  services: [],
  timeZone: "Asia/Dubai",
  location: "Studio",
};
const draft: BookingDraft = {
  service: {
    id: "gel",
    creator_id: "artist",
    name: "Gel",
    description: null,
    duration_minutes: 60,
    price: 100,
    deposit_amount: 25,
    is_active: true,
  },
  date: "2026-10-01",
  slot: {
    start_time: "10:00",
    end_time: "11:00",
    starts_at: "2026-10-01T06:00:00Z",
    ends_at: "2026-10-01T07:00:00Z",
    available: true,
  },
  notes: "Chrome",
};
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { resolve, promise };
}
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("client", true);
  read.mockResolvedValue(null);
  write.mockResolvedValue(undefined);
  send.mockResolvedValue({ booking: { id: "book" } });
});
test("rapid taps submit once and lost-response retries reuse the exact durable request", async () => {
  const wait = deferred<unknown>();
  send.mockReturnValueOnce(wait.promise);
  const done = jest.fn();
  const { result } = await renderHook(() => useBookingRequest(context, done));
  let first!: Promise<void>;
  await act(async () => {
    first = result.current.submit(draft);
    void result.current.submit(draft);
  });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => {
    wait.resolve({ booking: { id: "book" } });
    await first;
  });
  expect(done).toHaveBeenCalledTimes(1);
  send.mockRejectedValueOnce(new Error("Response lost"));
  await act(async () => {
    await result.current.submit(draft);
  });
  const original = send.mock.calls.at(-1)![1];
  expect(result.current.pending).toBe(true);
  await act(async () => {
    await result.current.recover();
  });
  expect(send.mock.calls.at(-1)![1]).toEqual(original);
  expect(result.current.pending).toBe(false);
});
test("failed storage recovery blocks new requests and can be retried", async () => {
  read.mockRejectedValueOnce(new Error("Storage unavailable"));
  const { result } = await renderHook(() =>
    useBookingRequest(context, jest.fn()),
  );
  expect(result.current.pending).toBe(true);
  await act(async () => {
    await result.current.submit(draft);
  });
  expect(send).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.recover();
  });
  expect(result.current.pending).toBe(false);
  await act(async () => {
    await result.current.submit(draft);
  });
  expect(send).toHaveBeenCalledTimes(1);
});
test("account change while persisting prevents any request under the replacement session", async () => {
  const wait = deferred<void>();
  write.mockReturnValueOnce(wait.promise);
  const done = jest.fn();
  const { result } = await renderHook(() => useBookingRequest(context, done));
  let submit!: Promise<void>;
  await act(async () => {
    submit = result.current.submit(draft);
  });
  accountScope.change("other");
  await act(async () => {
    wait.resolve();
    await submit;
  });
  expect(send).not.toHaveBeenCalled();
  expect(done).not.toHaveBeenCalled();
});
test("permanent availability conflict permits a new selection, storage failure retains recovery", async () => {
  send.mockRejectedValueOnce(new ApiError("Slot taken", 409));
  const { result } = await renderHook(() =>
    useBookingRequest(context, jest.fn()),
  );
  await act(async () => {
    await result.current.submit(draft);
  });
  expect(result.current.pending).toBe(false);
  expect(result.current.error).toBe("Slot taken");
  write.mockRejectedValueOnce(new Error("Disk full"));
  await act(async () => {
    await result.current.submit(draft);
  });
  expect(result.current.pending).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
});
test("account switch during conflict cleanup cannot finish or show private errors on the new account", async () => {
  const wait = deferred<void>();
  write.mockResolvedValueOnce(undefined).mockReturnValueOnce(wait.promise);
  send.mockRejectedValueOnce(new ApiError("Conflict", 409));
  const done = jest.fn();
  const { result } = await renderHook(() => useBookingRequest(context, done));
  let submit!: Promise<void>;
  await act(async () => {
    submit = result.current.submit(draft);
  });
  accountScope.change("other");
  await act(async () => {
    wait.resolve();
    await submit;
  });
  expect(done).not.toHaveBeenCalled();
  expect(result.current.error).toBe("");
});

test("a last-moment calendar conflict resets request recovery and exposes the exact slot for acknowledgement", async () => {
  send.mockRejectedValueOnce(
    new ApiError("Schedule overlap", 409, "CLIENT_CALENDAR_CONFLICT"),
  );
  const done = jest.fn();
  const { result } = await renderHook(() => useBookingRequest(context, done));
  await act(async () => {
    await result.current.submit(draft);
  });
  expect(result.current.calendarConflict).toBe("2026-10-01:10:00");
  expect(result.current.pending).toBe(false);
  expect(done).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.submit({ ...draft, allowCalendarConflict: true });
  });
  expect(send.mock.calls.at(-1)![1]).toMatchObject({
    allowCalendarConflict: true,
  });
  expect(done).toHaveBeenCalledTimes(1);
});
