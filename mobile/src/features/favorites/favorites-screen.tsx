import { useCallback, useEffect, useRef } from "react";
import { router, useFocusEffect } from "expo-router";
import { RequireAuth } from "../../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../../lib/auth";
import { accountScope } from "../../lib/account-scope";
import { FavoritesView } from "./favorites-view";
import { changeFavorite, loadFavorites } from "./data";
import { emptyLibrary, type FavoriteAction } from "./model";
export type FavoritesScreenProps = {
  initialTab?: "designs" | "profiles";
  initialFolderId?: string;
  initialDesignId?: string;
  back?: boolean;
};
function Library(props: FavoritesScreenProps) {
  const { session } = useAuth();
  const userId = session!.user.id;
  const mounted = useRef(true),
    busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const query = useAccountQuery(["favorites-library"], (signal) =>
    loadFavorites(userId, signal),
  );
  const refetch = query.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const perform = async (action: FavoriteAction) => {
    if (busy.current) return false;
    const ticket = accountScope.capture();
    busy.current = true;
    try {
      await changeFavorite(userId, action);
      accountScope.assert(ticket);
      if (!mounted.current) return false;
      await queryClient.invalidateQueries();
      accountScope.assert(ticket);
      return mounted.current;
    } finally {
      busy.current = false;
    }
  };
  return (
    <FavoritesView
      {...props}
      library={query.data || emptyLibrary}
      loading={query.isPending}
      refreshing={query.isRefetching}
      error={query.error?.message}
      onRetry={() => void query.refetch()}
      onAction={perform}
      onDesign={(id) =>
        router.push({ pathname: "/design/[id]", params: { id } })
      }
      onProfile={(id) =>
        router.push({ pathname: "/creator/[id]", params: { id } })
      }
      onDiscover={(tab) =>
        router.push({
          pathname: "/search",
          params: { mode: tab === "profiles" ? "Artists" : "Designs" },
        })
      }
      onBack={props.back ? () => router.back() : undefined}
    />
  );
}
export default function FavoritesScreen(props: FavoritesScreenProps) {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Library key={`${session?.user.id}:${epoch}`} {...props} />
    </RequireAuth>
  );
}
