import { useEffect, useRef, useState } from "react";
import { accountScope } from "../../lib/account-scope";
// A synchronous latch prevents double taps; a late result cannot update another account.
export function useSubmission() {
  const latch = useRef(false),
    mounted = useRef(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(work: () => Promise<void>) {
    if (latch.current) return false;
    const ticket = accountScope.capture();
    latch.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      return true;
    } catch (e) {
      if (mounted.current && accountScope.isCurrent(ticket))
        setError(
          e instanceof Error ? e.message : "Could not save. Please try again.",
        );
      return false;
    } finally {
      latch.current = false;
      if (mounted.current && accountScope.isCurrent(ticket)) setBusy(false);
    }
  }
  return { busy, error, run, clearError: () => setError("") };
}
