import { useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { RequireAuth } from "../../components/ui";
import { UpdateComposer } from "../../features/home/update-composer";
import { publishUpdate } from "../../features/home/update-data";
import { useDraftExit } from "../../features/secondary/profile-exit";
import { queryClient, useAuth, useProfile } from "../../lib/auth";
import { accountScope } from "../../lib/account-scope";
function Composer() {
  const [id] = useState(() => Crypto.randomUUID()),
    [closed, setClosed] = useState(false);
  const profile = useProfile(),
    navigation = useNavigation(),
    exit = useDraftExit("Leave this update?");
  usePreventRemove(
    !closed && (exit.status.dirty || exit.status.busy),
    ({ data }) => exit.requestExit(() => navigation.dispatch(data.action)),
  );
  useEffect(() => {
    if (closed) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
  }, [closed]);
  return (
    <>
      <UpdateComposer
        author={
          profile.data
            ? {
                name:
                  profile.data.display_name || profile.data.username || "You",
                username: profile.data.username,
                avatar: profile.data.avatar_url
                  ? { uri: profile.data.avatar_url }
                  : null,
              }
            : undefined
        }
        onStatusChange={exit.onStatusChange}
        onClose={() => setClosed(true)}
        onPublish={async (body) => {
          const ticket = accountScope.capture();
          await publishUpdate(id, body);
          accountScope.assert(ticket);
          void queryClient
            .invalidateQueries({
              predicate: (q) =>
                q.queryKey[0] === ticket.id && q.queryKey.includes("home"),
            })
            .catch(() => undefined);
        }}
      />
      {exit.dialog}
    </>
  );
}
export default function NewUpdate() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Composer key={`${session?.user.id}:${epoch}`} />
    </RequireAuth>
  );
}
