import { RequireAuth } from "../../components/ui";
import { Inbox } from "../../features/inbox";
export default function Messages() {
  return (
    <RequireAuth>
      <Inbox />
    </RequireAuth>
  );
}
