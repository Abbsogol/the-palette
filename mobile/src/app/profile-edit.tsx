import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { QueryState, RequireAuth } from "../components/ui";
import { useProfile, useAuth, queryClient } from "../lib/auth";
import { chooseAndUpload } from "../lib/upload";
import { api } from "../lib/api";
import { accountScope } from "../lib/account-scope";
import { Button, Notice, Screen } from "../features/secondary/primitives";
import { ProfileForm } from "../features/secondary/profile-form";
import { useProfileExit } from "../features/secondary/profile-exit";
function Edit() {
  const query = useProfile(),
    p = query.data;
  const { session } = useAuth();
  const navigation = useNavigation();
  const exit = useProfileExit();
  usePreventRemove(
    !!session && (exit.status.dirty || exit.status.busy),
    ({ data }) => exit.requestExit(() => navigation.dispatch(data.action)),
  );
  return (
    <Screen onBack={() => router.back()} title="Edit profile">
      <QueryState
        loading={query.isPending}
        error={p ? null : query.error}
        retry={() => void query.refetch()}
      >
        {!!p && !!query.error && (
          <>
            <Notice error>
              Couldn’t refresh your saved profile. Your edits are still here.
            </Notice>
            <Button
              title="Retry profile refresh"
              secondary
              onPress={() => void query.refetch()}
            />
          </>
        )}
        {p && (
          <ProfileForm
            key={p.id}
            onStatusChange={exit.onStatusChange}
            avatar={p.avatar_url}
            banner={p.banner_url}
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
              location: p.location || "",
              bio: p.bio || "",
              booking_area: p.booking_area || "",
              specialties: p.specialties || [],
              role: p.account_type === "user" ? "Customer" : "Creator",
            }}
            onSave={async ({ role: _role, ...fields }) => {
              const ticket = accountScope.capture();
              await api("/update-profile", {
                ...fields,
                username: fields.username || null,
              });
              accountScope.assert(ticket);
              await queryClient.invalidateQueries();
              accountScope.assert(ticket);
            }}
          />
        )}
      </QueryState>
      {exit.dialog}
    </Screen>
  );
}
export default function EditProfile() {
  return (
    <RequireAuth>
      <Edit />
    </RequireAuth>
  );
}
