import { useCallback, useEffect, useRef, useState } from "react";
import { router, type Href } from "expo-router";
import { RequireAuth, QueryState } from "../components/ui";
import {
  Screen,
  Notice,
  Button,
  styles,
} from "../features/secondary/primitives";
import { Text } from "react-native";
import type { ProfileProgress } from "../features/secondary/profile-form";
import { CompleteProfile } from "../features/onboarding/complete-profile";
import {
  loadProgress,
  saveProgress,
  clearProgress,
} from "../features/onboarding/progress";
import { chooseAndUpload } from "../lib/upload";
import { resolvePrivateImage } from "../lib/designs";
import { api } from "../lib/api";
import { queryClient, useProfile } from "../lib/auth";
import { accountScope } from "../lib/account-scope";
import { safeReturnPath } from "../lib/links";
import { secureStorage } from "../lib/secure-storage";
function Form() {
  const query = useProfile();
  const [setup, setSetup] = useState<{
    intent: string | null;
    progress: ProfileProgress | null;
    avatar?: string | null;
    banner?: string | null;
    mediaError?: boolean;
  } | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState(""),
    [saveError, setSaveError] = useState("");
  const [done, setDone] = useState(false);
  const mounted = useRef(true);
  const revision = useRef(0),
    finished = useRef(false),
    latest = useRef<ProfileProgress | null>(null);
  useEffect(() => {
    let active = true;
    const ticket = accountScope.capture();
    mounted.current = true;
    void (async () => {
      const [intent, progress] = await Promise.all([
        secureStorage.getItem("laque.auth-intent"),
        loadProgress(ticket),
      ]);
      accountScope.assert(ticket);
      const [avatar, banner] = await Promise.all([
        resolvePrivateImage(progress?.draft.avatar_url ?? null).catch(
          () => null,
        ),
        resolvePrivateImage(progress?.draft.banner_url ?? null).catch(
          () => null,
        ),
      ]);
      accountScope.assert(ticket);
      if (active)
        setSetup({
          intent,
          progress,
          avatar,
          banner,
          mediaError: !!(
            (progress?.draft.avatar_url && !avatar) ||
            (progress?.draft.banner_url && !banner)
          ),
        });
    })().catch((e) => {
      if (active && accountScope.isCurrent(ticket))
        setLoadError(
          e instanceof Error ? e : new Error("Saved setup could not load."),
        );
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [attempt]);
  const persist = useCallback((progress: ProfileProgress) => {
    if (finished.current) return;
    latest.current = progress;
    const current = ++revision.current,
      ticket = accountScope.capture();
    setStatus("Saving progress…");
    setSaveError("");
    void saveProgress(progress, ticket)
      .then(() => {
        if (
          mounted.current &&
          current === revision.current &&
          accountScope.isCurrent(ticket)
        )
          setStatus("Progress saved on this device.");
      })
      .catch(() => {
        if (
          mounted.current &&
          current === revision.current &&
          accountScope.isCurrent(ticket)
        ) {
          setStatus("");
          setSaveError(
            "Progress couldn’t be saved on this device. Keep this screen open or retry before leaving.",
          );
        }
      });
  }, []);
  const p = query.data;
  return (
    <QueryState
      loading={query.isPending || (!setup && !loadError)}
      error={query.error || loadError}
      retry={() => {
        setLoadError(null);
        setAttempt((v) => v + 1);
        void query.refetch();
      }}
    >
      {p && setup && (
        <>
          {setup.progress && !p.onboarding_complete && (
            <Notice>
              Your saved setup is restored. Confirm your age and the Privacy
              Policy before finishing.
            </Notice>
          )}
          {!!status && !done && (
            <Text accessibilityLiveRegion="polite" style={styles.small}>
              {status}
            </Text>
          )}
          {!!saveError && !done && (
            <>
              <Notice error>{saveError}</Notice>
              <Button
                title="Retry saving progress"
                secondary
                onPress={() => {
                  if (latest.current) persist(latest.current);
                }}
              />
            </>
          )}
          {setup.mediaError && (
            <Notice error>
              A saved photo is no longer available. Add it again or remove it
              before finishing.
            </Notice>
          )}
          <CompleteProfile
            key={p.id}
            alreadyComplete={p.onboarding_complete}
            initialStep={setup.progress?.step}
            avatar={
              setup.progress && "avatar_url" in setup.progress.draft
                ? setup.avatar
                : p.avatar_url
            }
            banner={
              setup.progress && "banner_url" in setup.progress.draft
                ? setup.banner
                : p.banner_url
            }
            onProgress={persist}
            onPick={async (kind) => {
              const image = await chooseAndUpload(
                kind === "avatar" ? "profile-avatar" : "profile-banner",
              );
              return image
                ? { url: image.privateUrl, preview: image.previewUrl }
                : null;
            }}
            initial={{
              display_name: p.display_name || "",
              username: p.username || "",
              bio: p.bio || "",
              location: p.location || "",
              booking_area: p.booking_area || "",
              specialties: p.specialties || [],
              role:
                setup.intent === "/creator-onboarding" ||
                p.account_type !== "user"
                  ? "Creator"
                  : "Customer",
              ...setup.progress?.draft,
            }}
            onSave={async ({ role, ...fields }) => {
              const ticket = accountScope.capture();
              await api("/set-account-type", {
                accountType: role === "Creator" ? "creator" : "user",
                displayName: fields.display_name,
              });
              accountScope.assert(ticket);
              await api("/update-profile", {
                ...fields,
                username: fields.username || null,
              });
              accountScope.assert(ticket);
              await api("/complete-onboarding", {
                age_confirmed: fields.age_confirmed,
                privacy_accepted: fields.privacy_accepted,
                display_name: fields.display_name,
                bio: fields.bio,
                location: fields.location,
                specialties: fields.specialties,
              });
              accountScope.assert(ticket);
              finished.current = true;
              setDone(true);
              revision.current++;
              await queryClient.invalidateQueries();
              accountScope.assert(ticket);
            }}
            onContinue={async (role) => {
              const ticket = accountScope.capture();
              finished.current = true;
              setDone(true);
              revision.current++;
              await clearProgress(ticket);
              await secureStorage.removeItem("laque.auth-intent");
              accountScope.assert(ticket);
              router.replace(
                (role === "Creator" &&
                (!setup.intent || setup.intent === "/creator-onboarding")
                  ? "/creator-onboarding"
                  : safeReturnPath(setup.intent)) as Href,
              );
            }}
          />
        </>
      )}
    </QueryState>
  );
}
export default function Onboarding() {
  return (
    <RequireAuth>
      <Screen title="Complete your profile" back={false}>
        <Form />
      </Screen>
    </RequireAuth>
  );
}
