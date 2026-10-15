import { RequireAuth } from "../components/ui";
import { CalendarScreen } from "../features/calendar/calendar-screen";
export default function CalendarConnection() {
  return (
    <RequireAuth>
      <CalendarScreen />
    </RequireAuth>
  );
}
