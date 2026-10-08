import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { MediaPermissionError } from "./media-permission";
import {
  Button,
  Card,
  Field,
  Notice,
  Screen,
  styles,
} from "../secondary/primitives";
import { accountScope } from "../../lib/account-scope";
import { useSubmission } from "../secondary/use-submission";
import { SocialMediaView, type SocialMedia } from "./media";
import { TagPeople, type TaggedPerson } from "./people";
export type SocialDraft = {
  caption: string;
  tags: string[];
  people: TaggedPerson[];
  media: SocialMedia[];
};
export function SocialComposer({
  kind,
  onClose,
  onPick,
  onPost,
  searchPeople,
  preview = false,
  onStatusChange,
  onRequestClose,
  onComplete,
}: {
  kind: "post" | "story";
  onClose: () => void;
  onPick: () => Promise<SocialMedia | null>;
  onPost: (d: SocialDraft, progress: (stage: string) => void) => Promise<void>;
  onStatusChange?: (status: { dirty: boolean; busy: boolean }) => void;
  onRequestClose?: () => void;
  onComplete?: () => void;
  searchPeople: (q: string, signal: AbortSignal) => Promise<TaggedPerson[]>;
  preview?: boolean;
}) {
  const [media, setMedia] = useState<SocialMedia[]>([]),
    [caption, setCaption] = useState(""),
    [tags, setTags] = useState(""),
    [people, setPeople] = useState<TaggedPerson[]>([]),
    [locked, setLocked] = useState(false),
    [discard, setDiscard] = useState(false),
    [stage, setStage] = useState(""),
    [posted, setPosted] = useState(false),
    [permissionDenied, setPermissionDenied] = useState(false);
  const work = useSubmission();
  const story = kind === "story";
  const dirty = !posted && !!(media.length || caption || tags || people.length);
  useEffect(() => {
    onStatusChange?.({ dirty, busy: work.busy });
  }, [dirty, work.busy, onStatusChange]);
  return (
    <Screen
      title={story ? "Your story" : "New community post"}
      resetScrollKey={`${discard ? "discard" : "compose"}:${permissionDenied ? "permission" : "ready"}`}
      onBack={() => {
        if (!work.busy) {
          if (onRequestClose) onRequestClose();
          else if (dirty) setDiscard(true);
          else onClose();
        }
      }}
      subtitle={
        story
          ? "Share a moment. Stories disappear after 24 hours."
          : "Share your latest set, a short video, or what inspires you."
      }
    >
      <Text style={styles.tag}>
        {preview ? "LOCAL PREVIEW · " : ""}
        {story ? "24-HOUR STORY" : "COMMUNITY POST"}
      </Text>
      <Text style={styles.small}>
        Visible to your profile’s audience. Blocks and private-profile settings
        apply.
      </Text>
      {discard && (
        <Card>
          <Text style={styles.subtitle}>Discard this {kind}?</Text>
          <Button title="Keep editing" onPress={() => setDiscard(false)} />
          <Button title="Discard" secondary onPress={onClose} />
        </Card>
      )}
      {permissionDenied && (
        <Card>
          <Text style={styles.subtitle}>Photo access is off</Text>
          <Notice error>
            {work.error ||
              "Allow photo access in Settings, then choose your photo or video again. Your draft stays here."}
          </Notice>
          {Platform.OS !== "web" && (
            <Button
              title="Open photo settings"
              secondary
              disabled={work.busy}
              onPress={() => void work.run(() => Linking.openSettings())}
            />
          )}
        </Card>
      )}
      {media.map((m, i) => (
        <View key={`${String(m.uri)}-${i}`} style={{ gap: 8 }}>
          <View
            style={{
              height: 360,
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: "#21090f",
            }}
          >
            <SocialMediaView media={m} />
          </View>
          <Button
            title={`Remove ${m.type === "video" ? "video" : "photo"} ${i + 1}`}
            secondary
            disabled={work.busy || locked}
            onPress={() => setMedia((v) => v.filter((_, j) => i !== j))}
          />
        </View>
      ))}
      <Button
        title={media.length ? "Add photo or video" : "Choose photo or video"}
        secondary
        disabled={work.busy || locked || media.length >= (story ? 1 : 8)}
        onPress={() =>
          void work.run(async () => {
            const ticket = accountScope.capture();
            setPermissionDenied(false);
            try {
              const m = await onPick();
              accountScope.assert(ticket);
              if (m) setMedia((v) => [...v, m]);
            } catch (error) {
              if (
                accountScope.isCurrent(ticket) &&
                error instanceof MediaPermissionError
              )
                setPermissionDenied(true);
              throw error;
            }
          })
        }
      />
      <Text style={styles.small}>
        Photos up to 8 MB · MP4/MOV videos up to 50 MB and 60 seconds
        {story ? "" : " · Up to 8 items"}
      </Text>
      <Card>
        <Field
          label="Caption"
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={story ? 500 : 2200}
          editable={!work.busy && !locked}
          placeholder="Tell the story behind this moment…"
        />
        <Field
          label="Hashtags"
          value={tags}
          onChangeText={setTags}
          maxLength={800}
          editable={!work.busy && !locked}
          placeholder="#nailart #newset"
        />
        <TagPeople
          value={people}
          onChange={setPeople}
          search={searchPeople}
          disabled={work.busy || locked}
        />
      </Card>
      {work.busy && !!stage && <Notice>{stage}</Notice>}
      {!!work.error && !permissionDenied && <Notice error>{work.error}</Notice>}
      {locked && !!work.error && (
        <Text style={styles.small}>
          Your upload is kept for this attempt. Retry checks whether it was
          already posted.
        </Text>
      )}
      <Button
        title={
          locked && work.error
            ? "Retry posting"
            : story
              ? "Share story"
              : "Share post"
        }
        busy={work.busy}
        onPress={() =>
          void work.run(async () => {
            if (!media.length)
              throw new Error("Choose a photo or video first.");
            const terms = [
              ...new Set(
                tags
                  .split(/[\s,]+/)
                  .map((t) => t.replace(/^#/, "").toLowerCase())
                  .filter(Boolean),
              ),
            ];
            if (
              terms.length > 20 ||
              terms.some((t) => !/^[a-z0-9_]{1,40}$/.test(t))
            )
              throw new Error(
                "Use up to 20 hashtags with letters, numbers and underscores.",
              );
            const ticket = accountScope.capture();
            setLocked(true);
            setStage("Preparing your upload…");
            await onPost(
              {
                caption: caption.trim(),
                tags: terms,
                people,
                media,
              },
              (next) => {
                if (accountScope.isCurrent(ticket)) setStage(next);
              },
            );
            accountScope.assert(ticket);
            setPosted(true);
            onComplete?.();
          })
        }
      />
    </Screen>
  );
}
