import { useLocalSearchParams } from "expo-router";
import { ProfileScreen } from "../../features/profiles/profile-screen";
export default function PublicProfile() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  return (
    <ProfileScreen
      key={`${id}:${tab || ""}`}
      id={id || ""}
      initialTab={tab === "Services" ? "Services" : undefined}
    />
  );
}
