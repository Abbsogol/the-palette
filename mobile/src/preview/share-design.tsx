import { usePreviewMessages } from "./message-store";
import { useState } from "react";
import { ShareDesignView } from "../features/messages-ui/share-view";
import {
  filterContacts,
  type ShareRecipient,
  type SharedDesign,
} from "../features/messages-ui/model";
import { ChatPreview } from "./chat";
import { demoContacts, demoDiscover } from "./message-fixtures";
export function ShareDesignPreview({
  design,
  width,
  onBack,
}: {
  design: SharedDesign;
  width: number;
  onBack: () => void;
}) {
  const messages = usePreviewMessages();
  const [source, setSource] = useState<"recent" | "discover">("recent"),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ShareRecipient>(),
    [sent, setSent] = useState(false),
    [chat, setChat] = useState(false);
  if (chat && selected)
    return (
      <ChatPreview
        width={width}
        contact={selected}
        initialSharedDesign={messages ? undefined : design}
        onBack={() => setChat(false)}
      />
    );
  const recipients =
    source === "recent"
      ? demoContacts
      : (filterContacts(
          demoDiscover,
          search,
          "All contacts",
        ) as ShareRecipient[]);
  return (
    <ShareDesignView
      width={width}
      design={design}
      recipients={recipients}
      selected={selected}
      source={source}
      search={search}
      preview
      sent={sent}
      onBack={onBack}
      onSearch={setSearch}
      onSource={(value) => {
        setSource(value);
        setSearch("");
      }}
      onSelect={setSelected}
      onSend={() => {
        if (selected && !sent) {
          messages?.share(selected, design);
          setSent(true);
        }
      }}
      onRetry={() => undefined}
      onMore={() => undefined}
      onOpenChat={() => setChat(true)}
    />
  );
}
