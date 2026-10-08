import { useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { QueryState, RequireAuth } from "../components/ui";
import { Screen } from "../features/secondary/primitives";
import { BusinessView } from "../features/secondary/business-view";
import { useSubmission } from "../features/secondary/use-submission";
import { loadSetupRecords } from "../features/creator-setup/data";
import { creatorSetup, isCreator } from "../features/creator-setup/model";
import { api } from "../lib/api";
import { queryClient, useProfile, useAccountQuery } from "../lib/auth";
import { accountScope } from "../lib/account-scope";
function Business() {
  const query = useProfile(),
    submit = useSubmission();
  const p = query.data,
    creator = isCreator(p?.account_type);
  const setup = useAccountQuery(
    ["creator-setup", p?.id],
    (signal) => loadSetupRecords(p!.id, signal),
    !!p && creator,
  );
  const refreshProfile = query.refetch,
    refreshSetup = setup.refetch,
    profileId = p?.id;
  useFocusEffect(
    useCallback(() => {
      if (profileId) {
        void refreshProfile();
        if (creator) void refreshSetup();
      }
    }, [profileId, creator, refreshProfile, refreshSetup]),
  );
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    >
      {p && (
        <BusinessView
          creator={creator}
          busy={submit.busy}
          error={submit.error}
          checking={creator && (setup.isPending || setup.isFetching)}
          checkError={
            setup.error
              ? "Your setup couldn’t be checked. Try again before relying on the ready status."
              : undefined
          }
          setup={setup.data ? creatorSetup(p, setup.data) : undefined}
          onRefresh={() => {
            void query.refetch();
            if (creator) void setup.refetch();
          }}
          onStart={() =>
            void submit.run(async () => {
              const ticket = accountScope.capture();
              await api("/set-account-type", { accountType: "creator" });
              accountScope.assert(ticket);
              await queryClient.invalidateQueries();
              accountScope.assert(ticket);
            })
          }
          onOpen={(route) => {
            if (
              !creator &&
              !["profile-edit", "calendar-connect", "appointments"].includes(
                route,
              )
            )
              return;
            router.push(`/${route}`);
          }}
        />
      )}
    </QueryState>
  );
}
export default function CreatorOnboarding() {
  return (
    <RequireAuth>
      <Screen onBack={() => router.back()} title="Creator studio">
        <Business />
      </Screen>
    </RequireAuth>
  );
}
