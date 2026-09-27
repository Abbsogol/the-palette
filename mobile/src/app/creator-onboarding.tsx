import { useState } from "react";
import { router } from "expo-router";
import { Button, Notice, RequireAuth, Screen } from "../components/ui";
import { api } from "../lib/api";
import { queryClient } from "../lib/auth";
export default function CreatorOnboarding() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Screen title="Create with LaQue" back>
      <RequireAuth>
        <Notice>
          Publish your work and manage appointments here. Set your service
          location, prices, deposits and working hours before inviting clients
          to book.
        </Notice>
        <Button
          title="Set up my creator account"
          busy={busy}
          onPress={() => {
            setBusy(true);
            void api("/set-account-type", { accountType: "creator" })
              .then(async () => {
                await queryClient.invalidateQueries();
                router.replace("/services");
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        />
        {error && <Notice error>{error}</Notice>}
      </RequireAuth>
    </Screen>
  );
}
