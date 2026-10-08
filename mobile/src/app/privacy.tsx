import { useCallback, useState } from "react";
import { Linking } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { QueryState, RequireAuth } from "../components/ui";
import { Screen, Notice, Button } from "../features/secondary/primitives";
import { PrivacyView } from "../features/secondary/privacy-view";
import { useSubmission } from "../features/secondary/use-submission";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { accountScope } from "../lib/account-scope";
import {
  loadPrivacy,
  savePrivacy,
  unblockAccount,
} from "../features/safety/data";
import { UsagePreference } from "../features/analytics/usage";
function Privacy() {
  const { session, epoch } = useAuth(),
    owner = session!.user.id,
    submit = useSubmission();
  const [notice, setNotice] = useState("");
  const query = useAccountQuery(["privacy-settings-and-blocks"], (signal) =>
    loadPrivacy(owner, signal),
  );
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const key = [owner, epoch, "privacy-settings-and-blocks"];
  return (
    <>
      {!!notice && <Notice>{notice}</Notice>}
      {!!submit.error && <Notice error>{submit.error}</Notice>}
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void refetch()}
      >
        {query.data && (
          <PrivacyView
            settings={query.data.settings}
            blocks={query.data.blocks}
            busy={submit.busy}
            onUpdate={(patch) =>
              void submit.run(async () => {
                setNotice("");
                const ticket = accountScope.capture();
                const settings = await savePrivacy(owner, patch);
                accountScope.assert(ticket);
                queryClient.setQueryData(key, (old: typeof query.data) =>
                  old ? { ...old, settings } : old,
                );
                setNotice("Privacy setting saved.");
                void queryClient.invalidateQueries({
                  queryKey: [owner, epoch],
                });
              })
            }
            onUnblock={(id) =>
              submit.run(async () => {
                setNotice("");
                const ticket = accountScope.capture();
                await unblockAccount(owner, id);
                accountScope.assert(ticket);
                queryClient.setQueryData(key, (old: typeof query.data) =>
                  old
                    ? { ...old, blocks: old.blocks.filter((b) => b.id !== id) }
                    : old,
                );
                setNotice(
                  "Account unblocked. Your message and profile settings still apply.",
                );
                void queryClient.invalidateQueries({
                  queryKey: [owner, epoch],
                });
              })
            }
            onDelete={() => router.push("/delete-account")}
            onPolicy={() =>
              void submit.run(async () => {
                await Linking.openURL(
                  "https://www.laque.app/privacy#retention",
                );
              })
            }
          />
        )}
      </QueryState>
      <UsagePreference />
      <Button
        title="Refresh privacy settings"
        secondary
        disabled={submit.busy || query.isFetching}
        onPress={() => void refetch()}
      />
    </>
  );
}
export default function PrivacyScreen() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Screen title="Privacy & safety" onBack={() => router.back()}>
        <Privacy key={`${session?.user.id}:${epoch}`} />
      </Screen>
    </RequireAuth>
  );
}
