import { RequireAuth } from "../../components/ui";
import { ConnectedComposer } from "../../features/social/connected-composer";
export default function NewPost() {
  return (
    <RequireAuth>
      <ConnectedComposer kind="post" />
    </RequireAuth>
  );
}
