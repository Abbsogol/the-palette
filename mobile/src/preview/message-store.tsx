// Demo-only deliveries live for this preview session and never reach real accounts.
import {
  createContext,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { ChatMessage } from "../features/chat/model";
import type {
  SharedDesign,
  ShareRecipient,
} from "../features/messages-ui/model";
type Delivery = { contact: ShareRecipient; message: ChatMessage };
const Context = createContext<{
  deliveries: Delivery[];
  share: (contact: ShareRecipient, design: SharedDesign) => void;
} | null>(null);
export function PreviewMessagesProvider({ children }: PropsWithChildren) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const sequence = useRef(0);
  return (
    <Context.Provider
      value={{
        deliveries,
        share: (contact, design) => {
          const message: ChatMessage = {
            id: `preview-share-${++sequence.current}`,
            own: true,
            text: "Shared a design",
            createdAt: new Date().toISOString(),
            demo: true,
            design: { ...design, metadata: design.metadata || "" },
          };
          setDeliveries((current) => [...current, { contact, message }]);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreviewMessages() {
  return useContext(Context);
}
