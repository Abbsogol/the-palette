import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  CallbackView,
  type CallbackViewProps,
} from "../src/features/auth-callback/callback-view";
import { AuthLinksPreview } from "../src/preview/auth-links";
import {
  authLinkProblem,
  passwordValidation,
} from "../src/features/auth-callback/model";
import { parseAuthLink } from "../src/lib/links";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const props = (): CallbackViewProps => ({
  state: "recovery",
  password: "",
  confirmation: "",
  onPassword: jest.fn(),
  onConfirmation: jest.fn(),
  onSave: jest.fn(),
  onContinue: jest.fn(),
  onRetry: jest.fn(),
  onNewLink: jest.fn(),
  onSignIn: jest.fn(),
});
test.each([
  "checking",
  "verified",
  "signed-in",
  "expired",
  "invalid",
  "retry",
  "account-changed",
  "password-saved",
] as const)(
  "%s has no password form or password mutation action",
  async (state) => {
    await render(<CallbackView {...props()} state={state} />);
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Save new password" }),
    ).toBeNull();
    if (state === "checking") expect(screen.queryByRole("button")).toBeNull();
  },
);
test("passwords are masked, can be revealed and cannot submit by keyboard while busy", async () => {
  const p = props();
  const view = await render(<CallbackView {...p} />);
  expect(screen.getByLabelText("New password").props.secureTextEntry).toBe(
    true,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Show new passwords" }),
  );
  expect(
    screen.getByLabelText("Confirm new password").props.secureTextEntry,
  ).toBe(false);
  await view.rerender(<CallbackView {...p} busy />);
  await fireEvent(
    screen.getByLabelText("Confirm new password"),
    "submitEditing",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Save new password" }),
  );
  expect(p.onSave).not.toHaveBeenCalled();
  expect(screen.getByLabelText("New password").props.editable).toBe(false);
});
test("unadopted recovery sessions cannot submit from either button or keyboard", async () => {
  const p = props();
  await render(<CallbackView {...p} canSave={false} />);
  await fireEvent(
    screen.getByLabelText("Confirm new password"),
    "submitEditing",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Save new password" }),
  );
  expect(p.onSave).not.toHaveBeenCalled();
});
test("connection retry and fresh recovery links are separate actions", async () => {
  const p = props();
  await render(<CallbackView {...p} state="retry" recovery />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Try this link again" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Request a new recovery link" }),
  );
  expect(p.onRetry).toHaveBeenCalledTimes(1);
  expect(p.onNewLink).toHaveBeenCalledTimes(1);
});
test("preview validates passwords and clears drafts without touching authentication", async () => {
  await render(<AuthLinksPreview onClose={jest.fn()} />);
  expect(screen.getByText(/no account or password is changed/)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Preview New password" }),
  );
  await fireEvent.changeText(screen.getByLabelText("New password"), "short");
  await fireEvent.press(
    screen.getByRole("button", { name: "Save new password" }),
  );
  expect(screen.getByText(/at least 8 characters/)).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("New password"),
    "synthetic-pass",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Confirm new password"),
    "synthetic-pass",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Save new password" }),
  );
  expect(screen.getByText("Password updated")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Preview New password" }),
  );
  expect(screen.getByLabelText("New password").props.value).toBe("");
});
test.each([
  "otp_expired",
  "flow_state_not_found",
  "bad_code_verifier",
  "pkce_verifier_not_found",
])("SDK %s maps to a fresh-link state", (code) =>
  expect(authLinkProblem({ code, message: "Provider detail" })).toBe("expired"),
);
test("unknown transport errors remain retryable and validation covers mismatched confirmation", () => {
  expect(authLinkProblem(new TypeError("Network failed"))).toBe("retry");
  expect(passwordValidation("long-password", "other-password")).toMatch(
    /don’t match/,
  );
});
test("explicit expiry codes and malformed PKCE slots cannot be exchanged", () => {
  try {
    parseAuthLink(
      "laque-dev://auth/callback?error=access_denied&error_code=otp_expired&error_description=Provider+detail",
      "laque-dev",
    );
  } catch (e) {
    expect(authLinkProblem(e)).toBe("expired");
  }
  expect(() =>
    parseAuthLink(
      "laque-dev://auth/callback?code=one&sb_flow_id=invalid",
      "laque-dev",
    ),
  ).toThrow(/not valid/);
});

test("expired preview links open an email request form without sending email", async () => {
  await render(<AuthLinksPreview onClose={jest.fn()} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Preview Expired" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Request a new recovery link" }),
  );
  expect(screen.getByLabelText("Email")).toBeTruthy();
  expect(screen.queryByLabelText("New password")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Send reset link" }),
  );
  expect(screen.getByText(/no email was sent/)).toBeTruthy();
});
