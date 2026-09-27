import { RequireAuth, Screen } from "../../components/ui";
import { Inbox } from "../../features/inbox";
export default function Messages() {
  return (
    <Screen title="Messages">
      <RequireAuth>
        <Inbox />
      </RequireAuth>
    </Screen>
  );
}
