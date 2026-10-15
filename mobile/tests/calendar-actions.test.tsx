import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { CalendarScreen } from "../src/features/calendar/calendar-screen";
import { accountScope } from "../src/lib/account-scope";
import { api } from "../src/lib/api";
import * as WebBrowser from "expo-web-browser";
import { readPending, writePending } from "../src/lib/pending";
const mockRefetch = jest.fn(),
  mockInvalidate = jest.fn();
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/api", () => ({ api: jest.fn() }));
jest.mock("../src/lib/config", () => ({ appScheme: "laque-dev" }));
jest.mock("../src/lib/pending", () => ({
  readPending: jest.fn(),
  writePending: jest.fn(),
}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
  WebBrowserResultType: { CANCEL: "cancel" },
}));
jest.mock("../src/lib/auth", () => ({
  queryClient: { invalidateQueries: () => mockInvalidate() },
  useAccountQuery: () => ({
    data: {
      configured: true,
      status: "disconnected",
      sources: [],
      calendars: [],
      pending: 0,
    },
    refetch: mockRefetch,
    isPending: false,
    error: null,
  }),
}));
const send = jest.mocked(api),
  open = jest.mocked(WebBrowser.openAuthSessionAsync);
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("client", true);
  send.mockResolvedValue({
    url: "https://accounts.google.com/authorize",
    attemptId: "attempt",
  });
  open.mockResolvedValue({
    type: "success",
    url: "laque-dev://calendar-connect?attempt=attempt&calendar=authorized",
  });
  jest.mocked(writePending).mockResolvedValue(undefined);
  jest.mocked(readPending).mockResolvedValue(null);
});
const start = async () => {
  await render(<CalendarScreen />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Connect Google Calendar" }),
  );
};
test("persists an account-bound attempt before opening Google and finalizes only the matching return", async () => {
  await start();
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  expect(jest.mocked(writePending).mock.calls[0]).toEqual([
    "google-calendar-connect",
    "attempt",
    accountScope.capture(),
  ]);
  expect(send.mock.calls[1]).toEqual([
    "/mobile/calendar",
    { action: "finish", attemptId: "attempt" },
  ]);
  expect(mockInvalidate).toHaveBeenCalledTimes(1);
});
test.each([
  { type: WebBrowser.WebBrowserResultType.CANCEL },
  {
    type: "success",
    url: "laque-dev://calendar-connect?attempt=wrong&calendar=authorized",
  },
  {
    type: "success",
    url: "https://evil.invalid/?attempt=attempt&calendar=authorized",
  },
  {
    type: "success",
    url: "laque-dev://calendar-connect?attempt=attempt&calendar=failed",
  },
] as const)(
  "cancelled or mismatched OAuth return never connects: %j",
  async (result) => {
    open.mockResolvedValue(result);
    await start();
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).not.toHaveBeenCalled();
  },
);
test("changing LaQue accounts while Google is open discards the old completion", async () => {
  let resolve!: (r: WebBrowser.WebBrowserAuthSessionResult) => void;
  open.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await start();
  await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  accountScope.change("other");
  await act(async () =>
    resolve({
      type: "success",
      url: "laque-dev://calendar-connect?attempt=attempt&calendar=authorized",
    }),
  );
  expect(send).toHaveBeenCalledTimes(1);
  expect(mockInvalidate).not.toHaveBeenCalled();
});
