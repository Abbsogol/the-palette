import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { appScheme } from "../../lib/config";
import { safeReturnPath } from "../../lib/links";
import { secureStorage } from "../../lib/secure-storage";
import {
  completeAuthCallback,
  consumeAuthCallback,
  type AuthCallbackOutcome,
} from "../../features/auth-actions";
import {
  CallbackView,
  type CallbackState,
} from "../../features/auth-callback/callback-view";
import { authLinkProblem } from "../../features/auth-callback/model";
import { saveRecoveryPassword } from "../../features/auth-callback/password";
import { accountScope } from "../../lib/account-scope";
import { useAuth } from "../../lib/auth";

type Params = {
  code?: string;
  flow?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
  sb_flow_id?: string;
};
function Callback({ query, recovery }: { query: string; recovery: boolean }) {
  const { session, epoch } = useAuth();
  const [state, setState] = useState<CallbackState>("checking"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [outcome, setOutcome] = useState<AuthCallbackOutcome | null>(null),
    [retry, setRetry] = useState(0),
    [isRecovery, setIsRecovery] = useState(recovery);
  const pending = useRef(false),
    mounted = useRef(true),
    revision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const current = ++revision.current;
    void completeAuthCallback(`${appScheme}://auth/callback?${query}`)
      .then((result) => {
        if (!mounted.current || revision.current !== current) return;
        setIsRecovery(result.recovery);
        setOutcome(result);
        setState(
          result.recovery
            ? "recovery"
            : result.verified
              ? "verified"
              : "signed-in",
        );
      })
      .catch((e) => {
        if (mounted.current && revision.current === current)
          setState(authLinkProblem(e));
      });
  }, [query, retry]);
  useEffect(() => {
    if (!outcome) return;
    return accountScope.onChange(() => {
      if (accountScope.capture().id === outcome.userId) return;
      revision.current++;
      setPassword("");
      setConfirmation("");
      setOutcome(null);
      setError("");
      setState("account-changed");
    });
  }, [outcome, epoch]);
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const current = revision.current;
    try {
      await action();
    } catch (e) {
      if (mounted.current && current === revision.current) {
        const kind = authLinkProblem(e);
        if (kind === "expired" || kind === "account-changed") {
          setPassword("");
          setConfirmation("");
          setOutcome(null);
          setState(kind);
        } else setError(e instanceof Error ? e.message : "Please try again.");
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const save = () =>
    void run(async () => {
      if (!outcome?.recovery || session?.user.id !== outcome.userId) return;
      const current = revision.current;
      await saveRecoveryPassword(outcome.userId, password, confirmation);
      if (!mounted.current || current !== revision.current) return;
      setPassword("");
      setConfirmation("");
      consumeAuthCallback(`${appScheme}://auth/callback?${query}`);
      setState("password-saved");
    });
  const continueToApp = () =>
    void run(async () => {
      if (!outcome) return;
      const ticket = accountScope.capture();
      if (ticket.id !== outcome.userId) {
        setState("account-changed");
        return;
      }
      const next = safeReturnPath(
        await secureStorage.getItem("laque.auth-intent"),
      );
      accountScope.assert(ticket);
      await secureStorage.removeItem("laque.auth-intent");
      accountScope.assert(ticket);
      if (mounted.current) {
        consumeAuthCallback(`${appScheme}://auth/callback?${query}`);
        router.replace(next as Href);
      }
    });
  const navigate = (mode: string) => {
    if (!pending.current)
      router.replace({ pathname: "/auth", params: { mode } });
  };
  return (
    <CallbackView
      state={state}
      recovery={isRecovery}
      password={password}
      confirmation={confirmation}
      onPassword={setPassword}
      onConfirmation={setConfirmation}
      canSave={!!outcome?.recovery && session?.user.id === outcome.userId}
      busy={busy}
      error={error}
      onSave={save}
      onContinue={continueToApp}
      onRetry={() => {
        if (!pending.current) {
          setState("checking");
          setError("");
          setPassword("");
          setConfirmation("");
          setOutcome(null);
          setRetry((v) => v + 1);
        }
      }}
      onNewLink={() => navigate(isRecovery ? "recovery" : "verification")}
      onSignIn={() => navigate("signin")}
    />
  );
}
export default function CallbackScreen() {
  const params = useLocalSearchParams<Params>();
  // Primitive query identity avoids restarting exchanges on ordinary rerenders.
  const query = new URLSearchParams();
  for (const key of [
    "code",
    "flow",
    "error",
    "error_code",
    "error_description",
    "sb_flow_id",
  ] as const) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  const encoded = query.toString();
  // A second incoming link starts a new form and clears password drafts.
  return (
    <Callback
      key={encoded}
      query={encoded}
      recovery={params.flow === "recovery"}
    />
  );
}
