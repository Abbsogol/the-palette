import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { randomUUID } from "expo-crypto";
import type { Service } from "../../lib/types";
import { accountScope } from "../../lib/account-scope";
import { LabSheet } from "../lab-ui/primitives";
import { Button, Card, Chips, Empty, Notice, Row, styles } from "./primitives";
import { ServiceForm, type ServiceDraft } from "./service-form";
import { ServicePricing } from "./service-pricing";
import { useSubmission } from "./use-submission";
import type { DraftStatus } from "./profile-exit";
export function ServiceManager({
  services,
  loading = false,
  error,
  onRetry,
  onSave,
  onVisibility,
  onHours,
  onLocation,
  onStatusChange,
  requestExit,
  onEditorChange,
}: {
  services: Service[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onSave: (
    draft: ServiceDraft,
    service: Service | undefined,
    draftId: string,
  ) => Promise<void>;
  onVisibility: (service: Service, active: boolean) => Promise<void>;
  onHours?: () => void;
  onLocation?: () => void;
  onStatusChange: (status: DraftStatus) => void;
  requestExit: (action: () => void) => void;
  onEditorChange?: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState<{
    service?: Service;
    id: string;
  } | null>(null);
  const [filter, setFilter] = useState("All");
  const [confirmation, setConfirmation] = useState<Service | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [errorFor, setErrorFor] = useState("");
  const submit = useSubmission();
  useEffect(() => {
    if (!editing) onStatusChange({ dirty: false, busy: submit.busy });
  }, [editing, submit.busy, onStatusChange]);
  const editingOpen = !!editing;
  useEffect(() => {
    onEditorChange?.(editingOpen);
  }, [editingOpen, onEditorChange]);
  const available = services.filter((s) => s.is_active).length;
  const listed = services.filter(
    (s) =>
      filter === "All" || (filter === "Available" ? s.is_active : !s.is_active),
  );
  if (editing)
    return (
      <>
        {!!error && (
          <Notice error>
            Couldn’t refresh your booking menu. Your edits are still here.
          </Notice>
        )}
        {!!error && onRetry && (
          <Button title="Retry services" secondary onPress={onRetry} />
        )}
        {editing.service && !editing.service.is_active && (
          <Notice>
            This service is hidden. Saving changes keeps it hidden until you
            show it in your booking menu.
          </Notice>
        )}
        {!editing.service && (
          <Notice>
            Your new service will be available to book after saving.
          </Notice>
        )}
        <ServiceForm
          key={editing.id}
          initial={editing.service}
          onStatusChange={onStatusChange}
          onCancel={() => requestExit(() => setEditing(null))}
          onSave={async (draft) => {
            const ticket = accountScope.capture();
            await onSave(draft, editing.service, editing.id);
            accountScope.assert(ticket);
            setMessage(
              editing.service
                ? "Service updated. Existing appointments keep their agreed terms."
                : "Service added to your booking menu.",
            );
            setEditing(null);
            setFilter(editing.service?.is_active === false ? "Hidden" : "All");
          }}
        />
      </>
    );
  return (
    <>
      <Card>
        <Text style={styles.tag}>YOUR BOOKING MENU · AED</Text>
        <Text accessibilityRole="header" style={styles.subtitle}>
          Treatments, made clear
        </Text>
        <Text style={styles.muted}>
          Set fixed prices and appointment durations. Clients see the total,
          deposit and remaining balance before requesting a booking.
        </Text>
        {!loading && !error && (
          <Text style={styles.label}>
            {available} available · {services.length - available} hidden
          </Text>
        )}
        {onHours && (
          <Row
            title="Working hours & time zone"
            detail="Choose when clients can book"
            onPress={onHours}
            disabled={submit.busy}
          />
        )}
        {onLocation && (
          <Row
            title="Service location"
            detail="Where appointments take place"
            onPress={onLocation}
            disabled={submit.busy}
          />
        )}
      </Card>
      {!!message && <Notice>{message}</Notice>}
      {loading && (
        <ActivityIndicator
          color="white"
          accessibilityLabel="Loading services"
        />
      )}
      {!!error && (
        <>
          <Notice error>
            Couldn’t load your booking menu. Try again to see the latest
            services.
          </Notice>
          {onRetry && (
            <Button title="Retry services" secondary onPress={onRetry} />
          )}
        </>
      )}
      {!loading && !error && (
        <>
          <Button
            title="Add a service"
            disabled={submit.busy}
            onPress={() => {
              setMessage("");
              setEditing({ id: randomUUID() });
            }}
          />
          {!!services.length && (
            <Chips
              values={["All", "Available", "Hidden"]}
              value={filter}
              onChange={setFilter}
              disabled={submit.busy}
            />
          )}
          {!listed.length && (
            <Empty
              title={
                services.length
                  ? `No ${filter.toLowerCase()} services`
                  : "Your first service"
              }
              detail={
                services.length
                  ? "Hidden services stay in your studio. Show them again when you’re ready to take new requests."
                  : "Add a treatment, duration and fixed price to build your booking menu."
              }
            />
          )}
          {listed.map((service) => (
            <Card key={service.id}>
              <Text style={styles.tag}>
                {service.is_active
                  ? "AVAILABLE TO BOOK"
                  : "HIDDEN FROM BOOKING"}
              </Text>
              <Text accessibilityRole="header" style={styles.subtitle}>
                {service.name}
              </Text>
              <Text style={styles.label}>
                {service.duration_minutes} min appointment
              </Text>
              {!!service.description && (
                <Text style={styles.muted}>{service.description}</Text>
              )}
              <ServicePricing
                price={service.price}
                deposit={service.deposit_amount}
              />
              <Text style={styles.small}>
                {service.is_active
                  ? "Clients can select this treatment in your booking menu."
                  : "Only you can see this in your studio. Existing appointments remain unchanged."}
              </Text>
              <Button
                title={`Edit ${service.name}`}
                secondary
                disabled={submit.busy}
                onPress={() => {
                  setMessage("");
                  setEditing({ service, id: service.id });
                }}
              />
              <Button
                title={
                  service.is_active
                    ? "Hide from booking menu"
                    : "Show in booking menu"
                }
                secondary
                disabled={submit.busy}
                onPress={() => {
                  setMessage("");
                  setErrorFor("");
                  setConfirmation(service);
                  setConfirmVisible(true);
                }}
              />
            </Card>
          ))}
        </>
      )}
      <LabSheet
        title={confirmation?.is_active ? "Hide service?" : "Show service?"}
        visible={confirmVisible}
        onClose={() => {
          if (!submit.busy) setConfirmVisible(false);
        }}
      >
        <Text style={styles.subtitle}>{confirmation?.name}</Text>
        <Text style={styles.text}>
          {confirmation?.is_active
            ? "Clients will no longer be able to request this treatment. Your existing appointments stay unchanged. You can show it again anytime."
            : "Clients will be able to request this treatment at its saved price, during your available hours."}
        </Text>
        {confirmation && (
          <ServicePricing
            price={confirmation.price}
            deposit={confirmation.deposit_amount}
          />
        )}
        {!!submit.error && confirmation?.id === errorFor && (
          <Notice error>{submit.error}</Notice>
        )}
        <Button
          title={confirmation?.is_active ? "Confirm hide" : "Confirm show"}
          busy={submit.busy}
          onPress={() =>
            void submit.run(async () => {
              if (!confirmation || !confirmVisible) return;
              const ticket = accountScope.capture(),
                active = !confirmation.is_active;
              setErrorFor(confirmation.id);
              await onVisibility(confirmation, active);
              accountScope.assert(ticket);
              setMessage(
                active
                  ? "Service is available to book again."
                  : "Service hidden. Existing appointments are unchanged.",
              );
              setConfirmVisible(false);
            })
          }
        />
        <Button
          title="Keep current visibility"
          secondary
          disabled={submit.busy}
          onPress={() => setConfirmVisible(false)}
        />
      </LabSheet>
    </>
  );
}
