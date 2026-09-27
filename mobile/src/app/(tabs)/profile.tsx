import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import {
  Button,
  Card,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
} from "../../components/ui";
import { useProfile, signOut } from "../../lib/auth";
function Profile() {
  const query = useProfile();
  const [error, setError] = useState("");
  const creator = query.data && query.data.account_type !== "user";
  const links: [string, Href][] = [
    ["Edit profile", "/profile-edit"],
    ["Saved designs", "/saved"],
    ["Collections", "/collections"],
    ["Appointments", "/appointments"],
    ["Credits & subscription", "/billing"],
    ["Notifications", "/notifications"],
    ["Privacy & safety", "/privacy"],
    ...(creator
      ? ([
          ["My portfolio", "/portfolio"],
          ["My services", "/services"],
          ["Working hours", "/availability"],
        ] as [string, Href][])
      : []),
    ["Delete account", "/delete-account"],
  ];
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    >
      <Card>
        <Text style={styles.title}>
          {query.data?.display_name || "Your profile"}
        </Text>
        <Text style={styles.muted}>
          {query.data?.account_type === "user" ? "Customer" : "Creator"} ·{" "}
          {query.data?.location}
        </Text>
        <Text style={styles.text}>{query.data?.bio}</Text>
        <Text style={styles.text}>
          {query.data?.credit_balance ?? 0} credits
        </Text>
      </Card>
      {!query.data?.onboarding_complete && (
        <Button
          title="Finish onboarding"
          onPress={() => router.push("/onboarding")}
        />
      )}
      <View style={{ gap: 12 }}>
        {links.map(([title, path]) => (
          <Button
            key={title}
            title={title}
            secondary
            onPress={() => router.push(path)}
          />
        ))}
      </View>
      {!creator && (
        <Button
          title="Become a creator"
          onPress={() => router.push("/creator-onboarding")}
        />
      )}
      <Button
        title="Sign out"
        secondary
        onPress={() =>
          Alert.alert(
            "Sign out?",
            "Your private data will be cleared from this app.",
            [
              { text: "Stay", style: "cancel" },
              {
                text: "Sign out",
                onPress: () =>
                  void signOut()
                    .then(() => router.replace("/"))
                    .catch((e) => setError(e.message)),
              },
            ],
          )
        }
      />
      {error && <Notice error>{error}</Notice>}
    </QueryState>
  );
}
export default function ProfileScreen() {
  return (
    <Screen title="Profile">
      <RequireAuth>
        <Profile />
      </RequireAuth>
    </Screen>
  );
}
