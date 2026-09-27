import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button, Field, Notice, RequireAuth, Screen } from "../components/ui";
import { api } from "../lib/api";
export default function Report() {
  const { targetType, targetId } = useLocalSearchParams<{
    targetType: string;
    targetId: string;
  }>();
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <Screen title="Report content" back>
      <RequireAuth>
        {sent ? (
          <Notice>Your report has been sent to the LaQue support team.</Notice>
        ) : (
          <>
            <Field
              label="What happened?"
              multiline
              value={reason}
              onChangeText={setReason}
              maxLength={2000}
            />
            <Button
              title="Submit report"
              busy={busy}
              disabled={reason.trim().length < 3}
              onPress={() => {
                setBusy(true);
                setError("");
                void api("/mobile/report", { targetType, targetId, reason })
                  .then(() => setSent(true))
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            />
          </>
        )}
        {error && <Notice error>{error}</Notice>}
      </RequireAuth>
    </Screen>
  );
}
