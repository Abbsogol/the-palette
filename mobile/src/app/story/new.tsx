import { RequireAuth } from "../../components/ui";
import { ConnectedComposer } from "../../features/social/connected-composer";
export default function NewStory() {
  return (
    <RequireAuth>
      <ConnectedComposer kind="story" />
    </RequireAuth>
  );
}
