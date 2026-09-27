import { useLocalSearchParams } from "expo-router";
import { RequireAuth, Screen } from "../components/ui";
import { Inbox } from "../features/inbox";
export default function ShareDesign() {
  const { designId } = useLocalSearchParams<{ designId: string }>();
  return (
    <Screen title="Share design" back>
      <RequireAuth>
        <Inbox designId={designId} />
      </RequireAuth>
    </Screen>
  );
}
