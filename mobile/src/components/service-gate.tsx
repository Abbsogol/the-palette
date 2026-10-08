import { useEffect, useState, type PropsWithChildren } from "react";
import { environment } from "../lib/config";
import { Button, Loading, Notice, Screen } from "./ui";
export function ServiceGate({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0),
    [state, setState] = useState<"checking" | "ready" | "error">("checking"),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    void fetch(`${environment.apiUrl}/api/mobile/config`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const config = await response.json();
        if (!response.ok)
          throw new Error(config.error || "Services unavailable.");
        if (
          config.environment !== environment.appEnv ||
          config.projectRef !== environment.projectRef ||
          config.contractVersion !== 1
        )
          throw new Error(
            "This app and backend belong to different environments.",
          );
        if (!controller.signal.aborted) setState("ready");
      })
      .catch((e) => {
        if (active) {
          setMessage(
            e.name === "AbortError"
              ? "Service check timed out. Check your connection and retry."
              : e.message,
          );
          setState("error");
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  if (state === "ready") return <>{children}</>;
  return (
    <Screen title="Connecting to LaQue">
      {state === "checking" ? (
        <Loading />
      ) : (
        <>
          <Notice error>{message}</Notice>
          <Button
            title="Try again"
            onPress={() => {
              setState("checking");
              setAttempt(attempt + 1);
            }}
          />
        </>
      )}
    </Screen>
  );
}
