import { act, renderHook } from "@testing-library/react-native";
import { useChatComposer } from "../src/features/chat/use-composer";
import { accountScope } from "../src/lib/account-scope";
import { api } from "../src/lib/api";
import { readPending, writePending } from "../src/lib/pending";
import { chooseAndUpload } from "../src/lib/upload";
jest.mock("../src/lib/api", () => ({ api: jest.fn() }));
jest.mock("../src/lib/pending", () => ({
  readPending: jest.fn(),
  writePending: jest.fn(),
}));
jest.mock("../src/lib/upload", () => ({ chooseAndUpload: jest.fn() }));
const read = jest.mocked(readPending),
  write = jest.mocked(writePending),
  send = jest.mocked(api);
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("account-a", true);
  read.mockResolvedValue(null);
  write.mockResolvedValue(undefined);
  send.mockResolvedValue({});
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
test("rapid taps use one send and retries replay the durable ID after a lost response", async () => {
  const wait = deferred<unknown>();
  send.mockReturnValueOnce(wait.promise);
  const done = jest.fn();
  const { result } = await renderHook(() => useChatComposer("chat", done));
  await act(async () => result.current.setDraft("Hello"));
  let first!: Promise<void>;
  await act(async () => {
    first = result.current.send();
    void result.current.send();
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledTimes(1);
  expect(result.current.pending?.content).toBe("Hello");
  await act(async () => {
    wait.resolve({});
    await first;
  });
  expect(done).toHaveBeenCalledTimes(1);
  expect(result.current.draft).toBe("");
  await act(async () => result.current.setDraft("Again"));
  send.mockRejectedValueOnce(new Error("Response lost"));
  await act(async () => {
    await result.current.send();
  });
  const original = send.mock.calls.at(-1)![1];
  expect(result.current.error).toBe("Response lost");
  await act(async () => {
    await result.current.send();
  });
  expect(send.mock.calls.at(-1)![1]).toEqual(original);
  expect(result.current.pending).toBeNull();
});
test("failed or unfinished recovery prevents a fresh send; retry restores the saved message", async () => {
  read.mockRejectedValueOnce(new Error("Secure storage unavailable"));
  const { result } = await renderHook(() => useChatComposer("chat", jest.fn()));
  expect(result.current.ready).toBe(false);
  await act(async () => {
    result.current.setDraft("New");
    await result.current.send();
  });
  expect(send).not.toHaveBeenCalled();
  read.mockResolvedValueOnce({
    id: "original",
    conversationId: "chat",
    content: "Stored",
  });
  await act(async () => {
    await result.current.restore();
  });
  expect(result.current.draft).toBe("Stored");
  await act(async () => {
    await result.current.send();
  });
  expect(send).toHaveBeenCalledWith(
    "/mobile/message",
    expect.objectContaining({ id: "original", content: "Stored" }),
  );
});
test("persistence failure cannot send to the server", async () => {
  write.mockRejectedValueOnce(new Error("Disk full"));
  const { result } = await renderHook(() => useChatComposer("chat", jest.fn()));
  await act(async () => result.current.setDraft("Hello"));
  await act(async () => {
    await result.current.send();
  });
  expect(send).not.toHaveBeenCalled();
  expect(result.current.pending).not.toBeNull();
});
test("account switch during persistence cannot submit with the replacement session", async () => {
  const wait = deferred<void>();
  write.mockReturnValueOnce(wait.promise);
  const { result } = await renderHook(() => useChatComposer("chat", jest.fn()));
  await act(async () => result.current.setDraft("Secret"));
  let sending!: Promise<void>;
  await act(async () => {
    sending = result.current.send();
  });
  accountScope.change("account-b");
  await act(async () => {
    wait.resolve();
    await sending;
    await result.current.send();
  });
  expect(send).not.toHaveBeenCalled();
});
test("late upload and send completions cannot alter a replacement account", async () => {
  const wait = deferred<{
    path: string;
    previewUrl: string;
    privateUrl: string;
  }>();
  jest.mocked(chooseAndUpload).mockReturnValueOnce(wait.promise);
  const done = jest.fn();
  const { result } = await renderHook(() => useChatComposer("chat", done));
  let uploading!: Promise<void>;
  await act(async () => {
    uploading = result.current.photo();
  });
  accountScope.change("account-b");
  await act(async () => {
    wait.resolve({
      path: "private-a",
      previewUrl: "private-url",
      privateUrl: "private-url",
    });
    await uploading;
  });
  expect(result.current.attachment).toBeNull();
  expect(done).not.toHaveBeenCalled();
});

test("a proposed time pre-fills a draft while durable unsent recovery takes precedence", async () => {
  const first = await renderHook(() =>
    useChatComposer("chat", jest.fn(), "Proposed time"),
  );
  expect(first.result.current.draft).toBe("Proposed time");
  await first.unmount();
  read.mockResolvedValueOnce({
    id: "stored",
    conversationId: "chat",
    content: "Unsent message",
  });
  const recovered = await renderHook(() =>
    useChatComposer("chat", jest.fn(), "Proposed time"),
  );
  expect(recovered.result.current.draft).toBe("Unsent message");
  expect(send).not.toHaveBeenCalled();
});
