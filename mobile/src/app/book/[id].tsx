import { useLocalSearchParams } from "expo-router";
import { RequireAuth } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { BookingScreen } from "../../features/booking/booking-screen";
export default function BookScreen() {
  const { id, designId, rescheduledFrom } = useLocalSearchParams<{
    id: string;
    designId?: string;
    rescheduledFrom?: string;
  }>();
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      {session && (
        <BookingScreen
          key={`${epoch}:${id}`}
          id={id || ""}
          userId={session.user.id}
          designId={designId}
          rescheduledFrom={rescheduledFrom}
        />
      )}
    </RequireAuth>
  );
}
