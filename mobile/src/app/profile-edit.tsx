import { useState } from "react";
import { router } from "expo-router";
import {
  Button,
  Field,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
} from "../components/ui";
import { useProfile, queryClient } from "../lib/auth";
import { api } from "../lib/api";
import type { Profile } from "../lib/types";
function Form({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.display_name || ""),
    [username, setUsername] = useState(profile.username || ""),
    [location, setLocation] = useState(profile.location || ""),
    [bio, setBio] = useState(profile.bio || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    try {
      if (!name.trim()) throw new Error("Enter your display name.");
      await api("/update-profile", {
        display_name: name.trim(),
        username: username.trim() || null,
        location: location.trim(),
        bio: bio.trim(),
      });
      await queryClient.invalidateQueries();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Field
        label="Display name"
        value={name}
        onChangeText={setName}
        maxLength={80}
      />
      <Field
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        maxLength={40}
      />
      <Field
        label="Location / service area"
        value={location}
        onChangeText={setLocation}
        maxLength={160}
      />
      <Field
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={1000}
      />
      <Button title="Save changes" busy={busy} onPress={() => void save()} />
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
function Edit() {
  const query = useProfile();
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    >
      {query.data && <Form profile={query.data} />}
    </QueryState>
  );
}
export default function EditProfile() {
  return (
    <Screen title="Edit profile" back>
      <RequireAuth>
        <Edit />
      </RequireAuth>
    </Screen>
  );
}
