import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import AuthScreen from "../src/app/auth/index";
import { supabase } from "../src/lib/supabase";
import { oauth } from "../src/features/auth-actions";
import { secureStorage } from "../src/lib/secure-storage";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ ready: true, session: mockSession }),
}));
jest.mock("../src/features/welcome/first-launch", () => ({
  useFirstLaunch: () => ({ complete: jest.fn().mockResolvedValue(undefined) }),
}));
jest.mock("../src/lib/secure-storage", () => ({
  secureStorage: {
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("../src/features/auth-actions", () => ({
  authCallback: "laque-dev://auth/callback",
  oauth: jest.fn(),
}));
jest.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      resend: jest.fn(),
    },
  },
}));
let mockSession: unknown = null;
let mockMode: string | undefined;
let mockReturnTo: string | undefined = "/search";
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({ returnTo: mockReturnTo, mode: mockMode }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockReturnTo = "/search";
  mockSession = null;
  mockMode = undefined;
});
test("opening sign-in without a return destination renders Onboarding 0", async () => {
  mockReturnTo = undefined;
  await render(<AuthScreen />);
  expect(
    screen.getByRole("button", { name: "Continue with Google" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", {name:"View Home as a guest"})).toBeNull();
  expect(screen.queryByRole("tab", {name:"Home"})).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});
async function acceptEligibility() {
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "I am 18 or older" }),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "I have read the Privacy Policy" }),
  );
}
async function credentials(mode = "Sign up", password = "secure-password") {
  await fireEvent.press(screen.getByRole("button", { name: mode }));
  await fireEvent.changeText(
    screen.getByLabelText("Email"),
    "person@example.test",
  );
  await fireEvent.changeText(screen.getByLabelText("Password"), password);
}
test("sign-up without a session waits for verification and cannot bypass authentication", async () => {
  jest
    .mocked(supabase.auth.signUp)
    .mockResolvedValue({ data: { session: null }, error: null } as never);
  await render(<AuthScreen />);
  await credentials();
  await acceptEligibility();
  await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() =>
    expect(screen.getByText(/Check your email to verify/)).toBeTruthy(),
  );
  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: "person@example.test",
    password: "secure-password",
    options: {
      emailRedirectTo: "laque-dev://auth/callback",
      data: {
        age_confirmed: true,
        privacy_accepted: true,
        privacy_policy_version: "2026-09-29",
      },
    },
  });
  expect(router.replace).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Resend verification email" }),
  ).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Email"),
    "different@example.test",
  );
  expect(
    screen.queryByRole("button", { name: "Resend verification email" }),
  ).toBeNull();
});
test("successful email sign-in returns to the gated feature and keeps older valid passwords usable", async () => {
  jest.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
    data: { session: { user: { id: "customer" } } },
    error: null,
  } as never);
  await render(<AuthScreen />);
  await credentials("Sign in", "oldpass");
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/search"));
  expect(secureStorage.setItem).toHaveBeenCalledWith(
    "laque.auth-intent",
    "/search",
  );
});
test("invalid sign-up fields do not send a backend request", async () => {
  await render(<AuthScreen />);
  await credentials("Sign up", "short");
  await acceptEligibility();
  await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/at least 8/);
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});
test("duplicate submissions send one request and failure leaves retry available", async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(supabase.auth.signInWithPassword).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }) as never,
  );
  await render(<AuthScreen />);
  await credentials("Sign in");
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await fireEvent(screen.getByLabelText("Password"), "submitEditing");
  await waitFor(() =>
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1),
  );
  await act(async () =>
    resolve({ data: {}, error: new Error("Invalid login credentials") }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/Invalid login/);
  expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled();
});
test.each(["Google", "Apple"])(
  "%s cancellation remains on entry; failure is visible and retryable",
  async (provider) => {
    jest
      .mocked(oauth)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("Provider unavailable"));
    await render(<AuthScreen />);
    await acceptEligibility();
    await fireEvent.press(
      screen.getByRole("button", { name: `Continue with ${provider}` }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Sign-in cancelled/)).toBeTruthy(),
    );
    expect(router.replace).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: `Continue with ${provider}` }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Provider unavailable/,
      ),
    );
  },
);
test("password recovery uses the registered callback without a password field", async () => {
  jest
    .mocked(supabase.auth.resetPasswordForEmail)
    .mockResolvedValue({ data: {}, error: null });
  await render(<AuthScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Forgot password?" }),
  );
  expect(screen.queryByLabelText("Password")).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText("Email"),
    "person@example.test",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Send reset link" }),
  );
  await waitFor(() =>
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "person@example.test",
      { redirectTo: "laque-dev://auth/callback?flow=recovery" },
    ),
  );
});
test("creator registration preserves the creator setup destination", async () => {
  jest
    .mocked(supabase.auth.signUp)
    .mockResolvedValue({ data: { session: null }, error: null } as never);
  await render(<AuthScreen />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Join as a Creator" }),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Email"),
    "creator@example.test",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Password"),
    "secure-password",
  );
  await acceptEligibility();
  await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() =>
    expect(secureStorage.setItem).toHaveBeenCalledWith(
      "laque.auth-intent",
      "/creator-onboarding",
    ),
  );
});
test("signed-out entry has no guest bypass and retains the protected destination", async () => {
  await render(<AuthScreen />);
  expect(screen.queryByRole("button", {name:"View Home as a guest"})).toBeNull();
  expect(screen.queryByRole("tab", {name:"Home"})).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
  expect(secureStorage.removeItem).not.toHaveBeenCalled();
  expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
});

test.each(["age", "privacy"])(
  "registration cannot bypass missing %s confirmation using the keyboard or providers",
  async (missing) => {
    await render(<AuthScreen />);
    await credentials();
    expect(
      screen.getByRole("checkbox", { name: "I am 18 or older" }),
    ).not.toBeChecked();
    await fireEvent.press(
      screen.getByRole("checkbox", {
        name:
          missing === "age"
            ? "I have read the Privacy Policy"
            : "I am 18 or older",
      }),
    );
    await fireEvent(screen.getByLabelText("Password"), "submitEditing");
    await fireEvent.press(
      screen.getByRole("button", { name: "Create account" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Continue with Apple" }),
    );
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
    expect(oauth).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/18 or older/);
  },
);
test("removing age confirmation blocks registration again", async () => {
  await render(<AuthScreen />);
  await credentials();
  await acceptEligibility();
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "I am 18 or older" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});

test.each(["recovery", "verification"])(
  "requesting a new %s link opens its email form even with an active session",
  async (mode) => {
    mockMode = mode;
    mockSession = { user: { id: "customer" } };
    jest
      .mocked(supabase.auth.resend)
      .mockResolvedValue({ data: {}, error: null } as never);
    jest
      .mocked(supabase.auth.resetPasswordForEmail)
      .mockResolvedValue({ data: {}, error: null });
    await render(<AuthScreen />);
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByLabelText("Email"),
      "person@example.test",
    );
    await fireEvent.press(
      screen.getByRole("button", {
        name:
          mode === "recovery" ? "Send reset link" : "Send verification link",
      }),
    );
    await waitFor(() =>
      expect(
        mode === "recovery"
          ? supabase.auth.resetPasswordForEmail
          : supabase.auth.resend,
      ).toHaveBeenCalledTimes(1),
    );
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    if (mode === "verification") {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "person@example.test",
        options: { emailRedirectTo: "laque-dev://auth/callback" },
      });
      expect(
        screen.getByText(/If this account needs verification/),
      ).toBeTruthy();
    }
  },
);
