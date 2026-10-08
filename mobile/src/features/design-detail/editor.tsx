import { useEffect, useState, type SetStateAction } from "react";
import { View, Text } from "react-native";
import { Image, type ImageSource } from "expo-image";
import {
  Button,
  Card,
  Field,
  Section,
  Chips,
  Notice,
  styles,
} from "../secondary/primitives";
import { useSubmission } from "../secondary/use-submission";
import type { DraftStatus } from "../secondary/profile-exit";
import { accountScope } from "../../lib/account-scope";
import { LabSheet } from "../lab-ui/primitives";
import { Allowance, type UploadAllowance } from "../portfolio/manager";
export type DesignPhoto = {
  value: string;
  preview: ImageSource | string | number;
};
export type DesignColourDraft = {
  colour_name: string;
  hex_code: string;
  brand_name: string;
  brand_code: string;
};
export type DesignDraft = {
  title: string;
  description: string;
  shape: string;
  length: string;
  category: string;
  technique: string;
  occasion: string;
  tags: string;
  colours: DesignColourDraft[];
  photos: DesignPhoto[];
};
export const emptyDesign: DesignDraft = {
  title: "",
  description: "",
  shape: "",
  length: "",
  category: "",
  technique: "",
  occasion: "",
  tags: "",
  colours: [],
  photos: [],
};
function PhotoPreview({ photo, index }: { photo: DesignPhoto; index: number }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <View style={{ minHeight: 120, justifyContent: "center" }}>
      <Text style={styles.muted}>
        Photo {index + 1} preview unavailable. Your details are kept; you can
        replace or remove this photo.
      </Text>
    </View>
  ) : (
    <Image
      source={photo.preview}
      cachePolicy="none"
      style={{ width: "100%", aspectRatio: 1, borderRadius: 20 }}
      contentFit="cover"
      onError={() => setFailed(true)}
      accessibilityLabel={
        index === 0 ? "Design cover preview" : `Close-up ${index + 1}`
      }
    />
  );
}
export function DesignEditor({
  initial,
  onPick,
  onSave,
  onPreview,
  onDelete,
  initialPublished = false,
  imageLocked = false,
  onStatusChange,
  onOpenSaved,
  allowance,
  allowanceError,
  onRetryAllowance,
}: {
  initial?: Partial<DesignDraft>;
  onPick: (
    onStage?: (stage: "choosing" | "uploading") => void,
  ) => Promise<DesignPhoto | null>;
  onSave: (
    draft: DesignDraft,
    published: boolean,
  ) => Promise<void | DesignDraft>;
  onPreview?: (draft: DesignDraft) => void;
  onDelete?: () => Promise<void>;
  initialPublished?: boolean;
  imageLocked?: boolean;
  onStatusChange?: (status: DraftStatus) => void;
  onOpenSaved?: () => void;
  allowance?: UploadAllowance;
  allowanceError?: unknown;
  onRetryAllowance?: () => void;
}) {
  const [d, setDraft] = useState<DesignDraft>({ ...emptyDesign, ...initial });
  const snapshot = JSON.stringify({
    ...d,
    photos: d.photos.map((p) => p.value),
  });
  const [baseline, setBaseline] = useState(snapshot);
  const [published, setPublished] = useState(initialPublished);
  const [notice, setNotice] = useState("");
  const [photoStage, setPhotoStage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!initial);
  const set = (update: SetStateAction<DesignDraft>) => {
    setNotice("");
    setDraft(update);
  };
  const work = useSubmission();
  const dirty = snapshot !== baseline;
  useEffect(() => {
    onStatusChange?.({ dirty, busy: work.busy });
  }, [dirty, work.busy, onStatusChange]);
  useEffect(
    () => () => onStatusChange?.({ dirty: false, busy: false }),
    [onStatusChange],
  );
  const field = (
    key: keyof Pick<
      DesignDraft,
      | "title"
      | "description"
      | "shape"
      | "length"
      | "category"
      | "technique"
      | "occasion"
      | "tags"
    >,
  ) => ({
    value: d[key],
    onChangeText: (v: string) => set((s) => ({ ...s, [key]: v })),
    editable: !work.busy,
  });
  const save = (published: boolean) =>
    void work.run(async () => {
      if (!d.title.trim() || !d.photos.length)
        throw new Error("Add a title and at least one photo.");
      if (d.photos.length > 8 || d.colours.length > 12)
        throw new Error("Choose up to 8 photos and 12 colours.");
      const tags = d.tags.split(/[\s,]+/).filter(Boolean);
      if (tags.length > 20 || tags.some((t) => !/^#?[a-z\d_]{1,40}$/i.test(t)))
        throw new Error(
          "Use up to 20 tags, each with 1–40 letters, numbers or underscores.",
        );
      if (
        published &&
        (!d.description.trim() || !d.shape || !d.length || !d.technique.trim())
      )
        throw new Error(
          "Add a description, shape, length and technique before publishing.",
        );
      if (
        d.colours.some(
          (c) =>
            !c.colour_name.trim() ||
            (c.hex_code && !/^#[a-f\d]{6}$/i.test(c.hex_code)),
        )
      )
        throw new Error(
          "Check each colour name and hex code. Leave unknown codes blank.",
        );
      const ticket = accountScope.capture();
      const saved = await onSave(d, published);
      accountScope.assert(ticket);
      if (saved) setDraft(saved);
      setBaseline(
        saved
          ? JSON.stringify({
              ...saved,
              photos: saved.photos.map((p) => p.value),
            })
          : snapshot,
      );
      setPublished(published);
      setHasSaved(true);
      setNotice(
        published
          ? "Design published. It follows your profile’s privacy settings."
          : "Private draft saved. It is not listed on your public profile.",
      );
    });
  return (
    <>
      <Card>
        <Text style={styles.tag}>
          {hasSaved
            ? published
              ? "PUBLISHED DESIGN"
              : "PRIVATE DRAFT"
            : "NEW DESIGN"}
        </Text>
        <Text style={styles.subtitle}>
          {hasSaved ? "Refine your design" : "Your next set, in detail"}
        </Text>
        <Text style={styles.muted}>
          A private draft stays off your public profile. Publishing makes this
          design discoverable according to your profile’s privacy settings. Both
          can be shared with your nail tech.
        </Text>
      </Card>
      {(allowance || allowanceError || onRetryAllowance) && (
        <Allowance
          value={allowance}
          error={allowanceError}
          onRetry={onRetryAllowance}
        />
      )}
      <Text style={styles.muted}>
        Make your design easy to recreate. These details appear on its design
        page and when you share it with your nail tech.
      </Text>
      <Section
        title="Photos & close-ups"
        subtitle={imageLocked ? "Generated images are final. You can add publishing details; a different image requires a new generation." : `The first photo is your cover. ${d.photos.length}/8 photos · each image must be smaller than 8 MB.`}
      >
        <View style={styles.wrap}>
          {d.photos.map((p, i) => (
            <View key={`${p.value}-${i}`} style={{ width: "47%", gap: 8 }}>
              <PhotoPreview
                key={JSON.stringify(p.preview)}
                photo={p}
                index={i}
              />
              <Text style={styles.small}>
                {i === 0 ? "COVER" : `CLOSE-UP ${i + 1}`}
              </Text>
              {i > 0 && (
                <Button
                  title={`Make photo ${i + 1} cover`}
                  disabled={imageLocked || work.busy}
                  secondary
                  onPress={() =>
                    set((s) => ({
                      ...s,
                      photos: [
                        s.photos[i],
                        ...s.photos.filter((_, n) => n !== i),
                      ],
                    }))
                  }
                />
              )}
              <Button
                title={i === 0 ? "Remove cover" : `Remove photo ${i + 1}`}
                secondary
                disabled={imageLocked || work.busy}
                onPress={() =>
                  set((s) => ({
                    ...s,
                    photos: s.photos.filter((_, n) => n !== i),
                  }))
                }
              />
            </View>
          ))}
        </View>
        <Button
          title={d.photos.length ? "Add a close-up" : "Choose design photo"}
          secondary
          disabled={imageLocked || work.busy || d.photos.length >= 8}
          onPress={() =>
            void work.run(async () => {
              const ticket = accountScope.capture();
              setPhotoStage("choosing");
              try {
                const photo = await onPick((stage) => {
                  if (accountScope.isCurrent(ticket)) setPhotoStage(stage);
                });
                accountScope.assert(ticket);
                if (photo) set((s) => ({ ...s, photos: [...s.photos, photo] }));
              } finally {
                if (accountScope.isCurrent(ticket)) setPhotoStage("");
              }
            })
          }
        />
        {!!photoStage && (
          <Notice>
            {photoStage === "uploading"
              ? "Uploading photo… Your other photos and details are kept."
              : "Opening your photo library…"}
          </Notice>
        )}
        {d.photos.length === 8 && (
          <Notice>Photo limit reached. Remove a photo to add another.</Notice>
        )}
      </Section>
      <Card>
        <Field
          label="Design title"
          {...field("title")}
          maxLength={150}
          placeholder="Give your design a name"
        />
        <Field
          label="Description"
          {...field("description")}
          multiline
          maxLength={2000}
          placeholder="Finish, details and inspiration…"
        />
      </Card>
      <Section title="Technique">
        <Card>
          <Chips
            label="Shape"
            values={["Almond", "Oval", "Square", "Coffin", "Stiletto", "Round"]}
            value={d.shape}
            onChange={(v) => set((s) => ({ ...s, shape: v }))}
            disabled={work.busy}
          />
          <Chips
            label="Length"
            values={["Short", "Medium", "Long", "Extra Long"]}
            value={d.length}
            onChange={(v) => set((s) => ({ ...s, length: v }))}
            disabled={work.busy}
          />
          <Field
            label="Material & techniques"
            {...field("technique")}
            maxLength={120}
            placeholder="Gel, 3D gel, chrome…"
          />
          <Field
            label="Style"
            {...field("category")}
            maxLength={80}
            placeholder="Gothic, minimal, bridal…"
          />
          <Field
            label="Occasion"
            {...field("occasion")}
            maxLength={80}
            placeholder="Everyday, editorial, wedding…"
          />
        </Card>
      </Section>
      <Section
        title="Colour Specs"
        subtitle="Add only colours and products you know. AI images do not identify an exact brand or shade."
      >
        {d.colours.map((c, i) => (
          <Card key={i}>
            {(
              ["colour_name", "hex_code", "brand_name", "brand_code"] as const
            ).map((key, n) => (
              <Field
                key={key}
                label={`${["Colour name", "Hex code", "Brand (optional)", "Shade code (optional)"][n]} ${i + 1}`}
                value={c[key]}
                maxLength={key === "hex_code" ? 7 : 100}
                autoCapitalize={key === "hex_code" ? "characters" : "sentences"}
                placeholder={key === "hex_code" ? "#D8D4CC" : ""}
                editable={!work.busy}
                onChangeText={(v) =>
                  set((s) => ({
                    ...s,
                    colours: s.colours.map((x, j) =>
                      j === i ? { ...x, [key]: v } : x,
                    ),
                  }))
                }
              />
            ))}
            <Button
              title={`Remove colour ${i + 1}`}
              secondary
              disabled={work.busy}
              onPress={() =>
                set((s) => ({
                  ...s,
                  colours: s.colours.filter((_, j) => i !== j),
                }))
              }
            />
          </Card>
        ))}
        <Button
          title="Add colour"
          secondary
          disabled={work.busy || d.colours.length >= 12}
          onPress={() =>
            set((s) => ({
              ...s,
              colours: [
                ...s.colours,
                {
                  colour_name: "",
                  hex_code: "",
                  brand_name: "",
                  brand_code: "",
                },
              ],
            }))
          }
        />
      </Section>
      <Card>
        <Field
          label="Tags"
          {...field("tags")}
          maxLength={800}
          placeholder="#gothic #ivory #editorial"
          hint="Separate with spaces. Up to 20 tags; letters, numbers and underscores."
        />
      </Card>
      {!!work.error && !confirmDelete && <Notice error>{work.error}</Notice>}
      {dirty && (
        <Text accessibilityLiveRegion="polite" style={styles.small}>
          Unsaved changes
        </Text>
      )}
      {!!notice && <Notice>{notice}</Notice>}
      {onPreview && (
        <Button
          title="Preview design page"
          secondary
          disabled={work.busy || !d.photos.length}
          onPress={() => onPreview(d)}
        />
      )}
      <Button
        title="Publish design"
        busy={work.busy}
        onPress={() => save(true)}
      />
      <Button
        title="Save private design"
        secondary
        disabled={work.busy}
        onPress={() => save(false)}
      />
      {hasSaved && onOpenSaved && (
        <Button
          title="View saved design"
          secondary
          disabled={work.busy || dirty}
          onPress={onOpenSaved}
        />
      )}
      {onDelete && (
        <Button
          title="Delete design"
          secondary
          disabled={work.busy}
          onPress={() => {
            work.clearError();
            setConfirmDelete(true);
          }}
        />
      )}
      <LabSheet
        title="Delete design?"
        visible={confirmDelete}
        onClose={() => {
          if (!work.busy) setConfirmDelete(false);
        }}
      >
        <Text style={styles.subtitle}>{d.title || "Your design"}</Text>
        <Text style={styles.text}>
          This permanently removes the saved design and its specifications.
          Shared links will no longer open it. Unsaved edits will also be lost.
          This cannot be undone.
        </Text>
        {!!work.error && <Notice error>{work.error}</Notice>}
        <Button
          title="Confirm delete design"
          busy={work.busy}
          onPress={() =>
            void work.run(async () => {
              if (!onDelete) return;
              const ticket = accountScope.capture();
              await onDelete();
              accountScope.assert(ticket);
              setConfirmDelete(false);
            })
          }
        />
        <Button
          title="Keep design"
          secondary
          disabled={work.busy}
          onPress={() => setConfirmDelete(false)}
        />
      </LabSheet>
    </>
  );
}
export function draftDetail(d: DesignDraft, id = "preview-design") {
  return {
    id,
    title: d.title || "Your design",
    description: d.description,
    photos: d.photos.map((p, i) => ({ id: String(i), source: p.preview })),
    closeups: d.photos
      .slice(1)
      .map((p, i) => ({ id: `close-${i}`, source: p.preview })),
    techniques: [
      d.shape,
      d.length,
      ...d.technique.split(","),
      d.category,
      d.occasion,
    ]
      .map((s) => s.trim())
      .filter(Boolean),
    colours: d.colours.map((c, i) => ({
      id: String(i),
      name: [c.colour_name, c.brand_name].filter(Boolean).join(" · "),
      code: c.brand_code || c.hex_code,
      hex: c.hex_code,
    })),
    tags: d.tags
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, ""))
      .filter(Boolean),
    saves: 0,
  };
}
