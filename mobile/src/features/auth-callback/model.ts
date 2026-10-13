export type AuthLinkProblem =
  "expired" | "invalid" | "retry" | "account-changed";
export class AuthLinkError extends Error {
  constructor(
    public kind: AuthLinkProblem,
    message: string,
  ) {
    super(message);
  }
}
export function authLinkProblem(error: unknown): AuthLinkProblem {
  if (error instanceof AuthLinkError) return error.kind;
  if ((error as { name?: string })?.name === "AccountChangedError")
    return "account-changed";
  const e = error as {
    code?: string;
    name?: string;
    message?: string;
    status?: number;
  };
  if (
    [
      "otp_expired",
      "flow_state_expired",
      "flow_state_not_found",
      "bad_code_verifier",
      "pkce_verifier_not_found",
      "session_not_found",
      "refresh_token_not_found",
    ].includes(e?.code || "") ||
    /expired|already used|code verifier|flow state/i.test(e?.message || "") ||
    ["AuthPKCECodeVerifierMissingError", "AuthSessionMissingError"].includes(
      e?.name || "",
    )
  )
    return "expired";
  if (/not valid|incomplete|invalid.*link/i.test(e?.message || ""))
    return "invalid";
  return "retry";
}
export function initialAuthMode(value: unknown) {
  return value === "recovery"
    ? "Reset password"
    : value === "verification"
      ? "Verify email"
      : value === "signin"
        ? "Sign in"
        : "welcome";
}
export function passwordValidation(password: string, confirmation: string) {
  if (password.length < 8) return "Use a password with at least 8 characters.";
  if (password !== confirmation)
    return "Your passwords don’t match. Check both fields.";
  return "";
}
