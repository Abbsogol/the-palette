import { useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { SocialComposer } from "./composer";
import { pickSocialMedia, postSocial, searchPeople } from "./data";
import { useDraftExit } from "../secondary/profile-exit";
import { useAuth, queryClient } from "../../lib/auth";
import { accountScope } from "../../lib/account-scope";
function Composer({ kind }: { kind: "post" | "story" }) {
  const [id] = useState(() => Crypto.randomUUID()),
    [complete, setComplete] = useState(false);
  const uploaded = useRef(new Map<string, string>()),
    navigation = useNavigation();
  const exit = useDraftExit(`Unsaved ${kind === "story" ? "story" : "post"}`);
  usePreventRemove(
    !complete && (exit.status.dirty || exit.status.busy),
    ({ data }) => exit.requestExit(() => navigation.dispatch(data.action)),
  );
  useEffect(() => {
    if (complete)
      router.replace(
        kind === "story"
          ? "/"
          : { pathname: "/community/[id]", params: { id } },
      );
  }, [complete, kind, id]);
  return (
    <>
      <SocialComposer
        kind={kind}
        onStatusChange={exit.onStatusChange}
        onRequestClose={() => router.back()}
        onComplete={() => setComplete(true)}
        onClose={() => router.back()}
        onPick={pickSocialMedia}
        searchPeople={searchPeople}
        onPost={async (d, progress) => {
          const ticket = accountScope.capture();
          await postSocial(kind, id, d, uploaded.current, progress);
          accountScope.assert(ticket);
          void queryClient.invalidateQueries();
        }}
      />
      {exit.dialog}
    </>
  );
}
export function ConnectedComposer({ kind }: { kind: "post" | "story" }) {
  const { session, epoch } = useAuth();
  return <Composer key={`${session?.user.id}:${epoch}:${kind}`} kind={kind} />;
}
