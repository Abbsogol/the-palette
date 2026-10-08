import { RequireAuth } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { ProfileScreen } from "../../features/profiles/profile-screen";
export default function OwnerProfile() {
  const { session } = useAuth();
  return (
    <RequireAuth>
      {session && (
        <ProfileScreen key={session.user.id} id={session.user.id} owner />
      )}
    </RequireAuth>
  );
}
