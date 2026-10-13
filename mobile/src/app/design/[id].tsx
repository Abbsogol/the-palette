import { useRef, useState } from "react";
import { Platform, Share, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useAccountQuery, useAuth, queryClient } from "../../lib/auth";
import { setSaved } from "../../lib/designs";
import { environment } from "../../lib/config";
import { accountScope } from "../../lib/account-scope";
import { loadDetail } from "../../features/design-detail/data";
import { DetailView } from "../../features/design-detail/detail-view";

export default function Details() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  // Route reuse must reset gallery, clipboard feedback and pending mutations.
  return <DesignDetails key={id} id={id} from={from} />;
}

function DesignDetails({ id, from }: { id: string; from?: string }) {
  const { session } = useAuth();
  const window = useWindowDimensions();
  const width =
    Platform.OS === "web" ? Math.min(393, window.width) : window.width;
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const design = useAccountQuery(["design-detail", id], (signal) =>
    loadDetail(id, signal),
  );
  const saved = useAccountQuery(
    ["saved-status", id],
    (signal) =>
      checked<{ id: string }[]>(
        supabase
          .from("saved_designs")
          .select("id")
          .eq("design_id", id)
          .eq("user_id", session!.user.id)
          .abortSignal(signal),
      ),
    !!session,
  );
  const requireSignIn = () => {
    if (session) return true;
    router.push({ pathname: "/auth", params: { returnTo: `/design/${id}` } });
    return false;
  };
  const save = async () => {
    if (!requireSignIn() || pending.current) return;
    const ticket = accountScope.capture();
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      let rows = saved.data;
      if (!rows || saved.error) {
        const refreshed = await saved.refetch();
        if (refreshed.error || !refreshed.data)
          throw new Error(
            "Saved status could not be checked. Please try again.",
          );
        rows = refreshed.data;
      }
      accountScope.assert(ticket);
      await setSaved(session!.user.id, id, !rows.length);
      accountScope.assert(ticket);
      await queryClient.invalidateQueries();
    } catch (e) {
      if (accountScope.isCurrent(ticket)) setError((e as Error).message);
    } finally {
      pending.current = false;
      if (accountScope.isCurrent(ticket)) setBusy(false);
    }
  };
  const record = design.data?.record;
  const share = async () => {
    if (!record) return;
    if (!record.is_published) {
      setError("Publish this design before sharing it.");
      return;
    }
    const ticket = accountScope.capture();
    try {
      await Share.share({
        message: `${record.title} · ${environment.apiUrl}/design/${id}`,
        url: `${environment.apiUrl}/design/${id}`,
      });
    } catch {
      if (accountScope.isCurrent(ticket))
        setError("Sharing is unavailable. Please try again.");
    }
  };
  const showTech = () => {
    if (requireSignIn())
      router.push({ pathname: "/share-design", params: { designId: id } });
  };
  const actions = record
    ? [
        {
          label: "Add to collection",
          onPress: () => {
            if (requireSignIn())
              router.push({
                pathname: "/collections",
                params: { designId: id },
              });
          },
        },
        {
          label: "View creator",
          onPress: () =>
            router.push({
              pathname: "/creator/[id]",
              params: { id: record.created_by },
            }),
        },
        {
          label: "Book this design",
          onPress: () => {
            if (requireSignIn())
              router.push({
                pathname: "/book/[id]",
                params: { id: record.created_by, designId: id },
              });
          },
        },
        ...(record.created_by === session?.user.id
          ? [
              {
                label: "Edit design",
                onPress: () =>
                  router.push({ pathname: "/portfolio-edit", params: { id } }),
              },
            ]
          : []),
        {
          label: "Report design",
          onPress: () => {
            if (requireSignIn())
              router.push({
                pathname: "/report",
                params: { targetType: "design", targetId: id },
              });
          },
        },
      ]
    : [];
  return (
    <View style={{ flex: 1, backgroundColor: "#21090f", alignItems: "center" }}>
      <View style={{ flex: 1, width }}>
        <DetailView
          key={design.data?.model.id || "loading"}
          width={width}
          design={design.data?.model}
          saved={!!saved.data?.length}
          saving={busy}
          loading={design.isPending}
          error={design.error?.message}
          actionError={error}
          selectedTab={typeof from === "string" ? from : "index"}
          onRetry={() => void design.refetch()}
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          onShare={() => void share()}
          onSave={() => void save()}
          onShowTech={showTech}
          actions={actions}
          onNavigate={(name) => {
            const routes = {
              index: "/",
              search: "/search",
              lab: "/lab",
              messages: "/messages",
              saved: "/saved",
              profile: "/profile",
            } as const;
            router.replace(routes[name as keyof typeof routes] || "/");
          }}
        />
      </View>
    </View>
  );
}
