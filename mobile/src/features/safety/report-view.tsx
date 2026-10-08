import { useState } from "react";
import { Text, View } from "react-native";
import {
  Button,
  Card,
  Chips,
  Field,
  Notice,
  Screen,
  styles,
} from "../secondary/primitives";
import { useSubmission } from "../secondary/use-submission";
import { accountScope } from "../../lib/account-scope";
import type { ReportTarget } from "./data";
const reasons = [
  "Harassment or bullying",
  "Inappropriate content",
  "Spam or scam",
  "Safety concern",
  "Other",
];
export function ReportView({
  target,
  onSubmit,
  onClose,
  onSafety,
  preview = false,
}: {
  target: ReportTarget | null;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
  onSafety?: () => void;
  preview?: boolean;
}) {
  const [category, setCategory] = useState(""),
    [details, setDetails] = useState(""),
    [sent, setSent] = useState(false);
  const work = useSubmission();
  const title =
    target?.type === "profile"
      ? "Report account"
      : target?.type === "message"
        ? "Report message"
        : "Report design";
  return (
    <Screen
      title={title}
      onBack={() => {
        if (!work.busy) onClose();
      }}
      resetScrollKey={sent ? "sent" : "form"}
    >
      {preview && (
        <Notice>Design preview. No report is sent to support.</Notice>
      )}
      {!target ? (
        <Card>
          <Text style={styles.subtitle}>This report link is unavailable</Text>
          <Text style={styles.muted}>
            Open the account, design or message again and choose Report from its
            options.
          </Text>
          <Button title="Go back" onPress={onClose} />
        </Card>
      ) : sent ? (
        <>
          <Card>
            <View style={styles.emblem}>
              <Text style={styles.arrow}>✓</Text>
            </View>
            <Text style={styles.heading}>
              {preview ? "Sample report received" : "Report received"}
            </Text>
            <Text style={styles.text}>
              {preview
                ? "This sample report stays in your preview. In the connected app, LaQue support reviews submitted reports."
                : "Thank you for letting us know. LaQue support will review your report."}
            </Text>
            <Text style={styles.muted}>
              The account won’t be told who submitted it. Reporting doesn’t
              block the account or cancel an appointment.
            </Text>
          </Card>
          <Button title="Done" onPress={onClose} />
          {onSafety && (
            <Button
              title="Privacy & blocked accounts"
              secondary
              onPress={onSafety}
            />
          )}
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.subtitle}>Help keep LaQue safe</Text>
            <Text style={styles.muted}>
              Choose what happened. Only add details relevant to this report.
              Your report goes to LaQue support.
            </Text>
          </Card>
          <Chips
            label="Reason for reporting"
            values={reasons}
            value={category}
            onChange={setCategory}
            disabled={work.busy}
          />
          <Field
            label={
              category === "Other"
                ? "What happened?"
                : "Additional details (optional)"
            }
            multiline
            value={details}
            onChangeText={setDetails}
            maxLength={1800}
            editable={!work.busy}
            hint={`${details.length}/1800 characters`}
            placeholder="Tell us what we should review…"
          />
          {!!work.error && <Notice error>{work.error}</Notice>}
          <Button
            title="Submit report"
            busy={work.busy}
            disabled={
              !category || (category === "Other" && details.trim().length < 3)
            }
            onPress={() =>
              void work.run(async () => {
                const ticket = accountScope.capture();
                await onSubmit(
                  `${category}${details.trim() ? ": " + details.trim() : ""}`,
                );
                accountScope.assert(ticket);
                setSent(true);
              })
            }
          />
          <Text style={styles.small}>
            If someone is in immediate danger, contact local emergency services.
            LaQue reports are reviewed by support.
          </Text>
        </>
      )}
    </Screen>
  );
}
