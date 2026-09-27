import { useState } from "react";
import { Alert } from "react-native";
import { Image } from "expo-image";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Chips,
  Field,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
} from "../components/ui";
import { useAccountQuery, useAuth, queryClient } from "../lib/auth";
import { api, checked } from "../lib/api";
import { chooseAndUpload } from "../lib/upload";
import { resolvePrivateImage } from "../lib/designs";
import { supabase } from "../lib/supabase";
import type { Design } from "../lib/types";
function Form({ design }: { design?: Design }) {
  const [id] = useState(design?.id || Crypto.randomUUID()),
    [title, setTitle] = useState(design?.title || ""),
    [description, setDescription] = useState(design?.description || ""),
    [shape, setShape] = useState(design?.shape || "Almond"),
    [length, setLength] = useState(design?.length || "Medium"),
    [category, setCategory] = useState(design?.category || "Minimal"),
    [image, setImage] = useState<{ path: string; previewUrl: string } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async (isPublished: boolean) => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ designId: string }>("/mobile/portfolio", {
        id,
        create: !design,
        title,
        description,
        shape,
        length,
        category,
        isPublished,
        imagePath: image?.path,
      });
      await queryClient.invalidateQueries();
      router.replace({
        pathname: "/design/[id]",
        params: { id: result.designId },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {(image?.previewUrl || design?.image_url) && (
        <Image
          source={image?.previewUrl || design?.image_url}
          style={{ height: 280, borderRadius: 24 }}
          contentFit="contain"
          cachePolicy="none"
        />
      )}
      <Button
        title={image || design ? "Choose another photo" : "Choose photo"}
        secondary
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setError("");
          void chooseAndUpload("design")
            .then(setImage)
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      />
      <Field
        label="Design title"
        value={title}
        onChangeText={setTitle}
        maxLength={150}
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
      />
      <Chips
        label="Shape"
        values={["Almond", "Oval", "Square", "Coffin", "Stiletto", "Round"]}
        value={shape}
        onChange={setShape}
      />
      <Chips
        label="Length"
        values={["Short", "Medium", "Long", "Extra Long"]}
        value={length}
        onChange={setLength}
      />
      <Chips
        label="Style"
        values={["Minimal", "Dark", "Glam", "Y2K", "Bridal", "Floral"]}
        value={category}
        onChange={setCategory}
      />
      <Button
        title="Publish design"
        busy={busy}
        onPress={() => void save(true)}
      />
      <Button
        title="Save private draft"
        secondary
        disabled={busy}
        onPress={() => void save(false)}
      />
      {design && (
        <Button
          title="Delete design"
          secondary
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Delete design?",
              "It will disappear from your portfolio. Its uploaded images will be queued for cleanup.",
              [
                { text: "Keep", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    setBusy(true);
                    void api("/mobile/portfolio", { id }, "DELETE")
                      .then(() => {
                        void queryClient.invalidateQueries();
                        router.replace("/portfolio");
                      })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  },
                },
              ],
            )
          }
        />
      )}{" "}
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
function Editor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const query = useAccountQuery(
    ["edit-design", id],
    async () => {
      const d = await checked<Design | null>(
        supabase
          .from("designs")
          .select("*")
          .eq("id", id!)
          .eq("created_by", session!.user.id)
          .single(),
      );
      return { ...d, image_url: await resolvePrivateImage(d.image_url) };
    },
    !!id,
  );
  if (!id) return <Form />;
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    >
      {query.data && <Form design={query.data} />}
    </QueryState>
  );
}
export default function PortfolioEdit() {
  return (
    <Screen title="Your design" back>
      <RequireAuth>
        <Editor />
      </RequireAuth>
    </Screen>
  );
}
