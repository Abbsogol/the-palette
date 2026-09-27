import { useState } from "react";
import { Share, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Notice,
  QueryState,
  Screen,
  styles,
} from "../../components/ui";
import { checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useAccountQuery, useAuth, queryClient } from "../../lib/auth";
import { resolvePrivateImage, setSaved } from "../../lib/designs";
import { environment } from "../../lib/config";
import type { Design } from "../../lib/types";

export default function Details() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const design = useAccountQuery(["design", id], async (signal) => {
    const d = await checked<Design | null>(
      supabase
        .from("designs")
        .select("*")
        .eq("id", id)
        .abortSignal(signal)
        .single(),
    );
    return { ...d, image_url: await resolvePrivateImage(d.image_url) };
  });
  const saved = useAccountQuery(
    ["saved-status", id],
    () =>
      checked(
        supabase
          .from("saved_designs")
          .select("id")
          .eq("design_id", id)
          .eq("user_id", session!.user.id),
      ),
    !!session,
  );
  const requireSignIn = () => {
    if (session) return true;
    router.push({ pathname: "/auth", params: { returnTo: `/design/${id}` } });
    return false;
  };
  const save = async () => {
    if (!requireSignIn()) return;
    setBusy(true);
    setError("");
    try {
      await setSaved(session!.user.id, id, !saved.data?.length);
      await queryClient.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const d = design.data;
  return (
    <Screen back>
      <QueryState
        loading={design.isPending}
        error={design.error}
        retry={() => void design.refetch()}
      >
        {d && (
          <>
            <Image
              source={d.image_url}
              style={{ width: "100%", aspectRatio: 0.85, borderRadius: 28 }}
              contentFit="cover"
              cachePolicy="none"
              accessibilityLabel={d.title}
            />
            <Text accessibilityRole="header" style={styles.title}>
              {d.title}
            </Text>
            <Text style={styles.text}>{d.description}</Text>
            <Text style={styles.muted}>
              {[d.shape, d.length, d.category, d.technique, d.occasion]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Button
              title={saved.data?.length ? "Remove from saved" : "Save design"}
              busy={busy}
              onPress={() => void save()}
            />
            <View style={styles.row}>
              <Button
                title="Add to collection"
                secondary
                onPress={() => {
                  if (requireSignIn())
                    router.push({
                      pathname: "/collections",
                      params: { designId: id },
                    });
                }}
              />
              <Button
                title="Share"
                secondary
                onPress={() => {
                  if (d.is_published)
                    void Share.share({
                      message: `${d.title} · ${environment.apiUrl}/design/${id}`,
                      url: `${environment.apiUrl}/design/${id}`,
                    }).catch(() => setError("Sharing is unavailable."));
                  else setError("Publish this design before sharing it.");
                }}
              />
              <Button
                title="Send in message"
                secondary
                onPress={() => {
                  if (requireSignIn())
                    router.push({
                      pathname: "/share-design",
                      params: { designId: id },
                    });
                }}
              />
            </View>
            <Button
              title="View creator"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/creator/[id]",
                  params: { id: d.created_by },
                })
              }
            />
            <Button
              title="Book this design"
              onPress={() => {
                if (requireSignIn())
                  router.push({
                    pathname: "/book/[id]",
                    params: { id: d.created_by, designId: d.id },
                  });
              }}
            />
            {d.created_by === session?.user.id && (
              <Button
                title="Edit design"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/portfolio-edit",
                    params: { id: d.id },
                  })
                }
              />
            )}
            <Button
              title="Report design"
              secondary
              onPress={() => {
                if (requireSignIn())
                  router.push({
                    pathname: "/report",
                    params: { targetType: "design", targetId: id },
                  });
              }}
            />
          </>
        )}
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
