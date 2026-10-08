import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useAccountQuery, useAuth } from "../lib/auth";
import { MessagesView } from "./messages-ui/messages-view";
import { loadInbox, inboxContact } from "./messages-ui/data";
export function Inbox() {
  const { session } = useAuth();
  const [limit, setLimit] = useState(30);
  const query = useAccountQuery(["inbox", limit], (signal) =>
    loadInbox(session!.user.id, limit, signal),
  );
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  return (
    <MessagesView
      contacts={(query.data ?? []).map((c) =>
        inboxContact(c, session!.user.id),
      )}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.error?.message}
      hasMore={query.data?.length === limit}
      onOpen={(id) =>
        router.push({ pathname: "/conversation/[id]", params: { id } })
      }
      onRefresh={() => void query.refetch()}
      onMore={() => setLimit((v) => v + 30)}
      onFind={() =>
        router.push({ pathname: "/search", params: { mode: "Artists" } })
      }
    />
  );
}
