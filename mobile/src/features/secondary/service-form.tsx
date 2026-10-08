import { useEffect, useState } from "react";
import type { Service } from "../../lib/types";
import { Button, Card, Chips, Field, Notice, styles } from "./primitives";
import { Text } from "react-native";
import { useSubmission } from "./use-submission";
import { parseServiceAmount, ServicePricing } from "./service-pricing";
import type { DraftStatus } from "./profile-exit";
export type ServiceDraft = Pick<
  Service,
  "name" | "description" | "price" | "deposit_amount" | "duration_minutes"
>;
export function ServiceForm({
  initial,
  onSave,
  onCancel,
  onStatusChange,
}: {
  initial?: ServiceDraft;
  onSave: (v: ServiceDraft) => Promise<void>;
  onCancel: () => void;
  onStatusChange?: (status: DraftStatus) => void;
}) {
  const [name, setName] = useState(initial?.name || ""),
    [description, setDescription] = useState(initial?.description || ""),
    [price, setPrice] = useState(initial ? String(initial.price) : ""),
    [deposit, setDeposit] = useState(
      initial ? String(initial.deposit_amount) : "0",
    ),
    [duration, setDuration] = useState(String(initial?.duration_minutes || 60));
  // A refetch must not change the baseline of an open draft.
  const [baseline] = useState({ name, description, price, deposit, duration });
  const submit = useSubmission();
  const dirty =
    name !== baseline.name ||
    description !== baseline.description ||
    price !== baseline.price ||
    deposit !== baseline.deposit ||
    duration !== baseline.duration;
  useEffect(() => {
    onStatusChange?.({ dirty, busy: submit.busy });
  }, [dirty, submit.busy, onStatusChange]);
  useEffect(
    () => () => onStatusChange?.({ dirty: false, busy: false }),
    [onStatusChange],
  );
  const p = parseServiceAmount(price),
    d = parseServiceAmount(deposit);
  return (
    <Card>
      <Text style={styles.tag}>
        {initial ? "EDIT YOUR TREATMENT" : "BUILD YOUR BOOKING MENU"}
      </Text>
      <Text accessibilityRole="header" style={styles.subtitle}>
        {initial ? "Edit service" : "New service"}
      </Text>
      <Text style={styles.muted}>
        Set one fixed price for this treatment. Updates apply to new requests;
        existing appointments keep their agreed terms.
      </Text>
      <Field
        label="Service name"
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!submit.busy}
        placeholder="e.g. Gel manicure"
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={1000}
        editable={!submit.busy}
        placeholder="What’s included?"
        hint="Optional. Help clients understand the treatment and finish."
      />
      <Field
        label="Duration (minutes)"
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
        editable={!submit.busy}
        hint="15–480 minutes, including any preparation or clean-up time."
      />
      <Chips
        label="Quick durations"
        values={["30 min", "60 min", "90 min", "120 min"]}
        value={`${duration} min`}
        disabled={submit.busy}
        onChange={(v) => setDuration(v.split(" ")[0])}
      />
      <Field
        label="Total price (AED)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        editable={!submit.busy}
        placeholder="0.00"
        hint="Enter the full service price, with up to two decimal places."
      />
      <Field
        label="Deposit (AED)"
        value={deposit}
        onChangeText={setDeposit}
        keyboardType="decimal-pad"
        editable={!submit.busy}
        hint="Part of the total, not an extra charge. Enter 0 for no deposit."
      />
      {p !== null && d !== null && d <= p && (
        <ServicePricing price={p} deposit={d} />
      )}
      {dirty && (
        <Text accessibilityLiveRegion="polite" style={styles.small}>
          Unsaved changes
        </Text>
      )}
      {!!submit.error && <Notice error>{submit.error}</Notice>}
      <Button
        title="Save service"
        busy={submit.busy}
        onPress={() =>
          void submit.run(async () => {
            if (!name.trim()) throw new Error("Enter a service name.");
            if (p === null)
              throw new Error(
                "Enter a total price in AED with up to two decimal places.",
              );
            if (d === null)
              throw new Error(
                "Enter a deposit in AED with up to two decimal places, or 0 for no deposit.",
              );
            if (d > p)
              throw new Error("The deposit cannot exceed the total price.");
            const m = Number(duration);
            if (
              !/^\d+$/.test(duration.trim()) ||
              !Number.isInteger(m) ||
              m < 15 ||
              m > 480
            )
              throw new Error(
                "Enter a duration between 15 and 480 whole minutes.",
              );
            await onSave({
              name: name.trim(),
              description: description.trim(),
              price: p,
              deposit_amount: d,
              duration_minutes: m,
            });
          })
        }
      />
      <Button
        title="Cancel editing"
        secondary
        disabled={submit.busy}
        onPress={onCancel}
      />
    </Card>
  );
}
