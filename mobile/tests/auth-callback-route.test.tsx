import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import CallbackScreen from "../src/app/auth/callback";
import { completeAuthCallback } from "../src/features/auth-actions";
import { saveRecoveryPassword } from "../src/features/auth-callback/password";
import { accountScope } from "../src/lib/account-scope";
import { secureStorage } from "../src/lib/secure-storage";
import { AuthLinkError } from "../src/features/auth-callback/model";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
let mockParams: Record<string, string> = { code: "verified" };
let mockSession = { user: { id: "owner" } };
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("../src/lib/config", () => ({ appScheme: "laque-dev" }));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: mockSession, epoch: 1 }),
}));
jest.mock("../src/features/auth-actions", () => ({
  completeAuthCallback: jest.fn(),
  consumeAuthCallback: jest.fn(),
}));
jest.mock("../src/features/auth-callback/password", () => ({
  saveRecoveryPassword: jest.fn(),
}));
jest.mock("../src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("owner", true);
  mockParams = { code: "verified" };
  mockSession = { user: { id: "owner" } };
  jest
    .mocked(completeAuthCallback)
    .mockResolvedValue({ userId: "owner", recovery: false, verified: true });
  jest.mocked(secureStorage.getItem).mockResolvedValue("/search");
});
afterEach(() => accountScope.change(null));
test("verified callback waits for Continue and returns to the intended permitted feature", async () => {
  await render(<CallbackScreen />);
  await waitFor(() => expect(screen.getByText("Email verified")).toBeTruthy());
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue to LaQue" }),
  );
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/search"));
  expect(secureStorage.removeItem).toHaveBeenCalledWith("laque.auth-intent");
});
test.each(["recovery", "verification"])(
  "expired %s links open their correct request form without exposing the callback",
  async (flow) => {
    mockParams = { code: "private-code", flow };
    jest
      .mocked(completeAuthCallback)
      .mockRejectedValue(
        new AuthLinkError("expired", "private-code secret provider error"),
      );
    await render(<CallbackScreen />);
    await waitFor(() =>
      expect(screen.getByText("This link has expired")).toBeTruthy(),
    );
    expect(screen.queryByText(/private-code|secret provider/)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: `Request a new ${flow} link` }),
    );
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/auth",
      params: { mode: flow },
    });
  },
);
test("failed exchange can retry and server-confirmed recovery enables the form", async () => {
  jest
    .mocked(completeAuthCallback)
    .mockRejectedValueOnce(new TypeError("Network failed"))
    .mockResolvedValueOnce({ userId: "owner", recovery: true, verified: true });
  await render(<CallbackScreen />);
  await waitFor(() =>
    expect(screen.getByText("Let’s try that again")).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Try this link again" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("New password")).toBeTruthy(),
  );
  expect(completeAuthCallback).toHaveBeenCalledTimes(2);
});
async function recovery() {
  jest
    .mocked(completeAuthCallback)
    .mockResolvedValue({ userId: "owner", recovery: true, verified: true });
  const view = await render(<CallbackScreen />);
  await waitFor(() =>
    expect(screen.getByLabelText("New password")).toBeTruthy(),
  );
  await fireEvent.changeText(
    screen.getByLabelText("New password"),
    "synthetic-password",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Confirm new password"),
    "synthetic-password",
  );
  return view;
}
test("double taps and keyboard events create only one update; expired sessions clear drafts", async () => {
  let reject!: (e: Error) => void;
  jest.mocked(saveRecoveryPassword).mockReturnValue(
    new Promise((_done, fail) => {
      reject = fail;
    }),
  );
  await recovery();
  await fireEvent.press(
    screen.getByRole("button", { name: "Save new password" }),
  );
  await fireEvent(
    screen.getByLabelText("Confirm new password"),
    "submitEditing",
  );
  expect(saveRecoveryPassword).toHaveBeenCalledTimes(1);
  await act(async () =>
    reject(new AuthLinkError("expired", "Session expired")),
  );
  expect(screen.getByText("This link has expired")).toBeTruthy();
  expect(screen.queryByLabelText("New password")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Request a new recovery link" }),
  );
  expect(router.replace).toHaveBeenCalledWith({
    pathname: "/auth",
    params: { mode: "recovery" },
  });
});
test("account changes suppress stale password success and remove the form", async () => {
  let resolve!: () => void;
  jest.mocked(saveRecoveryPassword).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await recovery();
  await fireEvent.press(
    screen.getByRole("button", { name: "Save new password" }),
  );
  await act(async () => accountScope.change("other"));
  await act(async () => resolve());
  expect(screen.getByText("Your account changed")).toBeTruthy();
  expect(screen.queryByText("Password updated")).toBeNull();
  expect(screen.queryByLabelText("New password")).toBeNull();
});
test("new incoming links clear old password drafts and ignore old exchange results", async () => {
  const view = await recovery();
  mockParams = { code: "second", sb_flow_id: "abcdefgh12345678" };
  await view.rerender(<CallbackScreen />);
  await waitFor(() =>
    expect(completeAuthCallback).toHaveBeenLastCalledWith(
      "laque-dev://auth/callback?code=second&sb_flow_id=abcdefgh12345678",
    ),
  );
  expect(screen.getByLabelText("New password").props.value).toBe("");
});
test("verified callbacks discard untrusted return paths", async () => {
  jest
    .mocked(secureStorage.getItem)
    .mockResolvedValue("https://untrusted.test");
  await render(<CallbackScreen />);
  await waitFor(() => expect(screen.getByText("Email verified")).toBeTruthy());
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue to LaQue" }),
  );
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
});

test("successful password updates clear the form and show an explicit completion action", async () => {
  jest.mocked(saveRecoveryPassword).mockResolvedValue(undefined);
  await recovery();
  await fireEvent.press(
    screen.getByRole("button", { name: "Save new password" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Password updated")).toBeTruthy(),
  );
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue to LaQue" }),
  );
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/search"));
});
test("password rejection retains the draft for correction and retry", async () => {
  jest
    .mocked(saveRecoveryPassword)
    .mockRejectedValue(
      new AuthLinkError("retry", "Choose a stronger password."),
    );
  await recovery();
  await fireEvent.press(
    screen.getByRole("button", { name: "Save new password" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Choose a stronger password.")).toBeTruthy(),
  );
  expect(screen.getByLabelText("New password").props.value).toBe(
    "synthetic-password",
  );
  expect(
    screen.getByRole("button", { name: "Save new password" }),
  ).not.toBeDisabled();
});
test("a delayed old exchange cannot replace the state of a newer link", async () => {
  let resolve!: (v: {
    userId: string;
    recovery: boolean;
    verified: boolean;
  }) => void;
  jest
    .mocked(completeAuthCallback)
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    )
    .mockResolvedValueOnce({
      userId: "owner",
      recovery: false,
      verified: true,
    });
  const view = await render(<CallbackScreen />);
  mockParams = { code: "newer" };
  await view.rerender(<CallbackScreen />);
  await waitFor(() => expect(screen.getByText("Email verified")).toBeTruthy());
  await act(async () =>
    resolve({ userId: "owner", recovery: true, verified: true }),
  );
  expect(screen.getByText("Email verified")).toBeTruthy();
  expect(screen.queryByLabelText("New password")).toBeNull();
});
