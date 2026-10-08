import { useState } from "react";
import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { QueryState, RequireAuth } from "../components/ui";
import { Screen, Button, Notice } from "../features/secondary/primitives";
import { ServiceManager } from "../features/secondary/service-manager";
import { useDraftExit } from "../features/secondary/profile-exit";
import { useAccountQuery, useAuth, useProfile, queryClient } from "../lib/auth";
import { checked } from "../lib/api";
import { accountScope } from "../lib/account-scope";
import { supabase } from "../lib/supabase";
import type { Service } from "../lib/types";
function Services() {
  const [editingOpen, setEditingOpen] = useState(false);
  const { session, epoch } = useAuth(),
    profile = useProfile();
  const exit = useDraftExit("Unsaved service changes"),
    navigation = useNavigation();
  usePreventRemove(
    !!session && (exit.status.dirty || exit.status.busy),
    ({ data }) => exit.requestExit(() => navigation.dispatch(data.action)),
  );
  const creator =
    profile.data?.account_type === "creator" ||
    profile.data?.account_type === "salon";
  const query = useAccountQuery(
    ["services", session!.user.id],
    (signal) =>
      checked<Service[]>(
        supabase
          .from("services")
          .select("*")
          .eq("creator_id", session!.user.id)
          .order("created_at")
          .abortSignal(signal),
      ),
    creator,
  );
  const refresh = async () => {
    // Reconcile all dependent booking/profile views after an acknowledged mutation.
    // A background read error must not turn a successful write into a failed save.
    await queryClient.invalidateQueries();
  };
  return (
    <Screen
      onBack={() => router.back()}
      title="My services"
      resetScrollKey={String(editingOpen)}
    >
      <QueryState
        loading={profile.isPending}
        error={profile.data ? null : profile.error}
        retry={() => void profile.refetch()}
      >
        {!!profile.data && !!profile.error && (
          <>
            <Notice error>
              Couldn’t refresh your creator profile. Your edits are still here.
            </Notice>
            <Button
              title="Retry creator profile"
              secondary
              onPress={() => void profile.refetch()}
            />
          </>
        )}
        {!creator ? (
          <Button
            title="Become a creator"
            onPress={() => router.push("/creator-onboarding")}
          />
        ) : (
          <ServiceManager
            key={`${session!.user.id}:${epoch}`}
            onEditorChange={setEditingOpen}
            services={query.data || []}
            loading={query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            onStatusChange={exit.onStatusChange}
            requestExit={exit.requestExit}
            onHours={() => router.push("/availability")}
            onLocation={() => router.push("/profile-edit")}
            onSave={async (fields, service, draftId) => {
              const ticket = accountScope.capture();
              const rows = await checked<{ id: string }[]>(
                service
                  ? supabase
                      .from("services")
                      .update(fields)
                      .eq("id", service.id)
                      .eq("creator_id", session!.user.id)
                      .select("id")
                  : // The draft ID survives retries, including a lost successful response.
                    supabase
                      .from("services")
                      .upsert(
                        {
                          ...fields,
                          id: draftId,
                          creator_id: session!.user.id,
                          is_active: true,
                        },
                        { onConflict: "id" },
                      )
                      .select("id"),
              );
              accountScope.assert(ticket);
              if (!rows.length)
                throw new Error(
                  "This service is unavailable. Refresh and try again.",
                );
              await refresh();
              accountScope.assert(ticket);
            }}
            onVisibility={async (service, active) => {
              const ticket = accountScope.capture();
              const rows = await checked<{ id: string }[]>(
                supabase
                  .from("services")
                  .update({ is_active: active })
                  .eq("id", service.id)
                  .eq("creator_id", session!.user.id)
                  .select("id"),
              );
              accountScope.assert(ticket);
              if (!rows.length)
                throw new Error(
                  "This service is unavailable. Refresh and try again.",
                );
              await refresh();
              accountScope.assert(ticket);
            }}
          />
        )}
      </QueryState>
      {exit.dialog}
    </Screen>
  );
}
export default function ServiceScreen() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Services key={`${session?.user.id}:${epoch}`} />
    </RequireAuth>
  );
}
