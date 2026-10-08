import { useState } from "react";
import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { RequireAuth } from "../components/ui";
import { Screen } from "../features/secondary/primitives";
import { useDraftExit } from "../features/secondary/profile-exit";
import {
  PortfolioManager,
  type PortfolioFilter,
  type UploadAllowance,
} from "../features/portfolio/manager";
import { loadPortfolio } from "../features/portfolio/data";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { api } from "../lib/api";
import { accountScope } from "../lib/account-scope";
function Portfolio() {
  const { session } = useAuth(),
    [limit, setLimit] = useState(20),
    [filter, setFilter] = useState<PortfolioFilter>("All");
  const exit = useDraftExit("My designs"),
    navigation = useNavigation();
  usePreventRemove(exit.status.busy, ({ data }) =>
    exit.requestExit(() => navigation.dispatch(data.action)),
  );
  const query = useAccountQuery(["portfolio", filter, limit], (signal) =>
    loadPortfolio(session!.user.id, filter, limit, signal),
  );
  const allowance = useAccountQuery(["portfolio-allowance"], () =>
    api<UploadAllowance>("/mobile/portfolio"),
  );
  return (
    <Screen title="My designs" onBack={() => router.back()}>
      <PortfolioManager
        items={query.data?.items || []}
        filter={filter}
        onFilter={(v) => {
          setFilter(v);
          setLimit(20);
        }}
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        hasMore={query.data?.hasMore}
        onMore={() => setLimit((v) => v + 20)}
        allowance={allowance.data}
        allowanceError={allowance.error}
        onRetryAllowance={() => void allowance.refetch()}
        onStatusChange={exit.onStatusChange}
        onUpload={() => router.push("/portfolio-edit")}
        onEdit={(id) =>
          router.push({ pathname: "/portfolio-edit", params: { id } })
        }
        onView={(id) =>
          router.push({
            pathname: "/design/[id]",
            params: { id, from: "profile" },
          })
        }
        onDelete={async (item) => {
          const ticket = accountScope.capture();
          await api("/mobile/portfolio", { id: item.id }, "DELETE");
          accountScope.assert(ticket);
          await queryClient.invalidateQueries();
          accountScope.assert(ticket);
        }}
      />
      {exit.dialog}
    </Screen>
  );
}
export default function PortfolioScreen() {
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      <Portfolio key={session?.user.id + ":" + epoch} />
    </RequireAuth>
  );
}
