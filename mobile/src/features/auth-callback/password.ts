import { supabase } from "../../lib/supabase";
import { environment } from "../../lib/config";
import { AccountChangedError, accountScope } from "../../lib/account-scope";
import { AuthLinkError, passwordValidation } from "./model";

export async function saveRecoveryPassword(
  userId: string,
  password: string,
  confirmation: string,
) {
  const validation = passwordValidation(password, confirmation);
  if (validation) throw new Error(validation);
  const ticket = accountScope.capture();
  if (ticket.id !== userId)
    throw new AuthLinkError(
      "account-changed",
      "Your account changed. Request a fresh recovery link.",
    );
  const { data, error } = await supabase.auth.getSession();
  accountScope.assert(ticket);
  if (error)
    throw new Error(
      "We couldn’t check your recovery session. Check your connection and try again.",
    );
  if (!data.session || data.session.user.id !== userId)
    throw new AuthLinkError(
      "expired",
      "Your recovery session expired. Request a new link.",
    );
  const controller = new AbortController();
  const detach = accountScope.onChange(() => controller.abort());
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    // Use the same Auth endpoint as updateUser, with this session's fixed bearer.
    // A queued SDK sign-in must never redirect this password change to another account.
    const response = await fetch(`${environment.supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      signal: controller.signal,
      headers: {
        apikey: environment.supabaseKey!,
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
        "X-Supabase-Api-Version": "2024-01-01",
      },
      body: JSON.stringify({ password }),
    });
    accountScope.assert(ticket);
    const result = await response.json();
    accountScope.assert(ticket);
    if (!response.ok) {
      if ([401, 403].includes(response.status))
        throw new AuthLinkError(
          "expired",
          "Your recovery session is no longer valid. Request a new link.",
        );
      if ((result.code ?? result.error_code) === "weak_password")
        throw new AuthLinkError(
          "retry",
          "Choose a stronger password with a mix of letters, numbers and symbols.",
        );
      if ((result.code ?? result.error_code) === "same_password")
        throw new AuthLinkError(
          "retry",
          "This password is already in use. Try signing in with it, or choose a different password.",
        );
      throw new AuthLinkError(
        "retry",
        "Your password couldn’t be updated. Try again, or request a fresh recovery link.",
      );
    }
    if ((result.user ?? result).id !== userId)
      throw new AuthLinkError(
        "retry",
        "Your password update could not be confirmed. Try signing in before requesting a new link.",
      );
  } catch (error) {
    if (error instanceof AuthLinkError || error instanceof AccountChangedError)
      throw error;
    throw new Error(
      "We couldn’t confirm the password update. Try signing in with your new password before requesting another link.",
    );
  } finally {
    clearTimeout(timeout);
    detach();
  }
}
