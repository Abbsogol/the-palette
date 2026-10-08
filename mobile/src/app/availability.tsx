import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { QueryState, RequireAuth } from "../components/ui";
import { Screen, Button, Notice } from "../features/secondary/primitives";
import { Schedule, type Day } from "../features/secondary/hours-form";
import { useDraftExit } from "../features/secondary/profile-exit";
import { useAccountQuery, useAuth, useProfile, queryClient } from "../lib/auth";
import { api, checked } from "../lib/api";
import { accountScope } from "../lib/account-scope";
import { supabase } from "../lib/supabase";
function Availability() {
  const { session } = useAuth(),
    profile = useProfile();
  const exit = useDraftExit("Unsaved working hours"),
    navigation = useNavigation();
  usePreventRemove(exit.status.dirty || exit.status.busy, ({ data }) =>
    exit.requestExit(() => navigation.dispatch(data.action)),
  );
  const creator =
    !!profile.data &&
    ["creator", "nail_artist", "salon"].includes(profile.data.account_type);
  const query = useAccountQuery(
    ["availability", session!.user.id],
    async (signal) => {
      const days = await checked<Day[]>(
        supabase
          .from("availability")
          .select("*")
          .eq("creator_id", session!.user.id)
          .abortSignal(signal),
      );
      const { data, error } = await supabase
        .from("creator_booking_settings")
        .select("time_zone")
        .eq("creator_id", session!.user.id)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return { days, zone: data?.time_zone || "" };
    },
    creator,
  );
  return (
    <Screen
      onBack={() => router.back()}
      title="Working hours"
      subtitle="Make room for your next client, on your schedule."
    >
      <QueryState
        loading={profile.isPending}
        error={profile.data ? null : profile.error}
        retry={() => void profile.refetch()}
      >
        {profile.data && profile.error && (
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
          <QueryState
            loading={query.isPending && !query.data}
            error={query.data ? null : query.error}
            retry={() => void query.refetch()}
          >
            {query.data && query.error && (
              <>
                <Notice error>
                  Couldn’t refresh your working hours. Your draft is still here.
                </Notice>
                <Button
                  title="Retry working hours"
                  secondary
                  onPress={() => void query.refetch()}
                />
              </>
            )}
            {query.data && (
              <Schedule
                initial={query.data.days}
                zone={query.data.zone}
                onStatusChange={exit.onStatusChange}
                onCalendar={() =>
                  exit.requestExit(() => router.push("/calendar-connect"))
                }
                onSave={async (timeZone, schedule) => {
                  const ticket = accountScope.capture();
                  await api("/update-availability", { timeZone, schedule });
                  accountScope.assert(ticket);
                  await queryClient.invalidateQueries();
                  accountScope.assert(ticket);
                }}
              />
            )}
          </QueryState>
        )}
      </QueryState>
      {exit.dialog}
    </Screen>
  );
}
export default function AvailabilityScreen() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Availability key={session?.user.id + ":" + epoch} />
    </RequireAuth>
  );
}
