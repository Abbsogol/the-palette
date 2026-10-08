import { accountScope } from "../../lib/account-scope";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Button,
  Card,
  Field,
  Notice,
  Row,
  Section,
  styles,
} from "./primitives";
import { useSubmission } from "./use-submission";
export function DeleteView({
  onDelete,
  onPolicy,
  onDone,
  onCancel,
  demo = false,
  onAppointments,
  onCredits,
  onSupport,
}: {
  onDelete: () => Promise<void>;
  onPolicy: () => void | Promise<void>;
  onDone: () => void;
  onCancel?: () => void;
  demo?: boolean;
  onAppointments?: () => void;
  onCredits?: () => void;
  onSupport?: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<"review" | "confirm" | "done">("review"),
    [word, setWord] = useState(""),
    [accepted, setAccepted] = useState(false);
  const submit = useSubmission();
  if (step === "done")
    return (
      <>
        <Card>
          <View style={styles.emblem}>
            <Text style={styles.arrow}>✓</Text>
          </View>
          <Text style={styles.heading}>
            {demo ? "Demo account closed" : "Account closed"}
          </Text>
          <Text style={styles.text}>
            Your account cannot be restored. Your profile is no longer available
            and your access has ended.
          </Text>
          <Text style={styles.muted}>
            File cleanup and any outstanding refunds continue separately.
            Limited records are retained only for the purposes explained in our
            privacy policy.
          </Text>
        </Card>
        <Button title="Return to Home" onPress={onDone} />
      </>
    );
  return (
    <>
      {demo && (
        <Notice>Design preview. This flow never deletes a real account.</Notice>
      )}
      {!!submit.error && <Notice error>{submit.error}</Notice>}
      <Card>
        <Text style={styles.tag}>PERMANENT · NO RESTORE OPTION</Text>
        <Text style={styles.heading}>Leave LaQue</Text>
        <Text style={styles.muted}>
          You can close your account at any time. Read what happens before you
          make this final decision.
        </Text>
      </Card>
      {step === "review" ? (
        <>
          <Section title="What happens immediately">
            <Card>
              <Text style={styles.text}>
                Your profile and designs are hidden, access ends, and you cannot
                restore this account.
              </Text>
              <Text style={styles.text}>
                Upcoming appointments are cancelled. Any full deposit refunds
                owed continue to be processed.
              </Text>
              <Text style={styles.text}>
                Your saves, collections and private content enter permanent
                deletion. Removing files may take additional processing time.
              </Text>
            </Card>
          </Section>
          <Section title="What may be kept">
            <Card>
              <Text style={styles.muted}>
                Limited records needed for payments, refunds, tax obligations or
                a specific legal claim may remain under restricted access for
                the periods explained in our privacy policy.
              </Text>
              <Text style={styles.small}>
                Recipients may retain messages or copies you shared. Google
                Calendar copies may need to be removed in Google. Historical
                store subscriptions must be cancelled with the billing provider.
              </Text>
              <Row
                title="Read our retention policy"
                onPress={() =>
                  void submit.run(async () => {
                    await onPolicy();
                  })
                }
              />
            </Card>
          </Section>
          <Section title="Bookings, refunds & purchases">
            <Card>
              <Text style={styles.muted}>
                You don’t need to wait for a refund to close your account.
                Cancellation and full deposit-refund obligations are recorded
                before closure is confirmed. Refunds and file cleanup continue
                separately.
              </Text>
              <Text style={styles.small}>
                You won’t be able to use unused Lab credits after closure. Any
                older recurring purchase must be cancelled with its original
                provider; closing LaQue does not cancel store billing.
              </Text>
              {onAppointments && (
                <Row
                  title="Review appointments & deposit refunds"
                  onPress={onAppointments}
                />
              )}
              {onCredits && (
                <Row title="Review Lab credit purchases" onPress={onCredits} />
              )}
              {onSupport && (
                <Row
                  title="Contact support about outstanding work"
                  onPress={() =>
                    void submit.run(async () => {
                      await onSupport?.();
                    })
                  }
                />
              )}
            </Card>
          </Section>
          <Button
            title="Continue to delete"
            onPress={() => setStep("confirm")}
          />
          <Button
            title="Keep my account"
            secondary
            onPress={onCancel || onDone}
          />
        </>
      ) : (
        <>
          <Section
            title="One final check"
            subtitle="This is permanent. There is no recovery period."
          >
            <Field
              label="Type DELETE to confirm"
              value={word}
              onChangeText={setWord}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!submit.busy}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted, disabled: submit.busy }}
              disabled={submit.busy}
              onPress={() => setAccepted(!accepted)}
              style={styles.row}
            >
              <Text style={[styles.chip, accepted && styles.selected]}>
                {accepted ? "✓" : "○"}
              </Text>
              <Text style={[styles.text, { flex: 1 }]}>
                I understand my account cannot be restored and limited records
                may be retained.
              </Text>
            </Pressable>
          </Section>
          {!!submit.error && (
            <Card>
              <Text style={styles.muted}>
                We haven’t confirmed closure yet. Retry or contact support. Your
                confirmation is kept so you can try again.
              </Text>
              {onSupport && (
                <Button
                  title="Contact support"
                  secondary
                  onPress={() =>
                    void submit.run(async () => {
                      await onSupport?.();
                    })
                  }
                />
              )}
              {onAppointments && (
                <Button
                  title="Review appointments & refunds"
                  secondary
                  onPress={onAppointments}
                />
              )}
            </Card>
          )}
          <Button
            title="Permanently delete account"
            disabled={word !== "DELETE" || !accepted}
            busy={submit.busy}
            onPress={() =>
              void submit.run(async () => {
                const ticket = accountScope.capture();
                await onDelete();
                if (accountScope.isCurrent(ticket)) setStep("done");
              })
            }
          />
          <Button
            title="Go back"
            secondary
            disabled={submit.busy}
            onPress={() => setStep("review")}
          />
        </>
      )}
    </>
  );
}
