import { useState, type ComponentProps } from "react";
import { Text } from "react-native";
import { ProfileForm, type ProfileDraft } from "../secondary/profile-form";
import { Button, Card, Notice, styles } from "../secondary/primitives";
import { useSubmission } from "../secondary/use-submission";
import { accountScope } from "../../lib/account-scope";

type Props = Omit<
  ComponentProps<typeof ProfileForm>,
  "onboarding" | "onSave"
> & {
  onSave: ComponentProps<typeof ProfileForm>["onSave"];
  onContinue: (role: ProfileDraft["role"]) => Promise<void>;
  alreadyComplete?: boolean;
};
export function CompleteProfile({
  onSave,
  onContinue,
  alreadyComplete = false,
  ...props
}: Props) {
  const [completed, setCompleted] = useState(alreadyComplete);
  const [role, setRole] = useState<ProfileDraft["role"]>(
    props.initial?.role || "Customer",
  );
  const next = useSubmission();
  if (!completed)
    return (
      <ProfileForm
        {...props}
        onboarding
        onSave={async (draft, media) => {
          const ticket = accountScope.capture();
          await onSave(draft, media);
          accountScope.assert(ticket);
          setRole(draft.role);
          setCompleted(true);
        }}
      />
    );
  return (
    <>
      <Text style={styles.tag}>PROFILE COMPLETE</Text>
      <Card>
        <Text accessibilityRole="header" style={styles.subtitle}>
          You’re ready to explore
        </Text>
        <Text style={styles.text}>
          Your profile is set up. Find inspiration, save your favourites and
          connect with your nail community.
        </Text>
        {role === "Creator" && (
          <Text style={styles.muted}>
            Next, add your services, working hours and portfolio in Creator
            Studio to get ready for bookings.
          </Text>
        )}
      </Card>
      {!!next.error && <Notice error>{next.error}</Notice>}
      <Button
        title={
          role === "Creator" ? "Continue to Creator Studio" : "Explore LaQue"
        }
        busy={next.busy}
        onPress={() => void next.run(() => onContinue(role))}
      />
    </>
  );
}
