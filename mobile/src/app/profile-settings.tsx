import { useState } from "react";
import { Alert, Linking } from "react-native";
import { router, type Href } from "expo-router";
import { RequireAuth } from "../components/ui";
import { HomeNavigation } from "../components/home-tab-bar";
import { useProfile, signOut } from "../lib/auth";
import {
  ProfileSettingsView,
  ProfileShell,
} from "../features/profiles/profile-view";
import { profileAssets as a } from "../features/profiles/assets";
function Settings() {
  const query = useProfile(),
    [busy, setBusy] = useState(false);
  const link = (title: string, icon: number, path: Href) => ({
    title,
    icon,
    onPress: () => router.push(path),
  });
  const items = [
    link("Edit Profile", a.account, "/profile-edit"),
    link(query.data?.account_type === "user" ? "Become a Creator" : "Creator Studio", a.folder, "/creator-onboarding"),
    link("Booking History", a.calendar, "/appointments"),
    link("Google Calendar", a.calendar, "/calendar-connect"),
    link("Nail Lab History", a.credits, "/generation-history"),
    link("Notifications", a.notifications, "/notifications"),
    link("Privacy & Safety", a.safety, "/privacy"),
    link("Lab Subscription & Tokens", a.credits, "/billing"),
    link("Delete Account", a.safety, "/delete-account"),
    {
      title: "Help & Support",
      icon: a.help,
      onPress: () =>
        void Linking.openURL("https://www.laque.app/help").catch(() =>
          Alert.alert("Support", "Contact contact@laque.app for help."),
        ),
    },
  ];
  const moreItems = [
    ...(query.data?.account_type && query.data.account_type !== "user"
      ? [
          link("My Portfolio", a.folder, "/portfolio"),
          link("My Services", a.calendar, "/services"),
          link("Working Hours", a.clock, "/availability"),
        ]
      : [link("Become a Creator", a.credits, "/creator-onboarding")]),
    {
      title: busy ? "Signing out…" : "Sign out",
      disabled: busy,
      icon: a.account,
      onPress: () => {
        if (busy) return;
        Alert.alert(
          "Sign out?",
          "Your private data will be cleared from this app.",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Sign out",
              onPress: () => {
                setBusy(true);
                void signOut()
                  .then(() => router.replace("/"))
                  .catch((e) => {
                    setBusy(false);
                    Alert.alert("Could not sign out", e.message);
                  });
              },
            },
          ],
        );
      },
    },
  ];
  return (
    <ProfileShell>
      <ProfileSettingsView
        onBack={() => router.back()}
        items={items}
        moreItems={moreItems}
      />
      <HomeNavigation
        selected="profile"
        onSelect={(name) =>
          router.replace((name === "index" ? "/" : `/${name}`) as Href)
        }
      />
    </ProfileShell>
  );
}
export default function ProfileSettings() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}
