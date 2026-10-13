import { useLocalSearchParams } from "expo-router";
import { RequireAuth } from "../components/ui";
import { ShareDesignScreen } from "../features/messages-ui/share-screen";
export default function ShareDesign() {
  const { designId } = useLocalSearchParams<{ designId: string }>();
  return (
    <RequireAuth>
      <ShareDesignScreen
        key={designId}
        designId={typeof designId === "string" ? designId : ""}
      />
    </RequireAuth>
  );
}
