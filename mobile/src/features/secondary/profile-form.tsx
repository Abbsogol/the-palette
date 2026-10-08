import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Image, type ImageSource } from "expo-image";
import {
  Button,
  Card,
  Field,
  Notice,
  Section,
  Chips,
  styles,
} from "./primitives";
import {
  EligibilityConsent,
  emptyEligibility,
  eligibilityMessage,
} from "../welcome/eligibility";
import { useSubmission } from "./use-submission";
import { ProfileTags } from "./profile-tags";
import { accountScope } from "../../lib/account-scope";
export type ProfileEditStatus = { dirty: boolean; busy: boolean };
export type ProfileDraft = {
  display_name: string;
  username: string;
  location: string;
  bio: string;
  booking_area: string;
  role: "Customer" | "Creator";
  specialties?: string[];
  avatar_url?: string | null;
  banner_url?: string | null;
  age_confirmed?: boolean;
  privacy_accepted?: boolean;
};
export type ProfileProgress = { draft: ProfileDraft; step: 0 | 1 };
export function ProfileForm({
  initial,
  avatar,
  banner,
  onPick,
  onboarding = false,
  onSave,
  initialStep,
  onProgress,
  onStatusChange,
}: {
  initial?: Partial<ProfileDraft>;
  avatar?: ImageSource | string | number | null | undefined;
  banner?: ImageSource | string | number | null | undefined;
  onPick?: (kind: "avatar" | "banner") => Promise<{
    url: string;
    preview: ImageSource | string | number | null | undefined;
  } | null>;
  onboarding?: boolean;
  initialStep?: 0 | 1;
  onProgress?: (progress: ProfileProgress) => void;
  onStatusChange?: (status: ProfileEditStatus) => void;
  onSave: (
    value: ProfileDraft,
    media?: {
      avatar: ImageSource | string | number | null | undefined;
      banner: ImageSource | string | number | null | undefined;
    },
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProfileDraft>({
    display_name: "",
    username: "",
    location: "",
    bio: "",
    booking_area: "",
    role: "Customer",
    specialties: [],
    ...initial,
  });
  const [avatarSource, setAvatar] = useState(
      avatar === undefined ? initial?.avatar_url : avatar,
    ),
    [bannerSource, setBanner] = useState(
      banner === undefined ? initial?.banner_url : banner,
    );
  const [eligibility, setEligibility] = useState(emptyEligibility);
  const [step, setStep] = useState<0 | 1>(onboarding ? (initialStep ?? 0) : 1);
  useEffect(() => {
    if (onboarding) onProgress?.({ draft, step });
  }, [draft, step, onboarding, onProgress]);
  const submit = useSubmission();
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [saved, setSaved] = useState(false);
  const [pendingTag, setPendingTag] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline || pendingTag;
  useEffect(() => {
    onStatusChange?.({ dirty, busy: submit.busy });
  }, [dirty, submit.busy, onStatusChange]);
  const field = (
    key: "display_name" | "username" | "location" | "bio" | "booking_area",
  ) => ({
    value: draft[key],
    onChangeText: (value: string) => setDraft((d) => ({ ...d, [key]: value })),
    editable: !submit.busy,
  });
  return (
    <>
      {onboarding && (
        <>
          <Text style={styles.tag}>STEP {step + 1} OF 2 · YOUR PROFILE</Text>
          <Chips
            values={["Your world", "Your details"]}
            value={step ? "Your details" : "Your world"}
            onChange={(v) => setStep(v === "Your world" ? 0 : 1)}
            disabled={submit.busy}
          />
        </>
      )}
      {step === 0 ? (
        <>
          <Section
            title="Make it yours"
            subtitle="One account for inspiration, your designs and your next appointment."
          />
          {(["Customer", "Creator"] as const).map((role) => (
            <Card key={role}>
              <Text style={styles.subtitle}>
                {role === "Creator"
                  ? "I’m a nail artist"
                  : "I’m here for inspiration"}
              </Text>
              <Text style={styles.muted}>
                {role === "Creator"
                  ? "Publish a portfolio, set your services and welcome clients."
                  : "Discover designs, create in Nail Lab and book your next set."}
              </Text>
              <Button
                secondary={draft.role !== role}
                title={
                  draft.role === role
                    ? `${role} selected`
                    : `Choose ${role.toLowerCase()}`
                }
                onPress={() => setDraft((d) => ({ ...d, role }))}
              />
            </Card>
          ))}
          <Button title="Continue" onPress={() => setStep(1)} />
        </>
      ) : (
        <>
          <Section
            title="Your profile look"
            subtitle="Your photo appears on your profile, in chats and in Messages. Your banner adds a personal backdrop."
          >
            <View style={{ height: 226, marginBottom: 12 }}>
              <View
                style={{
                  height: 170,
                  borderRadius: 24,
                  overflow: "hidden",
                  backgroundColor: "#5e1730",
                  borderWidth: 1,
                  borderColor: "#ffffff30",
                }}
              >
                {bannerSource ? (
                  <Image
                    source={bannerSource}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    accessibilityLabel="Profile banner"
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text style={styles.muted}>Your banner</Text>
                  </View>
                )}
              </View>
              <View
                style={{
                  position: "absolute",
                  left: 20,
                  bottom: 0,
                  width: 106,
                  height: 106,
                  borderRadius: 53,
                  borderWidth: 4,
                  borderColor: "#340817",
                  overflow: "hidden",
                  backgroundColor: "#730c2b",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatarSource ? (
                  <Image
                    source={avatarSource}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    accessibilityLabel="Profile photo"
                  />
                ) : (
                  <Text style={[styles.heading, { flex: 0 }]}>
                    {draft.display_name.slice(0, 1) || "✦"}
                  </Text>
                )}
              </View>
            </View>
            {onPick && (
              <>
                {(["avatar", "banner"] as const).map((kind) => {
                  const source =
                    kind === "avatar" ? avatarSource : bannerSource;
                  const label = kind === "avatar" ? "profile photo" : "banner";
                  return (
                    <View key={kind} style={{ gap: 8 }}>
                      <Button
                        title={`${source ? "Change" : "Add"} ${label}`}
                        secondary
                        disabled={submit.busy}
                        onPress={() =>
                          void submit.run(async () => {
                            const ticket = accountScope.capture();
                            const image = await onPick(kind);
                            accountScope.assert(ticket);
                            if (image) {
                              if (kind === "avatar") setAvatar(image.preview);
                              else setBanner(image.preview);
                              setDraft((d) => ({
                                ...d,
                                [kind === "avatar"
                                  ? "avatar_url"
                                  : "banner_url"]: image.url,
                              }));
                            }
                          })
                        }
                      />
                      {(!!source ||
                        !!draft[
                          kind === "avatar" ? "avatar_url" : "banner_url"
                        ]) && (
                        <Button
                          title={`Remove ${label}`}
                          secondary
                          disabled={submit.busy}
                          onPress={() => {
                            if (kind === "avatar") setAvatar(null);
                            else setBanner(null);
                            setDraft((d) => ({
                              ...d,
                              [kind === "avatar" ? "avatar_url" : "banner_url"]:
                                null,
                            }));
                          }}
                        />
                      )}
                    </View>
                  );
                })}
                <Text style={styles.small}>
                  Changes are applied when you save. Removing a photo shows your
                  initial; removing a banner restores the LaQue background.
                </Text>
              </>
            )}
          </Section>
          <Section
            title="Public profile"
            subtitle={
              onboarding
                ? "Name, unique ID and city are required. Your bio and photos are optional."
                : "Choose what people see when they visit your profile."
            }
          >
            <Card>
              <Field
                label="Display name"
                {...field("display_name")}
                maxLength={80}
                autoComplete="name"
              />
              <Field
                label="Username"
                {...field("username")}
                maxLength={31}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="yourname"
                hint="Your unique @ID: 3–30 lowercase letters, numbers, dots or underscores. People can search and tag you."
              />
              <Field
                label="City / area"
                {...field("location")}
                maxLength={100}
                placeholder="Dubai, UAE"
              />
              <Field
                label="Bio"
                {...field("bio")}
                maxLength={1000}
                multiline
                placeholder="Your style, your inspiration, your story…"
                hint={`${draft.bio.length}/1000`}
              />
            </Card>
          </Section>
          <ProfileTags
            value={draft.specialties || []}
            creator={draft.role === "Creator"}
            disabled={submit.busy}
            onPendingChange={setPendingTag}
            onChange={(specialties) => setDraft((d) => ({ ...d, specialties }))}
          />
          {draft.role === "Creator" && (
            <Section
              title="Where you work"
              subtitle="Shown to clients before they request an appointment."
            >
              <Card>
                <Field
                  label="Service location"
                  {...field("booking_area")}
                  maxLength={300}
                  placeholder="Studio or service area"
                />
                <Text style={styles.small}>
                  Add your services and working hours next. Your profile alone
                  does not open appointment slots.
                </Text>
              </Card>
            </Section>
          )}
          {onboarding && (
            <EligibilityConsent
              value={eligibility}
              onChange={setEligibility}
              disabled={submit.busy}
            />
          )}
          {!!submit.error && <Notice error>{submit.error}</Notice>}
          {!onboarding && (
            <Notice>
              {dirty
                ? "You have unsaved changes. Save them before leaving."
                : saved
                  ? "Profile saved. Your changes are now visible on your profile."
                  : "Only saved changes appear on your profile."}
            </Notice>
          )}
          <Button
            title={onboarding ? "Finish my profile" : "Save changes"}
            busy={submit.busy}
            onPress={() =>
              void submit.run(async () => {
                const ticket = accountScope.capture();
                if (pendingTag)
                  throw new Error(
                    "Add your new tag or clear it before saving.",
                  );
                if (
                  onboarding &&
                  (!eligibility.ageConfirmed || !eligibility.privacyAccepted)
                )
                  throw new Error(eligibilityMessage);
                if (!draft.display_name.trim())
                  throw new Error("Enter your display name.");
                if (
                  !/^[a-z0-9_.]{3,30}$/.test(
                    draft.username.trim().replace(/^@/, "").toLowerCase(),
                  )
                )
                  throw new Error(
                    "Choose a unique ID with 3–30 letters, numbers, dots or underscores.",
                  );
                if (onboarding && !draft.location.trim())
                  throw new Error("Enter your city or area.");
                if (
                  onboarding &&
                  draft.role === "Creator" &&
                  !draft.booking_area.trim()
                )
                  throw new Error("Enter your studio or service area.");
                await onSave(
                  {
                    ...draft,
                    ...(onboarding
                      ? {
                          age_confirmed: eligibility.ageConfirmed,
                          privacy_accepted: eligibility.privacyAccepted,
                        }
                      : {}),
                    display_name: draft.display_name.trim(),
                    username: draft.username
                      .trim()
                      .replace(/^@/, "")
                      .toLowerCase(),
                    location: draft.location.trim(),
                    bio: draft.bio.trim(),
                    booking_area: draft.booking_area.trim(),
                  },
                  { avatar: avatarSource, banner: bannerSource },
                );
                accountScope.assert(ticket);
                setBaseline(JSON.stringify(draft));
                setSaved(true);
              })
            }
          />
        </>
      )}
    </>
  );
}
