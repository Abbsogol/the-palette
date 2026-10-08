import { useLocalSearchParams } from "expo-router";
import { RequireAuth } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { ChatScreen } from "../../features/chat/chat-screen";
export default function ConversationScreen() {
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  const { session, epoch } = useAuth();
  return (
    <RequireAuth>
      {session && (
        <ChatScreen
          key={`${epoch}:${id}`}
          id={id || ""}
          initialDraft={draft}
          userId={session.user.id}
        />
      )}
    </RequireAuth>
  );
}
