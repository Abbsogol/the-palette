import { Linking } from "react-native";
import { router, type Href } from "expo-router";
import { useAuth } from "../lib/auth";
import { RequireAuth } from "../components/ui";
import { Screen } from "../features/secondary/primitives";
import { DeleteView } from "../features/secondary/delete-view";
import { api } from "../lib/api";
import { accountScope } from "../lib/account-scope";
import { closedAccounts } from "../lib/closed-accounts";
import { supabase } from "../lib/supabase";
export default function DeleteAccount() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Screen onBack={() => router.back()} title="Delete account">
        <DeleteView
          key={`${session?.user.id}:${epoch}`}
          onAppointments={() => router.push("/appointments")}
          onCredits={() => router.push("/billing")}
          onSupport={() =>
            Linking.openURL(
              "mailto:contact@laque.app?subject=Account%20closure",
            )
          }
          onDelete={async () => {
            const ticket = accountScope.capture();
            const result = await api<{ closed: boolean }>(
              "/delete-account",
              {},
            );
            if (!result.closed)
              throw new Error("Closure was not confirmed. Please retry.");
            // The server has committed: a local/network cleanup failure must
            // never tell the user their account is still open. Preserve a newer
            // account if they switched while the request was in flight.
            if (accountScope.isCurrent(ticket))
              router.replace("/account-closed" as Href);
            if (ticket.id)
              void closedAccounts.add(ticket.id).catch(() => undefined);
            // With no explicit token, Supabase reads the latest session under
            // its lock. Refresh cannot globally sign out a different account.
            void supabase.auth.refreshSession().catch(() => undefined);
          }}
          onPolicy={() =>
            Linking.openURL("https://www.laque.app/privacy#retention")
          }
          onDone={() => router.back()}
        />
      </Screen>
    </RequireAuth>
  );
}
