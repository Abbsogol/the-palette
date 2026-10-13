import { useEffect, useState } from "react";
import { Keyboard, Text } from "react-native";
import {
  Screen,
  Card,
  Field,
  Button,
  Notice,
  styles,
} from "../secondary/primitives";
import { LabSheet } from "../lab-ui/primitives";
import { useSubmission } from "../secondary/use-submission";
import { UpdateCard } from "./updates-view";
import type { HomeUpdate } from "./data";
import type { DraftStatus } from "../secondary/profile-exit";
import { accountScope } from "../../lib/account-scope";

export function UpdateComposer({
  onPublish,
  onClose,
  preview = false,
  author,
  onStatusChange,
}: {
  onPublish: (body: string) => Promise<void>;
  onClose: () => void;
  preview?: boolean;
  author?: Pick<HomeUpdate, "name" | "username" | "avatar">;
  onStatusChange?: (status: DraftStatus) => void;
}) {
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [discard, setDiscard] = useState(false);
  const submit = useSubmission();
  const [showPreview, setShowPreview] = useState(false);
  useEffect(
    () =>
      onStatusChange?.({
        dirty: !published && !!body.trim(),
        busy: submit.busy,
      }),
    [body, published, submit.busy, onStatusChange],
  );
  const card = (
    <UpdateCard
      post={{
        id: "composer-preview",
        creator_id: "self",
        name: author?.name || "You",
        username: author?.username,
        avatar: author?.avatar,
        body: body.trim(),
        created_at: new Date().toISOString(),
      }}
      own
      previewCard
      onProfile={() => undefined}
    />
  );
  const close = () => {
    if (submit.busy) return;
    if (!published && body.trim()) setDiscard(true);
    else onClose();
  };
  return (
    <Screen
      title={published ? "Update published" : "Create update"}
      onBack={close}
      resetScrollKey={
        published ? "published" : showPreview ? "preview" : "write"
      }
      subtitle={
        published
          ? "A new note for your circle."
          : "Share a little news, availability or inspiration."
      }
    >
      {published ? (
        <>
          <Card>
            <Text style={styles.subtitle}>Your update is ready</Text>
          </Card>
          {card}
          <Notice>
            {preview
              ? "Saved in this demo session only."
              : "Your update is now available in Updates. Your account privacy settings still apply."}
          </Notice>
          <Button title="Back to Updates" onPress={onClose} />
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.subtitle}>A note from you</Text>
            <Text style={styles.muted}>
              People who follow you can catch up here. Your account privacy
              settings apply.
            </Text>
          </Card>
          {!showPreview ? (
            <Field
              label="Your update"
              placeholder="What’s new in your nail world?"
              multiline
              maxLength={2200}
              value={body}
              editable={!submit.busy && submitted === null}
              onChangeText={setBody}
              style={{ minHeight: 200 }}
              hint={`${body.length} / 2,200`}
            />
          ) : (
            card
          )}
          <Button
            title={showPreview ? "Edit update" : "Preview update"}
            secondary
            disabled={!body.trim() || submit.busy}
            onPress={() => {
              Keyboard.dismiss();
              setShowPreview((value) => !value);
            }}
          />
          <Text style={styles.small}>
            For photos and videos, use Create post in Community.
          </Text>
          {preview && (
            <Notice>
              Demo only — this update will not be published to a real account.
            </Notice>
          )}
          {!!submit.error && (
            <>
              <Notice error>{submit.error}</Notice>
              <Text style={styles.small}>
                Your text is preserved. Retry checks the same update before
                publishing again.
              </Text>
            </>
          )}
          {submit.busy && <Notice>Publishing your update…</Notice>}
          <Button
            title={submit.error ? "Retry publish" : "Publish update"}
            busy={submit.busy}
            disabled={!body.trim() || body.length > 2200}
            onPress={() =>
              void submit.run(async () => {
                const ticket = accountScope.capture();
                const text = submitted ?? body.trim();
                setSubmitted(text);
                await onPublish(text);
                accountScope.assert(ticket);
                setPublished(true);
              })
            }
          />
        </>
      )}
      <LabSheet
        visible={discard}
        title={submitted ? "Leave this update?" : "Discard update?"}
        onClose={() => setDiscard(false)}
      >
        <Text style={styles.muted}>
          {submitted
            ? "Publishing may have reached the server. Check Updates before creating another copy."
            : "Your unfinished text will be lost."}
        </Text>
        <Button title="Keep writing" onPress={() => setDiscard(false)} />
        <Button
          title={submitted ? "Leave composer" : "Discard update"}
          secondary
          onPress={onClose}
        />
      </LabSheet>
    </Screen>
  );
}
