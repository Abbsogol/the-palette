import { useLocalSearchParams } from "expo-router";
import { RequireAuth } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { AppointmentScreen } from "../../features/booking/appointment-screen";
export default function BookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      {session && (
        <AppointmentScreen
          key={`${epoch}:${id}`}
          id={id || ""}
          userId={session.user.id}
        />
      )}
    </RequireAuth>
  );
}
