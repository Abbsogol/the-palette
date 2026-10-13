import { useEffect, useState } from "react";
import { Modal, useWindowDimensions } from "react-native";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { RequireAuth, QueryState } from "../components/ui";
import { Screen, Notice, Button } from "../features/secondary/primitives";
import { useDraftExit } from "../features/secondary/profile-exit";
import {
  DesignEditor,
  draftDetail,
  type DesignDraft,
} from "../features/design-detail/editor";
import { DetailView } from "../features/design-detail/detail-view";
import { loadDetail } from "../features/design-detail/data";
import type { UploadAllowance } from "../features/portfolio/manager";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { accountScope } from "../lib/account-scope";
import { api } from "../lib/api";
import { chooseAndUpload } from "../lib/upload";
import { resolvePrivateImage } from "../lib/designs";
function Editor() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    { session } = useAuth();
  const [newId] = useState(() => Crypto.randomUUID()),
    [preview, setPreview] = useState<DesignDraft>(),
    [hasSaved, setHasSaved] = useState(!!id),
    [deleted, setDeleted] = useState(false);
  const exit = useDraftExit("Unsaved design changes"),
    navigation = useNavigation(),
    { width } = useWindowDimensions();
  usePreventRemove(
    !deleted && (exit.status.dirty || exit.status.busy),
    ({ data }) => exit.requestExit(() => navigation.dispatch(data.action)),
  );
  useEffect(() => {
    if (deleted) router.replace("/portfolio");
  }, [deleted]);
  const q = useAccountQuery(
    ["edit-design-details", id],
    async (signal) => {
      const result = await loadDetail(id!, signal, {
        allowUnavailablePhotos: true,
      });
      if (result.record.created_by !== session!.user.id)
        throw new Error("Only the owner can edit this design.");
      return result;
    },
    !!id,
  );
  const allowance = useAccountQuery(["portfolio-allowance"], () =>
    api<UploadAllowance>("/mobile/portfolio"),
  );
  const record = q.data?.record,
    model = q.data?.model;
  const initial =
    record && model
      ? {
          title: record.title,
          description: record.description || "",
          shape: record.shape || "",
          length: record.length || "",
          category: record.category || "",
          technique: record.technique || "",
          occasion: record.occasion || "",
          tags: model.tags.map((t) => "#" + t).join(" "),
          colours: [...(record.design_colours || [])]
            .sort((a, b) => a.colour_order - b.colour_order)
            .map((c) => ({
              colour_name: c.colour_name || "",
              hex_code: c.hex_code || "",
              brand_name: c.brand_name || "",
              brand_code: c.brand_code || "",
            })),
          photos: [
            record.image_url,
            ...[...(record.design_images || [])]
              .sort((a, b) => a.image_order - b.image_order)
              .map((i) => i.image_url),
          ]
            .filter((v, i, a): v is string => !!v && a.indexOf(v) === i)
            .map((value, i) => ({
              value,
              preview: model.photos[i]?.source || value,
            })),
        }
      : undefined;
  return (
    <Screen
      title={id ? "Edit design" : "New design"}
      onBack={() => router.back()}
    >
      <QueryState
        loading={!!id && q.isPending && !q.data}
        error={q.data ? null : q.error}
        retry={() => void q.refetch()}
      >
        {q.data && q.error && (
          <>
            <Notice error>
              Couldn’t refresh this design. Your edits are still here.
            </Notice>
            <Button
              title="Retry design"
              secondary
              onPress={() => void q.refetch()}
            />
          </>
        )}
        {(!id || initial) && !deleted && (
          <DesignEditor
            key={id || newId}
            initial={initial}
            initialPublished={record?.is_published}
            imageLocked={!!record?.source_generation_id}
            onStatusChange={exit.onStatusChange}
            onPreview={setPreview}
            allowance={allowance.data}
            allowanceError={allowance.error}
            onRetryAllowance={() => void allowance.refetch()}
            onOpenSaved={() =>
              router.push({
                pathname: "/design/[id]",
                params: { id: id || newId, from: "profile" },
              })
            }
            onDelete={
              hasSaved
                ? async () => {
                    const ticket = accountScope.capture();
                    await api(
                      "/mobile/portfolio",
                      { id: id || newId },
                      "DELETE",
                    );
                    accountScope.assert(ticket);
                    await queryClient.invalidateQueries();
                    accountScope.assert(ticket);
                    setDeleted(true);
                  }
                : undefined
            }
            onPick={async (onStage) => {
              const photo = await chooseAndUpload("design", undefined, onStage);
              return photo
                ? { value: photo.path, preview: photo.previewUrl }
                : null;
            }}
            onSave={async (d, published) => {
              const ticket = accountScope.capture();
              const result = await api<{ designId: string; images?: string[] }>(
                "/mobile/portfolio",
                {
                  ...d,
                  id: id || newId,
                  create: !id,
                  detailsVersion: 1,
                  isPublished: published,
                  images: d.photos.map((p) => p.value),
                  tags: d.tags.split(/[\s,]+/).filter(Boolean),
                },
              );
              accountScope.assert(ticket);
              setHasSaved(true);
              const photos = result.images
                ? await Promise.all(
                    result.images.map(async (value, i) => ({
                      value,
                      preview:
                        (await resolvePrivateImage(value).catch(
                          () => d.photos[i]?.preview || value,
                        )) || value,
                    })),
                  )
                : d.photos;
              accountScope.assert(ticket);
              await queryClient.invalidateQueries();
              accountScope.assert(ticket);
              return { ...d, photos };
            }}
          />
        )}
      </QueryState>
      {exit.dialog}
      <Modal visible={!!preview} onRequestClose={() => setPreview(undefined)}>
        {preview && (
          <DetailView
            width={Math.min(width, 520)}
            design={draftDetail(preview)}
            onBack={() => setPreview(undefined)}
            onRetry={() => {}}
            onShare={() => setPreview(undefined)}
            onSave={() => setPreview(undefined)}
            onShowTech={() => setPreview(undefined)}
            onNavigate={() => setPreview(undefined)}
            actionError="Preview · Save your design to share it."
          />
        )}
      </Modal>
    </Screen>
  );
}
export default function PortfolioEdit() {
  const { session, epoch } = useAuth(),
    { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <RequireAuth>
      <Editor
        key={(session?.user.id || "") + ":" + epoch + ":" + (id || "new")}
      />
    </RequireAuth>
  );
}
