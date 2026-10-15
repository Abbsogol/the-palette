import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image, type ImageSource } from "expo-image";
import {
  Button,
  Card,
  Chips,
  Empty,
  Notice,
  styles,
} from "../secondary/primitives";
import { LabSheet } from "../lab-ui/primitives";
import { useSubmission } from "../secondary/use-submission";
import { accountScope } from "../../lib/account-scope";
import type { DraftStatus } from "../secondary/profile-exit";
export type PortfolioFilter = "All" | "Published" | "Drafts";
export type PortfolioItem = {
  id: string;
  title: string;
  image: ImageSource | string | number | null;
  published: boolean;
  shape?: string | null;
  length?: string | null;
  category?: string | null;
};
export type UploadAllowance = {
  used: number;
  limit: number | null;
  remaining: number | null;
  resetsAt: string | null;
};
export function Allowance({
  value,
  error,
  onRetry,
}: {
  value?: UploadAllowance;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <Text style={styles.tag}>PHOTO-DESIGN ALLOWANCE</Text>
      {error ? (
        <>
          <Notice error>
            Couldn’t check your upload allowance. Your existing designs are
            still available.
          </Notice>
          {onRetry && (
            <Button
              title="Retry upload allowance"
              secondary
              onPress={onRetry}
            />
          )}
        </>
      ) : !value ? (
        <Text style={styles.muted}>Checking upload allowance…</Text>
      ) : (
        <>
          <Text style={styles.subtitle}>
            {value.limit === null
              ? "No weekly photo-design cap"
              : `${value.remaining} of ${value.limit} new photo designs left`}
          </Text>
          <Text style={styles.muted}>
            Saving a new photo design, including a private draft, uses one
            upload. Editing an existing design does not. Lab generations follow
            their own credit rules.
          </Text>
          {value.resetsAt && (
            <Text style={styles.small}>
              Allowance resets {new Date(value.resetsAt).toLocaleString()}.
            </Text>
          )}
          {value.remaining === 0 && (
            <Notice>
              Your allowance is used. You can still edit, publish or delete
              designs you already saved.
            </Notice>
          )}
        </>
      )}
    </Card>
  );
}
function PortfolioTile({
  item,
  onView,
  disabled,
}: {
  item: PortfolioItem;
  onView: () => void;
  disabled: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${item.title}`}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onView}
      style={{ gap: 10 }}
    >
      {item.image && !failed ? (
        <Image
          key={JSON.stringify(item.image)}
          source={item.image}
          contentFit="cover"
          cachePolicy="none"
          style={{ width: "100%", aspectRatio: 1.15, borderRadius: 20 }}
          accessibilityLabel={`${item.title} cover`}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={{ minHeight: 100, justifyContent: "center" }}>
          <Text style={styles.muted}>
            Photo preview unavailable. Your design details are kept.
          </Text>
        </View>
      )}
      <Text accessibilityRole="header" style={styles.subtitle}>
        {item.title}
      </Text>
    </Pressable>
  );
}
export function PortfolioManager({
  items,
  filter,
  onFilter,
  onUpload,
  onEdit,
  onView,
  onDelete,
  loading = false,
  error,
  onRetry,
  hasMore,
  onMore,
  allowance,
  allowanceError,
  onRetryAllowance,
  onStatusChange,
}: {
  items: PortfolioItem[];
  filter: PortfolioFilter;
  onFilter: (filter: PortfolioFilter) => void;
  onUpload: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onDelete: (item: PortfolioItem) => Promise<void>;
  loading?: boolean;
  error?: unknown;
  onRetry: () => void;
  hasMore?: boolean;
  onMore?: () => void;
  allowance?: UploadAllowance;
  allowanceError?: unknown;
  onRetryAllowance?: () => void;
  onStatusChange?: (status: DraftStatus) => void;
}) {
  const [confirmation, setConfirmation] = useState<PortfolioItem | null>(null),
    [notice, setNotice] = useState("");
  const work = useSubmission();
  useEffect(() => {
    onStatusChange?.({ dirty: false, busy: work.busy });
  }, [work.busy, onStatusChange]);
  useEffect(
    () => () => onStatusChange?.({ dirty: false, busy: false }),
    [onStatusChange],
  );
  return (
    <>
      <Card>
        <Text style={styles.tag}>YOUR DESIGN LIBRARY</Text>
        <Text style={styles.subtitle}>Create it. Keep it. Share it.</Text>
        <Text style={styles.muted}>
          Upload your own nail photos or manage saved Lab designs. Add the
          details your nail tech needs to recreate each set.
        </Text>
        <Button
          title="Upload a design"
          disabled={work.busy || allowance?.remaining === 0}
          onPress={onUpload}
        />
      </Card>
      <Allowance
        value={allowance}
        error={allowanceError}
        onRetry={onRetryAllowance}
      />
      <Chips
        values={["All", "Published", "Drafts"]}
        value={filter}
        onChange={(v) => onFilter(v as PortfolioFilter)}
        disabled={work.busy}
      />
      {notice && <Notice>{notice}</Notice>}
      {loading && (
        <ActivityIndicator
          color="white"
          accessibilityLabel="Loading my designs"
        />
      )}
      {!!error && (
        <>
          <Notice error>
            Couldn’t refresh your designs. Retry to see the latest saved
            versions.
          </Notice>
          <Button title="Retry my designs" secondary onPress={onRetry} />
        </>
      )}
      {!loading && !error && !items.length && (
        <Empty
          title={
            filter === "All"
              ? "Your first design"
              : `No ${filter.toLowerCase()} yet`
          }
          detail="Add a photo and save it privately, or publish it with the specifications that help someone recreate it."
        />
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <Text style={styles.tag}>
            {item.published ? "PUBLISHED" : "PRIVATE DRAFT"}
          </Text>
          <PortfolioTile
            key={JSON.stringify(item.image)}
            item={item}
            disabled={work.busy}
            onView={() => onView(item.id)}
          />
          <Text style={styles.muted}>
            {[item.shape, item.length, item.category]
              .filter(Boolean)
              .join(" · ") || "Add specifications in the editor"}
          </Text>
          <Text style={styles.small}>
            {item.published
              ? "Listed on your profile, subject to your privacy settings."
              : "Not listed on your public profile. You can still share it with your nail tech."}
          </Text>
          <Button
            title={`Edit ${item.title}`}
            secondary
            disabled={work.busy}
            onPress={() => onEdit(item.id)}
          />
          <Button
            title={`Delete ${item.title}`}
            secondary
            disabled={work.busy}
            onPress={() => {
              setNotice("");
              work.clearError();
              setConfirmation(item);
            }}
          />
        </Card>
      ))}
      {hasMore && onMore && (
        <Button
          title="Load more designs"
          secondary
          disabled={loading || work.busy}
          onPress={onMore}
        />
      )}
      <LabSheet
        title="Delete design?"
        visible={!!confirmation}
        onClose={() => {
          if (!work.busy) setConfirmation(null);
        }}
      >
        <Text style={styles.subtitle}>{confirmation?.title}</Text>
        <Text style={styles.text}>
          This permanently removes the design and its specifications. Shared
          links will no longer open it. This cannot be undone.
        </Text>
        {!!work.error && <Notice error>{work.error}</Notice>}
        <Button
          title="Confirm delete design"
          busy={work.busy}
          onPress={() =>
            void work.run(async () => {
              if (!confirmation) return;
              const ticket = accountScope.capture();
              await onDelete(confirmation);
              accountScope.assert(ticket);
              setConfirmation(null);
              setNotice("Design removed. Shared links will no longer open it.");
            })
          }
        />
        <Button
          title="Keep design"
          secondary
          disabled={work.busy}
          onPress={() => setConfirmation(null)}
        />
      </LabSheet>
    </>
  );
}
