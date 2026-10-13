import { usePreviewMessages } from "./message-store";
// Figma contact samples only; never sends real messages or writes to Supabase.
import { useState } from "react";
import { View } from "react-native";
import { MessagesView } from "../features/messages-ui/messages-view";
import type { MessageContact } from "../features/messages-ui/model";
import { ChatPreview } from "./chat";
import { demoContacts } from "./message-fixtures";
export default function MessagesPreview({
  width,
  onFind,
  onChatOpenChange,
}: {
  width: number;
  onFind: () => void;
  onChatOpenChange?: (open: boolean) => void;
}) {
  const store = usePreviewMessages();
  const byId = new Map(demoContacts.map((c) => [c.id, c]));
  for (const { contact, message } of store?.deliveries || [])
    byId.set(contact.id, {
      ...contact,
      lastMessage: "You: Shared a design",
      lastMessageAt: message.createdAt,
      unread: false,
    });
  const contacts = [...byId.values()].sort(
    (a, b) =>
      Date.parse(b.lastMessageAt || "") - Date.parse(a.lastMessageAt || ""),
  );
  const [selected, setSelected] = useState<MessageContact>();
  if (selected)
    return (
      <ChatPreview
        key={selected.id}
        width={width}
        contact={selected}
        onBack={() => {
          setSelected(undefined);
          onChatOpenChange?.(false);
        }}
      />
    );
  return (
    <View style={{ flex: 1 }}>
      <MessagesView
        width={width}
        contacts={contacts}
        onOpen={(id) => {
          setSelected(contacts.find((c) => c.id === id));
          onChatOpenChange?.(true);
        }}
        onRefresh={() => undefined}
        onMore={() => undefined}
        onFind={onFind}
      />
    </View>
  );
}
